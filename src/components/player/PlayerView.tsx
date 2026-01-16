'use client';

import React from 'react';
import { OnDragEndResponder } from '@hello-pangea/dnd';
import Link from 'next/link';

import CommentsPanel from './CommentsPanel';
import RunningOrderList from './RunningOrderList';
import WaveformWithMarkers from './WaveformWithMarkers';
import GeneralComments from './GeneralComments';
import type { Comment, FileItem } from './types';
import { formatTime } from './utils';

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
  onSeek: (time: number) => void;
  onCreateComment: (time: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  comments: Comment[];
  hoveredCommentTimestamp: number | null;
  setHoveredCommentTimestamp: (timestamp: number | null) => void;
  newComment: string;
  newCommentInitials: string;
  newCommentTimestamp: number | null;
  setNewComment: (val: string) => void;
  setNewCommentInitials: (val: string) => void;
  setNewCommentTimestamp: (val: number | null) => void;
  replyingToCommentId: string | null;
  setReplyingToCommentId: (id: string | null) => void;
  addComment: (input: { text: string; initials: string; timestamp?: number | null; parentId?: string }) => boolean;
  deleteComment: (id: string) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  onSelectTrack: (track: FileItem) => void;
  onReorder: OnDragEndResponder;
  trackDurations: Record<string, number>;
  trackDataStatus: Record<string, 'present' | 'missing'>;
  generalComments: Comment[];
  addGeneralComment: (input: { text: string; initials: string; timestamp?: number | null; parentId?: string }) => boolean;
  deleteGeneralComment: (id: string) => void;
  replyingToGeneralCommentId: string | null;
  setReplyingToGeneralCommentId: (id: string | null) => void;
  confirmGeneralDeleteId: string | null;
  setConfirmGeneralDeleteId: (id: string | null) => void;
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
  onSeek,
  onCreateComment,
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
  replyingToCommentId,
  setReplyingToCommentId,
  addComment,
  deleteComment,
  confirmDeleteId,
  setConfirmDeleteId,
  onSelectTrack,
  onReorder,
  trackDurations,
  trackDataStatus,
  generalComments,
  addGeneralComment,
  deleteGeneralComment,
  replyingToGeneralCommentId,
  setReplyingToGeneralCommentId,
  confirmGeneralDeleteId,
  setConfirmGeneralDeleteId,
}: PlayerViewProps) => {
  const parentFolderPath = folderPath
    .split('/')
    .filter(Boolean)
    .slice(0, -1)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const backHref = parentFolderPath ? `/player/${parentFolderPath}` : '/';

  const handlePostComment = () => {
    const didAdd = addComment({
      text: newComment,
      initials: newCommentInitials,
      timestamp: newCommentTimestamp,
    });
    if (didAdd) {
      setNewComment('');
      setNewCommentInitials('');
      setNewCommentTimestamp(null);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-24 bg-gray-50">
      <div className="z-10 w-full max-w-5xl">
        <div className="mb-8 flex justify-between items-start">
          <div>
            {!isGuest && (
              <Link
                href={backHref}
                className="text-blue-500 mb-4 hover:underline flex items-center gap-1"
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
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-medium ${shareSuccess
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
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${isAutoplay ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                }`}
            >
              Autoplay {isAutoplay ? 'ON' : 'OFF'}
            </div>
          </div>

          <WaveformWithMarkers
            comments={comments}
            duration={duration}
            currentTrack={currentTrack}
            containerRef={containerRef}
            hoveredCommentTimestamp={hoveredCommentTimestamp}
            onHoverCommentTimestamp={setHoveredCommentTimestamp}
            onSeek={onSeek}
            onCreateComment={onCreateComment}
            newCommentTimestamp={newCommentTimestamp}
            newComment={newComment}
            newCommentInitials={newCommentInitials}
            onNewCommentChange={setNewComment}
            onNewCommentInitialsChange={setNewCommentInitials}
            onCancelComment={() => setNewCommentTimestamp(null)}
            onPostComment={handlePostComment}
          />

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
              className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${isAutoplay
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
          <CommentsPanel
            comments={comments}
            isGuest={isGuest}
            hoveredCommentTimestamp={hoveredCommentTimestamp}
            setHoveredCommentTimestamp={setHoveredCommentTimestamp}
            replyingToCommentId={replyingToCommentId}
            setReplyingToCommentId={setReplyingToCommentId}
            confirmDeleteId={confirmDeleteId}
            setConfirmDeleteId={setConfirmDeleteId}
            addComment={addComment}
            deleteComment={deleteComment}
          />

          <RunningOrderList
            playlist={playlist}
            currentTrack={currentTrack}
            isGuest={isGuest}
            trackDurations={trackDurations}
            trackDataStatus={trackDataStatus}
            onSelectTrack={onSelectTrack}
            onReorder={onReorder}
          />
        </div>

        <GeneralComments
          comments={generalComments}
          isGuest={isGuest}
          replyingToCommentId={replyingToGeneralCommentId}
          setReplyingToCommentId={setReplyingToGeneralCommentId}
          confirmDeleteId={confirmGeneralDeleteId}
          setConfirmDeleteId={setConfirmGeneralDeleteId}
          addComment={addGeneralComment}
          deleteComment={deleteGeneralComment}
        />
      </div>
    </main>
  );
};

export default PlayerView;
