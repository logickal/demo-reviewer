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
    const [isModalOpen, setIsModalOpen] = useState(false);
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
            setIsModalOpen(false);
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
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                        <span className="w-2 h-8 bg-orange-500 rounded-full"></span>
                        Release Feedback
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-400 bg-gray-50 px-3 py-1 rounded-full border border-gray-100 ml-2">
                            General Comments
                        </span>
                    </h2>

                    {!isGuest && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl text-sm font-black transition-all active:scale-95 shadow-lg shadow-orange-200 flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            Add Feedback
                        </button>
                    )}
                </div>

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
                            <div className="text-gray-300 text-xs">Be the first to share your feedback by clicking "Add Feedback" above!</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Feedback Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Add Release Feedback</h3>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Your Initials</label>
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newCommentInitials}
                                        onChange={(e) => setNewCommentInitials(e.target.value)}
                                        className="w-full max-w-[100px] px-4 py-3 rounded-2xl border border-gray-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all text-sm font-bold text-gray-900 placeholder:text-gray-300"
                                        placeholder="ABC"
                                        maxLength={3}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 ml-1">Comments</label>
                                    <textarea
                                        value={newCommentText}
                                        onChange={(e) => setNewCommentText(e.target.value)}
                                        className="w-full px-4 py-4 rounded-2xl border border-gray-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 outline-none transition-all text-sm min-h-[160px] resize-none text-gray-900 placeholder:text-gray-300 leading-relaxed"
                                        placeholder="What do you think of this release as a whole?"
                                    />
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-4 rounded-2xl text-sm font-black text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddGeneralComment}
                                    disabled={!newCommentText.trim() || !newCommentInitials.trim()}
                                    className="flex-[2] bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400 text-white px-8 py-4 rounded-2xl text-sm font-black transition-all active:scale-95 shadow-lg shadow-orange-200 flex items-center justify-center gap-2"
                                >
                                    Post Feedback
                                </button>
                            </div>
                        </div>
                    </div>
                    {/* Backdrop click to close */}
                    <div className="absolute inset-0 -z-10" onClick={() => setIsModalOpen(false)} />
                </div>
            )}
        </div>
    );
};

export default GeneralComments;
