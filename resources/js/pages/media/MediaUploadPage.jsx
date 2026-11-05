import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import {
    UploadCloud,
    Image as ImageIcon,
    Video,
    Music,
    FileText,
    CheckCircle,
    AlertCircle,
    X,
    FolderOpen,
    ArrowLeft,
    Check,
} from 'lucide-react';

export const MediaUploadPage = () => {
    const navigate = useNavigate();
    const [dragActive, setDragActive] = useState(false);
    const [filesToUpload, setFilesToUpload] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadResults, setUploadResults] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const inputRef = useRef(null);

    const getFileCategory = (file) => {
        const mime = file.type || '';
        const ext = file.name.split('.').pop()?.toLowerCase() || '';

        if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
            return 'image';
        }
        if (mime.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
            return 'video';
        }
        if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'opus', 'weba'].includes(ext)) {
            return 'audio';
        }
        return 'document';
    };

    const formatBytes = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleFiles = (incomingFiles) => {
        const newItems = Array.from(incomingFiles).map((file) => ({
            id: Math.random().toString(36).substring(7),
            file,
            title: file.name.replace(/\.[^/.]+$/, ''),
            category: getFileCategory(file),
            sizeFormatted: formatBytes(file.size),
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
            status: 'pending', // pending, uploading, success, error
        }));

        setFilesToUpload((prev) => [...prev, ...newItems]);
        setErrorMsg('');
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const handleInputChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    };

    const removeFile = (id) => {
        setFilesToUpload((prev) => prev.filter((item) => item.id !== id));
    };

    const handleUploadAll = async () => {
        if (filesToUpload.length === 0) return;
        setUploading(true);
        setErrorMsg('');
        setUploadResults(null);

        const formData = new FormData();
        filesToUpload.forEach((item) => {
            formData.append('files[]', item.file);
            formData.append('titles[]', item.title);
        });

        try {
            const res = await api.post('/media/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (res.data?.status === 'success') {
                setUploadResults(res.data);
                setFilesToUpload([]);
            }
        } catch (err) {
            setErrorMsg(err.response?.data?.message || 'Failed to upload files.');
        } finally {
            setUploading(false);
        }
    };

    const renderTypeIcon = (category) => {
        switch (category) {
            case 'image':
                return <ImageIcon className="w-5 h-5 text-indigo-400" />;
            case 'video':
                return <Video className="w-5 h-5 text-purple-400" />;
            case 'audio':
                return <Music className="w-5 h-5 text-amber-400" />;
            default:
                return <FileText className="w-5 h-5 text-emerald-400" />;
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
            {/* Top Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <Link
                        to="/media"
                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                        title="Back to Media Library"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                            <UploadCloud className="w-6 h-6 text-indigo-400" />
                            Upload New Media
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                            Upload photos, videos, audio/voice notes, or documents from your computer to NexFlow.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/media">
                        <Button variant="secondary" size="sm" icon={FolderOpen}>
                            All Media Library
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Success message */}
            {uploadResults && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-2.5">
                        <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
                        <div>
                            <p className="text-sm font-semibold">
                                {uploadResults.uploaded_count || 'Media'} files uploaded successfully!
                            </p>
                            <p className="text-xs text-emerald-400/80">
                                Your media files are now available in the Library and can be sent to customers in Chat.
                            </p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => navigate('/media')}
                        icon={FolderOpen}
                    >
                        View in Media Library
                    </Button>
                </div>
            )}

            {/* Error message */}
            {errorMsg && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-2.5">
                    <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                    <span className="text-xs sm:text-sm">{errorMsg}</span>
                </div>
            )}

            {/* Drop Zone */}
            <Card
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`p-8 sm:p-12 text-center border-2 border-dashed rounded-3xl transition-all cursor-pointer ${
                    dragActive
                        ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/70'
                }`}
                onClick={() => inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                    onChange={handleInputChange}
                    className="hidden"
                />

                <div className="max-w-md mx-auto space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/10">
                        <UploadCloud className="w-8 h-8" />
                    </div>

                    <div>
                        <h3 className="text-base font-bold text-white">
                            Drop your files here, or <span className="text-indigo-400 underline decoration-indigo-500/50">browse desktop</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                            Supports Images (PNG, JPG, WebP), Videos (MP4, WebM), Audio/Voice (MP3, WAV, M4A, OGG), and Documents (PDF, DOCX) up to 64MB each.
                        </p>
                    </div>

                    <div className="flex items-center justify-center gap-3 pt-2 text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-400" /> Images
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <Video className="w-3.5 h-3.5 text-purple-400" /> Videos
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <Music className="w-3.5 h-3.5 text-amber-400" /> Audio
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-emerald-400" /> Documents
                        </span>
                    </div>
                </div>
            </Card>

            {/* Selected Files Queue */}
            {filesToUpload.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                            <span>Ready to Upload</span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                {filesToUpload.length}
                            </span>
                        </h2>
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            loading={uploading}
                            onClick={handleUploadAll}
                            icon={UploadCloud}
                        >
                            Start Upload ({filesToUpload.length} files)
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filesToUpload.map((item) => (
                            <div
                                key={item.id}
                                className="p-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-3 relative group"
                            >
                                <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden">
                                    {item.preview ? (
                                        <img src={item.preview} alt="preview" className="w-full h-full object-cover" />
                                    ) : (
                                        renderTypeIcon(item.category)
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 pr-6">
                                    <input
                                        type="text"
                                        value={item.title}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setFilesToUpload((prev) =>
                                                prev.map((f) => (f.id === item.id ? { ...f, title: val } : f))
                                            );
                                        }}
                                        className="w-full bg-transparent text-xs font-medium text-slate-200 border-b border-transparent hover:border-slate-700 focus:border-indigo-500 focus:outline-none truncate"
                                        placeholder="Title / description"
                                    />
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                        <span className="uppercase font-semibold text-slate-500">{item.category}</span>
                                        <span>•</span>
                                        <span>{item.sizeFormatted}</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeFile(item.id)}
                                    className="absolute top-2 right-2 p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                                    title="Remove from queue"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="pt-2 flex justify-end">
                        <Button
                            type="button"
                            variant="primary"
                            size="md"
                            loading={uploading}
                            onClick={handleUploadAll}
                            icon={UploadCloud}
                        >
                            Upload {filesToUpload.length} Files Now
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
export default MediaUploadPage;

