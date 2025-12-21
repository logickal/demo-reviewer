'use client';

import React from 'react';
import { DragDropContext, Droppable, Draggable, OnDragEndResponder } from '@hello-pangea/dnd';
import Link from 'next/link';

import type { Comment, FileItem } from './types';

interface CommentItemProps {
  comment: Comment;
  depth?: number;
  comments: Comment[];
  replyingToCommentId: string | null;
  setReplyingToCommentId: (id: string | null) => void;
  replyInitials: string;
  setReplyInitials: (val: string) => void;
  replyText: string;
  setReplyText: (val: string) => void;
  handleAddComment: (parentId?: string) => void;
  hoveredCommentTimestamp: number | null;
  setHoveredCommentTimestamp: (timestamp: number | null) => void;
  showReplyButton: boolean;
  onDelete: (id: string) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
}

// Helper function to format time (e.g., 00:00.00)
const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds - Math.floor(seconds)) * 100); // two decimal places
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
};

const CommentItem = ({
  comment,
  depth = 0,
  comments,
  replyingToCommentId,
  setReplyingToCommentId,
  replyInitials,
  setReplyInitials,
  replyText,
  setReplyText,
  handleAddComment,
  hoveredCommentTimestamp,
  setHoveredCommentTimestamp,
  showReplyButton,
  onDelete,
  confirmDeleteId,
  setConfirmDeleteId,
}: CommentItemProps) => {
  const isReplying = replyingToCommentId === comment.id;
  const isConfirmingDelete = confirmDeleteId === comment.id;

  return (
    <div className={`space-y-3 ${depth > 0 ? 'ml-12' : ''}`}>
      <div
        className={`group p-4 rounded-2xl border transition-all flex gap-4 items-start ${
          hoveredCommentTimestamp === comment.timestamp
            ? 'bg-orange-50 border-orange-200 shadow-md'
            : depth > 0
              ? 'bg-gray-50/50 border-gray-100'
              : 'bg-white border-gray-100 hover:border-gray-200'
        }`}
        onMouseEnter={() => setHoveredCommentTimestamp(comment.timestamp)}
        onMouseLeave={() => setHoveredCommentTimestamp(null)}
      >
        <div
          className={`shrink-0 ${
            depth > 0 ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'
          } bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-black group-hover:bg-orange-500 group-hover:text-white transition-colors`}
        >
          {comment.initials.substring(0, 2).toUpperCase()}
        </div>
        <div className="grow">
          <div className="flex items-center justify-between mb-1">
            <span className="text-orange-500 font-mono text-xs font-bold bg-orange-50 px-2 py-0.5 rounded-full">
              {formatTime(comment.timestamp)}
            </span>
            <div className="flex items-center gap-3">
              {showReplyButton && !isConfirmingDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReplyingToCommentId(isReplying ? null : comment.id);
                  }}
                  className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-orange-500 transition-colors"
                >
                  Reply
                </button>
              )}
              {showReplyButton && !isConfirmingDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDeleteId(comment.id);
                  }}
                  className="text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:text-red-500 transition-colors"
                >
                  Delete
                </button>
              )}
              {isConfirmingDelete && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">Sure?</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(comment.id);
                    }}
                    className="text-[10px] font-bold uppercase tracking-widest text-red-600 hover:underline"
                  >
                    Yes
                  </button>
                  <span className="text-gray-300 text-[10px]">|</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(null);
                    }}
                    className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className={`${depth > 0 ? 'text-gray-600 text-xs' : 'text-gray-700 text-sm'} leading-relaxed`}>
            {comment.text}
          </p>
        </div>
      </div>

      {isReplying && (
        <div className="ml-12 p-4 bg-white rounded-2xl border border-orange-200 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-gray-900">Reply to comment</span>
            <button onClick={() => setReplyingToCommentId(null)} className="text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input
            autoFocus
            type="text"
            value={replyInitials}
            onChange={(e) => setReplyInitials(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition-all mb-2 text-xs text-gray-900"
            placeholder="Initials"
            maxLength={3}
          />
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition-all mb-3 text-xs resize-none text-gray-900"
            placeholder="Your reply..."
            rows={2}
          />
          <div className="flex justify-end">
            <button
              onClick={() => handleAddComment(comment.id)}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-orange-600 transition-all active:scale-95"
            >
              Post Reply
            </button>
          </div>
        </div>
      )}

      {comments
        .filter((reply) => reply.parentId === comment.id)
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((reply) => (
          <CommentItem
            key={reply.id}
            comment={reply}
            depth={depth + 1}
            comments={comments}
            replyingToCommentId={replyingToCommentId}
            setReplyingToCommentId={setReplyingToCommentId}
            replyInitials={replyInitials}
            setReplyInitials={setReplyInitials}
            replyText={replyText}
            setReplyText={setReplyText}
            handleAddComment={handleAddComment}
            hoveredCommentTimestamp={hoveredCommentTimestamp}
            setHoveredCommentTimestamp={setHoveredCommentTimestamp}
            showReplyButton={showReplyButton}
            onDelete={onDelete}
            confirmDeleteId={confirmDeleteId}
            setConfirmDeleteId={setConfirmDeleteId}
          />
        ))}
    </div>
  );
};

