# Demo Reviewer

A Next.js App Router project for reviewing audio directories with track playback, waveform previews, comments, and running order management. Audio assets and metadata live in Google Cloud Storage (GCS); the app reads track data and comments from JSON files stored alongside the audio.

## Requirements
- Node.js 20+
- GCS access (see Environment Variables)
- ffmpeg + ffprobe for local metadata pre-generation (required for the CLI script)

## Environment Variables
Set these in `.env.local` for development:
- `APP_PASSPHRASE`: login passphrase
- `SHARE_SECRET`: secret used to generate share links
- `GCS_BUCKET_NAME`: target GCS bucket
- `GCS_CREDENTIALS_JSON`: service account JSON for GCS access
- `NEXT_PUBLIC_BASE_URL`: public base URL for share links

## Development
```bash
npm install
npm run dev
```
Open `http://localhost:3000`.

Other useful commands:
- `npm run build`: production build
- `npm run start`: run production server
- `npm run lint`: ESLint checks
- `npm run type-check`: TypeScript type checks

## Local Track Data Pre-Generation
To avoid server-side bandwidth and ensure running order totals are ready on first load, generate `.track-data.v2.json` files locally before uploading to GCS.

```bash
npm run precompute-track-data -- --input /path/to/local/folder
```

Options:
- `--scale 256` (default 256)
- `--overwrite` (regenerate existing metadata)
- `--no-running-order` (skip `running-order.v2.json`)

Outputs:
- `*.track-data.v2.json` next to each audio file
- `running-order.v2.json` in each folder with audio

Notes:
- Requires `ffmpeg` and `ffprobe` available on your PATH.

## Project Structure
- `src/app/`: route segments, layouts, and API routes
- `src/components/`: UI components and player logic
- `src/lib/`: storage + auth helpers
- `scripts/`: local utilities (precompute script lives here)
- `public/`: static assets

## Deployment Notes
This app serves audio via GCS signed URLs. Ensure the bucket CORS policy allows the app origin(s) you plan to use.

Example CORS config (allow local dev + production):
```json
[
  {
    "origin": ["http://localhost:3000", "https://funkconsultant.offnominal.com"],
    "method": ["GET", "HEAD", "OPTIONS"],
    "responseHeader": ["Content-Type", "Content-Length", "Accept-Ranges"],
    "maxAgeSeconds": 3600
  }
]
```
