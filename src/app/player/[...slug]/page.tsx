// src/app/player/[...slug]/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, OnDragEndResponder } from '@hello-pangea/dnd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useWavesurfer } from '@wavesurfer/react';
import WaveSurfer from 'wavesurfer.js';

interface FileItem {
  name: string;
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
  const [currentTrack, setCurrentTrack] = useState<FileItem | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newCommentInitials, setNewCommentInitials] = useState('');
  const [newCommentTimestamp, setNewCommentTimestamp] = useState<number | null>(null);
  const [isAutoplay, setIsAutoplay] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [hoveredCommentTimestamp, setHoveredCommentTimestamp] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const folderPath = slug.join('/');
  const runningOrderPath = `${folderPath}/running-order.json`;
  const commentsPath = `${folderPath}/comments.json`;

  const autoplayRef = useRef(isAutoplay);
  autoplayRef.current = isAutoplay;
  const playlistRef = useRef(playlist);
  playlistRef.current = playlist;
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;
  const commentsRef = useRef(comments);
  commentsRef.current = comments;

  useEffect(() => {
    setIsClient(true);
  }, []);

  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    height: 100,
    waveColor: 'rgb(200, 200, 200)',
    progressColor: 'rgb(255, 85, 0)', // SoundCloud orange-ish
    url: currentTrack ? `/api/audio?path=${folderPath}/${currentTrack.name}` : undefined,
    // persist: true, // removed to fix type error if incompatible
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

      const onReady = () => {
        setDuration(wavesurfer.getDuration());
      };

      const onInteraction = () => {
        // update duration if needed, though usually fixed after load
      }

      wavesurfer.on('finish', onEnd);
      wavesurfer.on('ready', onReady);
      wavesurfer.on('decode', onReady);

      const onClick = (ratio: number) => {
        // managed by container click now
      };

      return () => {
        wavesurfer.un('finish', onEnd);
        wavesurfer.un('ready', onReady);
        wavesurfer.un('decode', onReady);
      }
    }
  }, [wavesurfer]);

  // Data fetching
  useEffect(() => {
    Promise.all([
      fetch(`/api/files?path=${folderPath}`).then(res => res.json()) as Promise<{ files: FileItem[] }>,
      fetch(`/api/running-order?path=${runningOrderPath}`).then(res => res.ok ? res.json() : null) as Promise<{ playlist: string[] } | null>
    ]).then(([filesData, orderData]) => {
      const files = filesData.files;
      let playlist = files;

      if (orderData && orderData.playlist) {
        const orderedNames = orderData.playlist;
        const fileMap = new Map(files.map((f: FileItem) => [f.name, f]));
        const orderedPlaylist = orderedNames.map((name: string) => fileMap.get(name)).filter((item): item is FileItem => !!item);
        const newFiles = files.filter((f: FileItem) => !orderedNames.includes(f.name));
        playlist = [...orderedPlaylist, ...newFiles];
      }

      setPlaylist(playlist);
      if (playlist.length > 0) {
        setCurrentTrack(playlist[0]);
      }
    });

    fetch(`/api/comments?path=${commentsPath}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.comments) {
          setComments(data.comments);
        }
      });
  }, [folderPath, commentsPath, runningOrderPath]);

  const onDragEnd: OnDragEndResponder = (result) => {
    if (!result.destination) return;
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
    }).then(res => res.json()).then(data => console.log(data.message));
  };

  const handleAddComment = () => {
    if (newComment.trim() && newCommentInitials.trim() && newCommentTimestamp !== null) {
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

  const onPlayPause = () => {
    wavesurfer && wavesurfer.playPause();
  };

  const toggleAutoplay = () => {
    setIsAutoplay(!isAutoplay);
    if (!isAutoplay && !isPlaying && playlist.length > 0) {
      const trackToPlay = currentTrack || playlist[0];
      setCurrentTrack(trackToPlay);
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !wavesurfer) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const ratio = Math.min(Math.max(x / width, 0), 1); // Clamp between 0 and 1
    const time = ratio * wavesurfer.getDuration();

    // Check if we clicked on an existing comment marker (prevent opening new comment input)
    // This simple check might need refinement if markers are dense
    if ((e.target as HTMLElement).closest('.comment-marker')) {
      return;
    }

    setNewCommentTimestamp(time);

    // We don't necessarily want to seek the audio when adding a comment, 
    // but standard behavior is usually click-to-seek.
    // Let's allow seek for now as it's the default container behavior unless we stop propagation.
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <div className="z-10 w-full max-w-5xl">
        <Link href="/" className="text-blue-500 mb-8 block">&larr; Back to Directories</Link>
        <h1 className="text-3xl font-bold mb-4 capitalize">{folderPath.replace(/-/g, ' ')}</h1>

        <div className="mb-8 p-4 border rounded-lg bg-white shadow-sm">
          <h2 className="text-2xl font-bold mb-4">Player</h2>

          <div className="relative w-full h-[150px] bg-gray-50 mb-4 rounded border border-gray-200" onClick={handleWaveformClick}>
            {/* WaveSurfer Container */}
            <div ref={containerRef} className="absolute inset-0 z-10 cursor-pointer opacity-80 hover:opacity-100 transition-opacity" />

            {/* Comments Overlay */}
            {duration > 0 && (
              <div className="absolute inset-0 z-20 pointer-events-none">
                {comments.map((comment, index) => {
                  const leftPercent = (comment.timestamp / duration) * 100;
                  const isHovered = hoveredCommentTimestamp === comment.timestamp;

                  return (
                    <div
                      key={index}
                      className="absolute top-0 bottom-0 flex flex-col items-center justify-end transform -translate-x-1/2"
                      style={{ left: `${leftPercent}%` }}
                    >
                      {/* Line */}
                      <div className={`w-0.5 grow mb-0.5 transition-colors duration-200 ${isHovered ? 'bg-orange-500' : 'bg-orange-300/40'}`} />

                      {/* Marker Area */}
                      <div
                        className="comment-marker pointer-events-auto group relative"
                        onMouseEnter={() => setHoveredCommentTimestamp(comment.timestamp)}
                        onMouseLeave={() => setHoveredCommentTimestamp(null)}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm cursor-pointer transition-transform hover:scale-125
                                        ${isHovered ? 'bg-orange-500 text-white z-50' : 'bg-gray-200 text-gray-600'}`}>
                          {comment.initials.substring(0, 2).toUpperCase()}
                        </div>

                        {/* Tooltip */}
                        <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black text-white text-xs p-2 rounded whitespace-nowrap z-50 shadow-lg">
                          <div className="font-bold mb-1">{formatTime(comment.timestamp)}</div>
                          {comment.text}
                          {/* Arrow */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* New Comment Input Overlay */}
            {newCommentTimestamp !== null && duration > 0 && (
              <div
                className="absolute z-30 bg-white p-3 rounded shadow-xl border border-gray-200 w-64 text-sm"
                style={{
                  left: `${Math.min(Math.max((newCommentTimestamp / duration) * 100, 0), 100)}%`,
                  top: '50%', // Centered vertically relative to container or adjusted
                  transform: 'translate(-50%, -50%)'
                }}
                onClick={(e) => e.stopPropagation()} // Prevent clicking through to waveform
              >
                <div className="font-bold mb-2 text-gray-700">Add comment at {formatTime(newCommentTimestamp)}</div>
                <input
                  autoFocus
                  type="text"
                  value={newCommentInitials}
                  onChange={(e) => setNewCommentInitials(e.target.value)}
                  className="border p-1 rounded w-full mb-2 text-xs"
                  placeholder="Initials (e.g. JD)"
                  maxLength={3}
                />
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="border p-1 rounded w-full mb-2 text-xs"
                  placeholder="Your comment..."
                  rows={2}
                />
                <div className="flex justify-between">
                  <button onClick={() => setNewCommentTimestamp(null)} className="text-gray-500 text-xs hover:text-gray-700">Cancel</button>
                  <button onClick={handleAddComment} className="bg-orange-500 text-white px-2 py-1 rounded text-xs hover:bg-orange-600">Post</button>
                </div>
                {/* Triangle pointer */}
                {/* <div className="absolute left-1/2 -translate-x-1/2 top-full border-8 border-transparent border-t-white drop-shadow-sm"></div> */}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-4">
              <button onClick={onPlayPause} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full font-medium transition-colors">
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-gray-800">{currentTrack?.name || 'No Track Selected'}</span>
                <span className="text-xs text-gray-500 font-mono">{formatTime(currentTime)} / {formatTime(duration)}</span>
              </div>
            </div>

            <button
              onClick={toggleAutoplay}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${isAutoplay ? 'bg-green-100 border-green-300 text-green-700' : 'bg-gray-100 border-gray-200 text-gray-600'}`}
            >
              {isAutoplay ? 'Autoplay On' : 'Autoplay Off'}
            </button>
          </div>
        </div>

        {/* Comment List (Below Player) */}
        <div>
          <h2 className="text-xl font-bold mb-4 text-gray-800">All Comments</h2>
          <div className="border rounded-lg bg-white overflow-hidden shadow-sm">
            {comments.slice().sort((a, b) => a.timestamp - b.timestamp).map((comment, index) => (
              <div
                key={index}
                className={`p-3 border-b text-sm transition-colors flex gap-3 items-start ${hoveredCommentTimestamp === comment.timestamp ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                onMouseEnter={() => setHoveredCommentTimestamp(comment.timestamp)}
                onMouseLeave={() => setHoveredCommentTimestamp(null)}
              >
                <div className="shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                  {comment.initials.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-orange-600 font-mono text-xs">{formatTime(comment.timestamp)}</span>
                  </div>
                  <p className="text-gray-700 mt-1">{comment.text}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && <div className="p-8 text-center text-gray-400 italic">No comments yet. Click on the waveform to add one.</div>}
          </div>
        </div>

        <div className="mt-8">
          <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold text-gray-800">Playlist</h2></div>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="playlist">
              {(provided) => (
                <ul {...provided.droppableProps} ref={provided.innerRef} className="border rounded-lg bg-white overflow-hidden shadow-sm">
                  {playlist.map((item, index) => (
                    <Draggable key={item.name} draggableId={item.name} index={index}>
                      {(provided) => (
                        <li
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          onClick={() => setCurrentTrack(item)}
                          className={`p-3 border-b last:border-b-0 cursor-pointer flex items-center gap-3 transition-colors ${currentTrack?.name === item.name ? 'bg-orange-50 text-orange-900' : 'hover:bg-gray-50'}`}
                        >
                          <span className="text-gray-400 text-xs">{index + 1}</span>
                          <span className="font-medium text-sm">{item.name}</span>
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
    </main>
  );
}