interface PlayerViewProps {
  folderPath: string;
  isGuest: boolean;
  playlist: FileItem[];
  currentTrack: FileItem | null;
  onShare: () => Promise<void> | void;
  isShareLoading: boolean;
  shareSuccess: boolean;
  isAutoplay: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onPlayFullSequence: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  onWaveformClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  comments: Comment[];
  hoveredCommentTimestamp: number | null;
  setHoveredCommentTimestamp: (timestamp: number | null) => void;
  newComment: string;
  newCommentInitials: string;
  newCommentTimestamp: number | null;
  setNewComment: (val: string) => void;
  setNewCommentInitials: (val: string) => void;
  setNewCommentTimestamp: (val: number | null) => void;
  onAddComment: (parentId?: string) => void;
  replyingToCommentId: string | null;
  setReplyingToCommentId: (id: string | null) => void;
  replyText: string;
  setReplyText: (val: string) => void;
  replyInitials: string;
  setReplyInitials: (val: string) => void;
  onDeleteComment: (id: string) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  onSelectTrack: (track: FileItem) => void;
  onDragEnd: OnDragEndResponder;
  trackDurations: Record<string, number>;
}

const PlayerView = ({
  folderPath,
  isGuest,
  playlist,
  currentTrack,
  onShare,
  isShareLoading,
  shareSuccess,
  isAutoplay,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onPlayFullSequence,
  onSkipForward,
  onSkipBackward,
  onWaveformClick,
  containerRef,
  comments,
  hoveredCommentTimestamp,
  setHoveredCommentTimestamp,
  newComment,
  newCommentInitials,
  newCommentTimestamp,
  setNewComment,
  setNewCommentInitials,
  setNewCommentTimestamp,
  onAddComment,
  replyingToCommentId,
  setReplyingToCommentId,
  replyText,
  setReplyText,
  replyInitials,
  setReplyInitials,
  onDeleteComment,
  confirmDeleteId,
  setConfirmDeleteId,
  onSelectTrack,
  onDragEnd,
  trackDurations,
}: PlayerViewProps) => {
  return (
    <main className="flex min-h-screen flex-col items-center p-24 bg-gray-50">
      <div className="z-10 w-full max-w-5xl">
        <div className="mb-8 flex justify-between items-start">
          <div>
            {!isGuest && (
              <Link
                href={folderPath.includes('/') ? `/player/${folderPath.split('/').slice(0, -1).join('/')}` : '/'}
                className="text-blue-500 mb-4 block hover:underline flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Directories
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
              ) : shareSuccess ? (
                'Copied!'
              ) : (
                'Share Player'
              )}
            </button>
          )}
        </div>

        <div className="mb-8 p-6 border-0 rounded-3xl bg-white shadow-xl shadow-gray-200/50">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-orange-500">Currently Playing</h2>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-md border border-gray-100 italic">
                Click to seek • Cmd/Ctrl + Click to comment
              </span>
            </div>
            <div
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                isAutoplay ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
              }`}
            >
              Autoplay {isAutoplay ? 'ON' : 'OFF'}
            </div>
          </div>

          <div className="relative w-full h-[180px] bg-gray-50 mb-6 rounded-2xl border border-gray-100" onClick={onWaveformClick}>
            <div ref={containerRef} className="absolute inset-0 z-10 cursor-pointer opacity-90 hover:opacity-100 transition-opacity" />
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
                      <div
                        className={`w-0.5 grow mb-0.5 transition-colors duration-200 ${
                          isHovered ? 'bg-orange-500' : 'bg-orange-300/40'
                        }`}
                      />
                      <div
                        className="comment-marker pointer-events-auto group relative"
                        onMouseEnter={() => setHoveredCommentTimestamp(comment.timestamp)}
                        onMouseLeave={() => setHoveredCommentTimestamp(null)}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm cursor-pointer transition-transform hover:scale-125 ${
                            isHovered ? 'bg-orange-500 text-white z-50' : 'bg-white text-gray-600 border-gray-100'
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
                  onChange={(e) => setNewCommentInitials(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition-all mb-3 text-xs text-gray-900"
                  placeholder="Initials (e.g. JD)"
                  maxLength={3}
                />
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none transition-all mb-4 text-xs resize-none text-gray-900"
                  placeholder="What do you think?"
                  rows={3}
                />
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setNewCommentTimestamp(null)}
                    className="text-gray-400 text-xs hover:text-gray-600 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onAddComment()}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-orange-600 shadow-md shadow-orange-100 transition-all active:scale-95"
                  >
                    Post Comment
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={onSkipBackward}
                  className="w-10 h-10 bg-white border border-gray-100 text-gray-400 hover:text-orange-500 hover:border-orange-200 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-sm"
                  title="Previous Track"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M9.195 18.44c1.25.713 2.805-.19 2.805-1.629v-2.34l6.945 3.968c1.25.714 2.805-.19 2.805-1.629V5.19c0-1.44-1.555-2.343-2.805-1.628L12 7.529v-2.34c0-1.44-1.555-2.343-2.805-1.628l-7.108 4.061c-1.26.72-1.26 2.536 0 3.256l7.108 4.061c.001 0 .001 0 0 0Z" />
                  </svg>
                </button>

                <button
                  onClick={onPlayPause}
                  className="w-16 h-16 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-200 transition-all active:scale-90"
                >
                  {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                      <path
                        fillRule="evenodd"
                        d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 ml-1">
                      <path
                        fillRule="evenodd"
                        d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>

                <button
                  onClick={onSkipForward}
                  className="w-10 h-10 bg-white border border-gray-100 text-gray-400 hover:text-orange-500 hover:border-orange-200 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-sm"
                  title="Next Track"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M5.055 7.06c-1.25-.714-2.805.189-2.805 1.628v8.123c0 1.44 1.555 2.342 2.805 1.628L12 14.471v2.34c0 1.44 1.555 2.342 2.805 1.628l7.108-4.061c1.26-.72 1.26-2.536 0-3.256L14.805 7.06C13.555 6.346 12 7.25 12 8.688v2.34L5.055 7.06Z" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black text-gray-900 tracking-tight leading-tight">
                  {currentTrack?.name || 'No Track Selected'}
                </span>
                <span className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1 bg-gray-100 w-fit px-2 py-0.5 rounded leading-none flex items-center gap-1.5">
                  <span className="text-orange-500 inline-block w-1 h-1 rounded-full bg-orange-500"></span>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
            </div>
            <button
              onClick={onPlayFullSequence}
              className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${
                isAutoplay
                  ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-100'
                  : 'bg-white border-gray-200 text-gray-400 hover:border-orange-200 hover:text-orange-500'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              {isAutoplay ? 'Running Order Playing' : 'Play full running order'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2">
            <h2 className="text-xl font-black mb-6 text-gray-900 flex items-center gap-2">
              <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>Comments
            </h2>
            <div className="space-y-6">
              {comments
                .filter((c) => !c.parentId || !comments.some((p) => p.id === c.parentId))
                .sort((a, b) => a.timestamp - b.timestamp)
                .map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    comments={comments}
                    replyingToCommentId={replyingToCommentId}
                    setReplyingToCommentId={setReplyingToCommentId}
                    replyInitials={replyInitials}
                    setReplyInitials={setReplyInitials}
                    replyText={replyText}
                    setReplyText={setReplyText}
                    handleAddComment={onAddComment}
                    hoveredCommentTimestamp={hoveredCommentTimestamp}
                    setHoveredCommentTimestamp={setHoveredCommentTimestamp}
                    showReplyButton={!isGuest}
                    onDelete={onDeleteComment}
                    confirmDeleteId={confirmDeleteId}
                    setConfirmDeleteId={setConfirmDeleteId}
                  />
                ))}
              {comments.length === 0 && (
                <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400 font-medium">
                  No comments yet. Click on the waveform to mark a moment.
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>Running Order
              </h2>
              {playlist.length > 0 && playlist.every((f) => trackDurations[f.name] !== undefined) && (
                <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full uppercase tracking-wider">
                  Total: {formatTime(playlist.reduce((sum, f) => sum + (trackDurations[f.name] || 0), 0))}
                </span>
              )}
            </div>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="playlist">
                {(provided) => (
                  <ul {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {playlist.map((item, index) => (
                      <Draggable key={item.name} draggableId={item.name} index={index} isDragDisabled={isGuest}>
                        {(provided) => (
                          <li
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => onSelectTrack(item)}
                            className={`group p-4 rounded-2xl border cursor-pointer flex items-center gap-4 transition-all ${
                              currentTrack?.name === item.name
                                ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-100'
                                : 'bg-white border-gray-100 hover:border-orange-200 text-gray-900'
                            }`}
                          >
                            <span
                              className={`text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center ${
                                currentTrack?.name === item.name
                                  ? 'bg-white/20'
                                  : 'bg-gray-50 text-gray-400 group-hover:bg-orange-50 group-hover:text-orange-500'
                              }`}
                            >
                              {index + 1}
                            </span>
                            <span className="font-bold text-sm grow truncate">{item.name}</span>
                            {!isGuest && (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`h-4 w-4 ${currentTrack?.name === item.name ? 'text-white/50' : 'text-gray-300'}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                              </svg>
                            )}
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
};

export default PlayerView;
