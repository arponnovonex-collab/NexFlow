import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Facebook } from '../../components/common/SocialIcons';
import {
    Layers,
    ShoppingBag,
    Link,
    CheckCircle2,
    Sliders,
    Plus,
    RefreshCw,
    ExternalLink,
} from 'lucide-react';

export const PostProductMappingPage = () => {
    const [posts, setPosts] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [mappingModal, setMappingModal] = useState(null);
    const [selectedProductIds, setSelectedProductIds] = useState([]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [postsRes, prodsRes] = await Promise.all([
                api.get('/posts?per_page=50'),
                api.get('/products'),
            ]);
            setPosts(postsRes.data.data.data || []);
            setProducts(prodsRes.data.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSyncPosts = async () => {
        setSyncing(true);
        try {
            const res = await api.post('/posts/sync');
            await fetchData();
            alert(res.data?.message || 'Posts synchronized successfully from Facebook!');
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to sync posts from Facebook');
        } finally {
            setSyncing(false);
        }
    };

    const openMappingModal = (post) => {
        setMappingModal(post);
        setSelectedProductIds(post.products?.map((p) => p.id) || []);
    };

    const handleSaveMapping = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/posts/${mappingModal.id}`, {
                product_ids: selectedProductIds,
            });
            setMappingModal(null);
            fetchData();
        } catch (err) {
            alert('Failed to update mapping');
        }
    };

    const toggleProductSelection = (id) => {
        setSelectedProductIds((prev) =>
            prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Post-to-Product Mapping Engine
                        <Badge variant="primary" size="xs">
                            {posts.length} Posts
                        </Badge>
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Map each Facebook post to verified catalog products so AI only quotes accurate pricing, stock and details.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="primary"
                        size="sm"
                        icon={RefreshCw}
                        loading={syncing}
                        onClick={handleSyncPosts}
                    >
                        Sync Facebook Posts
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center text-xs text-slate-400">Loading posts and products...</div>
            ) : posts.length === 0 ? (
                <Card className="py-12 text-center">
                    <Layers className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-slate-200">No posts found yet</h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                        Fetch your published Facebook Page posts to start mapping them with your catalog products.
                    </p>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={RefreshCw}
                        loading={syncing}
                        onClick={handleSyncPosts}
                    >
                        Fetch Facebook Posts Now
                    </Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {posts.map((post) => (
                        <Card key={post.id} className="relative flex flex-col justify-between">
                            <div>
                                <div className="flex items-start gap-3">
                                    <img
                                        src={post.media_url || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=200'}
                                        alt="Post media"
                                        className="w-20 h-20 rounded-xl object-cover ring-1 ring-slate-800 shrink-0 bg-slate-900"
                                        onError={(e) => {
                                            e.target.src = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=200';
                                        }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-semibold text-blue-400 flex items-center gap-1">
                                                <Facebook className="w-3 h-3" /> {post.social_account?.name || 'Facebook Page'}
                                            </span>
                                            {post.permalink && (
                                                <a
                                                    href={post.permalink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                                                >
                                                    View on FB <ExternalLink className="w-2.5 h-2.5" />
                                                </a>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-200 line-clamp-3 mt-1 font-medium">
                                            {post.message || <span className="italic text-slate-400">(Photo/Video Post)</span>}
                                        </p>
                                        {post.published_at && (
                                            <span className="text-[10px] text-slate-400 block mt-1">
                                                Published: {new Date(post.published_at).toLocaleDateString([], { dateStyle: 'medium' })}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Mapped Products */}
                                <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                                        Mapped Products ({post.products?.length || 0}):
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {post.products?.length > 0 ? (
                                            post.products.map((p) => (
                                                <span
                                                    key={p.id}
                                                    className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 flex items-center gap-1.5"
                                                >
                                                    <ShoppingBag className="w-3 h-3 text-indigo-400" />
                                                    <strong>{p.name}</strong> · {p.selling_price} BDT
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-amber-400 italic">
                                                No product mapped yet. AI will reply with general brand knowledge.
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-end">
                                <Button
                                    variant="secondary"
                                    size="xs"
                                    icon={Link}
                                    onClick={() => openMappingModal(post)}
                                >
                                    Edit Product Mapping
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Edit Mapping Modal */}
            <Modal
                isOpen={!!mappingModal}
                onClose={() => setMappingModal(null)}
                title={`Map Products to Post #${mappingModal?.platform_post_id}`}
            >
                <form onSubmit={handleSaveMapping} className="space-y-4">
                    <p className="text-xs text-slate-300">
                        Select which products are featured in this post:
                    </p>

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                        {products.map((p) => {
                            const isChecked = selectedProductIds.includes(p.id);
                            return (
                                <div
                                    key={p.id}
                                    onClick={() => toggleProductSelection(p.id)}
                                    className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                                        isChecked
                                            ? 'bg-indigo-950/40 border-indigo-500/40 text-white'
                                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800/40'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => {}}
                                            className="rounded bg-slate-900 border-slate-700 text-indigo-600"
                                        />
                                        <div>
                                            <span className="text-xs font-semibold block">{p.name}</span>
                                            <span className="text-[10px] text-slate-400">SKU: {p.sku}</span>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-emerald-400">
                                        {p.selling_price} BDT
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => setMappingModal(null)}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" type="submit">
                            Save Mapping
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
