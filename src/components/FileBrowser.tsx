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
      <h1 className="text-4xl font-black text-gray-900 mb-8 capitalize tracking-tight">Select a Directory</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {directories.map((dir) => (
          <Link
            key={dir.name}
            href={`/player/${encodeURIComponent(dir.name)}`}
            className="group p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors">{dir.name}</h3>
                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mt-1">Directory</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default FileBrowser;
