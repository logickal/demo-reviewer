#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const AUDIO_EXTENSIONS = ['.wav', '.mp3', '.ogg'];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    input: '',
    scale: 256,
    overwrite: false,
    runningOrder: true,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--input' || arg === '--dir') {
      options.input = args[i + 1] || '';
      i += 1;
    } else if (arg === '--scale') {
      options.scale = Number(args[i + 1] || '256');
      i += 1;
    } else if (arg === '--overwrite') {
      options.overwrite = true;
    } else if (arg === '--no-running-order') {
      options.runningOrder = false;
    } else if (!arg.startsWith('--') && !options.input) {
      options.input = arg;
    }
  }

  return options;
};

const runCommand = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr.trim() || `Command failed: ${command}`));
      }
    });
  });

const getAudioInfo = async (filePath) => {
  const { stdout } = await runCommand('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'a:0',
    '-show_entries',
    'stream=sample_rate',
    '-of',
    'json',
    filePath,
  ]);

  const data = JSON.parse(stdout);
  const sampleRate = Number(data?.streams?.[0]?.sample_rate || 0);
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error(`Unable to read sample rate for ${filePath}`);
  }

  return { sampleRate };
};

const generateTrackData = async (filePath, scale) =>
  new Promise((resolve, reject) => {
    const peaks = [];
    let sampleCount = 0;
    let windowCount = 0;
    let min = Infinity;
    let max = -Infinity;
    let leftover = Buffer.alloc(0);

    const child = spawn('ffmpeg', [
      '-v',
      'error',
      '-i',
      filePath,
      '-ac',
      '1',
      '-f',
      'f32le',
      '-acodec',
      'pcm_f32le',
      '-',
    ]);

    child.stdout.on('data', (chunk) => {
      const data = leftover.length ? Buffer.concat([leftover, chunk]) : chunk;
      const sampleTotal = Math.floor(data.length / 4);
      const bytesUsed = sampleTotal * 4;

      for (let i = 0; i < sampleTotal; i += 1) {
        const sample = data.readFloatLE(i * 4);
        if (Number.isFinite(sample)) {
          if (sample < min) min = sample;
          if (sample > max) max = sample;
          windowCount += 1;
          sampleCount += 1;
          if (windowCount === scale) {
            peaks.push(Math.max(Math.abs(min), Math.abs(max)));
            windowCount = 0;
            min = Infinity;
            max = -Infinity;
          }
        }
      }

      leftover = data.subarray(bytesUsed);
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed for ${filePath}`));
        return;
      }
      if (windowCount > 0) {
        peaks.push(Math.max(Math.abs(min), Math.abs(max)));
      }
      resolve({ peaks, sampleCount });
    });
  });

const isAudioFile = (name) => AUDIO_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

const walkDirectories = async (rootDir) => {
  const directories = [];

  const walk = async (currentPath) => {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const audioFiles = entries.filter((entry) => entry.isFile() && isAudioFile(entry.name));
    if (audioFiles.length > 0) {
      directories.push({
        dirPath: currentPath,
        files: audioFiles.map((entry) => entry.name),
      });
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await walk(path.join(currentPath, entry.name));
      }
    }
  };

  await walk(rootDir);
  return directories;
};

const writeJsonIfNeeded = async (filePath, data, overwrite) => {
  try {
    if (!overwrite) {
      await fs.access(filePath);
      return false;
    }
  } catch (error) {
    // File doesn't exist; continue.
  }

  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
  return true;
};

const main = async () => {
  const options = parseArgs();
  if (!options.input) {
    console.error(
      'Usage: node scripts/precompute-track-data.mjs --input <directory> [--scale 256] [--overwrite] [--no-running-order]'
    );
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(options.input);
  const stat = await fs.stat(inputPath).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    console.error(`Input path is not a directory: ${inputPath}`);
    process.exitCode = 1;
    return;
  }

  const directories = await walkDirectories(inputPath);
  if (directories.length === 0) {
    console.log('No audio files found.');
    return;
  }

  console.log(`Found ${directories.length} folder(s) with audio files.`);

  for (const { dirPath, files } of directories) {
    console.log(`\nProcessing ${dirPath}`);

    const sortedFiles = [...files].sort((a, b) => a.localeCompare(b));
    for (const name of sortedFiles) {
      const filePath = path.join(dirPath, name);
      const trackDataPath = `${filePath}.track-data.v2.json`;

      try {
        if (!options.overwrite) {
          await fs.access(trackDataPath);
          console.log(`- Skipping existing ${path.basename(trackDataPath)}`);
          continue;
        }
      } catch (error) {
        // Continue to generate.
      }

      console.log(`- Generating ${path.basename(trackDataPath)}`);
      const { sampleRate } = await getAudioInfo(filePath);
      const { peaks, sampleCount } = await generateTrackData(filePath, options.scale);
      const duration = sampleCount / sampleRate;

      const payload = {
        duration,
        peaks,
        sampleRate,
        scale: options.scale,
        generatedAt: new Date().toISOString(),
      };

      await fs.writeFile(trackDataPath, `${JSON.stringify(payload, null, 2)}\n`);
    }

    if (options.runningOrder) {
      const runningOrderPath = path.join(dirPath, 'running-order.v2.json');
      const wrote = await writeJsonIfNeeded(
        runningOrderPath,
        { playlist: sortedFiles },
        options.overwrite
      );
      if (wrote) {
        console.log(`- Wrote ${path.basename(runningOrderPath)}`);
      } else {
        console.log(`- Skipping existing ${path.basename(runningOrderPath)}`);
      }
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
