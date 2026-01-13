'use client';
import React, { useState } from 'react';
import CommentItem from './CommentItem';
import type { Comment } from './types';

interface GeneralCommentsProps {
    comments: Comment[];
    isGuest: boolean;
    replyingToCommentId: string | null;
    setReplyingToCommentId: (id: string | null) => void;
    confirmDeleteId: string | null;
    setConfirmDeleteId: (id: string | null) => void;
    addComment: (input: { text: string; initials: string; timestamp?: number | null; parentId?: string }) => boolean;
    deleteComment: (id: string) => void;
}

const GeneralComments = ({
    comments,
    isGuest,
    replyingToCommentId,
    setReplyingToCommentId,
    confirmDeleteId,
    setConfirmDeleteId,
    addComment,
    deleteComment,
}: GeneralCommentsProps) => {
    const [newCommentText, setNewCommentText] = useState('');
    const [newCommentInitials, setNewCommentInitials] = useState('');
    const [replyText, setReplyText] = useState('');
    const [replyInitials, setReplyInitials] = useState('');

    const handleAddGeneralComment = () => {
        const didAdd = addComment({
            text: newCommentText,
            initials: newCommentInitials,
        });
        if (didAdd) {
            setNewCommentText('');
            setNewCommentInitials('');
        }
    };

    const handleAddReply = (parentId: string) => {
        const didAdd = addComment({
            text: replyText,
            initials: replyInitials,
            parentId,
        });
        if (didAdd) {
            setReplyText('');
            setReplyInitials('');
        }
    };

    const sortedComments = [...comments]
        .filter((comment) => !comment.parentId || !comments.some((parent) => parent.id === comment.parentId))
        .sort((a, b) => {
            if (a.createdAt && b.createdAt) return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return 0;
        });

    return (
        <div className="mt-12 w-full max-w-5xl">
            <div className="p-8 bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100">
                <h2 className="text-2xl font-black mb-8 text-gray-900 flex items-center gap-3">
                    <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
                    Release Feedback
                    <span className="text-xs font-bold uppercase tracking-widest text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100 ml-2">
                        General Comments
                    </span>
                </h2>

                {!isGuest && (
                    <div className="mb-12 p-6 bg-orange-50/30 rounded-2xl border border-orange-100/50">
                        <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-wider">Add a general comment</h3>
                        <div className="flex flex-col gap-4">
                            <input
                                type="text"
                                value={newCommentInitials}
                                onChange={(e) => setNewCommentInitials(e.target.value)}
                                className="w-full max-w-[120px] px-4 py-2.5 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all text-sm font-medium text-gray-900 placeholder:text-gray-400"
                                placeholder="Initials"
                                maxLength={3}
                            />
                            <textarea
                                value={newCommentText}
                                onChange={(e) => setNewCommentText(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all text-sm min-h-[120px] resize-none text-gray-900 placeholder:text-gray-400"
                                placeholder="Share your thoughts on this release..."
                            />
                            <div className="flex justify-end">
                                <button
                                    onClick={handleAddGeneralComment}
                                    disabled={!newCommentText.trim() || !newCommentInitials.trim()}
                                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 text-white px-8 py-3 rounded-xl text-sm font-black transition-all active:scale-95 shadow-lg shadow-orange-200"
                                >
                                    Post Comment
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-6">
                    {sortedComments.map((comment) => (
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
                            showReplyButton={!isGuest}
                            onDelete={deleteComment}
                            confirmDeleteId={confirmDeleteId}
                            setConfirmDeleteId={setConfirmDeleteId}
                        />
                    ))}

                    {sortedComments.length === 0 && (
                        <div className="py-16 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                            <div className="text-gray-400 font-medium mb-1">No general comments yet.</div>
                            <div className="text-gray-300 text-xs">Be the first to share your feedback!</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GeneralComments;
