import React, { useState, useEffect, useRef } from 'react';
import {
    X,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    RotateCw,
    Download,
    ExternalLink,
    Maximize2,
    User,
    Calendar,
} from 'lucide-react';

export const ImageLightboxModal = ({
    isOpen,
    onClose,
    images = [],
    currentIndex = 0,
    onIndexChange,
}) => {
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    const currentImage = images[currentIndex] || null;
    const hasMultiple = images.length > 1;
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < images.length - 1;

    // Reset transform when changing image or opening
    useEffect(() => {
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
    }, [currentIndex, isOpen]);

    // Keyboard navigation (Esc to close, Left/Right arrows to navigate, +/- to zoom)
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                handlePrev();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                handleNext();
            } else if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                handleZoomIn();
            } else if (e.key === '-') {
                e.preventDefault();
                handleZoomOut();
            } else if (e.key === '0') {
                e.preventDefault();
                handleReset();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, currentIndex, images.length]);

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const handlePrev = () => {
        if (hasPrev && onIndexChange) {
            onIndexChange(currentIndex - 1);
        }
    };

    const handleNext = () => {
        if (hasNext && onIndexChange) {
            onIndexChange(currentIndex + 1);
        }
    };

    const handleZoomIn = () => {
        setZoom((prev) => Math.min(prev + 0.35, 3.5));
    };

    const handleZoomOut = () => {
        setZoom((prev) => {
            const next = Math.max(prev - 0.35, 1);
            if (next === 1) setPan({ x: 0, y: 0 });
            return next;
        });
    };

    const handleRotate = () => {
        setRotation((prev) => (prev + 90) % 360);
    };

    const handleReset = () => {
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
    };

    // Pan / Drag image when zoomed in
    const handleMouseDown = (e) => {
        if (zoom <= 1) return;
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX - pan.x,
            y: e.clientY - pan.y,
        };
    };

    const handleMouseMove = (e) => {
        if (!isDragging || zoom <= 1) return;
        setPan({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y,
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    if (!isOpen || !currentImage) return null;

    const formattedDate = currentImage.createdAt
        ? new Date(currentImage.createdAt).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : null;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex flex-col justify-between select-none animate-fade-in"
            onClick={(e) => {
                // If user clicks backdrop directly (outside controls or image)
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {/* Top Toolbar */}
            <div
                className="p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between gap-3 text-white z-20"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Left: Info / Sender / Counter */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            {currentImage.senderName && (
                                <span className="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    <span>{currentImage.senderName}</span>
                                </span>
                            )}
                            {hasMultiple && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 font-mono text-slate-300">
                                    {currentIndex + 1} / {images.length}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 truncate">
                            {formattedDate && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 shrink-0" />
                                    <span>{formattedDate}</span>
                                </span>
                            )}
                            {currentImage.file_name && (
                                <span className="truncate hidden sm:inline">
                                    • {currentImage.file_name}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Controls & Cross Close Button */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {/* Zoom Out */}
                    <button
                        type="button"
                        onClick={handleZoomOut}
                        disabled={zoom <= 1}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white flex items-center justify-center transition-all cursor-pointer"
                        title="Zoom Out (-)"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>

                    {/* Zoom Percentage */}
                    <button
                        type="button"
                        onClick={handleReset}
                        className="text-[11px] font-mono px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer min-w-[46px] text-center"
                        title="Reset Zoom (0)"
                    >
                        {Math.round(zoom * 100)}%
                    </button>

                    {/* Zoom In */}
                    <button
                        type="button"
                        onClick={handleZoomIn}
                        disabled={zoom >= 3.5}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 text-white flex items-center justify-center transition-all cursor-pointer"
                        title="Zoom In (+)"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>

                    {/* Rotate */}
                    <button
                        type="button"
                        onClick={handleRotate}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer hidden sm:flex"
                        title="Rotate 90°"
                    >
                        <RotateCw className="w-4 h-4" />
                    </button>

                    {/* Download */}
                    <a
                        href={currentImage.file_url}
                        download={currentImage.file_name || 'photo.jpg'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                        title="Download Image"
                    >
                        <Download className="w-4 h-4" />
                    </a>

                    {/* Open in New Tab */}
                    <a
                        href={currentImage.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer hidden sm:flex"
                        title="Open Raw Image in New Tab"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>

                    {/* Divider */}
                    <div className="w-px h-6 bg-white/20 mx-1" />

                    {/* Messenger-style Prominent Cross (X) Close Button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/15 hover:bg-rose-600 active:bg-rose-700 text-white flex items-center justify-center transition-all cursor-pointer shadow-xl hover:scale-105"
                        title="Close (Esc)"
                    >
                        <X className="w-5 h-5 sm:w-6 sm:h-6" />
                    </button>
                </div>
            </div>

            {/* Middle Image Viewport */}
            <div
                className="flex-1 relative flex items-center justify-center overflow-hidden p-2 sm:p-6"
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        onClose();
                    }
                }}
            >
                {/* Floating Previous Arrow Button */}
                {hasMultiple && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handlePrev();
                        }}
                        disabled={!hasPrev}
                        className={`absolute left-3 sm:left-6 z-30 w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all shadow-2xl backdrop-blur-md cursor-pointer ${
                            hasPrev
                                ? 'bg-black/60 hover:bg-black/90 text-white hover:scale-110 active:scale-95 border border-white/20'
                                : 'opacity-0 pointer-events-none'
                        }`}
                        title="Previous Image (Left Arrow)"
                    >
                        <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
                    </button>
                )}

                {/* The Displayed Image */}
                <div
                    className={`relative max-w-full max-h-full flex items-center justify-center transition-transform ${
                        zoom > 1 ? 'cursor-grab' : 'cursor-default'
                    } ${isDragging ? 'cursor-grabbing' : ''}`}
                    onMouseDown={handleMouseDown}
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px)`,
                    }}
                >
                    <img
                        key={currentImage.file_url}
                        src={currentImage.file_url}
                        alt={currentImage.file_name || 'Photo'}
                        draggable={false}
                        className="max-h-[82vh] max-w-[92vw] sm:max-w-[85vw] object-contain rounded-xl shadow-2xl transition-transform duration-150 select-none"
                        style={{
                            transform: `scale(${zoom}) rotate(${rotation}deg)`,
                        }}
                    />
                </div>

                {/* Floating Next Arrow Button */}
                {hasMultiple && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleNext();
                        }}
                        disabled={!hasNext}
                        className={`absolute right-3 sm:right-6 z-30 w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all shadow-2xl backdrop-blur-md cursor-pointer ${
                            hasNext
                                ? 'bg-black/60 hover:bg-black/90 text-white hover:scale-110 active:scale-95 border border-white/20'
                                : 'opacity-0 pointer-events-none'
                        }`}
                        title="Next Image (Right Arrow)"
                    >
                        <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
                    </button>
                )}
            </div>

            {/* Bottom Bar: Caption (if any) + Thumbnails Strip */}
            <div
                className="p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex flex-col items-center gap-2 z-20"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Optional Message Caption */}
                {currentImage.text && (
                    <div className="max-w-xl text-center px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs text-slate-200 truncate">
                        {currentImage.text}
                    </div>
                )}

                {/* Thumbnails Carousel (when there are multiple images in the conversation) */}
                {hasMultiple && (
                    <div className="flex items-center gap-2 overflow-x-auto max-w-full px-2 py-1 scrollbar-none">
                        {images.map((img, idx) => {
                            const isSelected = idx === currentIndex;
                            return (
                                <button
                                    key={img.id || img.file_url || idx}
                                    type="button"
                                    onClick={() => onIndexChange && onIndexChange(idx)}
                                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 cursor-pointer ${
                                        isSelected
                                            ? 'border-indigo-500 scale-110 ring-2 ring-indigo-500/50 shadow-lg'
                                            : 'border-transparent opacity-50 hover:opacity-100 hover:scale-105'
                                    }`}
                                >
                                    <img
                                        src={img.file_url}
                                        alt=""
                                        draggable={false}
                                        className="w-full h-full object-cover"
                                    />
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageLightboxModal;

