import React, { useEffect, useState, useRef } from 'react';
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
    CheckCircle2,
    Clock,
    AlertCircle,
    ShoppingBag,
    Send,
    ThumbsUp,
    RefreshCw,
    Save,
    Bot,
    FileText,
    Loader2,
    ExternalLink,
    Video,
    Film,
    Image as ImageIcon,
} from 'lucide-react';

export const CommentAutomationPage = () => {
    const [posts, setPosts] = useState([]);
    const [comments, setComments] = useState([]);
    const [selectedPost, setSelectedPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [replyingCommentId, setReplyingCommentId] = useState(null);
    const [commentInstructions, setCommentInstructions] = useState('');
    const [savingInstructions, setSavingInstructions] = useState(false);
    const [savedNotice, setSavedNotice] = useState(false);

    // Infinite scroll for posts
    const [postsPage, setPostsPage] = useState(1);
    const [hasMorePosts, setHasMorePosts] = useState(true);
    const [loadingMorePosts, setLoadingMorePosts] = useState(false);
    const [totalPostsCount, setTotalPostsCount] = useState(0);

    const postsPageRef = useRef(1);
    const hasMorePostsRef = useRef(true);
    const loadingMorePostsRef = useRef(false);

    const fetchData = async (reset = true) => {
        try {
            if (reset) {
                setLoading(true);
                postsPageRef.current = 1;
                setPostsPage(1);
                hasMorePostsRef.current = true;
                setHasMorePosts(true);
            }
            const [postsRes, commentsRes, instRes] = await Promise.all([
                api.get('/posts?page=1&per_page=20'),
                api.get('/comments'),
                api.get('/automation/comment-instructions').catch(() => ({ data: { data: { instructions: '' } } })),
            ]);
            const paginated = postsRes.data?.data;
            const items = paginated?.data || [];
            setPosts(items);
            setTotalPostsCount(paginated?.total || items.length);
            setComments(commentsRes.data?.data?.data || []);
            if (instRes.data?.data?.instructions !== undefined) {
                setCommentInstructions(instRes.data.data.instructions || '');
            }

            const curPage = paginated?.current_page || 1;
            const lastPage = paginated?.last_page || 1;
            const more = curPage < lastPage;
            hasMorePostsRef.current = more;
            setHasMorePosts(more);
        } catch (err) {
            console.error(err);
        } finally {
            if (reset) setLoading(false);
        }
    };

    const loadMorePosts = async () => {
        if (loadingMorePostsRef.current || !hasMorePostsRef.current) return;
        loadingMorePostsRef.current = true;
        setLoadingMorePosts(true);

        try {
            const nextPage = postsPageRef.current + 1;
            const res = await api.get(`/posts?page=${nextPage}&per_page=20`);
            const paginated = res.data?.data;
            const newItems = paginated?.data || [];

            if (newItems.length > 0) {
                setPosts((prev) => {
                    const existingIds = new Set(prev.map((p) => p.id));
                    const unique = newItems.filter((p) => !existingIds.has(p.id));
                    return [...prev, ...unique];
                });
                postsPageRef.current = nextPage;
                setPostsPage(nextPage);
            }

            const curPage = paginated?.current_page || nextPage;
            const lastPage = paginated?.last_page || 1;
            const more = curPage < lastPage && newItems.length > 0;
            hasMorePostsRef.current = more;
            setHasMorePosts(more);
            if (paginated?.total) setTotalPostsCount(paginated.total);
        } catch (err) {
            console.error('Failed to load more posts', err);
        } finally {
            loadingMorePostsRef.current = false;
            setLoadingMorePosts(false);
        }
    };

    // Auto-load more posts on scroll
    useEffect(() => {
        const handleScroll = () => {
            const scrollBottom = window.innerHeight + window.scrollY;
            const docHeight = document.documentElement.scrollHeight;
            if (docHeight - scrollBottom < 350 && hasMorePostsRef.current && !loadingMorePostsRef.current) {
                loadMorePosts();
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleSyncPosts = async () => {
        setSyncing(true);
        try {
            const res = await api.post('/posts/sync');
            await fetchData(true);
            if (res.data?.message) {
                alert(res.data.message);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to sync Facebook feed: ' + (err.response?.data?.message || err.message));
        } finally {
            setSyncing(false);
        }
    };

    const handleSaveInstructions = async (e) => {
        e?.preventDefault();
        setSavingInstructions(true);
        try {
            await api.post('/automation/comment-instructions', {
                instructions: commentInstructions,
            });
            setSavedNotice(true);
            setTimeout(() => setSavedNotice(false), 4000);
        } catch (err) {
            alert('Failed to save comment AI instructions');
        } finally {
            setSavingInstructions(false);
        }
    };

    const sampleTemplate = `আপনি একজন অত্যন্ত অমায়িক, দক্ষ ও পেশাদার ই-কমার্স সেলস অ্যাসিস্ট্যান্ট।
ফেসবুক পোস্টের নিচে কাস্টমারদের কমেন্টের উত্তর দেওয়ার সময় নিচের প্রতিটি নির্দেশ অত্যন্ত সতর্কতার সাথে মেনে চলুন:

১. বাচনভঙ্গি ও ভাষা নির্বাচন:
- কাস্টমার যে ভাষায় প্রশ্ন বা মন্তব্য করবেন (বাংলা, ইংরেজি বা বাংলিশ), আপনিও হুবহু সেই ভাষায় স্বাভাবিক ও আন্তরিক ভঙ্গিতে উত্তর দিন।
- অতিরিক্ত রোবোটিক ভাব পরিহার করুন। সম্ভাষণে "আসসালামু আলাইকুম প্রিয় গ্রাহক" বা "Hello!" ব্যবহার করতে পারেন।

২. দাম ও সাইজ সংক্রান্ত নিয়ম:
- কাস্টমার যদি পণ্যের দাম জানতে চায়, সরাসরি এবং স্পষ্টভাবে সঠিক বিক্রয়মূল্য উল্লেখ করুন।
- শুধুমাত্র আমাদের ডাটাবেজে ভেরিফাইড প্রোডাক্ট ক্যাটালগে থাকা সঠিক মূল্য ও সাইজ (যেমনঃ M, L, XL, Free Size) উল্লেখ করবেন। কোনো অবস্থাতেই মনগড়া তথ্য বা অনুমান করে কথা বলবেন না।

৩. ডেলিভারি চার্জ ও সময়:
- ডেলিভারি চার্জ: ঢাকার ভেতরে ৭০ টাকা এবং ঢাকার বাইরে ১৩০ টাকা।
- ডেলিভারি সময়: ঢাকার ভেতর ১-২ কার্যদিবস এবং ঢাকার বাইরে ২-৪ কার্যদিবস।

৪. অর্ডার প্রক্রিয়া:
- আগ্রহী গ্রাহকদের সহজে অর্ডার নিশ্চিত করতে আপনার সাথে ইনবক্সে/মেসেঞ্জারে যোগাযোগ করতে বলুন অথবা নাম, সম্পূর্ণ ঠিকানা এবং সচল মোবাইল নম্বর লিখে মেসেজ পাঠাতে আন্তরিকভাবে আহ্বান জানান।

৫. স্টক ও অন্যান্য পণ্য:
- কোনো নির্দিষ্ট সাইজ বা কালার স্টক আউট থাকলে বিনীতভাবে দুঃখ প্রকাশ করুন এবং একই ক্যাটাগরির অন্য ডিজাইন দেখার আমন্ত্রণ জানান।`;

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

            {/* AI Comment Reply Custom Prompt & Multi-line Instructions Box */}
            <Card
                title="AI Comment Reply Custom Prompt & Instructions"
                subtitle="Provide custom prompt instructions, guidelines, reply templates, FAQs, or tone rules (up to several thousand lines). AI will strictly follow these instructions when replying to Facebook comments."
            >
                <form onSubmit={handleSaveInstructions} className="space-y-3">
                    <div className="relative">
                        <textarea
                            rows={8}
                            value={commentInstructions}
                            onChange={(e) => setCommentInstructions(e.target.value)}
                            placeholder="এখানে আপনি যেভাবে AI রিপ্লাই দিতে চান তার বিস্তারিত নিয়মাবলি ও ইনস্ট্রাকশন লিখে দিন (কয়েক হাজার লাইন পর্যন্ত সাপোর্ট করবে)..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-y min-h-[160px]"
                        />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1 font-mono text-[11px] bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
                                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                                {commentInstructions ? commentInstructions.split('\n').length : 0} lines · {commentInstructions.length} characters
                            </span>
                            {savedNotice && (
                                <span className="text-emerald-400 font-semibold flex items-center gap-1 text-xs">
                                    <CheckCircle2 className="w-4 h-4" /> Instructions Saved & Active!
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => setCommentInstructions(sampleTemplate)}
                            >
                                Insert Sample Template
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                icon={Save}
                                loading={savingInstructions}
                            >
                                Save AI Instructions
                            </Button>
                        </div>
                    </div>
                </form>
            </Card>

            {/* Posts Grid */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-300">
                        Synchronized Facebook Posts {totalPostsCount > 0 ? `(${posts.length} of ${totalPostsCount})` : `(${posts.length})`}
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {posts.map((post) => {
                        const isVideo = post.permalink?.includes('/reel/') || post.permalink?.includes('/videos/');
                        const isPlaceholderTitle = !post.message || post.message.startsWith('Facebook Post #');

                        return (
                            <Card key={post.id} className="relative hover:border-slate-700 transition-colors">
                                <div className="flex items-start gap-3.5">
                                    {/* Post Thumbnail with Video / Reel badge & hotlink-safe fallback */}
                                    <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 ring-1 ring-slate-800 bg-slate-950 flex items-center justify-center group/thumb">
                                        {post.media_url ? (
                                            <img
                                                src={post.media_url}
                                                alt="Post thumbnail"
                                                referrerPolicy="no-referrer"
                                                crossOrigin="anonymous"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = 'none';
                                                    const fallback = e.currentTarget.parentElement?.querySelector('.post-media-fallback');
                                                    if (fallback) fallback.classList.remove('hidden');
                                                }}
                                                className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105"
                                            />
                                        ) : null}
                                        <div className={`post-media-fallback ${post.media_url ? 'hidden' : 'flex'} flex-col items-center justify-center w-full h-full p-2 bg-gradient-to-br from-slate-900 to-slate-950 text-slate-500 text-center`}>
                                            {isVideo ? (
                                                <Video className="w-6 h-6 text-indigo-400 mb-0.5" />
                                            ) : (
                                                <Facebook className="w-6 h-6 text-blue-400 mb-0.5" />
                                            )}
                                            <span className="text-[9px] font-mono text-slate-400">Facebook</span>
                                        </div>

                                        {/* Video / Reel badge overlay */}
                                        {isVideo && (
                                            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[9px] font-bold text-rose-300 flex items-center gap-1 shadow-sm">
                                                <Film className="w-2.5 h-2.5 text-rose-400" />
                                                <span>Reel</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Post Content & Meta */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                                                <span className="text-[11px] font-semibold text-blue-400 flex items-center gap-1 truncate">
                                                    <Facebook className="w-3 h-3 shrink-0" /> {post.social_account?.name || 'Facebook Page'}
                                                </span>
                                                {post.permalink && (
                                                    <a
                                                        href={post.permalink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] text-slate-400 hover:text-indigo-300 inline-flex items-center gap-0.5 transition-colors shrink-0 ml-1"
                                                        title="View post on Facebook"
                                                    >
                                                        <span>View</span>
                                                        <ExternalLink className="w-2.5 h-2.5" />
                                                    </a>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleTogglePostAutoReply(post)}
                                                title="Click to toggle auto-reply for this post"
                                                className="focus:outline-none shrink-0"
                                            >
                                                <Badge variant={post.is_auto_reply_enabled ? 'primary' : 'neutral'} size="xs" className="cursor-pointer hover:opacity-80">
                                                    {post.is_auto_reply_enabled ? 'Auto Reply Active' : 'Paused'}
                                                </Badge>
                                            </button>
                                        </div>

                                        {/* Caption / Message */}
                                        <p className="text-xs text-slate-200 line-clamp-3 mt-1.5 leading-relaxed selection:bg-indigo-500 selection:text-white">
                                            {post.message || 'No caption available.'}
                                        </p>

                                        {/* Publication Date & Products */}
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            {post.published_at && (
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    📅 {new Date(post.published_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </span>
                                            )}
                                            {post.products?.map((p) => (
                                                <span key={p.id} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                                                    <ShoppingBag className="w-2.5 h-2.5 text-indigo-400" /> {p.name} ({p.selling_price} BDT)
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>

                {/* Infinite scroll loading & status */}
                {loadingMorePosts && (
                    <div className="py-4 flex items-center justify-center gap-2 text-xs text-indigo-400 font-medium">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                        <span>Loading more posts...</span>
                    </div>
                )}

                {hasMorePosts && !loadingMorePosts && posts.length > 0 && (
                    <div className="py-2 text-center">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={loadMorePosts}
                            icon={Loader2}
                        >
                            Load More Posts ({posts.length} of {totalPostsCount || 'more'})
                        </Button>
                    </div>
                )}

                {!hasMorePosts && posts.length > 0 && (
                    <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>All {posts.length} posts loaded</span>
                    </div>
                )}
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

                                {/* Post Context Preview Box */}
                                {cmt.post && (
                                    <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 my-1.5">
                                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-slate-900 ring-1 ring-slate-800 flex items-center justify-center">
                                            {cmt.post.media_url ? (
                                                <img
                                                    src={cmt.post.media_url}
                                                    alt=""
                                                    referrerPolicy="no-referrer"
                                                    crossOrigin="anonymous"
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                        e.currentTarget.parentElement?.querySelector('.post-thumb-fallback')?.classList.remove('hidden');
                                                    }}
                                                />
                                            ) : null}
                                            <div className={`post-thumb-fallback ${cmt.post.media_url ? 'hidden' : 'flex'} items-center justify-center w-full h-full text-blue-400`}>
                                                <Facebook className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="text-[10px] font-bold text-slate-400 truncate flex items-center gap-1">
                                                    <Facebook className="w-2.5 h-2.5 text-blue-400" />
                                                    <span>{cmt.post.social_account?.name || 'Facebook Post'}</span>
                                                </span>
                                                {cmt.post.permalink && (
                                                    <a
                                                        href={cmt.post.permalink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-0.5 shrink-0"
                                                    >
                                                        <span>View</span>
                                                        <ExternalLink className="w-2.5 h-2.5" />
                                                    </a>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-slate-300 truncate">
                                                {cmt.post.message || 'Facebook Post'}
                                            </p>
                                        </div>
                                    </div>
                                )}

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
