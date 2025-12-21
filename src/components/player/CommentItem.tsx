import React from 'react';

import type { Comment } from './types';
import { formatTime } from './utils';

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
  handleAddComment: (parentId: string) => void;
  hoveredCommentTimestamp: number | null;
  setHoveredCommentTimestamp: (timestamp: number | null) => void;
  showReplyButton: boolean;
  onDelete: (id: string) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
}

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

export default CommentItem;
