import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../api/client';
import {
    Bookmark,
    Plus,
    Search,
    Edit2,
    Trash2,
    Copy,
    Check,
    Tag,
    Zap,
    MessageSquare,
    AlertCircle,
    CheckCircle2,
    Sparkles,
    Send,
    Filter,
    X,
    Image as ImageIcon,
    UploadCloud,
    FolderOpen,
    ExternalLink,
    Eye,
    Link,
    Loader2,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { MediaPickerModal } from '../../components/media/MediaPickerModal';

export const SavedMessagesPage = () => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [toastMessage, setToastMessage] = useState('');
    const [copiedId, setCopiedId] = useState(null);

    // Media & Image state
    const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [lightboxImage, setLightboxImage] = useState(null); // { url, title }
    const fileInputRef = useRef(null);

    // Form fields
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        image_url: '',
        shortcut: '',
        category: 'general',
        is_active: true,
    });

    const categories = [
        { id: 'all', label: 'All Categories' },
        { id: 'general', label: 'General' },
        { id: 'order', label: 'Order' },
        { id: 'sales', label: 'Sales' },
        { id: 'delivery', label: 'Delivery' },
        { id: 'payment', label: 'Payment' },
        { id: 'support', label: 'Support' },
    ];

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    const fetchMessages = async () => {
        try {
            setLoading(true);
            const res = await api.get('/saved-messages?all=true');
            if (res.data?.success) {
                setMessages(res.data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch saved messages:', err);
            showToast('Failed to load saved messages list');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, []);

    const handleOpenCreateModal = () => {
        setEditingItem(null);
        setFormData({
            title: '',
            content: '',
            image_url: '',
            shortcut: '',
            category: 'general',
            is_active: true,
        });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (item) => {
        setEditingItem(item);
        setFormData({
            title: item.title,
            content: item.content,
            image_url: item.image_url || '',
            shortcut: item.shortcut || '',
            category: item.category || 'general',
            is_active: item.is_active ?? true,
        });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleImageFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            setFormError('Image size must be less than 5MB.');
            return;
        }

        try {
            setUploadingImage(true);
            setFormError('');
            const form = new FormData();
            form.append('image', file);

            const res = await api.post('/saved-messages/upload-image', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (res.data?.success && res.data?.image_url) {
                setFormData((prev) => ({ ...prev, image_url: res.data.image_url }));
                showToast('Image uploaded and attached successfully!');
            }
        } catch (err) {
            console.error('Image upload failed:', err);
            setFormError(err.response?.data?.message || 'Failed to upload image. Please try again.');
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSelectMediaItem = (media) => {
        if (media?.file_url) {
            setFormData((prev) => ({ ...prev, image_url: media.file_url }));
            setMediaPickerOpen(false);
            showToast('Image selected from Media Library!');
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            setFormError('Please provide a title for the saved message.');
            return;
        }
        if (!formData.content.trim()) {
            setFormError('Please enter the message content.');
            return;
        }

        setSubmitting(true);
        setFormError('');

        try {
            if (editingItem) {
                const res = await api.put(`/saved-messages/${editingItem.id}`, formData);
                if (res.data?.success) {
                    showToast('Saved message updated successfully!');
                    setIsModalOpen(false);
                    fetchMessages();
                }
            } else {
                const res = await api.post('/saved-messages', formData);
                if (res.data?.success) {
                    showToast('New saved message created successfully!');
                    setIsModalOpen(false);
                    fetchMessages();
                }
            }
        } catch (err) {
            console.error('Failed to save message:', err);
            setFormError(err.response?.data?.message || 'Failed to save. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id, title) => {
        if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

        try {
            await api.delete(`/saved-messages/${id}`);
            showToast('Saved message deleted successfully');
            setMessages((prev) => prev.filter((m) => m.id !== id));
        } catch (err) {
            console.error('Failed to delete message:', err);
            showToast('Failed to delete saved message');
        }
    };

    const handleCopyContent = (item) => {
        navigator.clipboard.writeText(item.content);
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 2000);
        showToast('Message text copied to clipboard!');
    };

    // Filter messages by search query & category
    const filteredMessages = useMemo(() => {
        return messages.filter((msg) => {
            const matchesCat = selectedCategory === 'all' || msg.category === selectedCategory;
            const q = searchQuery.toLowerCase().trim();
            const matchesQuery =
                !q ||
                msg.title?.toLowerCase().includes(q) ||
                msg.content?.toLowerCase().includes(q) ||
                msg.shortcut?.toLowerCase().includes(q);
            return matchesCat && matchesQuery;
        });
    }, [messages, searchQuery, selectedCategory]);

    // Calculate SMS character counter & segments
    const smsMetrics = useMemo(() => {
        const text = formData.content || '';
        const isUnicode = /[^\u0000-\u007F]/.test(text); // Checks if Bangla or non-ASCII
        const charCount = text.length;
        let segmentLimit = isUnicode ? 70 : 160;
        let multiSegmentLimit = isUnicode ? 67 : 153;
        let segments = 1;

        if (charCount > segmentLimit) {
            segments = Math.ceil(charCount / multiSegmentLimit);
        }

        return {
            charCount,
            isUnicode,
            segments,
        };
    }, [formData.content]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-indigo-500/50 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="text-sm font-medium">{toastMessage}</span>
                </div>
            )}

            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-6 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                        <Bookmark className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            Saved Messages & Quick Replies
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                Text + Image
                            </span>
                        </h1>
                        <p className="text-sm text-slate-400 mt-0.5">
                            টেক্সট এবং ছবির সমন্বয়ে কুইক রিপ্লাই টেমপ্লেট তৈরি ও সংরক্ষণ করুন — ইনবক্সে ১-ক্লিকে গ্রাহককে পাঠানোর জন্য।
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="primary"
                        onClick={handleOpenCreateModal}
                        icon={Plus}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer shadow-lg shadow-indigo-600/20"
                    >
                        Create Saved Message
                    </Button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-400">Total Saved Templates</p>
                        <h3 className="text-2xl font-bold text-white mt-1">{messages.length}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <MessageSquare className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-400">Templates with Image</p>
                        <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                            {messages.filter(m => !!m.image_url).length}
                        </h3>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <ImageIcon className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-400">Total Times Used</p>
                        <h3 className="text-2xl font-bold text-amber-400 mt-1">
                            {messages.reduce((acc, m) => acc + (m.usage_count || 0), 0)}
                        </h3>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                        <Zap className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by title, shortcut (/confirm) or message text..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                                selectedCategory === cat.id
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Saved Messages Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs text-slate-400 mt-3 font-medium">Loading saved messages...</p>
                </div>
            ) : filteredMessages.length === 0 ? (
                <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <Bookmark className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-white">No Saved Messages Found</h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-6">
                        {searchQuery || selectedCategory !== 'all'
                            ? 'No saved templates matched your search criteria. Try a different keyword.'
                            : 'Save your most frequently sent replies, product explanations, bank details, or photos for fast 1-click messaging.'}
                    </p>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={handleOpenCreateModal}
                        icon={Plus}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                    >
                        Create First Saved Message
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredMessages.map((item) => (
                        <div
                            key={item.id}
                            className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 flex flex-col justify-between transition-all group overflow-hidden shadow-lg"
                        >
                            <div className="space-y-3">
                                {/* Card Header */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-slate-100 text-sm truncate flex items-center gap-1.5">
                                            {item.title}
                                            {item.shortcut && (
                                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                                                    {item.shortcut}
                                                </span>
                                            )}
                                        </h3>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        {item.image_url && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                                <ImageIcon className="w-3 h-3 text-emerald-400" />
                                                <span>Photo</span>
                                            </span>
                                        )}
                                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                                            {item.category || 'General'}
                                        </span>
                                    </div>
                                </div>

                                {/* Image Preview Thumbnail if attached */}
                                {item.image_url && (
                                    <div className="relative group/img rounded-lg overflow-hidden border border-slate-800 bg-slate-950 h-36 flex items-center justify-center">
                                        <img
                                            src={item.image_url}
                                            alt={item.title}
                                            className="w-full h-full object-cover cursor-pointer group-hover/img:scale-105 transition-transform duration-300"
                                            onClick={() => setLightboxImage({ url: item.image_url, title: item.title })}
                                        />
                                        <div
                                            onClick={() => setLightboxImage({ url: item.image_url, title: item.title })}
                                            className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover/img:opacity-100 flex items-center justify-center gap-1.5 text-white text-xs font-semibold cursor-pointer transition-opacity backdrop-blur-xs"
                                        >
                                            <Eye className="w-4 h-4" />
                                            <span>ছবি বড় করে দেখুন</span>
                                        </div>
                                    </div>
                                )}

                                {/* Content Preview */}
                                <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300 leading-relaxed font-normal whitespace-pre-wrap max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                                    {item.content}
                                </div>
                            </div>

                            {/* Card Footer */}
                            <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                                <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1 text-slate-400">
                                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                                        Used {item.usage_count || 0}
                                    </span>
                                    <span className="text-slate-600">•</span>
                                    <span>{item.content?.length || 0} chars</span>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleCopyContent(item)}
                                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                                        title="Copy Text to Clipboard"
                                    >
                                        {copiedId === item.id ? (
                                            <Check className="w-4 h-4 text-emerald-400" />
                                        ) : (
                                            <Copy className="w-4 h-4" />
                                        )}
                                    </button>

                                    {item.image_url && (
                                        <a
                                            href={item.image_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                                            title="View / Download Image"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => handleOpenEditModal(item)}
                                        className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                                        title="Edit Template"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleDelete(item.id, item.title)}
                                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                                        title="Delete Template"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create / Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <Bookmark className="w-5 h-5 text-indigo-400" />
                                {editingItem ? 'Edit Saved Message' : 'Create New Saved Message'}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                            {formError && (
                                <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{formError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Message Title <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g. Order Confirmation, Bkash Payment Info, Size Chart"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Shortcut Code (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.shortcut}
                                        onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                                        placeholder="e.g. /confirm or /bkash"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Category
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer"
                                    >
                                        <option value="general">General</option>
                                        <option value="order">Order</option>
                                        <option value="sales">Sales</option>
                                        <option value="delivery">Delivery</option>
                                        <option value="payment">Payment</option>
                                        <option value="support">Support</option>
                                    </select>
                                </div>
                            </div>

                            {/* Image Attachment Section */}
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                        <ImageIcon className="w-4 h-4 text-indigo-400" />
                                        <span>সংযুক্ত ছবি (Attached Image)</span>
                                    </label>
                                    {formData.image_url && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, image_url: '' })}
                                            className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            <span>ছবি মুছুন</span>
                                        </button>
                                    )}
                                </div>

                                {formData.image_url ? (
                                    <div className="relative rounded-xl border border-slate-700 bg-slate-900 overflow-hidden group">
                                        <img
                                            src={formData.image_url}
                                            alt="Preview"
                                            className="w-full h-44 object-cover"
                                        />
                                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2.5 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={() => setLightboxImage({ url: formData.image_url, title: formData.title || 'Preview' })}
                                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                <span>জুম দেখুন</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-600"
                                            >
                                                <UploadCloud className="w-3.5 h-3.5" />
                                                <span>পরিবর্তন করুন</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <button
                                                type="button"
                                                disabled={uploadingImage}
                                                onClick={() => fileInputRef.current?.click()}
                                                className="py-3 px-3 rounded-xl border border-dashed border-slate-700 hover:border-indigo-500/70 bg-slate-900 hover:bg-indigo-950/20 text-slate-300 hover:text-white flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-medium cursor-pointer"
                                            >
                                                {uploadingImage ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                                                        <span>আপলোড হচ্ছে...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <UploadCloud className="w-5 h-5 text-indigo-400" />
                                                        <span className="font-semibold text-slate-200">কম্পিউটার থেকে আপলোড</span>
                                                        <span className="text-[10px] text-slate-500">JPG, PNG, WebP (Max 5MB)</span>
                                                    </>
                                                )}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setMediaPickerOpen(true)}
                                                className="py-3 px-3 rounded-xl border border-slate-700 hover:border-emerald-500/70 bg-slate-900 hover:bg-emerald-950/20 text-slate-300 hover:text-white flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-medium cursor-pointer"
                                            >
                                                <FolderOpen className="w-5 h-5 text-emerald-400" />
                                                <span className="font-semibold text-slate-200">মিডিয়া লাইব্রেরি থেকে পছন্দ</span>
                                                <span className="text-[10px] text-slate-500">পূর্বে আপলোডকৃত ফাইলসমূহ</span>
                                            </button>
                                        </div>

                                        <div className="relative">
                                            <input
                                                type="url"
                                                value={formData.image_url}
                                                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                                                placeholder="অথবা সরাসরি ছবির অনলাইন লিঙ্ক (URL) পেস্ট করুন..."
                                                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                                            />
                                            <Link className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                                        </div>
                                    </div>
                                )}

                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageFileChange}
                                    className="hidden"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                        Message Content / Text <span className="text-rose-400">*</span>
                                    </label>
                                    <span className="text-[11px] text-slate-400">
                                        {smsMetrics.charCount} chars • {smsMetrics.segments} SMS ({smsMetrics.isUnicode ? 'Unicode' : 'GSM'})
                                    </span>
                                </div>
                                <textarea
                                    rows={4}
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    placeholder="Write your template text here... You can edit this message before sending it from the inbox."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
                                    required
                                />
                            </div>

                            {/* Modal Actions */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setIsModalOpen(false)}
                                    className="cursor-pointer"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    loading={submitting}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer shadow-lg shadow-indigo-600/20"
                                >
                                    {editingItem ? 'Update Template' : 'Save Template'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Media Picker Modal for selecting existing media */}
            <MediaPickerModal
                isOpen={mediaPickerOpen}
                onClose={() => setMediaPickerOpen(false)}
                onSelectMedia={handleSelectMediaItem}
            />

            {/* Full-screen Image Lightbox Modal */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
                    onClick={() => setLightboxImage(null)}
                >
                    <div
                        className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
                            <span className="font-semibold text-white truncate max-w-md">
                                {lightboxImage.title || 'Image Preview'}
                            </span>
                            <div className="flex items-center gap-2">
                                <a
                                    href={lightboxImage.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                    title="Open in new tab"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setLightboxImage(null)}
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                    title="Close"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="p-2 flex items-center justify-center overflow-auto max-h-[80vh]">
                            <img
                                src={lightboxImage.url}
                                alt="Full size"
                                className="max-w-full max-h-[75vh] object-contain rounded-lg"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SavedMessagesPage;
