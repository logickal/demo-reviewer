// src/app/page.tsx
import FileBrowser from '@/components/FileBrowser';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <div className="z-10 w-full max-w-5xl">
        <FileBrowser />
      </div>
    </main>
  );
}
