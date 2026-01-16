import React, { useState } from 'react';

import CommentItem from './CommentItem';
import type { Comment } from './types';

interface CommentsPanelProps {
  comments: Comment[];
  isGuest: boolean;
  hoveredCommentTimestamp: number | null;
  setHoveredCommentTimestamp: (timestamp: number | null) => void;
  replyingToCommentId: string | null;
  setReplyingToCommentId: (id: string | null) => void;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  addComment: (input: { text: string; initials: string; timestamp?: number | null; parentId?: string }) => boolean;
  deleteComment: (id: string) => void;
}

const CommentsPanel = ({
  comments,
  isGuest,
  hoveredCommentTimestamp,
  setHoveredCommentTimestamp,
  replyingToCommentId,
  setReplyingToCommentId,
  confirmDeleteId,
  setConfirmDeleteId,
  addComment,
  deleteComment,
}: CommentsPanelProps) => {
  const [replyText, setReplyText] = useState('');
  const [replyInitials, setReplyInitials] = useState('');

  const handleAddReply = (parentId: string) => {
    const parent = comments.find((comment) => comment.id === parentId);
    if (!parent) return;
    const didAdd = addComment({
      text: replyText,
      initials: replyInitials,
      timestamp: parent.timestamp,
      parentId,
    });
    if (didAdd) {
      setReplyText('');
      setReplyInitials('');
    }
  };

  return (
    <div className="lg:col-span-2">
      <h2 className="text-xl font-black mb-6 text-gray-900 flex items-center gap-2">
        <span className="w-1.5 h-6 bg-orange-500 rounded-full"></span>Comments
      </h2>
      <div className="space-y-6">
        {comments
          .filter((comment) => !comment.parentId || !comments.some((parent) => parent.id === comment.parentId))
          .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
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
              handleAddComment={handleAddReply}
              hoveredCommentTimestamp={hoveredCommentTimestamp}
              setHoveredCommentTimestamp={setHoveredCommentTimestamp}
              showReplyButton={!isGuest}
              onDelete={deleteComment}
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
  );
};

export default CommentsPanel;
