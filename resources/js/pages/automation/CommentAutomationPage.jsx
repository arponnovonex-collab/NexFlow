import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Facebook } from '../../components/common/SocialIcons';
import {
    MessageSquare,
    Sparkles,
    CheckCircle,
    Clock,
    AlertCircle,
    ShoppingBag,
    Send,
    ThumbsUp,
    RefreshCw,
} from 'lucide-react';

export const CommentAutomationPage = () => {
    const [posts, setPosts] = useState([]);
    const [comments, setComments] = useState([]);
    const [selectedPost, setSelectedPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [replyingCommentId, setReplyingCommentId] = useState(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [postsRes, commentsRes] = await Promise.all([
                api.get('/posts?per_page=50'),
                api.get('/comments'),
            ]);
            setPosts(postsRes.data.data.data || []);
            setComments(commentsRes.data.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSyncPosts = async () => {
        setSyncing(true);
        try {
            await api.post('/posts/sync');
            await fetchData();
        } catch (err) {
            console.error(err);
        } finally {
            setSyncing(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleTriggerAiReply = async (comment) => {
        setReplyingCommentId(comment.id);
        try {
            await api.post(`/comments/${comment.id}/reply`);
            fetchData();
        } catch (err) {
            alert('Failed to generate AI comment reply');
        } finally {
            setReplyingCommentId(null);
        }
    };

    const handleApproveDraft = async (comment) => {
        try {
            await api.post(`/comments/${comment.id}/approve`, {
                reply_text: comment.reply_text,
            });
            fetchData();
        } catch (err) {
            alert('Failed to approve reply');
        }
    };

    const handleTogglePostAutoReply = async (post) => {
        try {
            const newStatus = !post.is_auto_reply_enabled;
            await api.put(`/posts/${post.id}`, {
                is_auto_reply_enabled: newStatus,
            });
            setPosts((prev) =>
                prev.map((p) => (p.id === post.id ? { ...p, is_auto_reply_enabled: newStatus } : p))
            );
        } catch (err) {
            alert('Failed to update post auto-reply status');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Facebook Comment Automation
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        AI-powered comment replies contextually grounded in verified MySQL product specs, stock & pricing.
                    </p>
                </div>
                <Button variant="secondary" size="sm" icon={RefreshCw} loading={syncing} onClick={handleSyncPosts}>
                    Sync Facebook Feed
                </Button>
            </div>

            {/* Posts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {posts.map((post) => (
                    <Card key={post.id} className="relative">
                        <div className="flex items-start gap-3">
                            <img
                                src={post.media_url || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=200'}
                                alt="Post thumbnail"
                                className="w-20 h-20 rounded-xl object-cover shrink-0 ring-1 ring-slate-800"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-blue-400 flex items-center gap-1">
                                        <Facebook className="w-3 h-3" /> {post.social_account?.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleTogglePostAutoReply(post)}
                                        title="Click to toggle auto-reply for this post"
                                        className="focus:outline-none"
                                    >
                                        <Badge variant={post.is_auto_reply_enabled ? 'primary' : 'neutral'} size="xs" className="cursor-pointer hover:opacity-80">
                                            {post.is_auto_reply_enabled ? 'Auto Reply Active' : 'Paused'}
                                        </Badge>
                                    </button>
                                </div>
                                <p className="text-xs text-slate-200 line-clamp-2 mt-1">{post.message}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    {post.products?.map((p) => (
                                        <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                                            <ShoppingBag className="w-2.5 h-2.5 text-indigo-400" /> {p.name} ({p.selling_price} BDT)
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Real-time Comments Stream */}
            <Card
                title="Customer Comments & Automated Decisions"
                subtitle="Live stream of incoming Facebook post comments and their automated replies"
            >
                <div className="divide-y divide-slate-800/60">
                    {comments.length === 0 ? (
                        <p className="py-8 text-center text-xs text-slate-400">No comments found.</p>
                    ) : (
                        comments.map((cmt) => (
                            <div key={cmt.id} className="py-4 space-y-2">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-slate-200">{cmt.customer_name}</span>
                                        <span className="text-[10px] text-slate-400">
                                            {new Date(cmt.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                        </span>
                                        {cmt.intent && (
                                            <Badge variant="info" size="xs">
                                                Intent: {cmt.intent}
                                            </Badge>
                                        )}
                                    </div>

                                    <Badge
                                        variant={cmt.reply_status === 'replied' ? 'success' : cmt.reply_status === 'requires_approval' ? 'warning' : 'neutral'}
                                        size="xs"
                                    >
                                        {cmt.reply_status}
                                    </Badge>
                                </div>

                                <p className="text-xs text-slate-300 pl-2 border-l-2 border-indigo-500/40">
                                    "{cmt.message}"
                                </p>

                                {cmt.reply_text ? (
                                    <div className="mt-2 ml-4 p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                                        <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-400 mb-1">
                                            <span className="flex items-center gap-1">
                                                <Sparkles className="w-3.5 h-3.5" /> Published NexFlow AI Reply
                                            </span>
                                            {cmt.reply_status === 'requires_approval' && (
                                                <Button
                                                    variant="success"
                                                    size="xs"
                                                    onClick={() => handleApproveDraft(cmt)}
                                                >
                                                    Approve & Publish
                                                </Button>
                                            )}
                                        </div>
                                        <p className="text-slate-300">{cmt.reply_text}</p>
                                    </div>
                                ) : (
                                    <div className="pt-1 flex items-center justify-end">
                                        <Button
                                            variant="secondary"
                                            size="xs"
                                            loading={replyingCommentId === cmt.id}
                                            icon={Sparkles}
                                            onClick={() => handleTriggerAiReply(cmt)}
                                        >
                                            Generate AI Reply
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </Card>
        </div>
    );
};
