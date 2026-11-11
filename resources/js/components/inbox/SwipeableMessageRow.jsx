import React, { useState, useRef } from 'react';
import {
    Reply,
    User,
    Sparkles,
    Maximize2,
    Video,
    Download,
    Mic,
    FileText,
    File,
    AlertCircle,
    CheckCheck,
} from 'lucide-react';

export const SwipeableMessageRow = ({
    msg,
    isCustomer,
    isAi,
    isMod,
    isFailed,
    senderName,
    isHighlighted,
    onReply,
    onScrollToMessage,
    onOpenImageLightbox,
    activeConversation,
}) => {
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const touchStartXRef = useRef(0);
    const touchStartYRef = useRef(0);
    const isHorizontalSwipeRef = useRef(null);

    // Mouse drag support for desktop
    const mouseStartXRef = useRef(0);
    const isMouseDownRef = useRef(false);

    // --- Touch Gestures ---
    const handleTouchStart = (e) => {
        touchStartXRef.current = e.touches[0].clientX;
        touchStartYRef.current = e.touches[0].clientY;
        isHorizontalSwipeRef.current = null;
        setIsSwiping(true);
    };

    const handleTouchMove = (e) => {
        if (!isSwiping) return;
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - touchStartXRef.current;
        const diffY = currentY - touchStartYRef.current;

        // Detect if horizontal swipe or vertical page scroll
        if (isHorizontalSwipeRef.current === null) {
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 6) {
                isHorizontalSwipeRef.current = true;
            } else if (Math.abs(diffY) > 6) {
                isHorizontalSwipeRef.current = false;
            }
        }

        if (isHorizontalSwipeRef.current && diffX > 0) {
            // Rubber-band resistance: max drag ~65px
            const maxDrag = 65;
            const resistance = 0.5;
            const newOffset = Math.min(diffX * resistance, maxDrag);
            setSwipeOffset(newOffset);
        }
    };

    const handleTouchEnd = () => {
        if (swipeOffset >= 38) {
            onReply(msg);
        }
        setSwipeOffset(0);
        setIsSwiping(false);
        isHorizontalSwipeRef.current = null;
    };

    // --- Mouse Drag Gestures (Desktop swipe to right) ---
    const handleMouseDown = (e) => {
        // Only primary mouse button and ignore interactive elements
        if (e.button !== 0 || e.target.closest('button, a, audio, video, img, input')) return;
        mouseStartXRef.current = e.clientX;
        isMouseDownRef.current = true;
    };

    const handleMouseMove = (e) => {
        if (!isMouseDownRef.current) return;
        const diffX = e.clientX - mouseStartXRef.current;
        if (diffX > 0) {
            const maxDrag = 65;
            const resistance = 0.45;
            setSwipeOffset(Math.min(diffX * resistance, maxDrag));
        }
    };

    const handleMouseUp = () => {
        if (isMouseDownRef.current) {
            if (swipeOffset >= 38) {
                onReply(msg);
            }
            setSwipeOffset(0);
            isMouseDownRef.current = false;
        }
    };

    const handleMouseLeave = () => {
        if (isMouseDownRef.current) {
            setSwipeOffset(0);
            isMouseDownRef.current = false;
        }
    };

    // Resolve Quoted Message data (Messenger-style)
    const quotedData =
        msg.replyTo ||
        msg.metadata?.reply_to ||
        (msg.reply_to_message_id
            ? activeConversation?.messages?.find((m) => m.id === msg.reply_to_message_id)
            : null);

    return (
        <div
            id={`msg-item-${msg.id}`}
            className={`relative flex flex-col ${isCustomer ? 'items-start' : 'items-end'} group select-none transition-all duration-300 ${
                isHighlighted ? 'bg-indigo-500/15 ring-2 ring-indigo-400/80 rounded-2xl p-1 shadow-lg' : ''
            }`}
        >
            {/* Swipe to Reply Floating Indicator (Behind/Beside message) */}
            <div
                className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all z-0"
                style={{
                    transform: `translate(${Math.max(swipeOffset - 32, 0)}px, -50%) scale(${Math.min(
                        Math.max(swipeOffset / 35, 0),
                        1.15
                    )})`,
                    opacity: swipeOffset > 8 ? Math.min(swipeOffset / 28, 1) : 0,
                }}
            >
                <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                        swipeOffset >= 38
                            ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                >
                    <Reply className="w-3.5 h-3.5" />
                </div>
            </div>

            {/* Bubble & Hover Actions Row */}
            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                style={{
                    transform: `translateX(${swipeOffset}px)`,
                    transition: isSwiping || isMouseDownRef.current ? 'none' : 'transform 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                }}
                className={`relative flex items-center gap-1.5 max-w-full z-10 ${
                    isCustomer ? 'flex-row' : 'flex-row-reverse'
                }`}
            >
                {/* Main Message Bubble */}
                <div
                    className={`max-w-md rounded-2xl px-4 py-2.5 text-xs transition-shadow ${
                        isCustomer
                            ? 'bg-slate-800 text-slate-200 rounded-bl-sm'
                            : isAi
                            ? 'bg-gradient-to-r from-violet-900/60 to-indigo-900/60 border border-indigo-500/30 text-indigo-100 rounded-br-sm'
                            : isFailed
                            ? 'bg-rose-950/80 border border-rose-500/40 text-rose-100 rounded-br-sm shadow-md'
                            : 'bg-indigo-600 text-white rounded-br-sm shadow-md'
                    }`}
                >
                    {/* Header Badges */}
                    {isAi && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-violet-300 mb-1">
                            <Sparkles className="w-3 h-3" /> NexFlow AI Automated Reply
                        </div>
                    )}
                    {isMod && (
                        <div
                            className={`flex items-center gap-1 text-[10px] font-semibold mb-1 ${
                                isFailed ? 'text-rose-300' : 'text-indigo-200'
                            }`}
                        >
                            <User className="w-3 h-3" />{' '}
                            {senderName || (msg.metadata?.source === 'facebook_page_inbox' ? 'Facebook Page' : 'Team Moderator')}
                        </div>
                    )}

                    {/* Messenger-style Quoted Reply Preview inside bubble */}
                    {quotedData && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                if (quotedData.id) onScrollToMessage(quotedData.id);
                            }}
                            className={`mb-2 p-2 rounded-xl border-l-2 cursor-pointer transition-all text-left group/quote ${
                                isCustomer
                                    ? 'bg-slate-900/90 hover:bg-slate-900 border-indigo-400'
                                    : 'bg-black/25 hover:bg-black/35 border-white/80'
                            }`}
                            title="Click to jump to quoted message"
                        >
                            <div className="flex items-center gap-1 text-[10px] font-bold opacity-90 group-hover/quote:underline mb-0.5">
                                <Reply className="w-3 h-3" />
                                <span className="truncate">
                                    {quotedData.sender_name ||
                                        (quotedData.sender_type === 'customer'
                                            ? activeConversation?.customer?.name || 'Customer'
                                            : quotedData.senderUser?.name || 'You')}
                                </span>
                            </div>
                            <p className="text-[11px] opacity-80 truncate leading-snug">
                                {quotedData.text || 'Photo / Attachment'}
                            </p>
                        </div>
                    )}

                    {/* Attachments rendering */}
                    {msg.attachments && msg.attachments.length > 0 && (
                        <div className="space-y-1.5 mb-1.5">
                            {msg.attachments.map((att) => {
                                const rawType = (att.file_type || '').toLowerCase();
                                const name = (att.file_name || '').toLowerCase();
                                const url = (att.file_url || '').toLowerCase();
                                const ext = (name.split('.').pop() || url.split('.').pop() || '').split('?')[0];

                                const isImage =
                                    rawType.startsWith('image') ||
                                    rawType === 'image' ||
                                    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
                                const isVideo =
                                    rawType.startsWith('video') ||
                                    rawType === 'video' ||
                                    ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v'].includes(ext);
                                const isAudio =
                                    rawType.startsWith('audio') ||
                                    rawType === 'audio' ||
                                    ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext) ||
                                    (ext === 'webm' && !isVideo);
                                const isPdf = rawType.includes('pdf') || ext === 'pdf';

                                if (isImage) {
                                    return (
                                        <div key={att.id} className="relative group/att my-1">
                                            <div
                                                onClick={() => onOpenImageLightbox(att)}
                                                className="block rounded-xl overflow-hidden border border-slate-700/60 hover:border-indigo-400/60 transition-all max-w-[260px] md:max-w-xs shadow-md cursor-pointer group/img relative"
                                                title="Click to view photo (Messenger style)"
                                            >
                                                <img
                                                    src={att.file_url}
                                                    alt={att.file_name || 'Photo'}
                                                    className="max-h-64 w-auto rounded-xl object-contain bg-slate-950/40 group-hover/img:scale-[1.02] transition-transform"
                                                    loading="lazy"
                                                />
                                                <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                    <div className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-sm text-white text-[11px] font-medium flex items-center gap-1 shadow-lg border border-white/10">
                                                        <Maximize2 className="w-3.5 h-3.5" />
                                                        <span>View</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }

                                if (isVideo) {
                                    return (
                                        <div
                                            key={att.id}
                                            className="my-1.5 max-w-[280px] md:max-w-xs rounded-xl overflow-hidden border border-slate-700/70 bg-black/80 shadow-md"
                                        >
                                            <video controls preload="metadata" className="w-full max-h-72 rounded-t-xl bg-black">
                                                <source src={att.file_url} />
                                                Your browser does not support playing this video.
                                            </video>
                                            {att.file_name && (
                                                <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/90 text-[10px] text-slate-300">
                                                    <span className="flex items-center gap-1.5 truncate">
                                                        <Video className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                        <span className="truncate">{att.file_name}</span>
                                                    </span>
                                                    <a
                                                        href={att.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        download={att.file_name}
                                                        className="text-cyan-400 hover:text-cyan-300 ml-2 shrink-0 p-1"
                                                        title="Download video"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                if (isAudio) {
                                    return (
                                        <div
                                            key={att.id}
                                            className="my-1.5 p-2.5 rounded-xl bg-slate-900/95 border border-slate-700/70 max-w-[280px] md:max-w-xs shadow-md"
                                        >
                                            <div className="flex items-center justify-between mb-1.5 text-[11px] text-indigo-300">
                                                <span className="flex items-center gap-1.5 font-medium">
                                                    <Mic className="w-3.5 h-3.5 text-indigo-400" />
                                                    <span>Voice Note / Audio</span>
                                                </span>
                                                {att.file_size ? (
                                                    <span className="text-[10px] text-slate-400">
                                                        {(att.file_size / 1024).toFixed(0)} KB
                                                    </span>
                                                ) : null}
                                            </div>
                                            <audio controls preload="metadata" className="w-full h-8 rounded">
                                                <source src={att.file_url} />
                                                Your browser does not support audio playback.
                                            </audio>
                                        </div>
                                    );
                                }

                                if (isPdf) {
                                    return (
                                        <a
                                            key={att.id}
                                            href={att.file_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 p-2.5 my-1.5 rounded-xl bg-slate-900/95 border border-rose-500/30 hover:border-rose-400/60 text-slate-200 transition-all max-w-[280px] md:max-w-xs shadow-md group/pdf"
                                            title="Open / Download PDF"
                                        >
                                            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 group-hover/pdf:scale-105 transition-transform shrink-0">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-slate-100 truncate group-hover/pdf:text-rose-300 transition-colors">
                                                    {att.file_name || 'Document.pdf'}
                                                </p>
                                                <p className="text-[10px] text-rose-400/80">
                                                    PDF Document {att.file_size ? `· ${(att.file_size / 1024).toFixed(0)} KB` : ''}
                                                </p>
                                            </div>
                                            <div className="p-1.5 text-slate-400 group-hover/pdf:text-white shrink-0">
                                                <Download className="w-4 h-4" />
                                            </div>
                                        </a>
                                    );
                                }

                                return (
                                    <a
                                        key={att.id}
                                        href={att.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-2.5 my-1.5 rounded-xl bg-slate-900/95 border border-cyan-500/30 hover:border-cyan-400/60 text-slate-200 transition-all max-w-[280px] md:max-w-xs shadow-md group/doc"
                                        title="Download file"
                                    >
                                        <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 group-hover/doc:scale-105 transition-transform shrink-0">
                                            <File className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-slate-100 truncate group-hover/doc:text-cyan-300 transition-colors">
                                                {att.file_name || 'Attached File'}
                                            </p>
                                            <p className="text-[10px] text-cyan-400/80">
                                                Attachment {att.file_size ? `· ${(att.file_size / 1024).toFixed(0)} KB` : ''}
                                            </p>
                                        </div>
                                        <div className="p-1.5 text-slate-400 group-hover/doc:text-white shrink-0">
                                            <Download className="w-4 h-4" />
                                        </div>
                                    </a>
                                );
                            })}
                        </div>
                    )}

                    {/* Message Text */}
                    {msg.text &&
                        (!msg.attachments ||
                            msg.attachments.length === 0 ||
                            ![
                                '📷 [Photo]',
                                '[Photo]',
                                '🎥 [Video]',
                                '[Video]',
                                '🎤 [Voice Message]',
                                '[Voice Message]',
                                '📄 [Document]',
                                '[Document]',
                                '📎 [Attachment]',
                                '[Attachment]',
                            ].includes(msg.text.trim())) && (
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        )}

                    {isFailed && (
                        <div className="mt-1.5 pt-1.5 border-t border-rose-400/25 text-[10px] text-rose-300 flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                                <span className="font-semibold text-rose-400">মেসেজ ডেলিভারি হয়নি (Meta Policy)</span>
                            </div>
                            <span className="text-[10px] text-rose-200/90 leading-tight">
                                {msg.metadata?.error && (msg.metadata.error.includes('outside of allowed window') || msg.metadata.error_code === 10)
                                    ? 'গ্রাহকের ২৪ ঘণ্টার উইন্ডো শেষ হয়ে গেছে। Message Tag দিয়ে পুনরায় চেষ্টা করুন অথবা গ্রাহককে নতুন মেসেজ দিতে বলুন।'
                                    : (msg.metadata?.error || 'Page Token Expired')}
                            </span>
                        </div>
                    )}
                </div>

                {/* Desktop Hover Quick Reply Button */}
                <button
                    type="button"
                    onClick={() => onReply(msg)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-800/80 rounded-full transition-all cursor-pointer shadow-sm shrink-0"
                    title="Reply to message (or swipe right)"
                >
                    <Reply className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Timestamps & Delivery Status */}
            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 px-1">
                {isMod && (
                    <span className="text-slate-400 font-medium">
                        Sent by {senderName || (msg.metadata?.source === 'facebook_page_inbox' ? 'Facebook Page' : 'Moderator')} ·{' '}
                    </span>
                )}
                <span>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.metadata?.tag_used && msg.metadata?.tag_used !== 'RESPONSE' && (
                    <span
                        className="inline-flex items-center gap-1 text-[9px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20"
                        title={`Sent with Meta Message Tag: ${msg.metadata.tag_used}`}
                    >
                        🏷️ {msg.metadata.tag_used}
                    </span>
                )}
                {!isCustomer &&
                    (isFailed ? (
                        <span
                            className="inline-flex items-center gap-1 text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/25 ml-1"
                            title={msg.metadata?.error || 'Message delivery failed'}
                        >
                            <AlertCircle className="w-3 h-3 text-rose-400" /> Delivery failed
                        </span>
                    ) : (
                        <CheckCheck className="w-3 h-3 text-indigo-400" />
                    ))}
            </div>
        </div>
    );
};

export default SwipeableMessageRow;

