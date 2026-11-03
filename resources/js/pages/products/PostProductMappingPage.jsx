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
} from 'lucide-react';

export const PostProductMappingPage = () => {
    const [posts, setPosts] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mappingModal, setMappingModal] = useState(null);
    const [selectedProductIds, setSelectedProductIds] = useState([]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [postsRes, prodsRes] = await Promise.all([
                api.get('/posts'),
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
            <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    Post-to-Product Mapping Engine
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                    Map each Facebook or Instagram post to verified catalog products so AI only quotes relevant pricing and stock.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {posts.map((post) => (
                    <Card key={post.id} className="relative flex flex-col justify-between">
                        <div>
                            <div className="flex items-start gap-3">
                                <img
                                    src={post.media_url || 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=200'}
                                    alt="Post media"
                                    className="w-20 h-20 rounded-xl object-cover ring-1 ring-slate-800 shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-semibold text-blue-400 flex items-center gap-1">
                                            <Facebook className="w-3 h-3" /> {post.social_account?.name}
                                        </span>
                                        <span className="text-[10px] text-slate-400">Post ID: {post.platform_post_id}</span>
                                    </div>
                                    <p className="text-xs text-slate-200 line-clamp-2 mt-1">{post.message}</p>
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
                                            No product mapped. AI will reply with general brand details.
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
