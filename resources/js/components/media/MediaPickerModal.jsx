import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import {
    FolderOpen,
    Folder,
    FolderPlus,
    Image as ImageIcon,
    Video,
    Music,
    FileText,
    Search,
    X,
    Check,
    CheckSquare,
    Square,
    UploadCloud,
    Play,
    Layers,
    Tag,
    ArrowRight,
    Loader2,
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

export const MediaPickerModal = ({ isOpen, onClose, onSelectMedia }) => {
    const [mediaItems, setMediaItems] = useState([]);
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterType, setFilterType] = useState('all');
    const [selectedFolderId, setSelectedFolderId] = useState('all'); // 'all', 'uncategorized', or numeric id
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadTargetFolder, setUploadTargetFolder] = useState(''); // empty = auto (current folder or null)
    const quickUploadRef = useRef(null);

    // Single item moving state & feedback
    const [isMovingSingle, setIsMovingSingle] = useState(false);
    const [moveToast, setMoveToast] = useState(null);

    // Bulk selection state inside modal
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkSelectedIds, setBulkSelectedIds] = useState([]);
    const [bulkTargetFolderId, setBulkTargetFolderId] = useState('');
    const [isBulkMoving, setIsBulkMoving] = useState(false);

    // Quick Folder Create Modal
    const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderColor, setNewFolderColor] = useState('#6366f1');
    const [creatingFolder, setCreatingFolder] = useState(false);

    // Drag-over folder indicator
    const [dragOverFolderId, setDragOverFolderId] = useState(null);

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
            const params = { per_page: 60 };
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
            setIsBulkMode(false);
            setBulkSelectedIds([]);
            setMoveToast(null);
        }
    }, [isOpen, filterType, selectedFolderId]);

    // Keep upload target folder aligned when user navigates folders
    useEffect(() => {
        if (selectedFolderId && selectedFolderId !== 'all' && selectedFolderId !== 'uncategorized') {
            setUploadTargetFolder(String(selectedFolderId));
        }
    }, [selectedFolderId]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchMedia(filterType, selectedFolderId, searchQuery);
    };

    // Quick Upload from Chat Modal
    const handleQuickUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        const formData = new FormData();
        Array.from(files).forEach((f) => {
            formData.append('files[]', f);
        });

        // Determine destination folder
        let destFolderId = null;
        if (uploadTargetFolder && uploadTargetFolder !== 'uncategorized') {
            destFolderId = uploadTargetFolder;
        } else if (selectedFolderId && selectedFolderId !== 'all' && selectedFolderId !== 'uncategorized') {
            destFolderId = selectedFolderId;
        }

        if (destFolderId) {
            formData.append('folder_id', destFolderId);
        }

        try {
            const res = await api.post('/media/upload', formData);
            if (res.data?.status === 'success') {
                const uploadedList = res.data.files || [];
                const uploadedFirst = uploadedList[0];
                if (uploadedFirst) {
                    setSelectedItem(uploadedFirst);
                }

                // If uploaded into a specific folder, show toast
                const targetFolderObj = folders.find((f) => f.id === parseInt(destFolderId, 10));
                if (targetFolderObj) {
                    showToast(`Uploaded ${uploadedList.length} file(s) into "${targetFolderObj.name}"`);
                } else {
                    showToast(`Uploaded ${uploadedList.length} file(s)`);
                }

                await fetchFolders();
                await fetchMedia(filterType, selectedFolderId, searchQuery);
            }
        } catch (err) {
            alert('Upload failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    // Move single media item to a folder immediately
    const handleMoveSingleItem = async (mediaId, newFolderId) => {
        if (!mediaId) return;
        setIsMovingSingle(true);

        const targetFolderId = newFolderId === 'uncategorized' ? null : newFolderId;
        const targetFolderObj = folders.find((f) => f.id === parseInt(newFolderId, 10));

        try {
            const res = await api.post('/media/move-folder', {
                media_ids: [mediaId],
                folder_id: targetFolderId,
            });

            if (res.data?.status === 'success') {
                // Optimistically update local list
                setMediaItems((prev) =>
                    prev.map((m) =>
                        m.id === mediaId
                            ? { ...m, folder_id: targetFolderId, folder: targetFolderObj || null }
                            : m
                    )
                );

                if (selectedItem && selectedItem.id === mediaId) {
                    setSelectedItem((prev) => ({
                        ...prev,
                        folder_id: targetFolderId,
                        folder: targetFolderObj || null,
                    }));
                }

                showToast(
                    targetFolderObj
                        ? `Moved to "${targetFolderObj.name}"`
                        : 'Moved to Uncategorized'
                );

                fetchFolders();
            }
        } catch (err) {
            alert('Failed to move media: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsMovingSingle(false);
        }
    };

    // Bulk Selection & Move Handlers
    const toggleBulkSelect = (id, e) => {
        if (e) e.stopPropagation();
        setBulkSelectedIds((prev) => {
            const exists = prev.includes(id);
            const next = exists ? prev.filter((item) => item !== id) : [...prev, id];
            if (next.length > 0 && !isBulkMode) setIsBulkMode(true);
            return next;
        });
    };

    const handleSelectAllOnPage = () => {
        const allIds = mediaItems.map((m) => m.id);
        setBulkSelectedIds(allIds);
    };

    const handleDeselectAll = () => {
        setBulkSelectedIds([]);
        setIsBulkMode(false);
    };

    const handleBulkMove = async (targetFolderId) => {
        if (bulkSelectedIds.length === 0) return;
        setIsBulkMoving(true);

        const folderId = targetFolderId === 'uncategorized' ? null : targetFolderId;
        const targetFolderObj = folders.find((f) => f.id === parseInt(targetFolderId, 10));

        try {
            const res = await api.post('/media/move-folder', {
                media_ids: bulkSelectedIds,
                folder_id: folderId,
            });

            if (res.data?.status === 'success') {
                setMediaItems((prev) =>
                    prev.map((m) =>
                        bulkSelectedIds.includes(m.id)
                            ? { ...m, folder_id: folderId, folder: targetFolderObj || null }
                            : m
                    )
                );

                if (selectedItem && bulkSelectedIds.includes(selectedItem.id)) {
                    setSelectedItem((prev) => ({
                        ...prev,
                        folder_id: folderId,
                        folder: targetFolderObj || null,
                    }));
                }

                showToast(
                    targetFolderObj
                        ? `Moved ${bulkSelectedIds.length} item(s) to "${targetFolderObj.name}"`
                        : `Moved ${bulkSelectedIds.length} item(s) to Uncategorized`
                );

                setBulkSelectedIds([]);
                setIsBulkMode(false);
                fetchFolders();
            }
        } catch (err) {
            alert('Failed to move files: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsBulkMoving(false);
        }
    };

    // Quick Folder Creation
    const handleCreateFolder = async (e) => {
        e.preventDefault();
        if (!newFolderName.trim()) return;

        setCreatingFolder(true);
        try {
            const res = await api.post('/media/folders', {
                name: newFolderName.trim(),
                color: newFolderColor,
            });

            if (res.data?.status === 'success') {
                const created = res.data.data;
                await fetchFolders();

                // If user had a selected item, offer or auto-move it to the new folder
                if (selectedItem) {
                    await handleMoveSingleItem(selectedItem.id, created.id);
                }

                // Switch upload target to new folder
                setUploadTargetFolder(String(created.id));
                setSelectedFolderId(created.id);
                setCreateFolderModalOpen(false);
                setNewFolderName('');
                showToast(`Created folder "${created.name}"`);
            }
        } catch (err) {
            alert('Failed to create folder: ' + (err.response?.data?.message || err.message));
        } finally {
            setCreatingFolder(false);
        }
    };

    // Drag and Drop files onto folder pills
    const handleDragStartCard = (e, item) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id }));
    };

    const handleDropOnFolder = async (folderId, e) => {
        e.preventDefault();
        setDragOverFolderId(null);
        try {
            const dataStr = e.dataTransfer.getData('text/plain');
            if (!dataStr) return;
            const data = JSON.parse(dataStr);
            if (data?.id) {
                await handleMoveSingleItem(data.id, folderId);
            }
        } catch (err) {
            console.error('Drop error', err);
        }
    };

    const showToast = (msg) => {
        setMoveToast(msg);
        setTimeout(() => setMoveToast(null), 3000);
    };

    const handleCardClick = (item) => {
        if (isBulkMode) {
            toggleBulkSelect(item.id);
        } else {
            setSelectedItem(item);
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
        { key: 'audio', label: 'Audio / Voice', icon: Music },
        { key: 'document', label: 'Documents', icon: FileText },
    ];

    const currentFolder = folders.find((f) => f.id === parseInt(selectedFolderId, 10));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Floating Notification Toast */}
                {moveToast && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-xl flex items-center gap-2 animate-fade-in">
                        <Check className="w-4 h-4 shrink-0" />
                        <span>{moveToast}</span>
                    </div>
                )}

                {/* Modal Header */}
                <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-950/50">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                            <FolderOpen className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2 truncate">
                                <span>Send Media & Organize Folders</span>
                                {currentFolder && (
                                    <span
                                        className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white shrink-0"
                                        style={{ backgroundColor: currentFolder.color || '#6366f1' }}
                                    >
                                        📁 {currentFolder.name}
                                    </span>
                                )}
                            </h3>
                            <p className="text-[11px] text-slate-400 truncate">
                                Bulk select images, move to Product Folders, or upload directly to folder
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Bulk Select Toggle */}
                        <Button
                            type="button"
                            variant={isBulkMode ? 'primary' : 'secondary'}
                            size="xs"
                            icon={CheckSquare}
                            onClick={() => {
                                if (isBulkMode) handleDeselectAll();
                                else setIsBulkMode(true);
                            }}
                            className={isBulkMode ? 'bg-indigo-600 text-white' : ''}
                            title="Select multiple images to move to a folder"
                        >
                            {isBulkMode ? 'Done' : 'Bulk Select'}
                        </Button>

                        {/* Quick Folder Create Button */}
                        <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            icon={FolderPlus}
                            onClick={() => setCreateFolderModalOpen(true)}
                            className="text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10 hidden sm:inline-flex"
                            title="Create a new Product Folder right here"
                        >
                            + Folder
                        </Button>

                        {/* Hidden Upload Input */}
                        <input
                            ref={quickUploadRef}
                            type="file"
                            multiple
                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                            onChange={handleQuickUpload}
                            className="hidden"
                        />

                        {/* Upload to Folder Button & Target Folder Selector */}
                        <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-xl border border-slate-700">
                            <select
                                value={uploadTargetFolder}
                                onChange={(e) => {
                                    if (e.target.value === '__new__') {
                                        setCreateFolderModalOpen(true);
                                    } else {
                                        setUploadTargetFolder(e.target.value);
                                    }
                                }}
                                className="bg-transparent text-[11px] text-slate-300 font-medium px-2 py-1 focus:outline-none max-w-[130px] truncate"
                                title="Choose destination folder for uploads"
                            >
                                <option value="" className="bg-slate-900 text-white">
                                    {selectedFolderId !== 'all' && currentFolder
                                        ? `📁 To: ${currentFolder.name}`
                                        : '📁 To: Uncategorized'}
                                </option>
                                <option value="uncategorized" className="bg-slate-900 text-white">
                                    📂 Uncategorized
                                </option>
                                {folders.map((f) => (
                                    <option key={f.id} value={f.id} className="bg-slate-900 text-white">
                                        📁 {f.name}
                                    </option>
                                ))}
                                <option value="__new__" className="bg-slate-900 text-indigo-400 font-bold">
                                    ➕ Create New Folder...
                                </option>
                            </select>

                            <Button
                                type="button"
                                variant="primary"
                                size="xs"
                                loading={isUploading}
                                onClick={() => quickUploadRef.current?.click()}
                                icon={UploadCloud}
                                className="bg-indigo-600 hover:bg-indigo-500 shadow-sm"
                            >
                                Upload
                            </Button>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Filter Toolbar: Search + Product Folders + Media Types */}
                <div className="p-3 border-b border-slate-800 bg-slate-950/80 space-y-2.5">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                        {/* Search Input */}
                        <form onSubmit={handleSearchSubmit} className="relative flex-1">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search product name or file title (e.g. Watch, T-Shirt)..."
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

                        {/* Product Folder Dropdown */}
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-slate-400 hidden sm:inline">Folder:</span>
                            <select
                                value={selectedFolderId}
                                onChange={(e) => {
                                    if (e.target.value === '__new__') {
                                        setCreateFolderModalOpen(true);
                                    } else {
                                        setSelectedFolderId(e.target.value);
                                    }
                                }}
                                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 max-w-[210px] truncate"
                            >
                                <option value="all">📁 All Products ({mediaItems.length})</option>
                                <option value="uncategorized">📂 Uncategorized</option>
                                {folders.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        📁 {f.name} ({f.media_files_count || 0})
                                    </option>
                                ))}
                                <option value="__new__" className="text-indigo-400 font-bold">
                                    ➕ Create New Folder...
                                </option>
                            </select>
                        </div>
                    </div>

                    {/* Product Folder Quick Pills (Interactive & Drop-Target) */}
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

                        <button
                            type="button"
                            onClick={() => setSelectedFolderId('uncategorized')}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragOverFolderId('uncategorized');
                            }}
                            onDragLeave={() => setDragOverFolderId(null)}
                            onDrop={(e) => handleDropOnFolder('uncategorized', e)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                                selectedFolderId === 'uncategorized'
                                    ? 'bg-amber-600 text-white shadow-sm'
                                    : dragOverFolderId === 'uncategorized'
                                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-500'
                                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                            }`}
                            title="Drop image here to remove from folder"
                        >
                            <Folder className="w-3 h-3 text-amber-400" />
                            <span>Uncategorized</span>
                        </button>

                        {folders.map((folder) => {
                            const isSelected = selectedFolderId === folder.id;
                            const isDragOver = dragOverFolderId === folder.id;
                            return (
                                <button
                                    key={folder.id}
                                    type="button"
                                    onClick={() => setSelectedFolderId(folder.id)}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragOverFolderId(folder.id);
                                    }}
                                    onDragLeave={() => setDragOverFolderId(null)}
                                    onDrop={(e) => handleDropOnFolder(folder.id, e)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-white/30'
                                            : isDragOver
                                            ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 ring-2 ring-indigo-500'
                                            : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
                                    }`}
                                    title="Click to filter, or drag any image card onto this folder to move it"
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

                        <button
                            type="button"
                            onClick={() => setCreateFolderModalOpen(true)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 whitespace-nowrap cursor-pointer"
                        >
                            <FolderPlus className="w-3 h-3" />
                            <span>New Folder</span>
                        </button>
                    </div>

                    {/* Media Type Filter Pills */}
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
                                {selectedFolderId !== 'all'
                                    ? `No media found in "${currentFolder?.name || 'this folder'}"`
                                    : 'No media files found'}
                            </p>
                            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                                Click "Upload" above to quickly add pictures or videos to this folder.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {mediaItems.map((item) => {
                                const isSelected = isBulkMode
                                    ? bulkSelectedIds.includes(item.id)
                                    : selectedItem?.id === item.id;

                                return (
                                    <div
                                        key={item.id}
                                        draggable
                                        onDragStart={(e) => handleDragStartCard(e, item)}
                                        onClick={() => handleCardClick(item)}
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
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
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
                                            {item.folder ? (
                                                <div
                                                    className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold text-white truncate shadow-sm flex items-center gap-1"
                                                    style={{ backgroundColor: `${item.folder.color || '#6366f1'}ee` }}
                                                    title={`Product: ${item.folder.name}`}
                                                >
                                                    <Folder className="w-2.5 h-2.5 shrink-0" />
                                                    <span className="truncate">{item.folder.name}</span>
                                                </div>
                                            ) : (
                                                <div className="absolute bottom-1 left-1 right-1 px-1 py-0.2 rounded text-[7px] font-semibold text-slate-400 bg-black/60 truncate text-center">
                                                    Uncategorized
                                                </div>
                                            )}

                                            {/* Bulk Checkbox or Selection check */}
                                            {isBulkMode ? (
                                                <div
                                                    onClick={(e) => toggleBulkSelect(item.id, e)}
                                                    className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-indigo-600 text-white shadow-md'
                                                            : 'bg-black/60 border border-slate-500 text-transparent'
                                                    }`}
                                                >
                                                    <Check className={`w-3 h-3 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                                                </div>
                                            ) : isSelected ? (
                                                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-md">
                                                    <Check className="w-3 h-3" />
                                                </div>
                                            ) : null}
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

                {/* Footer Toolbar: Differs based on Bulk Mode vs Single Item Selection */}
                {isBulkMode ? (
                    /* Bulk Action Footer */
                    <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-fade-in">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                                {bulkSelectedIds.length}
                            </span>
                            <span className="text-xs text-white font-semibold">
                                {bulkSelectedIds.length} file(s) selected
                            </span>
                            <Button
                                type="button"
                                variant="secondary"
                                size="xs"
                                onClick={handleSelectAllOnPage}
                                className="ml-2"
                            >
                                Select All
                            </Button>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-slate-700">
                                <span className="text-[11px] text-slate-400">Move to:</span>
                                <select
                                    value={bulkTargetFolderId}
                                    onChange={(e) => {
                                        if (e.target.value === '__new__') {
                                            setCreateFolderModalOpen(true);
                                        } else {
                                            setBulkTargetFolderId(e.target.value);
                                        }
                                    }}
                                    className="bg-transparent text-xs text-white focus:outline-none max-w-[150px] truncate"
                                >
                                    <option value="" className="bg-slate-900">
                                        Choose Folder...
                                    </option>
                                    <option value="uncategorized" className="bg-slate-900">
                                        📂 Uncategorized
                                    </option>
                                    {folders.map((f) => (
                                        <option key={f.id} value={f.id} className="bg-slate-900">
                                            📁 {f.name}
                                        </option>
                                    ))}
                                    <option value="__new__" className="bg-slate-900 text-indigo-400 font-bold">
                                        ➕ Create New Folder...
                                    </option>
                                </select>

                                <Button
                                    type="button"
                                    variant="primary"
                                    size="xs"
                                    disabled={!bulkTargetFolderId || bulkSelectedIds.length === 0}
                                    loading={isBulkMoving}
                                    onClick={() => handleBulkMove(bulkTargetFolderId)}
                                    icon={ArrowRight}
                                    className="bg-indigo-600 hover:bg-indigo-500"
                                >
                                    Move Now
                                </Button>
                            </div>

                            <Button
                                type="button"
                                variant="secondary"
                                size="xs"
                                onClick={handleDeselectAll}
                            >
                                Exit Bulk
                            </Button>
                        </div>
                    </div>
                ) : (
                    /* Standard Single Select Footer with Folder Reassignment */
                    <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            {selectedItem ? (
                                <div className="flex items-center gap-2.5 min-w-0">
                                    {selectedItem.file_type === 'image' && (
                                        <img
                                            src={selectedItem.file_url}
                                            alt=""
                                            className="w-9 h-9 rounded-lg object-cover border border-slate-700 shrink-0"
                                        />
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-sm">
                                            {selectedItem.title}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[10px] text-slate-400">Folder:</span>
                                            {/* Instant Folder Reassignment Dropdown */}
                                            <select
                                                value={selectedItem.folder_id || 'uncategorized'}
                                                disabled={isMovingSingle}
                                                onChange={(e) => {
                                                    if (e.target.value === '__new__') {
                                                        setCreateFolderModalOpen(true);
                                                    } else {
                                                        handleMoveSingleItem(selectedItem.id, e.target.value);
                                                    }
                                                }}
                                                className="bg-slate-900 border border-slate-700 rounded-md text-[10px] text-indigo-400 font-semibold px-2 py-0.5 focus:outline-none max-w-[150px] truncate"
                                                title="Change product folder for this file"
                                            >
                                                <option value="uncategorized">📂 Uncategorized</option>
                                                {folders.map((f) => (
                                                    <option key={f.id} value={f.id}>
                                                        📁 {f.name}
                                                    </option>
                                                ))}
                                                <option value="__new__" className="text-indigo-400 font-bold">
                                                    ➕ Create New Folder...
                                                </option>
                                            </select>
                                            {isMovingSingle && (
                                                <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <span className="text-xs text-slate-400">
                                    Click any image to select and send to customer, or upload into a product folder
                                </span>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 shrink-0">
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
                                className="bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30"
                            >
                                Select & Send Media
                            </Button>
                        </div>
                    </div>
                )}

                {/* Inline Create Product Folder Modal */}
                {createFolderModalOpen && (
                    <Modal
                        isOpen={createFolderModalOpen}
                        onClose={() => setCreateFolderModalOpen(false)}
                        title="Create New Product Folder"
                    >
                        <form onSubmit={handleCreateFolder} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    Product Name / Folder Title *
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    value={newFolderName}
                                    onChange={(e) => setNewFolderName(e.target.value)}
                                    placeholder="e.g. Smart Watch Series 8, Men's Panjabi, AirPods..."
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    Color Tag
                                </label>
                                <div className="flex items-center gap-2">
                                    {FOLDER_COLORS.map((c) => (
                                        <button
                                            key={c}
                                            type="button"
                                            onClick={() => setNewFolderColor(c)}
                                            className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                                                newFolderColor === c ? 'scale-110 border-white' : 'border-transparent hover:scale-105'
                                            }`}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setCreateFolderModalOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="sm"
                                    loading={creatingFolder}
                                    icon={Check}
                                >
                                    Create Folder & Organize
                                </Button>
                            </div>
                        </form>
                    </Modal>
                )}
            </div>
        </div>
    );
};

export default MediaPickerModal;
