import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import {
    FolderOpen,
    FolderPlus,
    Folder,
    UploadCloud,
    Image as ImageIcon,
    Video,
    Music,
    FileText,
    Search,
    Trash2,
    Copy,
    Check,
    ExternalLink,
    Play,
    X,
    Filter,
    Calendar,
    HardDrive,
    Eye,
    Edit3,
    CornerDownRight,
    Tag,
    Layers,
    ChevronRight,
} from 'lucide-react';

const FOLDER_COLORS = [
    '#6366f1', // Indigo
    '#0ea5e9', // Sky Cyan
    '#10b981', // Emerald
    '#8b5cf6', // Violet
    '#f43f5e', // Rose
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#14b8a6', // Teal
];

export const MediaLibraryPage = () => {
    const [mediaItems, setMediaItems] = useState([]);
    const [folders, setFolders] = useState([]);
    const [folderStats, setFolderStats] = useState({ total_files: 0, uncategorized_files: 0 });
    const [loading, setLoading] = useState(true);
    const [foldersLoading, setFoldersLoading] = useState(false);

    // Filters
    const [filterType, setFilterType] = useState('all');
    const [selectedFolderId, setSelectedFolderId] = useState('all'); // 'all', 'uncategorized', or numeric id
    const [searchQuery, setSearchQuery] = useState('');

    // Modals & Selections
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    // Folder Create / Edit Modal
    const [folderModalOpen, setFolderModalOpen] = useState(false);
    const [editingFolder, setEditingFolder] = useState(null);
    const [folderForm, setFolderForm] = useState({ name: '', color: '#6366f1', description: '' });
    const [savingFolder, setSavingFolder] = useState(false);

    // Move file to folder modal
    const [movingMedia, setMovingMedia] = useState(null);
    const [targetFolderSelection, setTargetFolderSelection] = useState('');
    const [movingFile, setMovingFile] = useState(false);

    const [pagination, setPagination] = useState({
        current_page: 1,
        last_page: 1,
        total: 0,
    });

    const fetchFolders = async () => {
        setFoldersLoading(true);
        try {
            const res = await api.get('/media/folders');
            if (res.data?.status === 'success') {
                setFolders(res.data.data.folders || []);
                setFolderStats({
                    total_files: res.data.data.total_files || 0,
                    uncategorized_files: res.data.data.uncategorized_files || 0,
                });
            }
        } catch (err) {
            console.error('Failed to load folders', err);
        } finally {
            setFoldersLoading(false);
        }
    };

    const fetchMedia = async (page = 1, type = filterType, folderId = selectedFolderId, search = searchQuery) => {
        setLoading(true);
        try {
            const params = { page, per_page: 24 };
            if (type && type !== 'all') params.type = type;
            if (folderId && folderId !== 'all') params.folder_id = folderId;
            if (search && search.trim()) params.search = search.trim();

            const res = await api.get('/media', { params });
            if (res.data?.status === 'success') {
                const pagData = res.data.data;
                setMediaItems(pagData.data || []);
                setPagination({
                    current_page: pagData.current_page || 1,
                    last_page: pagData.last_page || 1,
                    total: pagData.total || 0,
                });
            }
        } catch (err) {
            console.error('Failed to load media files', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFolders();
    }, []);

    useEffect(() => {
        fetchMedia(1, filterType, selectedFolderId, searchQuery);
    }, [filterType, selectedFolderId]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchMedia(1, filterType, selectedFolderId, searchQuery);
    };

    const handleCopyUrl = (url) => {
        const fullUrl = url.startsWith('http') ? url : window.location.origin + url;
        navigator.clipboard.writeText(fullUrl);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this media file permanently?')) {
            return;
        }

        setDeletingId(id);
        try {
            await api.delete(`/media/${id}`);
            setMediaItems((prev) => prev.filter((m) => m.id !== id));
            if (selectedMedia?.id === id) {
                setSelectedMedia(null);
            }
            setPagination((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
            fetchFolders();
        } catch (err) {
            alert('Failed to delete media file: ' + (err.response?.data?.message || err.message));
        } finally {
            setDeletingId(null);
        }
    };

    // Open Create Folder Modal
    const openCreateFolder = () => {
        setEditingFolder(null);
        setFolderForm({ name: '', color: '#6366f1', description: '' });
        setFolderModalOpen(true);
    };

    // Open Edit Folder Modal
    const openEditFolder = (f, e) => {
        if (e) e.stopPropagation();
        setEditingFolder(f);
        setFolderForm({ name: f.name, color: f.color || '#6366f1', description: f.description || '' });
        setFolderModalOpen(true);
    };

    const handleSaveFolder = async (e) => {
        e.preventDefault();
        if (!folderForm.name.trim()) return;

        setSavingFolder(true);
        try {
            if (editingFolder) {
                await api.put(`/media/folders/${editingFolder.id}`, folderForm);
            } else {
                await api.post('/media/folders', folderForm);
            }
            setFolderModalOpen(false);
            fetchFolders();
        } catch (err) {
            alert('Failed to save folder: ' + (err.response?.data?.message || err.message));
        } finally {
            setSavingFolder(false);
        }
    };

    const handleDeleteFolder = async (folder, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm(`Delete folder "${folder.name}"? Media files inside will NOT be deleted, but will become Uncategorized.`)) {
            return;
        }

        try {
            await api.delete(`/media/folders/${folder.id}`);
            if (selectedFolderId === folder.id) {
                setSelectedFolderId('all');
            }
            fetchFolders();
            fetchMedia(1, filterType, 'all', searchQuery);
        } catch (err) {
            alert('Failed to delete folder: ' + (err.response?.data?.message || err.message));
        }
    };

    // Move single file to folder
    const handleMoveFileToFolder = async (mediaId, folderId) => {
        setMovingFile(true);
        try {
            await api.post('/media/move-folder', {
                media_ids: [mediaId],
                folder_id: folderId === 'uncategorized' ? null : folderId,
            });

            // Update item locally
            const targetFolder = folders.find((f) => f.id === parseInt(folderId, 10));
            setMediaItems((prev) =>
                prev.map((m) =>
                    m.id === mediaId
                        ? { ...m, folder_id: folderId === 'uncategorized' ? null : folderId, folder: targetFolder || null }
                        : m
                )
            );

            if (selectedMedia && selectedMedia.id === mediaId) {
                setSelectedMedia((prev) => ({
                    ...prev,
                    folder_id: folderId === 'uncategorized' ? null : folderId,
                    folder: targetFolder || null,
                }));
            }

            setMovingMedia(null);
            fetchFolders();
        } catch (err) {
            alert('Failed to move media: ' + (err.response?.data?.message || err.message));
        } finally {
            setMovingFile(false);
        }
    };

    const renderTypeIcon = (type, size = 'w-5 h-5') => {
        switch (type) {
            case 'image':
                return <ImageIcon className={`${size} text-indigo-400`} />;
            case 'video':
                return <Video className={`${size} text-purple-400`} />;
            case 'audio':
                return <Music className={`${size} text-amber-400`} />;
            default:
                return <FileText className={`${size} text-emerald-400`} />;
        }
    };

    const typeBadges = [
        { key: 'all', label: 'All Files', icon: FolderOpen },
        { key: 'image', label: 'Images', icon: ImageIcon },
        { key: 'video', label: 'Videos', icon: Video },
        { key: 'audio', label: 'Audio / Voice', icon: Music },
        { key: 'document', label: 'Documents', icon: FileText },
    ];

    const currentFolderName =
        selectedFolderId === 'all'
            ? 'All Media'
            : selectedFolderId === 'uncategorized'
            ? 'Uncategorized Media'
            : folders.find((f) => f.id === parseInt(selectedFolderId, 10))?.name || 'Selected Folder';

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                        <FolderOpen className="w-6 h-6 text-indigo-400" />
                        Media Library & Product Folders
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                        Organize photos, videos, and documents by Product Folders to send quickly to customers in chat.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={openCreateFolder}
                        icon={FolderPlus}
                        className="text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10"
                    >
                        New Product Folder
                    </Button>
                    <Link to="/media/upload">
                        <Button variant="primary" size="sm" icon={UploadCloud}>
                            Upload New Media
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Product Folders Carousel / Grid */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Product Folders ({folders.length})</span>
                    </span>
                    <button
                        type="button"
                        onClick={openCreateFolder}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>Create Folder</span>
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {/* All Files Tab Card */}
                    <div
                        onClick={() => setSelectedFolderId('all')}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                            selectedFolderId === 'all'
                                ? 'bg-indigo-600/15 border-indigo-500 ring-2 ring-indigo-500/30'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                                <FolderOpen className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-800 text-slate-300">
                                {folderStats.total_files}
                            </span>
                        </div>
                        <div className="mt-3">
                            <h4 className="text-xs font-bold text-white truncate">All Media</h4>
                            <p className="text-[10px] text-slate-400">All uploaded files</p>
                        </div>
                    </div>

                    {/* Uncategorized Folder */}
                    <div
                        onClick={() => setSelectedFolderId('uncategorized')}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                            selectedFolderId === 'uncategorized'
                                ? 'bg-amber-600/15 border-amber-500 ring-2 ring-amber-500/30'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                                <Folder className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-800 text-slate-300">
                                {folderStats.uncategorized_files}
                            </span>
                        </div>
                        <div className="mt-3">
                            <h4 className="text-xs font-bold text-white truncate">Uncategorized</h4>
                            <p className="text-[10px] text-slate-400">Not in a folder</p>
                        </div>
                    </div>

                    {/* Custom Product Folders */}
                    {folders.map((folder) => {
                        const isSelected = selectedFolderId === folder.id;
                        return (
                            <div
                                key={folder.id}
                                onClick={() => setSelectedFolderId(folder.id)}
                                className={`group p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                                    isSelected
                                        ? 'bg-indigo-600/15 border-indigo-500 ring-2 ring-indigo-500/30'
                                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div
                                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-sm"
                                        style={{ backgroundColor: folder.color || '#6366f1' }}
                                    >
                                        <Folder className="w-4 h-4" />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-800 text-slate-300">
                                            {folder.media_files_count || 0}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => openEditFolder(folder, e)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-opacity"
                                            title="Edit Folder"
                                        >
                                            <Edit3 className="w-3 h-3" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteFolder(folder, e)}
                                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-opacity"
                                            title="Delete Folder"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-3 min-w-0">
                                    <h4 className="text-xs font-bold text-white truncate" title={folder.name}>
                                        {folder.name}
                                    </h4>
                                    <p className="text-[10px] text-slate-400 truncate">
                                        {folder.description || 'Product media folder'}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Active Folder Breadcrumb & Filter Status */}
            {selectedFolderId !== 'all' && (
                <div className="flex items-center justify-between p-3 px-4 rounded-xl bg-slate-900/90 border border-indigo-500/30 text-xs">
                    <div className="flex items-center gap-2 text-slate-300">
                        <Folder className="w-4 h-4 text-indigo-400" />
                        <span>Filtering by Folder:</span>
                        <strong className="text-white bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30 font-semibold">
                            {currentFolderName}
                        </strong>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSelectedFolderId('all')}
                        className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                        <X className="w-3.5 h-3.5" />
                        <span>Clear folder filter (Show all)</span>
                    </button>
                </div>
            )}

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Type Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                    {typeBadges.map((badge) => {
                        const Icon = badge.icon;
                        const isActive = filterType === badge.key;
                        return (
                            <button
                                key={badge.key}
                                type="button"
                                onClick={() => setFilterType(badge.key)}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                                    isActive
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{badge.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Search Box */}
                <form onSubmit={handleSearchSubmit} className="relative min-w-[240px] md:w-80">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search product folders or file title..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                </form>
            </div>

            {/* Total items badge */}
            <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>
                    Showing <strong className="text-slate-200">{mediaItems.length}</strong> of{' '}
                    <strong className="text-slate-200">{pagination.total}</strong> items
                </span>
            </div>

            {/* Media Grid */}
            {loading ? (
                <div className="p-16 text-center">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs text-slate-400">Loading media library...</p>
                </div>
            ) : mediaItems.length === 0 ? (
                <Card className="p-12 text-center border border-slate-800 bg-slate-900/40 rounded-3xl">
                    <FolderOpen className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-60" />
                    <h3 className="text-base font-bold text-white">No media files found</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        {searchQuery || filterType !== 'all' || selectedFolderId !== 'all'
                            ? 'No items matched your current folder or search filter.'
                            : 'You have not uploaded any media files yet. Upload images, videos, audio, or documents to organize by product.'}
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                        {selectedFolderId !== 'all' && (
                            <Button variant="secondary" size="sm" onClick={() => setSelectedFolderId('all')}>
                                View All Media
                            </Button>
                        )}
                        <Link to="/media/upload">
                            <Button variant="primary" size="sm" icon={UploadCloud}>
                                Upload Files
                            </Button>
                        </Link>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                    {mediaItems.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setSelectedMedia(item)}
                            className="group relative rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-850 hover:border-indigo-500/50 transition-all cursor-pointer overflow-hidden flex flex-col shadow-md"
                        >
                            {/* Media Preview Box */}
                            <div className="aspect-square w-full bg-slate-950 flex items-center justify-center relative overflow-hidden">
                                {item.file_type === 'image' ? (
                                    <img
                                        src={item.file_url}
                                        alt={item.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                        loading="lazy"
                                    />
                                ) : item.file_type === 'video' ? (
                                    <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
                                        <Video className="w-10 h-10 text-purple-400 opacity-80" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center group-hover:bg-black/20 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                                                <Play className="w-4 h-4 ml-0.5 fill-current" />
                                            </div>
                                        </div>
                                    </div>
                                ) : item.file_type === 'audio' ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-amber-500/10 p-2">
                                        <Music className="w-8 h-8 text-amber-400 mb-1" />
                                        <span className="text-[10px] font-mono text-amber-300 uppercase">
                                            {item.file_name.split('.').pop()}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-emerald-500/10 p-2">
                                        <FileText className="w-8 h-8 text-emerald-400 mb-1" />
                                        <span className="text-[10px] font-mono text-emerald-300 uppercase">
                                            {item.file_name.split('.').pop()}
                                        </span>
                                    </div>
                                )}

                                {/* Category indicator */}
                                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-bold text-white uppercase tracking-wider">
                                    {item.file_type}
                                </div>

                                {/* Folder Badge if assigned */}
                                {item.folder && (
                                    <div
                                        className="absolute bottom-2 left-2 right-2 px-1.5 py-0.5 rounded-md text-[9px] font-semibold text-white truncate shadow-sm flex items-center gap-1"
                                        style={{ backgroundColor: `${item.folder.color || '#6366f1'}cc` }}
                                        title={`Product: ${item.folder.name}`}
                                    >
                                        <Folder className="w-2.5 h-2.5 shrink-0" />
                                        <span className="truncate">{item.folder.name}</span>
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="p-2.5 flex-1 flex flex-col justify-between">
                                <p className="text-xs font-semibold text-slate-200 truncate" title={item.title}>
                                    {item.title}
                                </p>
                                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                                    <span>{item.formatted_size || '—'}</span>
                                    <span className="uppercase text-slate-500 font-mono">
                                        {item.file_name.split('.').pop()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination Controls */}
            {pagination.last_page > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                        variant="secondary"
                        size="xs"
                        disabled={pagination.current_page <= 1}
                        onClick={() => fetchMedia(pagination.current_page - 1)}
                    >
                        Previous
                    </Button>
                    <span className="text-xs text-slate-400 px-2">
                        Page {pagination.current_page} of {pagination.last_page}
                    </span>
                    <Button
                        variant="secondary"
                        size="xs"
                        disabled={pagination.current_page >= pagination.last_page}
                        onClick={() => fetchMedia(pagination.current_page + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}

            {/* Media Details & Preview Modal */}
            {selectedMedia && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
                    <div
                        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0 pr-4">
                                {renderTypeIcon(selectedMedia.file_type)}
                                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                                    {selectedMedia.title}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedMedia(null)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body / Media Preview */}
                        <div className="p-5 overflow-y-auto space-y-4">
                            <div className="rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden max-h-80">
                                {selectedMedia.file_type === 'image' && (
                                    <img
                                        src={selectedMedia.file_url}
                                        alt={selectedMedia.title}
                                        className="max-h-80 w-auto object-contain"
                                    />
                                )}
                                {selectedMedia.file_type === 'video' && (
                                    <video
                                        src={selectedMedia.file_url}
                                        controls
                                        className="max-h-80 w-full rounded-2xl"
                                    />
                                )}
                                {selectedMedia.file_type === 'audio' && (
                                    <div className="p-8 w-full flex flex-col items-center gap-4">
                                        <Music className="w-12 h-12 text-amber-400" />
                                        <audio src={selectedMedia.file_url} controls className="w-full max-w-md" />
                                    </div>
                                )}
                                {selectedMedia.file_type === 'document' && (
                                    <div className="p-8 text-center space-y-2">
                                        <FileText className="w-12 h-12 text-emerald-400 mx-auto" />
                                        <p className="text-sm font-semibold text-slate-200">{selectedMedia.file_name}</p>
                                        <a
                                            href={selectedMedia.file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:underline"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" /> Download / Open Document
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Folder Assignment Box */}
                            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block mb-0.5">
                                        Product Folder
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Folder className="w-4 h-4 text-indigo-400" />
                                        <span className="text-xs font-semibold text-white">
                                            {selectedMedia.folder?.name || 'Uncategorized (No Folder)'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <select
                                        value={selectedMedia.folder_id || ''}
                                        onChange={(e) => handleMoveFileToFolder(selectedMedia.id, e.target.value)}
                                        className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="uncategorized">No Folder (Uncategorized)</option>
                                        {folders.map((f) => (
                                            <option key={f.id} value={f.id}>
                                                📁 {f.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Metadata Details */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs">
                                <div>
                                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                                        File Type
                                    </span>
                                    <span className="text-slate-200 font-medium capitalize">
                                        {selectedMedia.file_type}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                                        File Size
                                    </span>
                                    <span className="text-slate-200 font-medium">
                                        {selectedMedia.formatted_size || '—'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                                        Uploaded By
                                    </span>
                                    <span className="text-slate-200 font-medium">
                                        {selectedMedia.user?.name || 'Administrator'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                                        Uploaded Date
                                    </span>
                                    <span className="text-slate-200 font-medium">
                                        {selectedMedia.created_at ? new Date(selectedMedia.created_at).toLocaleDateString() : '—'}
                                    </span>
                                </div>
                            </div>

                            {/* Direct URL */}
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                    Direct File URL
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={selectedMedia.file_url}
                                        className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 focus:outline-none"
                                    />
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="xs"
                                        onClick={() => handleCopyUrl(selectedMedia.file_url)}
                                        icon={copiedUrl ? Check : Copy}
                                    >
                                        {copiedUrl ? 'Copied' : 'Copy'}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
                            <Button
                                type="button"
                                variant="danger"
                                size="xs"
                                loading={deletingId === selectedMedia.id}
                                onClick={() => handleDelete(selectedMedia.id)}
                                icon={Trash2}
                            >
                                Delete File
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="xs"
                                onClick={() => setSelectedMedia(null)}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create / Edit Folder Modal */}
            {folderModalOpen && (
                <Modal
                    isOpen={folderModalOpen}
                    onClose={() => setFolderModalOpen(false)}
                    title={editingFolder ? `Edit Folder: ${editingFolder.name}` : 'Create Product Folder'}
                >
                    <form onSubmit={handleSaveFolder} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                Folder Name (e.g. Product Name) *
                            </label>
                            <input
                                type="text"
                                required
                                value={folderForm.name}
                                onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                                placeholder="e.g. Smart Watch Series 8, Men's Panjabi"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                Folder Color Badge
                            </label>
                            <div className="flex items-center gap-2">
                                {FOLDER_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setFolderForm({ ...folderForm, color: c })}
                                        className={`w-7 h-7 rounded-full border-2 transition-transform ${
                                            folderForm.color === c ? 'scale-110 border-white' : 'border-transparent hover:scale-105'
                                        }`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                Description / Notes (Optional)
                            </label>
                            <textarea
                                rows={2}
                                value={folderForm.description}
                                onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                                placeholder="e.g. Product promo photos, demonstration videos, unboxing clips"
                                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => setFolderModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                loading={savingFolder}
                                icon={Check}
                            >
                                {editingFolder ? 'Save Changes' : 'Create Folder'}
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};
export default MediaLibraryPage;
