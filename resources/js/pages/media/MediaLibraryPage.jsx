import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import {
    FolderOpen,
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
} from 'lucide-react';

export const MediaLibraryPage = () => {
    const [mediaItems, setMediaItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMedia, setSelectedMedia] = useState(null);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const [pagination, setPagination] = useState({
        current_page: 1,
        last_page: 1,
        total: 0,
    });

    const fetchMedia = async (page = 1, type = filterType, search = searchQuery) => {
        setLoading(true);
        try {
            const params = { page, per_page: 24 };
            if (type && type !== 'all') params.type = type;
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
        fetchMedia(1, filterType, searchQuery);
    }, [filterType]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchMedia(1, filterType, searchQuery);
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
        } catch (err) {
            alert('Failed to delete media file: ' + (err.response?.data?.message || err.message));
        } finally {
            setDeletingId(null);
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

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                        <FolderOpen className="w-6 h-6 text-indigo-400" />
                        Media Library
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                        Manage all website photos, videos, voice recordings, and files. Easily attach to customer chats.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/media/upload">
                        <Button variant="primary" size="sm" icon={UploadCloud}>
                            Upload New Media
                        </Button>
                    </Link>
                </div>
            </div>

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
                <form onSubmit={handleSearchSubmit} className="relative min-w-[240px] md:w-72">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search media files..."
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
                        {searchQuery || filterType !== 'all'
                            ? 'No items matched your current filter or search criteria.'
                            : 'You have not uploaded any media files yet. Upload images, videos, audio, or documents to use across your CRM.'}
                    </p>
                    <div className="mt-4">
                        <Link to="/media/upload">
                            <Button variant="primary" size="sm" icon={UploadCloud}>
                                Upload Your First File
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
        </div>
    );
};
export default MediaLibraryPage;

