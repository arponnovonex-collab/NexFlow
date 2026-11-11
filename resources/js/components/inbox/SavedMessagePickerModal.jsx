import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../api/client';
import {
    Bookmark,
    Search,
    Zap,
    X,
    ExternalLink,
    Check,
    MessageSquare,
    CornerDownLeft,
    Sparkles,
    Image as ImageIcon,
} from 'lucide-react';

export const SavedMessagePickerModal = ({ isOpen, onClose, onSelectMessage }) => {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const searchInputRef = useRef(null);

    const categories = [
        { id: 'all', label: 'All' },
        { id: 'order', label: 'Order' },
        { id: 'sales', label: 'Sales' },
        { id: 'delivery', label: 'Delivery' },
        { id: 'payment', label: 'Payment' },
        { id: 'general', label: 'General' },
    ];

    useEffect(() => {
        if (isOpen) {
            fetchSavedMessages();
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        } else {
            setSearchQuery('');
            setSelectedCategory('all');
        }
    }, [isOpen]);

    const fetchSavedMessages = async () => {
        try {
            setLoading(true);
            const res = await api.get('/saved-messages?all=true');
            if (res.data?.success) {
                setMessages(res.data.data || []);
            }
        } catch (err) {
            console.error('Failed to load saved messages for picker:', err);
        } finally {
            setLoading(false);
        }
    };

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

    const handleSelect = (msg) => {
        // Fire-and-forget usage increment
        api.post(`/saved-messages/${msg.id}/use`).catch(() => {});
        onSelectMessage({ text: msg.content, imageUrl: msg.image_url });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                            <Bookmark className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                Saved SMS & Quick Replies
                            </h3>
                            <p className="text-[11px] text-slate-400">
                                Select any saved message to insert into your reply box
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <a
                            href="/shortcuts/saved-sms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors"
                            title="Manage Saved SMS Templates"
                        >
                            <span>Manage</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Search Bar & Categories */}
                <div className="p-3 bg-slate-950/60 border-b border-slate-800 space-y-2.5">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by title, shortcut (/confirm) or message text..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                                    selectedCategory === cat.id
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                                }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-slate-800">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-xs text-slate-400 mt-2">Loading templates...</span>
                        </div>
                    ) : filteredMessages.length === 0 ? (
                        <div className="text-center py-10 px-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center mx-auto mb-2 text-slate-400">
                                <Bookmark className="w-5 h-5" />
                            </div>
                            <h4 className="text-xs font-bold text-slate-200">No saved SMS found</h4>
                            <p className="text-[11px] text-slate-400 mt-1 mb-3">
                                {searchQuery
                                    ? `No matches for "${searchQuery}"`
                                    : 'You haven’t created any saved templates yet.'}
                            </p>
                            <a
                                href="/shortcuts/saved-sms"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Create Saved SMS</span>
                            </a>
                        </div>
                    ) : (
                        filteredMessages.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => handleSelect(item)}
                                className="p-3 bg-slate-950/70 hover:bg-indigo-950/30 border border-slate-800/90 hover:border-indigo-500/50 rounded-xl cursor-pointer transition-all group flex flex-col gap-1.5"
                            >
                                <div className="flex items-start gap-3">
                                    {item.image_url && (
                                        <div className="w-12 h-12 rounded-lg border border-slate-700 bg-slate-900 overflow-hidden shrink-0">
                                            <img
                                                src={item.image_url}
                                                alt={item.title}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-semibold text-xs text-white group-hover:text-indigo-300 transition-colors truncate">
                                                    {item.title}
                                                </span>
                                                {item.shortcut && (
                                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shrink-0">
                                                        {item.shortcut}
                                                    </span>
                                                )}
                                                {item.image_url && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 flex items-center gap-1">
                                                        <ImageIcon className="w-2.5 h-2.5" />
                                                        <span>Photo</span>
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                                    {item.category || 'General'}
                                                </span>
                                                <span className="text-[11px] text-indigo-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                                                    <CornerDownLeft className="w-3 h-3" />
                                                    <span>Insert</span>
                                                </span>
                                            </div>
                                        </div>

                                        <p className="text-xs text-slate-400 group-hover:text-slate-300 line-clamp-2 leading-relaxed mt-1">
                                            {item.content}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        Clicking any SMS inserts it into the reply box for quick editing
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SavedMessagePickerModal;

