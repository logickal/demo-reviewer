// src/components/FileBrowser.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface FileItem {
  name: string;
  type: 'file' | 'directory';
}

const FileBrowser = () => {
  const [directories, setDirectories] = useState<FileItem[]>([]);

  useEffect(() => {
    fetch(`/api/files`)
      .then((res) => res.json())
      .then((data) => {
        setDirectories(data.files.filter((item: FileItem) => item.type === 'directory'));
      });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Select a Directory</h1>
      <ul>
        {directories.map((dir) => (
          <li key={dir.name} className="mb-2">
            <Link href={`/player/${dir.name}`} className="text-blue-500 text-xl">
              {dir.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FileBrowser;
