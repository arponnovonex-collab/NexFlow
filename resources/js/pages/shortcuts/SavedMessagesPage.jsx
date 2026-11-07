import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';

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

    // Form fields
    const [formData, setFormData] = useState({
        title: '',
        content: '',
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
            showToast('Failed to load saved SMS list');
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
            shortcut: item.shortcut || '',
            category: item.category || 'general',
            is_active: item.is_active ?? true,
        });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            setFormError('Please provide a title for the saved SMS.');
            return;
        }
        if (!formData.content.trim()) {
            setFormError('Please enter the SMS or message content.');
            return;
        }

        setSubmitting(true);
        setFormError('');

        try {
            if (editingItem) {
                const res = await api.put(`/saved-messages/${editingItem.id}`, formData);
                if (res.data?.success) {
                    showToast('Saved SMS updated successfully!');
                    setIsModalOpen(false);
                    fetchMessages();
                }
            } else {
                const res = await api.post('/saved-messages', formData);
                if (res.data?.success) {
                    showToast('New saved SMS created successfully!');
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
            showToast('Saved SMS deleted successfully');
            setMessages((prev) => prev.filter((m) => m.id !== id));
        } catch (err) {
            console.error('Failed to delete message:', err);
            showToast('Failed to delete saved SMS');
        }
    };

    const handleCopyContent = (item) => {
        navigator.clipboard.writeText(item.content);
        setCopiedId(item.id);
        setTimeout(() => setCopiedId(null), 2000);
        showToast('SMS text copied to clipboard!');
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
                            Saved SMS & Quick Replies
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                Shortcut
                            </span>
                        </h1>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Create and manage pre-saved message templates for 1-click insertion and replies in Unified Inbox.
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
                        Create Saved SMS
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
                        <p className="text-xs font-medium text-slate-400">Total Times Used</p>
                        <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                            {messages.reduce((acc, curr) => acc + (curr.usage_count || 0), 0)}
                        </h3>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                        <Zap className="w-5 h-5" />
                    </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-400">Inbox Quick Access</p>
                        <h3 className="text-sm font-semibold text-cyan-400 mt-1.5 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" /> Ready in Unified Inbox
                        </h3>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                        <Send className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search saved SMS by title, text content, or shortcut (/order)..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                        >
                            <X className="w-4 h-4" />
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
                    <h3 className="text-base font-bold text-white">No Saved SMS Found</h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto mt-1 mb-6">
                        {searchQuery || selectedCategory !== 'all'
                            ? 'No saved templates matched your search criteria. Try a different keyword.'
                            : 'Save your most frequently sent replies, product explanations, or address requests for fast 1-click messaging.'}
                    </p>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={handleOpenCreateModal}
                        icon={Plus}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                    >
                        Create First Saved SMS
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredMessages.map((item) => (
                        <div
                            key={item.id}
                            className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 flex flex-col justify-between transition-all group"
                        >
                            <div>
                                {/* Card Header */}
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-slate-100 text-sm truncate flex items-center gap-2">
                                            {item.title}
                                            {item.shortcut && (
                                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                                                    {item.shortcut}
                                                </span>
                                            )}
                                        </h3>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/50">
                                            {item.category || 'General'}
                                        </span>
                                    </div>
                                </div>

                                {/* Content Preview */}
                                <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300 leading-relaxed font-normal whitespace-pre-wrap max-h-36 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                                    {item.content}
                                </div>
                            </div>

                            {/* Card Footer */}
                            <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
                                <div className="flex items-center gap-3">
                                    <span className="flex items-center gap-1 text-slate-400">
                                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                                        Used {item.usage_count || 0} times
                                    </span>
                                    <span className="text-slate-500">•</span>
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
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                <Bookmark className="w-5 h-5 text-indigo-400" />
                                {editingItem ? 'Edit Saved SMS' : 'Create New Saved SMS'}
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
                                    SMS Title <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g. Order Confirmation, Address Request"
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
                                        placeholder="e.g. /confirm or /address"
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

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                        SMS / Message Text <span className="text-rose-400">*</span>
                                    </label>
                                    <span className="text-[11px] text-slate-400">
                                        {smsMetrics.charCount} chars • {smsMetrics.segments} SMS ({smsMetrics.isUnicode ? 'Unicode' : 'GSM'})
                                    </span>
                                </div>
                                <textarea
                                    rows={5}
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
                                    {editingItem ? 'Update Saved SMS' : 'Save Template'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SavedMessagesPage;
