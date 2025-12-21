import { useEffect, useState } from 'react';

import type { Comment } from '../types';

interface AddCommentInput {
  text: string;
  initials: string;
  timestamp: number | null;
  parentId?: string;
}

const ensureCommentId = (comment: Comment) => ({
  ...comment,
  id: comment.id || `${comment.timestamp}-${comment.initials}-${comment.text.substring(0, 10)}`,
});

export const useComments = (commentsPath: string | null) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!commentsPath) {
      setComments([]);
      return;
    }
    setComments([]);
    fetch(`/api/comments?path=${encodeURIComponent(commentsPath)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.comments) {
          setComments(data.comments.map(ensureCommentId));
        }
      });
  }, [commentsPath]);

  const persistComments = (nextComments: Comment[]) => {
    setComments(nextComments);
    if (!commentsPath) return;
    fetch(`/api/comments?path=${encodeURIComponent(commentsPath)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments: nextComments }),
    });
  };

  const addComment = ({ text, initials, timestamp, parentId }: AddCommentInput) => {
    if (!commentsPath || timestamp === null) return false;
    if (!text.trim() || !initials.trim()) return false;
    const newComment: Comment = {
      id: crypto.randomUUID(),
      timestamp,
      text,
      initials,
      parentId,
    };
    const nextComments = [...comments, newComment];
    persistComments(nextComments);
    setReplyingToCommentId(null);
    return true;
  };

  const deleteComment = (id: string) => {
    if (!commentsPath) return;
    const nextComments = comments.filter((comment) => comment.id !== id);
    persistComments(nextComments);
    setConfirmDeleteId(null);
  };

  return {
    comments,
    addComment,
    deleteComment,
    replyingToCommentId,
    setReplyingToCommentId,
    confirmDeleteId,
    setConfirmDeleteId,
  };
};
