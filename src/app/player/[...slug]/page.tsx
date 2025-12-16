// src/app/player/[...slug]/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, OnDragEndResponder } from '@hello-pangea/dnd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useWavesurfer } from '@wavesurfer/react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';

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

  useEffect(() => {
    setIsClient(true);
  }, []);

  const plugins = useMemo(() => {
    if (isClient) {
      return [
        RegionsPlugin.create()
      ];
    }
    return [];
  }, [isClient]);

  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    height: 100,
    waveColor: 'rgb(200, 200, 200)',
    progressColor: 'rgb(100, 100, 100)',
    url: currentTrack ? `/api/audio?path=${folderPath}/${currentTrack.name}` : undefined,
    plugins: plugins,
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
      wavesurfer.on('finish', onEnd);
      
      const onClick = (ratio) => {
        const duration = wavesurfer.getDuration();
        const time = ratio * duration;
        console.log("Waveform clicked. Ratio:", ratio, "Duration:", duration, "Calculated Time:", time);
        setNewCommentTimestamp(time);
      };
      wavesurfer.on('click', onClick);

      return () => {
        wavesurfer.un('finish', onEnd);
        wavesurfer.un('click', onClick);
      }
    }
  }, [wavesurfer]);
  
  useEffect(() => {
    if (wavesurfer && wavesurfer.plugins.regions) {
      wavesurfer.plugins.regions.clearRegions();
      comments.forEach(comment => {
        wavesurfer.plugins.regions.addRegion({
          start: comment.timestamp,
          end: comment.timestamp + 0.1,
          color: 'rgba(255, 0, 0, 0.5)',
          content: comment.initials
        });
      });
    }
  }, [wavesurfer, comments]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/files?path=${folderPath}`).then(res => res.json()),
      fetch(`/api/running-order?path=${runningOrderPath}`).then(res => res.ok ? res.json() : null)
    ]).then(([filesData, orderData]) => {
      const files = filesData.files;
      let playlist = files;

      if (orderData && orderData.playlist) {
        const orderedNames = orderData.playlist;
        const fileMap = new Map(files.map(f => [f.name, f]));
        const orderedPlaylist = orderedNames.map(name => fileMap.get(name)).filter(Boolean);
        const newFiles = files.filter(f => !orderedNames.includes(f.name));
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
      const newComments: Comment[] = [...comments, { timestamp: newCommentTimestamp, text: newComment, initials: newCommentInitials }];
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

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <div className="z-10 w-full max-w-5xl">
        <Link href="/" className="text-blue-500 mb-8 block">&larr; Back to Directories</Link>
        <h1 className="text-3xl font-bold mb-4 capitalize">{folderPath.replace(/-/g, ' ')}</h1>
        
        {/* Player */}
        <div className="mb-8 p-4 border rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Player</h2>
          <div ref={containerRef} />
          <div className="flex items-center mt-4">
            <button onClick={onPlayPause} className="bg-blue-500 text-white px-4 py-2 rounded w-24">{isPlaying ? 'Pause' : 'Play'}</button>
            <p className="ml-4">Now playing: {currentTrack?.name || 'None'}</p>
          </div>
          <div className="flex items-center mt-2">
            <p>Time: {formatTime(currentTime)}</p>
          </div>
          <div className="flex items-center mt-4">
             <button onClick={toggleAutoplay} className="bg-green-500 text-white px-4 py-2 rounded">{isAutoplay ? 'Stop Autoplay' : 'Autoplay'}</button>
          </div>
        </div>

        {/* Comments Display */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Comments</h2>
          <div className="border rounded-lg p-4 mb-4">
            {comments.map((comment, index) => (
              <div key={index} className="p-2 bg-gray-50 border-b text-gray-800">
                <strong>{formatTime(comment.timestamp)} [{comment.initials}]:</strong> {comment.text}
              </div>
            ))}
             {comments.length === 0 && <p>No comments yet.</p>}
          </div>
        </div>

        {/* Playlist */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-bold">Playlist</h2></div>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="playlist">
              {(provided) => (
                <ul {...provided.droppableProps} ref={provided.innerRef} className="border rounded-lg p-4">
                  {playlist.map((item, index) => (
                    <Draggable key={item.name} draggableId={item.name} index={index}>
                      {(provided) => (
                        <li
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          onClick={() => setCurrentTrack(item)}
                          className={`p-2 mb-2 rounded cursor-pointer text-gray-800 ${currentTrack?.name === item.name ? 'bg-blue-200' : 'bg-gray-100'}`}
                        >
                          {item.name}
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

        {/* Comment Popup */}
        {newCommentTimestamp !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-lg w-1/3">
              <h3 className="font-bold text-xl mb-4">Add comment at {formatTime(newCommentTimestamp)}</h3>
              <div className="flex flex-col">
                <input
                  type="text"
                  value={newCommentInitials}
                  onChange={(e) => setNewCommentInitials(e.target.value)}
                  className="border p-2 rounded-lg w-full mb-4"
                  placeholder="Initials"
                />
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="border p-2 rounded-lg w-full mb-4"
                  placeholder="Your comment"
                  rows={4}
                />
                <div className="flex justify-end">
                  <button onClick={() => setNewCommentTimestamp(null)} className="bg-gray-300 text-black px-4 py-2 rounded-lg mr-2">Cancel</button>
                  <button onClick={handleAddComment} className="bg-blue-500 text-white px-4 py-2 rounded-lg">Add Comment</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
