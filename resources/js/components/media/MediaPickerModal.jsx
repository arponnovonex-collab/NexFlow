import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import { Button } from '../common/Button';
import {
    FolderOpen,
    Image as ImageIcon,
    Video,
    Music,
    FileText,
    Search,
    X,
    Check,
    UploadCloud,
    Play,
} from 'lucide-react';

export const MediaPickerModal = ({ isOpen, onClose, onSelectMedia }) => {
    const [mediaItems, setMediaItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterType, setFilterType] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const quickUploadRef = useRef(null);

    const fetchMedia = async (type = filterType, search = searchQuery) => {
        setLoading(true);
        try {
            const params = { per_page: 36 };
            if (type && type !== 'all') params.type = type;
            if (search && search.trim()) params.search = search.trim();

            const res = await api.get('/media', { params });
            if (res.data?.status === 'success') {
                const list = res.data.data?.data || res.data.data || [];
                setMediaItems(list);
            }
        } catch (err) {
            console.error('Failed to load media for picker', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchMedia(filterType, searchQuery);
            setSelectedItem(null);
        }
    }, [isOpen, filterType]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchMedia(filterType, searchQuery);
    };

    const handleQuickUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const formData = new FormData();
        Array.from(files).forEach((f) => {
            formData.append('files[]', f);
        });

        try {
            const res = await api.post('/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (res.data?.status === 'success') {
                const uploaded = res.data.files?.[0];
                if (uploaded) {
                    setSelectedItem(uploaded);
                }
                fetchMedia(filterType, searchQuery);
            }
        } catch (err) {
            alert('Upload failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsUploading(false);
        }
    };

    const handleConfirm = () => {
        if (selectedItem) {
            onSelectMedia(selectedItem);
            onClose();
        }
    };

    if (!isOpen) return null;

    const typeBadges = [
        { key: 'all', label: 'All', icon: FolderOpen },
        { key: 'image', label: 'Images', icon: ImageIcon },
        { key: 'video', label: 'Videos', icon: Video },
        { key: 'audio', label: 'Audio', icon: Music },
        { key: 'document', label: 'Docs', icon: FileText },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[88vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                            <FolderOpen className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-white">
                                Select from Media Library
                            </h3>
                            <p className="text-[11px] text-slate-400">
                                Choose a saved photo, video, audio file or document to send to this customer
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            ref={quickUploadRef}
                            type="file"
                            multiple
                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                            onChange={handleQuickUpload}
                            className="hidden"
                        />
                        <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            loading={isUploading}
                            onClick={() => quickUploadRef.current?.click()}
                            icon={UploadCloud}
                        >
                            Quick Upload
                        </Button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="p-3 border-b border-slate-800/80 bg-slate-950/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                        {typeBadges.map((badge) => {
                            const Icon = badge.icon;
                            const isActive = filterType === badge.key;
                            return (
                                <button
                                    key={badge.key}
                                    type="button"
                                    onClick={() => setFilterType(badge.key)}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                                        isActive
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    <span>{badge.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <form onSubmit={handleSearchSubmit} className="relative min-w-[200px]">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter files..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                    </form>
                </div>

                {/* Media Grid */}
                <div className="p-4 flex-1 overflow-y-auto min-h-[300px]">
                    {loading ? (
                        <div className="py-20 text-center">
                            <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-xs text-slate-400">Loading library...</p>
                        </div>
                    ) : mediaItems.length === 0 ? (
                        <div className="py-16 text-center">
                            <FolderOpen className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-50" />
                            <p className="text-xs font-medium text-slate-300">No media files found</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Click "Quick Upload" above to add new photos or videos
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {mediaItems.map((item) => {
                                const isSelected = selectedItem?.id === item.id;
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedItem(item)}
                                        className={`group relative rounded-xl border transition-all cursor-pointer overflow-hidden flex flex-col ${
                                            isSelected
                                                ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/40'
                                                : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="aspect-square w-full bg-slate-900 flex items-center justify-center relative overflow-hidden">
                                            {item.file_type === 'image' ? (
                                                <img
                                                    src={item.file_url}
                                                    alt={item.title}
                                                    className="w-full h-full object-cover"
                                                    loading="lazy"
                                                />
                                            ) : item.file_type === 'video' ? (
                                                <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
                                                    <Video className="w-8 h-8 text-purple-400 opacity-80" />
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center text-white">
                                                            <Play className="w-3 h-3 ml-0.5 fill-current" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : item.file_type === 'audio' ? (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-amber-500/10 p-2 text-center">
                                                    <Music className="w-7 h-7 text-amber-400 mb-1" />
                                                    <span className="text-[9px] font-mono text-amber-300 uppercase">
                                                        {item.file_name.split('.').pop()}
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-500/10 p-2 text-center">
                                                    <FileText className="w-7 h-7 text-emerald-400 mb-1" />
                                                    <span className="text-[9px] font-mono text-emerald-300 uppercase">
                                                        {item.file_name.split('.').pop()}
                                                    </span>
                                                </div>
                                            )}

                                            {isSelected && (
                                                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                                                    <Check className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-2">
                                            <p className="text-[11px] font-semibold text-slate-200 truncate">
                                                {item.title}
                                            </p>
                                            <p className="text-[10px] text-slate-400 uppercase mt-0.5">
                                                {item.file_type} • {item.formatted_size || ''}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
                    <div className="text-xs text-slate-400 truncate max-w-sm">
                        {selectedItem ? (
                            <span>
                                Selected: <strong className="text-white">{selectedItem.title}</strong> (
                                <span className="uppercase">{selectedItem.file_type}</span>)
                            </span>
                        ) : (
                            <span>Click an item above to select</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="secondary" size="xs" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            size="xs"
                            disabled={!selectedItem}
                            onClick={handleConfirm}
                            icon={Check}
                        >
                            Select & Attach Media
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

