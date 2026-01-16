'use client';

import React from 'react';

import type { Comment, FileItem } from './types';
import { formatTime } from './utils';

type WaveformWithMarkersProps = {
  comments: Comment[];
  duration: number;
  currentTrack: FileItem | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  hoveredCommentTimestamp: number | null;
  onHoverCommentTimestamp?: (timestamp: number | null) => void;
  onSeek: (time: number) => void;
  onCreateComment: (time: number) => void;
  newCommentTimestamp: number | null;
  newComment: string;
  newCommentInitials: string;
  onNewCommentChange: (value: string) => void;
  onNewCommentInitialsChange: (value: string) => void;
  onCancelComment: () => void;
  onPostComment: () => void;
};

const NewCommentPopover = ({
  duration,
  newCommentTimestamp,
  newComment,
  newCommentInitials,
  onNewCommentChange,
  onNewCommentInitialsChange,
  onCancelComment,
  onPostComment,
}: {
  duration: number;
  newCommentTimestamp: number;
  newComment: string;
  newCommentInitials: string;
  onNewCommentChange: (value: string) => void;
  onNewCommentInitialsChange: (value: string) => void;
  onCancelComment: () => void;
  onPostComment: () => void;
}) => {
  return (
    <div
      className="absolute z-50 bg-white p-4 rounded-2xl shadow-2xl border border-gray-100 w-72 text-sm animate-in fade-in zoom-in duration-200"
      style={{
        left: `${Math.min(Math.max((newCommentTimestamp / duration) * 100, 10), 90)}%`,
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="font-bold mb-3 text-gray-900 flex items-center justify-between">
        <span>Add comment</span>
        <span className="text-orange-500 font-mono text-xs bg-orange-50 px-2 py-0.5 rounded-full">
          {formatTime(newCommentTimestamp)}
        </span>
      </div>
      <input
        autoFocus
        type="text"
        value={newCommentInitials}
        onChange={(e) => onNewCommentInitialsChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition-all mb-3 text-xs text-gray-900"
        placeholder="Initials (e.g. JD)"
        maxLength={3}
      />
      <textarea
        value={newComment}
        onChange={(e) => onNewCommentChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition-all mb-4 text-xs resize-none text-gray-900"
        placeholder="What do you think?"
        rows={3}
      />
      <div className="flex justify-between items-center">
        <button onClick={onCancelComment} className="text-gray-400 text-xs hover:text-gray-600 font-medium transition-colors">
          Cancel
        </button>
        <button
          onClick={onPostComment}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-orange-600 shadow-md shadow-orange-100 transition-all active:scale-95"
        >
          Post Comment
        </button>
      </div>
    </div>
  );
};

const WaveformWithMarkers = ({
  comments,
  duration,
  currentTrack,
  containerRef,
  hoveredCommentTimestamp,
  onHoverCommentTimestamp,
  onSeek,
  onCreateComment,
  newCommentTimestamp,
  newComment,
  newCommentInitials,
  onNewCommentChange,
  onNewCommentInitialsChange,
  onCancelComment,
  onPostComment,
}: WaveformWithMarkersProps) => {
  const handleWaveformClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration <= 0) return;
    if ((event.target as HTMLElement).closest('.comment-marker')) return;

    const rect = containerRef.current.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const time = ratio * duration;

    if (event.metaKey || event.ctrlKey) {
      onCreateComment(time);
    } else {
      onSeek(time);
    }
  };

  const handleHoverComment = (timestamp: number | null) => {
    onHoverCommentTimestamp?.(timestamp);
  };

  return (
    <div
      className="relative w-full h-[180px] bg-gray-50 mb-6 rounded-2xl border border-gray-100"
      onClick={handleWaveformClick}
      data-track={currentTrack?.name ?? 'none'}
    >
      <div ref={containerRef} className="absolute inset-0 z-10 cursor-pointer opacity-90 hover:opacity-100 transition-opacity" />
      {duration > 0 && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          {comments
            .filter((comment): comment is Comment & { timestamp: number } => typeof comment.timestamp === 'number')
            .map((comment) => {
              const leftPercent = (comment.timestamp / duration) * 100;
              const isHovered = hoveredCommentTimestamp === comment.timestamp;
              return (
                <div
                  key={comment.id}
                  className="absolute top-0 bottom-0 flex flex-col items-center justify-end transform -translate-x-1/2"
                  style={{ left: `${leftPercent}%` }}
                >
                  <div
                    className={`w-0.5 grow mb-0.5 transition-colors duration-200 ${isHovered ? 'bg-orange-500' : 'bg-orange-300/40'
                      }`}
                  />
                  <div
                    className="comment-marker pointer-events-auto group relative"
                    onMouseEnter={() => handleHoverComment(comment.timestamp)}
                    onMouseLeave={() => handleHoverComment(null)}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm cursor-pointer transition-transform hover:scale-125 ${isHovered ? 'bg-orange-500 text-white z-50' : 'bg-white text-gray-600 border-gray-100'
                        }`}
                    >
                      {comment.initials.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900/95 backdrop-blur-md text-white text-xs p-3 rounded-xl whitespace-nowrap z-50 shadow-2xl">
                      <div className="font-bold mb-1 text-orange-400">{formatTime(comment.timestamp)}</div>
                      <div className="max-w-[200px] whitespace-normal leading-relaxed">{comment.text}</div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-gray-900/95"></div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {newCommentTimestamp !== null && duration > 0 && (
        <NewCommentPopover
          duration={duration}
          newCommentTimestamp={newCommentTimestamp}
          newComment={newComment}
          newCommentInitials={newCommentInitials}
          onNewCommentChange={onNewCommentChange}
          onNewCommentInitialsChange={onNewCommentInitialsChange}
          onCancelComment={onCancelComment}
          onPostComment={onPostComment}
        />
      )}
    </div>
  );
};

export default WaveformWithMarkers;
