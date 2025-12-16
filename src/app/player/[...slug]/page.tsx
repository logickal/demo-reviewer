// src/app/player/[...slug]/page.tsx
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
}

export default function PlayerPage() {
  const params = useParams();
  const slug = params.slug as string[];
  const [playlist, setPlaylist] = useState<FileItem[]>([]);
  const [currentTrack, setCurrentTrack] = useState<FileItem | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isAutoplay, setIsAutoplay] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const folderPath = slug.join('/');
  const runningOrderPath = `${folderPath}/running-order.json`;
  const commentsPath = `${folderPath}/comments.json`;

  const { wavesurfer, isPlaying, currentTime } = useWavesurfer({
    container: containerRef,
    height: 100,
    waveColor: 'rgb(200, 200, 200)',
    progressColor: 'rgb(100, 100, 100)',
    url: currentTrack ? `/api/audio?path=${folderPath}/${currentTrack.name}` : undefined,
  });

  useEffect(() => {
    if (wavesurfer) {
      const onEnd = () => {
        if (isAutoplay) {
          const currentIndex = playlist.findIndex(t => t.name === currentTrack?.name);
          if (currentIndex < playlist.length - 1) {
            setCurrentTrack(playlist[currentIndex + 1]);
          } else {
            setIsAutoplay(false); // End of playlist
          }
        }
      };
      wavesurfer.on('finish', onEnd);
      return () => wavesurfer.un('finish', onEnd);
    }
  }, [wavesurfer, isAutoplay, playlist, currentTrack]);

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
        // Add any new files that are not in the saved order
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
  
  const saveRunningOrder = (currentPlaylist: FileItem[]) => {
    fetch(`/api/running-order?path=${runningOrderPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlist: currentPlaylist.map(f => f.name) }),
    })
      .then(res => res.json())
      .then(data => console.log(data.message)); // Log success, no alert
  };

  const onDragEnd: OnDragEndResponder = (result) => {
    if (!result.destination) return;
    const items = Array.from(playlist);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setPlaylist(items);
    saveRunningOrder(items); // Auto-save after drag-and-drop
  };
  
  const handleAddComment = () => {
    if (newComment.trim() && wavesurfer) {
      const newComments = [...comments, { timestamp: currentTime, text: newComment }];
      setComments(newComments);
      setNewComment('');
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

        {/* Audio Player */}
        <div className="mb-8 p-4 border rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Player</h2>
          <div ref={containerRef} />
          <div className="flex items-center mt-4">
            <button onClick={onPlayPause} className="bg-blue-500 text-white px-4 py-2 rounded w-24">
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <p className="ml-4">Now playing: {currentTrack?.name || 'None'}</p>
          </div>
          <div className="flex items-center mt-2">
            <p>Time: {new Date(currentTime * 1000).toISOString().substr(11, 8)}</p>
          </div>
          <div className="flex items-center mt-4">
             <button onClick={toggleAutoplay} className="bg-green-500 text-white px-4 py-2 rounded">
              {isAutoplay ? 'Stop Autoplay' : 'Autoplay'}
            </button>
          </div>
        </div>

        {/* Playlist */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Playlist</h2>
            {/* Removed Save and Load buttons */}
          </div>
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
        
        {/* Comments */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Comments</h2>
          <div className="border rounded-lg p-4 mb-4">
            {comments.map((comment, index) => (
              <div key={index} className="p-2 bg-gray-50 border-b">
                <strong>{new Date(comment.timestamp * 1000).toISOString().substr(11, 8)}:</strong> {comment.text}
              </div>
            ))}
             {comments.length === 0 && <p>No comments yet.</p>}
          </div>
          <div className="flex">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="border p-2 flex-grow rounded-l-lg"
              placeholder="Add a comment"
            />
            <button onClick={handleAddComment} className="bg-blue-500 text-white px-4 py-2 rounded-r-lg">
              Add
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}