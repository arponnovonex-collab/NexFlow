import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import { Button } from '../common/Button';
import {
    FolderOpen,
    Folder,
    Image as ImageIcon,
    Video,
    Music,
    FileText,
    Search,
    X,
    Check,
    UploadCloud,
    Play,
    Layers,
    Tag,
} from 'lucide-react';

export const MediaPickerModal = ({ isOpen, onClose, onSelectMedia }) => {
    const [mediaItems, setMediaItems] = useState([]);
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterType, setFilterType] = useState('all');
    const [selectedFolderId, setSelectedFolderId] = useState('all'); // 'all', 'uncategorized', or numeric id
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const quickUploadRef = useRef(null);

    const fetchFolders = async () => {
        try {
            const res = await api.get('/media/folders');
            if (res.data?.status === 'success') {
                setFolders(res.data.data.folders || []);
            }
        } catch (err) {
            console.error('Failed to load folders in picker', err);
        }
    };

    const fetchMedia = async (type = filterType, folderId = selectedFolderId, search = searchQuery) => {
        setLoading(true);
        try {
            const params = { per_page: 48 };
            if (type && type !== 'all') params.type = type;
            if (folderId && folderId !== 'all') params.folder_id = folderId;
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
            fetchFolders();
            fetchMedia(filterType, selectedFolderId, searchQuery);
            setSelectedItem(null);
        }
    }, [isOpen, filterType, selectedFolderId]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchMedia(filterType, selectedFolderId, searchQuery);
    };

    const handleQuickUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const formData = new FormData();
        Array.from(files).forEach((f) => {
            formData.append('files[]', f);
        });

        if (selectedFolderId && selectedFolderId !== 'all' && selectedFolderId !== 'uncategorized') {
            formData.append('folder_id', selectedFolderId);
        }

        try {
            const res = await api.post('/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (res.data?.status === 'success') {
                const uploaded = res.data.files?.[0];
                if (uploaded) {
                    setSelectedItem(uploaded);
                }
                fetchFolders();
                fetchMedia(filterType, selectedFolderId, searchQuery);
            }
        } catch (err) {
            alert('Upload failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
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
        { key: 'all', label: 'All Types', icon: FolderOpen },
        { key: 'image', label: 'Images', icon: ImageIcon },
        { key: 'video', label: 'Videos', icon: Video },
        { key: 'audio', label: 'Voice / Audio', icon: Music },
        { key: 'document', label: 'Documents', icon: FileText },
    ];

    const currentFolder = folders.find((f) => f.id === parseInt(selectedFolderId, 10));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                            <FolderOpen className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                                <span>Send Media to Customer</span>
                                {currentFolder && (
                                    <span
                                        className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white"
                                        style={{ backgroundColor: currentFolder.color || '#6366f1' }}
                                    >
                                        📁 {currentFolder.name}
                                    </span>
                                )}
                            </h3>
                            <p className="text-[11px] text-slate-400">
                                Browse Product Folders or search to find photos, videos or audio to send
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
                            Upload File
                        </Button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Search Bar & Product Folder Selector */}
                <div className="p-3 border-b border-slate-800 bg-slate-950/80 space-y-2.5">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                        {/* Search Input (searches file title and folder name) */}
                        <form onSubmit={handleSearchSubmit} className="relative flex-1">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search product name or file title (e.g. Watch, T-Shirt, Photo)..."
                                className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        fetchMedia(filterType, selectedFolderId, '');
                                    }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </form>

                        {/* Product Folder Dropdown Selector */}
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-slate-400 hidden sm:inline">Folder:</span>
                            <select
                                value={selectedFolderId}
                                onChange={(e) => setSelectedFolderId(e.target.value)}
                                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 max-w-[210px] truncate"
                            >
                                <option value="all">📁 All Folders ({mediaItems.length})</option>
                                <option value="uncategorized">📂 Uncategorized</option>
                                {folders.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        📁 {f.name} ({f.media_files_count || 0})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Product Folder Quick Pills (Horizontal scrollable) */}
                    {folders.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                            <button
                                type="button"
                                onClick={() => setSelectedFolderId('all')}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                                    selectedFolderId === 'all'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                                }`}
                            >
                                <FolderOpen className="w-3 h-3" />
                                <span>All Products</span>
                            </button>

                            {folders.map((folder) => {
                                const isSelected = selectedFolderId === folder.id;
                                return (
                                    <button
                                        key={folder.id}
                                        type="button"
                                        onClick={() => setSelectedFolderId(folder.id)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                                            isSelected
                                                ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-white/30'
                                                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
                                        }`}
                                    >
                                        <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: folder.color || '#6366f1' }}
                                        />
                                        <span>{folder.name}</span>
                                        <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 font-mono text-slate-400">
                                            {folder.media_files_count || 0}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Media Type Filter Pills (Images, Videos, Audio, Docs) */}
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                        {typeBadges.map((badge) => {
                            const Icon = badge.icon;
                            const isActive = filterType === badge.key;
                            return (
                                <button
                                    key={badge.key}
                                    type="button"
                                    onClick={() => setFilterType(badge.key)}
                                    className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap transition-colors ${
                                        isActive
                                            ? 'bg-slate-800 text-indigo-400 border border-indigo-500/50'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <Icon className="w-3 h-3" />
                                    <span>{badge.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Media Grid */}
                <div className="p-3.5 flex-1 overflow-y-auto min-h-[300px]">
                    {loading ? (
                        <div className="py-20 text-center">
                            <div className="w-7 h-7 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <p className="text-xs text-slate-400">Loading product media...</p>
                        </div>
                    ) : mediaItems.length === 0 ? (
                        <div className="py-16 text-center space-y-2">
                            <FolderOpen className="w-10 h-10 text-slate-600 mx-auto opacity-50" />
                            <p className="text-xs font-semibold text-slate-300">
                                {selectedFolderId !== 'all' ? `No media found in "${currentFolder?.name || 'this folder'}"` : 'No media files found'}
                            </p>
                            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                                Click "Upload File" above to quickly add pictures or videos to this product.
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
                                                ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/40 shadow-lg'
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

                                            {/* Folder badge if item has folder */}
                                            {item.folder && (
                                                <div
                                                    className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold text-white truncate shadow-sm"
                                                    style={{ backgroundColor: `${item.folder.color || '#6366f1'}e6` }}
                                                    title={`Product: ${item.folder.name}`}
                                                >
                                                    {item.folder.name}
                                                </div>
                                            )}

                                            {isSelected && (
                                                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                                                    <Check className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-2">
                                            <p className="text-[11px] font-semibold text-slate-200 truncate" title={item.title}>
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
                <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
                    <div className="text-xs text-slate-400 truncate max-w-sm">
                        {selectedItem ? (
                            <span>
                                Ready to send:{' '}
                                <strong className="text-white">{selectedItem.title}</strong>
                                {selectedItem.folder && (
                                    <span className="text-indigo-400 font-semibold ml-1">
                                        (📁 {selectedItem.folder.name})
                                    </span>
                                )}
                            </span>
                        ) : (
                            <span>Click a product photo/video above to send to customer</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="secondary" size="xs" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={!selectedItem}
                            onClick={handleConfirm}
                            icon={Check}
                        >
                            Select & Send Media
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
