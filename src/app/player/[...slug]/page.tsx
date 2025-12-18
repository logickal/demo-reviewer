// src/app/player/[...slug]/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, OnDragEndResponder } from '@hello-pangea/dnd';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useWavesurfer } from '@wavesurfer/react';
import WaveSurfer from 'wavesurfer.js';

interface FileItem {
  name: string;
  type: 'file' | 'directory';
}

interface Comment {
  timestamp: number;
  text: string;
  initials: string;
}

// Helper function to format time (e.g., 00:00.00)
const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds - Math.floor(seconds)) * 100); // two decimal places
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
};

export default function PlayerPage() {
  const params = useParams();
  const slug = params.slug as string[];
  const [playlist, setPlaylist] = useState<FileItem[]>([]);
  const [directories, setDirectories] = useState<FileItem[]>([]);
  const [isFolderView, setIsFolderView] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<FileItem | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newCommentInitials, setNewCommentInitials] = useState('');
  const [newCommentTimestamp, setNewCommentTimestamp] = useState<number | null>(null);
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [hoveredCommentTimestamp, setHoveredCommentTimestamp] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [isShareLoading, setIsShareLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const folderPath = slug.join('/');
  const runningOrderPath = `${folderPath}/running-order.json`;

  // Derived state for current comment path
  const commentsPath = currentTrack ? `${folderPath}/${currentTrack.name}.comments.json` : null;

  const autoplayRef = useRef(isAutoplay);
  autoplayRef.current = isAutoplay;
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;

  const isGuest = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('token');
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    height: 100,
    waveColor: 'rgb(200, 200, 200)',
    progressColor: 'rgb(255, 85, 0)', // SoundCloud orange-ish
    url: currentTrack ? `/api/audio?path=${folderPath}/${currentTrack.name}` : undefined,
  });

  useEffect(() => {
    if (wavesurfer) {
      const onEnd = () => {
        if (autoplayRef.current) {
          const currentIndex = playlistRef.current.findIndex(t => t.name === currentTrackRef.current?.name);
          if (currentIndex < playlistRef.current.length - 1) {
            setCurrentTrack(playlistRef.current[currentIndex + 1]);
          } else {
            setIsAutoplay(false);
          }
        }
      };

      const onReady = () => setDuration(wavesurfer.getDuration());
      wavesurfer.on('finish', onEnd);
      wavesurfer.on('ready', onReady);
      wavesurfer.on('decode', onReady);

      return () => {
        wavesurfer.un('finish', onEnd);
        wavesurfer.un('ready', onReady);
        wavesurfer.un('decode', onReady);
      }
    }
  }, [wavesurfer]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/files?path=${folderPath}`).then(res => res.json()) as Promise<{ files: FileItem[] }>,
      fetch(`/api/running-order?path=${runningOrderPath}`).then(res => res.ok ? res.json() : null) as Promise<{ playlist: string[] } | null>
    ]).then(([filesData, orderData]) => {
      const allFiles = filesData.files || [];
      const audioFiles = allFiles.filter(f => f.type === 'file' && f.name.match(/\.(mp3|wav|ogg)$/i));
      const subDirectories = allFiles.filter(f => f.type === 'directory');

      if (audioFiles.length > 0) {
        setIsFolderView(false);
        let pl = audioFiles;
        if (orderData && orderData.playlist) {
          const orderedNames = orderData.playlist;
          const fileMap = new Map(audioFiles.map((f: FileItem) => [f.name, f]));
          const orderedPlaylist = orderedNames.map((name: string) => fileMap.get(name)).filter((item): item is FileItem => !!item);
          const newFiles = audioFiles.filter((f: FileItem) => !orderedNames.includes(f.name));
          pl = [...orderedPlaylist, ...newFiles];
        }
        setPlaylist(pl);
        if (pl.length > 0) setCurrentTrack(pl[0]);
      } else {
        setIsFolderView(true);
        setDirectories(subDirectories);
      }
      setIsLoading(false);
    });
  }, [folderPath, runningOrderPath]);

  useEffect(() => {
    if (!commentsPath) {
      setComments([]);
      return;
    }
    setComments([]);
    fetch(`/api/comments?path=${commentsPath}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.comments) setComments(data.comments);
      });
  }, [commentsPath]);

  const onDragEnd: OnDragEndResponder = (result) => {
    if (!result.destination || isGuest) return;
    const items = Array.from(playlist);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setPlaylist(items);
    saveRunningOrder(items);
  };

  const saveRunningOrder = (currentPlaylist: FileItem[]) => {
    fetch(`/api/running-order?path=${runningOrderPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlist: currentPlaylist.map(f => f.name) }),
    });
  };

  const handleAddComment = () => {
    if (newComment.trim() && newCommentInitials.trim() && newCommentTimestamp !== null && commentsPath) {
      const newCommentData = { timestamp: newCommentTimestamp, text: newComment, initials: newCommentInitials };
      const newComments: Comment[] = [...comments, newCommentData];
      setComments(newComments);
      setNewComment('');
      setNewCommentInitials('');
      setNewCommentTimestamp(null);
      fetch(`/api/comments?path=${commentsPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: newComments }),
      });
    }
  };

  const onPlayPause = () => wavesurfer && wavesurfer.playPause();

  const toggleAutoplay = () => {
    setIsAutoplay(!isAutoplay);
    if (!isAutoplay && !isPlaying && playlist.length > 0) {
      setCurrentTrack(currentTrack || playlist[0]);
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !wavesurfer) return;
    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const time = ratio * wavesurfer.getDuration();
    if ((e.target as HTMLElement).closest('.comment-marker')) return;
    setNewCommentTimestamp(time);
  };

  const handleShare = async () => {
    setIsShareLoading(true);
    setShareSuccess(false);
    try {
      const res = await fetch(`/api/share?slug=${encodeURIComponent(folderPath)}`);
      const data = await res.json();
      if (data.shareUrl) {
        await navigator.clipboard.writeText(data.shareUrl);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to share:', err);
    } finally {
      setIsShareLoading(false);
    }
  };

  if (!isClient || isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin"></div>
          <div className="text-xl font-bold text-gray-400">Loading...</div>
        </div>
      </main>
    )
  }

  if (isFolderView) {
    return (
      <main className="flex min-h-screen flex-col items-center p-24 bg-gray-50">
        <div className="z-10 w-full max-w-5xl">
          <div className="mb-8 flex justify-between items-start">
            <div>
              {!isGuest && (
                <Link href={folderPath.includes('/') ? `/player/${folderPath.split('/').slice(0, -1).join('/')}` : '/'} className="text-blue-500 mb-4 block hover:underline flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Root
                </Link>
              )}
              <h1 className="text-4xl font-black text-gray-900 capitalize tracking-tight">{folderPath.split('/').pop()?.replace(/-/g, ' ')}</h1>
            </div>

            {!isGuest && (
              <button
                onClick={handleShare}
                disabled={isShareLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-medium ${shareSuccess ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-gray-200 text-gray-700 hover:border-orange-200 hover:bg-orange-50'}`}
              >
                {isShareLoading ? <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div> : shareSuccess ? "Copied!" : "Share Folder"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {directories.length === 0 ? (
              <div className="col-span-full p-12 bg-white rounded-3xl border border-dashed border-gray-200 text-center text-gray-400">No subdirectories or audio files found.</div>
            ) : (
              directories.map((dir) => (
                <Link key={dir.name} href={`/player/${folderPath}/${dir.name}${isGuest ? `?token=${new URLSearchParams(window.location.search).get('token')}` : ''}`} className="group p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
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
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-24 bg-gray-50">
      <div className="z-10 w-full max-w-5xl">
        <div className="mb-8 flex justify-between items-start">
          <div>
            {!isGuest && (
              <Link href={folderPath.includes('/') ? `/player/${folderPath.split('/').slice(0, -1).join('/')}` : '/'} className="text-blue-500 mb-4 block hover:underline flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Directories
              </Link>
            )}
            <h1 className="text-4xl font-black text-gray-900 capitalize tracking-tight">{folderPath.split('/').pop()?.replace(/-/g, ' ')}</h1>
          </div>

          {!isGuest && (
            <button
              onClick={handleShare}
              disabled={isShareLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-medium ${shareSuccess ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-gray-200 text-gray-700 hover:border-orange-200 hover:bg-orange-50'}`}
            >
              {isShareLoading ? <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div> : shareSuccess ? "Copied!" : "Share Player"}
            </button>
          )}
        </div>

        <div className="mb-8 p-6 border-0 rounded-3xl bg-white shadow-xl shadow-gray-200/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-orange-500">Currently Playing</h2>
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${isAutoplay ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>Autoplay {isAutoplay ? 'ON' : 'OFF'}</div>
          </div>

          <div className="relative w-full h-[180px] bg-gray-50 mb-6 rounded-2xl border border-gray-100 overflow-hidden" onClick={handleWaveformClick}>
            <div ref={containerRef} className="absolute inset-0 z-10 cursor-pointer opacity-90 hover:opacity-100 transition-opacity" />
            {duration > 0 && (
              <div className="absolute inset-0 z-20 pointer-events-none">
                {comments.map((comment, index) => {
                  const leftPercent = (comment.timestamp / duration) * 100;
                  const isHovered = hoveredCommentTimestamp === comment.timestamp;
                  return (
                    <div key={index} className="absolute top-0 bottom-0 flex flex-col items-center justify-end transform -translate-x-1/2" style={{ left: `${leftPercent}%` }}>
                      <div className={`w-0.5 grow mb-0.5 transition-colors duration-200 ${isHovered ? 'bg-orange-500' : 'bg-orange-300/40'}`} />
                      <div className="comment-marker pointer-events-auto group relative" onMouseEnter={() => setHoveredCommentTimestamp(comment.timestamp)} onMouseLeave={() => setHoveredCommentTimestamp(null)}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm cursor-pointer transition-transform hover:scale-125 ${isHovered ? 'bg-orange-500 text-white z-50' : 'bg-white text-gray-600 border-gray-100'}`}>{comment.initials.substring(0, 2).toUpperCase()}</div>
                        <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-md text-white text-xs p-3 rounded-xl whitespace-nowrap z-50 shadow-2xl">
                          <div className="font-bold mb-1 text-orange-400">{formatTime(comment.timestamp)}</div>
                          <div className="max-w-[200px] whitespace-normal leading-relaxed">{comment.text}</div>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-gray-900/95"></div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {newCommentTimestamp !== null && duration > 0 && (
              <div className="absolute z-30 bg-white p-4 rounded-2xl shadow-2xl border border-gray-100 w-72 text-sm animate-in fade-in zoom-in duration-200" style={{ left: `${Math.min(Math.max((newCommentTimestamp / duration) * 100, 10), 90)}%`, top: '50%', transform: 'translate(-50%, -50%)' }} onClick={(e) => e.stopPropagation()}>
                <div className="font-bold mb-3 text-gray-900 flex items-center justify-between">
                  <span>Add comment</span>
                  <span className="text-orange-500 font-mono text-xs bg-orange-50 px-2 py-0.5 rounded-full">{formatTime(newCommentTimestamp)}</span>
                </div>
                <input autoFocus type="text" value={newCommentInitials} onChange={(e) => setNewCommentInitials(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition-all mb-3 text-xs" placeholder="Initials (e.g. JD)" maxLength={3} />
                <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition-all mb-4 text-xs resize-none" placeholder="What do you think?" rows={3} />
                <div className="flex justify-between items-center">
                  <button onClick={() => setNewCommentTimestamp(null)} className="text-gray-400 text-xs hover:text-gray-600 font-medium transition-colors">Cancel</button>
                  <button onClick={handleAddComment} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-orange-600 shadow-md shadow-orange-100 transition-all active:scale-95">Post Comment</button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <button onClick={onPlayPause} className="w-16 h-16 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-200 transition-all active:scale-90">
                {isPlaying ? <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>}
              </button>
              <div className="flex flex-col">
                <span className="text-xl font-black text-gray-900 tracking-tight leading-tight">{currentTrack?.name || 'No Track Selected'}</span>
                <span className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1 bg-gray-100 w-fit px-2 py-0.5 rounded leading-none flex items-center gap-1.5"><span className="text-orange-500 inline-block w-1 h-1 rounded-full bg-orange-500"></span>{formatTime(currentTime)} / {formatTime(duration)}</span>
              </div>
            </div>
            <button onClick={toggleAutoplay} className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border ${isAutoplay ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-100' : 'bg-white border-gray-200 text-gray-400 hover:border-orange-200 hover:text-orange-500'}`}>{isAutoplay ? 'Loop On' : 'Loop Off'}</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-black mb-6 text-gray-900 flex items-center gap-2"><span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>Comments</h2>
            <div className="space-y-3">
              {comments.slice().sort((a, b) => a.timestamp - b.timestamp).map((comment, index) => (
                <div key={index} className={`group p-4 rounded-2xl border transition-all flex gap-4 items-start cursor-pointer ${hoveredCommentTimestamp === comment.timestamp ? 'bg-orange-50 border-orange-200 shadow-md' : 'bg-white border-gray-100 hover:border-gray-200'}`} onMouseEnter={() => setHoveredCommentTimestamp(comment.timestamp)} onMouseLeave={() => setHoveredCommentTimestamp(null)}>
                  <div className="shrink-0 w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-black group-hover:bg-orange-500 group-hover:text-white transition-colors">{comment.initials.substring(0, 2).toUpperCase()}</div>
                  <div className="grow">
                    <div className="flex items-center justify-between mb-1"><span className="text-orange-500 font-mono text-xs font-bold bg-orange-50 px-2 py-0.5 rounded-full">{formatTime(comment.timestamp)}</span></div>
                    <p className="text-gray-700 text-sm leading-relaxed">{comment.text}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400 font-medium">No comments yet. Click on the waveform to mark a moment.</div>}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black mb-6 text-gray-900 flex items-center gap-2"><span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>Running Order</h2>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="playlist">
                {(provided) => (
                  <ul {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {playlist.map((item, index) => (
                      <Draggable key={item.name} draggableId={item.name} index={index} isDragDisabled={isGuest}>
                        {(provided) => (
                          <li ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} onClick={() => setCurrentTrack(item)} className={`group p-4 rounded-2xl border cursor-pointer flex items-center gap-4 transition-all ${currentTrack?.name === item.name ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-100' : 'bg-white border-gray-100 hover:border-orange-200 text-gray-900'}`}>
                            <span className={`text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center ${currentTrack?.name === item.name ? 'bg-white/20' : 'bg-gray-50 text-gray-400 group-hover:bg-orange-50 group-hover:text-orange-500'}`}>{index + 1}</span>
                            <span className="font-bold text-sm grow truncate">{item.name}</span>
                            {!isGuest && <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${currentTrack?.name === item.name ? 'text-white/50' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>}
                          </li>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </ul>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </div>
      </div>
    </main>
  );
}