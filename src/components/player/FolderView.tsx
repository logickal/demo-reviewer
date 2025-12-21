'use client';

import Link from 'next/link';

import type { FileItem } from './types';

interface FolderViewProps {
  folderPath: string;
  directories: FileItem[];
  isGuest: boolean;
  onShare: () => Promise<void> | void;
  isShareLoading: boolean;
  shareSuccess: boolean;
  token: string | null;
}

const FolderView = ({
  folderPath,
  directories,
  isGuest,
  onShare,
  isShareLoading,
  shareSuccess,
  token,
}: FolderViewProps) => {
  const shareLabel = shareSuccess ? 'Copied!' : 'Share Folder';
  const tokenSuffix = token ? `?token=${token}` : '';

  return (
    <main className="flex min-h-screen flex-col items-center p-24 bg-gray-50">
      <div className="z-10 w-full max-w-5xl">
        <div className="mb-8 flex justify-between items-start">
          <div>
            {!isGuest && (
              <Link
                href={folderPath.includes('/') ? `/player/${folderPath.split('/').slice(0, -1).join('/')}` : '/'}
                className="text-blue-500 mb-4 hover:underline flex items-center gap-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Root
              </Link>
            )}
            <h1 className="text-4xl font-black text-gray-900 capitalize tracking-tight">
              {folderPath.split('/').pop()?.replace(/-/g, ' ')}
            </h1>
          </div>

          {!isGuest && (
            <button
              onClick={onShare}
              disabled={isShareLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-medium ${
                shareSuccess
                  ? 'bg-green-50 border-green-200 text-green-600'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-orange-200 hover:bg-orange-50'
              }`}
            >
              {isShareLoading ? (
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
              ) : (
                shareLabel
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {directories.length === 0 ? (
            <div className="col-span-full p-12 bg-white rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">
              No subdirectories or audio files found.
            </div>
          ) : (
            directories.map((dir) => (
              <Link
                key={dir.name}
                href={`/player/${folderPath}/${dir.name}${tokenSuffix}`}
                className="group p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors">{dir.name}</h3>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mt-1">Directory</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </main>
  );
};

export default FolderView;
