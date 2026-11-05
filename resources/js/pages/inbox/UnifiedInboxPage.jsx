import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { playIncomingMessageSound, playOutgoingMessageSound } from '../../utils/soundEffects';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { CreateOrderModal } from '../../components/orders/CreateOrderModal';
import { CustomerAvatar } from '../../components/common/CustomerAvatar';
import { Facebook, Instagram } from '../../components/common/SocialIcons';
import { MediaPickerModal } from '../../components/media/MediaPickerModal';
import { ImageLightboxModal } from '../../components/common/ImageLightboxModal';
import {
    Search,
    Send,
    Sparkles,
    User,
    Phone,
    Mail,
    Tag,
    Clock,
    AlertCircle,
    CheckCircle,
    Check,
    CheckCheck,
    MessageSquare,
    PhoneCall,
    Flame,
    ShoppingBag,
    Plus,
    Calendar,
    FileText,
    ShieldAlert,
    RefreshCw,
    Bot,
    PanelRightClose,
    PanelRightOpen,
    GripVertical,
    Edit3,
    Users,
    ArrowLeft,
    Info,
    Image as ImageIcon,
    Paperclip,
    FolderOpen,
    Music,
    X,
    Mic,
    Video,
    Volume2,
    Download,
    File,
    Square,
    Maximize2,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';

export const UnifiedInboxPage = () => {
    const { user, isModerator } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Resizable Panels State (with persistence)
    const [leftWidth, setLeftWidth] = useState(() => {
        const saved = localStorage.getItem('nexflow_inbox_left_width');
        return saved ? Math.max(190, Math.min(parseInt(saved, 10), 480)) : 260;
    });
    const [rightWidth, setRightWidth] = useState(() => {
        const saved = localStorage.getItem('nexflow_inbox_right_width');
        return saved ? Math.max(220, Math.min(parseInt(saved, 10), 450)) : 270;
    });
    const [showRightPanel, setShowRightPanel] = useState(true);
    const [isDraggingLeft, setIsDraggingLeft] = useState(false);
    const [isDraggingRight, setIsDraggingRight] = useState(false);

    // Mobile Navigation State: 'list' | 'chat' (Always start on customer list on mobile)
    const [mobileView, setMobileView] = useState(() => {
        if (typeof window !== 'undefined' && window.innerWidth < 768) {
            return searchParams.has('conversation') ? 'chat' : 'list';
        }
        return 'chat';
    });
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
    const [mobileCrmExpanded, setMobileCrmExpanded] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) {
                setMobileView('chat');
            } else if (!searchParams.has('conversation')) {
                setMobileView('list');
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [searchParams]);

    // Handle smartphone hardware/gesture back button & browser history
    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const convId = params.get('conversation');
            if (isMobile) {
                if (!convId) {
                    setMobileView('list');
                    setMobileCrmExpanded(false);
                    setActiveConversation(null);
                } else {
                    setMobileView('chat');
                }
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isMobile]);

    // React to searchParams changes on mobile
    useEffect(() => {
        const convId = searchParams.get('conversation');
        if (isMobile) {
            if (convId) {
                setMobileView('chat');
            } else {
                setMobileView('list');
                setMobileCrmExpanded(false);
            }
        }
    }, [searchParams, isMobile]);

    const handleBackToList = () => {
        setMobileView('list');
        setMobileCrmExpanded(false);
        setActiveConversation(null);
        if (searchParams.has('conversation')) {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                navigate('/inbox', { replace: true });
            }
        }
    };

    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [loadingList, setLoadingList] = useState(true);
    const [loadingThread, setLoadingThread] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isInternalNote, setIsInternalNote] = useState(false);
    const [sending, setSending] = useState(false);
    const [suggesting, setSuggesting] = useState(false);
    const [suggestedData, setSuggestedData] = useState(null);

    // File / Media attachment state (Images, Videos, PDFs, Documents, Audio)
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedMediaItem, setSelectedMediaItem] = useState(null);
    const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
    const [filePreviewUrl, setFilePreviewUrl] = useState('');
    const [fileTypeCategory, setFileTypeCategory] = useState(''); // 'image' | 'video' | 'audio' | 'pdf' | 'file'
    const fileInputRef = useRef(null);

    // Messenger-style Image Lightbox State
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxImageIndex, setLightboxImageIndex] = useState(0);

    // Extract all image attachments from current active conversation messages
    const conversationImages = useMemo(() => {
        if (!messages || messages.length === 0) return [];
        const imgs = [];
        messages.forEach((msg) => {
            if (msg.attachments && msg.attachments.length > 0) {
                msg.attachments.forEach((att) => {
                    const rawType = (att.file_type || '').toLowerCase();
                    const name = (att.file_name || '').toLowerCase();
                    const url = (att.file_url || '').toLowerCase();
                    const ext = (name.split('.').pop() || url.split('.').pop() || '').split('?')[0];
                    const isImg =
                        rawType.startsWith('image') ||
                        rawType === 'image' ||
                        ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);

                    if (isImg && att.file_url) {
                        imgs.push({
                            ...att,
                            messageId: msg.id,
                            sender: msg.sender_type,
                            senderName:
                                msg.sender_name ||
                                (msg.sender_type === 'customer'
                                    ? activeConversation?.customer?.name
                                    : 'Moderator'),
                            createdAt: msg.created_at,
                            text: msg.text,
                        });
                    }
                });
            }
        });
        return imgs;
    }, [messages, activeConversation]);

    const handleOpenImageLightbox = (clickedAtt) => {
        const foundIdx = conversationImages.findIndex(
            (img) => (clickedAtt.id && img.id === clickedAtt.id) || img.file_url === clickedAtt.file_url
        );
        if (foundIdx !== -1) {
            setLightboxImageIndex(foundIdx);
        } else {
            setLightboxImageIndex(0);
        }
        setIsLightboxOpen(true);
    };

    // Voice recording state & refs
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const timerRef = useRef(null);
    const recorderMimeRef = useRef('');
    const recorderExtRef = useRef('webm');
    const sendImmediatelyRef = useRef(false);

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 25 * 1024 * 1024) {
                alert('ফাইলের সাইজ সর্বোচ্চ 25MB হতে পারে।');
                return;
            }
            setSelectedFile(file);
            setFilePreviewUrl(URL.createObjectURL(file));

            const mime = file.type || '';
            const ext = file.name.split('.').pop()?.toLowerCase() || '';

            if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
                setFileTypeCategory('image');
            } else if (mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) {
                setFileTypeCategory('video');
            } else if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) {
                setFileTypeCategory('audio');
            } else if (ext === 'pdf' || mime === 'application/pdf') {
                setFileTypeCategory('pdf');
            } else {
                setFileTypeCategory('file');
            }
        }
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        setSelectedMediaItem(null);
        if (filePreviewUrl) {
            if (filePreviewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(filePreviewUrl);
            }
            setFilePreviewUrl('');
        }
        setFileTypeCategory('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSelectMediaLibraryItem = (media) => {
        handleRemoveFile();
        setSelectedMediaItem(media);
        setFileTypeCategory(media.file_type);
        setFilePreviewUrl(media.file_url);
    };

    const getSupportedAudioMime = () => {
        if (typeof MediaRecorder === 'undefined') return { mime: '', ext: 'webm' };
        const candidates = [
            { mime: 'audio/webm;codecs=opus', ext: 'webm' },
            { mime: 'audio/webm', ext: 'webm' },
            { mime: 'audio/mp4', ext: 'mp4' },
            { mime: 'audio/aac', ext: 'aac' },
            { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
            { mime: 'audio/ogg', ext: 'ogg' },
        ];
        for (const c of candidates) {
            try {
                if (MediaRecorder.isTypeSupported(c.mime)) {
                    return c;
                }
            } catch (e) {}
        }
        return { mime: '', ext: 'webm' };
    };

    const startRecording = async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert('আপনার ব্রাউজারে অডিও রেকর্ডিং সাপোর্ট করে না।');
                return;
            }

            // Clear any previously attached file/audio
            handleRemoveFile();

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            audioChunksRef.current = [];
            sendImmediatelyRef.current = false;

            const { mime, ext } = getSupportedAudioMime();
            recorderMimeRef.current = mime;
            recorderExtRef.current = ext;

            const options = mime ? { mimeType: mime } : undefined;
            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            mediaRecorder.onstop = () => {
                try {
                    const actualMime = mediaRecorder.mimeType || recorderMimeRef.current || 'audio/webm';
                    const actualExt = recorderExtRef.current || (actualMime.includes('mp4') ? 'mp4' : actualMime.includes('ogg') ? 'ogg' : 'webm');
                    const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });

                    if (audioBlob.size < 50) {
                        console.warn('Recorded audio is empty or too short');
                        return;
                    }

                    const filename = `voice_${Date.now()}.${actualExt}`;
                    let voiceFile;
                    try {
                        voiceFile = new File([audioBlob], filename, { type: actualMime });
                    } catch (e) {
                        voiceFile = audioBlob;
                        voiceFile.name = filename;
                        voiceFile.lastModified = Date.now();
                    }

                    setSelectedFile(voiceFile);
                    const previewUrl = URL.createObjectURL(audioBlob);
                    setFilePreviewUrl(previewUrl);
                    setFileTypeCategory('audio');

                    if (sendImmediatelyRef.current) {
                        sendImmediatelyRef.current = false;
                        executeSendMessage(voiceFile, 'audio', filename);
                    }
                } catch (err) {
                    console.error('Error handling recorded audio:', err);
                } finally {
                    if (mediaStreamRef.current) {
                        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
                        mediaStreamRef.current = null;
                    }
                }
            };

            // Request timeslice every 200ms so chunks are continuously populated
            mediaRecorder.start(200);
            setIsRecording(true);
            setRecordingTime(0);

            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        } catch (err) {
            console.error('Microphone access denied:', err);
            alert('ভয়েস রেকর্ড করতে মাইক্রোফোন পারমিশন প্রয়োজন। ব্রাউজার সেটিংসে মাইক্রোফোন অ্যাক্সেস অ্যালাউ করুন।');
        }
    };

    const stopRecording = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                mediaRecorderRef.current.requestData();
            } catch (e) {}
            try {
                mediaRecorderRef.current.stop();
            } catch (e) {}
        }
    };

    const cancelRecording = () => {
        sendImmediatelyRef.current = false;
        if (timerRef.current) clearInterval(timerRef.current);
        setIsRecording(false);
        setRecordingTime(0);

        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.onstop = null;
            if (mediaRecorderRef.current.state !== 'inactive') {
                try {
                    mediaRecorderRef.current.stop();
                } catch (e) {}
            }
            mediaRecorderRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
        }
        audioChunksRef.current = [];
    };

    // Channel Access Token Update Modal State
    const [tokenModalAccount, setTokenModalAccount] = useState(null);
    const [newToken, setNewToken] = useState('');
    const [savingToken, setSavingToken] = useState(false);

    // Filters
    const [filterTab, setFilterTab] = useState(searchParams.get('filter') || 'all');
    const [platformFilter, setPlatformFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [followupModal, setFollowupModal] = useState(false);
    const [orderModal, setOrderModal] = useState(false);
    const [followupForm, setFollowupForm] = useState({
        followup_date: new Date().toISOString().split('T')[0],
        followup_time: '14:00',
        notes: '',
        priority: 'high',
    });
    const [orderForm, setOrderForm] = useState({
        quantity: 1,
        unit_price: 1250,
        delivery_charge: 70,
        customer_address: '',
        customer_phone: '',
        notes: '',
    });

    // Customer editing state
    const [editingCustomer, setEditingCustomer] = useState(false);
    const [custEditName, setCustEditName] = useState('');
    const [custEditPhone, setCustEditPhone] = useState('');
    const [savingCustomer, setSavingCustomer] = useState(false);
    const [syncingNames, setSyncingNames] = useState(false);

    const messagesEndRef = useRef(null);
    const activeConvIdRef = useRef(null);
    const lastMsgIdRef = useRef(null);
    const containerRef = useRef(null);
    const prevUnreadTotalRef = useRef(0);
    const hasSyncedNamesRef = useRef(false);

    // Mouse drag resize listener
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDraggingLeft && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const newWidth = Math.max(190, Math.min(e.clientX - rect.left, 480));
                setLeftWidth(newWidth);
                localStorage.setItem('nexflow_inbox_left_width', newWidth);
            } else if (isDraggingRight && containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const newWidth = Math.max(220, Math.min(rect.right - e.clientX, 450));
                setRightWidth(newWidth);
                localStorage.setItem('nexflow_inbox_right_width', newWidth);
            }
        };

        const handleMouseUp = () => {
            if (isDraggingLeft) setIsDraggingLeft(false);
            if (isDraggingRight) setIsDraggingRight(false);
        };

        if (isDraggingLeft || isDraggingRight) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDraggingLeft, isDraggingRight]);

    // Play subtle audio alert for inbound messages using user settings
    const playNotificationSound = () => {
        playIncomingMessageSound();
    };

    // Fetch conversation list
    const fetchConversations = async (silent = false) => {
        try {
            if (!silent) setLoadingList(true);
            const params = {};
            if (filterTab && filterTab !== 'all') params.filter = filterTab;
            if (platformFilter) params.platform = platformFilter;
            if (searchQuery) params.search = searchQuery;

            const res = await api.get('/conversations', { params });
            const list = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.data || []);
            setConversations(list);

            const totalUnread = list.reduce((sum, c) => sum + (c.unread_count || 0), 0);
            if (silent && totalUnread > prevUnreadTotalRef.current) {
                playNotificationSound();
            }
            prevUnreadTotalRef.current = totalUnread;

            // Auto-enrich any generic customer names silently from Facebook
            const hasGenericFacebookCustomer = list.some((c) => c.customer?.name?.startsWith('Facebook'));
            if (hasGenericFacebookCustomer && !hasSyncedNamesRef.current) {
                hasSyncedNamesRef.current = true;
                api.post('/conversations/sync-names')
                    .then((syncRes) => {
                        if (syncRes.data?.updated_count > 0) {
                            fetchConversations(true);
                            if (activeConvIdRef.current) {
                                loadConversationDetails(activeConvIdRef.current);
                            }
                        }
                    })
                    .catch(() => {});
            }

            if (!silent) {
                // On desktop, auto-select conversation from query param or first item
                // On mobile, DO NOT auto-select so user always starts on customer list view
                if (!isMobile) {
                    const queryConvId = searchParams.get('conversation');
                    if (queryConvId) {
                        const found = list.find((c) => c.id === parseInt(queryConvId));
                        if (found) {
                            loadConversationDetails(found.id);
                        } else if (list.length > 0) {
                            loadConversationDetails(list[0].id);
                        }
                    } else if (!activeConversation && list.length > 0) {
                        loadConversationDetails(list[0].id);
                    }
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (!silent) setLoadingList(false);
        }
    };

    const loadConversationDetails = async (id, isExplicitUserClick = false) => {
        try {
            setLoadingThread(true);
            const res = await api.get(`/conversations/${id}`);
            setActiveConversation(res.data.data);
            if (isExplicitUserClick && isMobile) {
                setMobileView('chat');
                setMobileCrmExpanded(false);
                navigate(`/inbox?conversation=${id}`);
            } else if (!isMobile) {
                setSearchParams({ conversation: id }, { replace: true });
            }

            // Prefill order modal if customer exists
            const cust = res.data.data.customer;
            const lead = res.data.data.lead;
            setOrderForm((prev) => ({
                ...prev,
                customer_phone: cust?.phone || '',
                unit_price: lead?.related_product?.selling_price || 1250,
                delivery_charge: 70,
            }));
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingThread(false);
        }
    };

    // Keep active conversation id & last message id refs updated to avoid stale closures
    useEffect(() => {
        activeConvIdRef.current = activeConversation?.id || null;
        const msgs = activeConversation?.messages || [];
        if (msgs.length > 0) {
            lastMsgIdRef.current = msgs[msgs.length - 1].id;
        } else {
            lastMsgIdRef.current = null;
        }
    }, [activeConversation]);

    // Real-time synchronization poller
    useEffect(() => {
        // Poller for new messages in active thread (every 2.2 seconds)
        const threadInterval = setInterval(async () => {
            const currentConvId = activeConvIdRef.current;
            const lastId = lastMsgIdRef.current;
            if (!currentConvId) return;

            try {
                const url = lastId
                    ? `/conversations/${currentConvId}/latest-messages?after_id=${lastId}`
                    : `/conversations/${currentConvId}/latest-messages`;

                const res = await api.get(url);
                const newMsgs = res.data?.data?.messages || [];

                if (newMsgs.length > 0) {
                    const hasCustomerMsg = newMsgs.some((m) => m.sender_type === 'customer');
                    if (hasCustomerMsg) {
                        playNotificationSound();
                    }

                    setActiveConversation((prev) => {
                        if (!prev || prev.id !== currentConvId) return prev;
                        const existingIds = new Set((prev.messages || []).map((m) => m.id));
                        const toAppend = newMsgs.filter((m) => !existingIds.has(m.id));
                        if (toAppend.length === 0) return prev;

                        return {
                            ...prev,
                            is_human_takeover: res.data.data.is_human_takeover ?? prev.is_human_takeover,
                            status: res.data.data.status ?? prev.status,
                            messages: [...(prev.messages || []), ...toAppend],
                        };
                    });

                    // Silently refresh conversation list so snippets & unread counts update
                    fetchConversations(true);
                }
            } catch (err) {
                // Ignore silent background poll errors
            }
        }, 1200);

        // Poller for conversation sidebar list updates (every 2.5 seconds)
        const listInterval = setInterval(() => {
            fetchConversations(true);
        }, 2500);

        return () => {
            clearInterval(threadInterval);
            clearInterval(listInterval);
        };
    }, []);

    useEffect(() => {
        fetchConversations();
    }, [filterTab, platformFilter]);

    useEffect(() => {
        if (!isMobile || mobileView === 'chat') {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [activeConversation?.messages, mobileView, isMobile]);

    // Send Message (supports text, photo, video, audio, media library files, and documents)
    const executeSendMessage = async (fileOverride = null, fileTypeOverride = null, filenameOverride = null) => {
        const fileToSend = fileOverride || selectedFile;
        const catToSend = fileTypeOverride || fileTypeCategory;
        const textToSend = replyText.trim();
        const mediaToSend = selectedMediaItem;

        if ((!textToSend && !fileToSend && !mediaToSend) || !activeConversation) return;

        setSending(true);
        try {
            let res;
            if (fileToSend) {
                const formData = new FormData();
                if (textToSend) {
                    formData.append('text', textToSend);
                }
                formData.append('is_internal_note', isInternalNote ? '1' : '0');
                formData.append('file_type', catToSend || 'file');

                const fname = filenameOverride || fileToSend.name || `voice_${Date.now()}.webm`;
                formData.append('file', fileToSend, fname);

                res = await api.post(`/conversations/${activeConversation.id}/messages`, formData);
            } else if (mediaToSend) {
                const formData = new FormData();
                if (textToSend) {
                    formData.append('text', textToSend);
                }
                formData.append('is_internal_note', isInternalNote ? '1' : '0');
                formData.append('media_id', mediaToSend.id);

                res = await api.post(`/conversations/${activeConversation.id}/messages`, formData);
            } else {
                res = await api.post(`/conversations/${activeConversation.id}/messages`, {
                    text: textToSend,
                    is_internal_note: isInternalNote,
                });
            }

            // Append message locally
            const newMsg = res.data.data;
            if (newMsg && !newMsg.sender_user && user) {
                newMsg.sender_user = { id: user.id, name: user.name, role: user.role };
            }
            setActiveConversation((prev) => ({
                ...prev,
                is_human_takeover: isInternalNote ? prev.is_human_takeover : true,
                messages: [...(prev.messages || []), newMsg],
            }));
            lastMsgIdRef.current = newMsg?.id || Date.now();
            setReplyText('');
            handleRemoveFile();
            setIsInternalNote(false);
            setSuggestedData(null);
            fetchConversations(true);

            // Play outgoing Messenger-style message sound
            playOutgoingMessageSound();
        } catch (err) {
            const failedMsg = err.response?.data?.data;
            if (failedMsg) {
                if (!failedMsg.sender_user && user) {
                    failedMsg.sender_user = { id: user.id, name: user.name, role: user.role };
                }
                setActiveConversation((prev) => ({
                    ...prev,
                    messages: [...(prev.messages || []), failedMsg],
                }));
            }
            const errMsg = err.response?.data?.message || err.message;
            alert(errMsg);
            if (errMsg.includes('expired') || errMsg.includes('token')) {
                setTokenModalAccount(activeConversation?.social_account);
            }
        } finally {
            setSending(false);
        }
    };

    const handleSendMessage = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        executeSendMessage();
    };

    // Update Channel Page Access Token
    const handleUpdateChannelToken = async (e) => {
        e.preventDefault();
        const targetAccount = tokenModalAccount || activeConversation?.social_account;
        if (!newToken.trim() || !targetAccount?.id) return;

        setSavingToken(true);
        try {
            await api.put(`/social-accounts/${targetAccount.id}`, {
                access_token: newToken.trim(),
            });
            alert(`Page Access Token for "${targetAccount.name}" updated and verified successfully!`);
            setTokenModalAccount(null);
            setNewToken('');
            if (activeConversation) {
                loadConversationDetails(activeConversation.id);
            }
            fetchConversations(true);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update access token.');
        } finally {
            setSavingToken(false);
        }
    };

    // Update Customer details handler
    const handleSaveCustomer = async (e) => {
        e?.preventDefault();
        if (!activeConversation?.customer?.id) return;
        try {
            setSavingCustomer(true);
            const res = await api.put(`/customers/${activeConversation.customer.id}`, {
                name: custEditName.trim(),
                phone: custEditPhone.trim(),
            });
            const updatedCust = res.data.data;
            setActiveConversation((prev) => ({
                ...prev,
                customer: {
                    ...prev.customer,
                    ...updatedCust,
                },
            }));
            setConversations((prev) =>
                prev.map((c) =>
                    c.customer?.id === updatedCust.id
                        ? { ...c, customer: { ...c.customer, ...updatedCust } }
                        : c
                )
            );
            setEditingCustomer(false);
        } catch (err) {
            console.error('Failed to update customer', err);
            alert('Failed to update customer details.');
        } finally {
            setSavingCustomer(false);
        }
    };

    // Bulk sync real customer names from Facebook
    const handleSyncNames = async () => {
        try {
            setSyncingNames(true);
            const res = await api.post('/conversations/sync-names');
            alert(res.data.message || 'Customer names synchronized successfully!');
            fetchConversations(true);
            if (activeConversation) {
                loadConversationDetails(activeConversation.id);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to sync names from Facebook.');
        } finally {
            setSyncingNames(false);
        }
    };

    // AI Suggest Reply
    const handleAiSuggest = async () => {
        if (!activeConversation) return;
        setSuggesting(true);
        try {
            const res = await api.post(`/conversations/${activeConversation.id}/suggest-reply`);
            const data = res.data.data;
            setSuggestedData(data);
            setReplyText(data.suggested_reply);
        } catch (err) {
            alert('AI suggestion error: ' + (err.response?.data?.message || err.message));
        } finally {
            setSuggesting(false);
        }
    };

    // Human takeover toggle
    const handleToggleTakeover = async () => {
        if (!activeConversation) return;
        const nextState = !activeConversation.is_human_takeover;
        try {
            await api.post(`/conversations/${activeConversation.id}/takeover`, {
                is_human_takeover: nextState,
            });
            setActiveConversation((prev) => ({ ...prev, is_human_takeover: nextState }));
        } catch (err) {
            alert('Failed to toggle takeover');
        }
    };

    // Quick Lead status update
    const handleLeadStatusChange = async (newStatus) => {
        if (!activeConversation?.lead) return;
        try {
            await api.put(`/leads/${activeConversation.lead.id}/status`, {
                status: newStatus,
                reason: 'Changed by moderator in Unified Inbox',
            });
            setActiveConversation((prev) => ({
                ...prev,
                lead: { ...prev.lead, status: newStatus },
            }));
            // Refresh conversation list to update badge
            fetchConversations();
        } catch (err) {
            alert('Failed to update lead status');
        }
    };

    // Schedule Followup submit
    const handleFollowupSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/followups', {
                lead_id: activeConversation.lead.id,
                conversation_id: activeConversation.id,
                ...followupForm,
            });
            setFollowupModal(false);
            alert('Follow-up scheduled successfully!');
        } catch (err) {
            alert('Failed to schedule follow-up');
        }
    };

    // Create Order submit
    const handleOrderSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/orders', {
                customer_id: activeConversation.customer.id,
                conversation_id: activeConversation.id,
                product_id: activeConversation.lead?.related_product?.id || 1,
                ...orderForm,
            });
            setOrderModal(false);
            alert('Order confirmed and lead successfully verified as Converted!');
            loadConversationDetails(activeConversation.id);
            fetchConversations();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to create order');
        }
    };

    // Reusable Customer & Lead CRM Panel Content
    const renderCrmDetails = () => (
        <div className="space-y-4">
            {/* Customer Identity */}
            <div className="text-center">
                <CustomerAvatar
                    name={activeConversation?.customer?.name}
                    avatarUrl={activeConversation?.customer?.avatar_url}
                    size="xl"
                    className="mx-auto ring-2 ring-indigo-500/20"
                />
                <div className="mt-2">
                    <h3 className="text-sm font-bold text-slate-100 flex items-center justify-center gap-1.5">
                        <span>{activeConversation?.customer?.name || 'Customer'}</span>
                        <button
                            type="button"
                            onClick={() => {
                                setCustEditName(activeConversation?.customer?.name || '');
                                setCustEditPhone(activeConversation?.customer?.phone || '');
                                setEditingCustomer((prev) => !prev);
                            }}
                            title="Edit Customer"
                            className="text-slate-400 hover:text-cyan-400 transition-colors p-1 rounded hover:bg-slate-800 cursor-pointer"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                        </button>
                    </h3>
                    {(activeConversation?.social_account?.name || activeConversation?.socialAccount?.name) && (
                        <p className="text-xs text-cyan-400 font-semibold mt-0.5">
                            ({activeConversation?.social_account?.name || activeConversation?.socialAccount?.name})
                        </p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">{activeConversation?.customer?.phone || 'No phone recorded'}</p>
                </div>
            </div>

            {/* Inline Customer Edit Form */}
            {editingCustomer && (
                <form onSubmit={handleSaveCustomer} className="p-3 bg-slate-900 border border-cyan-500/30 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200">Edit Customer Info</span>
                        <button
                            type="button"
                            onClick={() => setEditingCustomer(false)}
                            className="text-slate-400 hover:text-slate-200 text-xs px-1 cursor-pointer"
                        >
                            ✕
                        </button>
                    </div>
                    <div>
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">Customer Name</label>
                        <input
                            type="text"
                            value={custEditName}
                            onChange={(e) => setCustEditName(e.target.value)}
                            placeholder="Enter real customer name"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-medium text-slate-400 mb-1">Phone Number</label>
                        <input
                            type="text"
                            value={custEditPhone}
                            onChange={(e) => setCustEditPhone(e.target.value)}
                            placeholder="01XXXXXXXXX"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => setEditingCustomer(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="xs"
                            disabled={savingCustomer}
                        >
                            {savingCustomer ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                </form>
            )}

            {/* Quick Lead Status Selector */}
            <div className="space-y-1.5 border-t border-slate-800/80 pt-3">
                <label className="text-xs font-semibold text-slate-300 block">Lead CRM Classification</label>
                <select
                    value={activeConversation?.lead?.status || 'cold'}
                    onChange={(e) => handleLeadStatusChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-medium capitalize"
                >
                    <option value="cold">Cold Lead (Browsing / Passive)</option>
                    <option value="warm">Warm Lead (Price / Size / Specs Inquired)</option>
                    <option value="hot">Hot Lead (Purchase Intent / Address Shared)</option>
                    <option value="converted">Converted (Verified Order Created)</option>
                    <option value="lost">Lost Lead (Declined / Cancelled)</option>
                </select>
                {activeConversation?.lead?.suggested_status && (
                    <p className="text-[10px] text-violet-400 mt-1">
                        AI Suggested: <span className="font-semibold uppercase">{activeConversation.lead.suggested_status}</span> ({(activeConversation.lead.confidence * 100).toFixed(0)}% confidence)
                    </p>
                )}
            </div>

            {/* Mapped Product Context */}
            {activeConversation?.lead?.related_product && (
                <div className="border border-slate-800 rounded-xl p-3 bg-slate-900/60 space-y-1.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                        Inquired Product
                    </span>
                    <p className="text-xs font-bold text-slate-200">
                        {activeConversation.lead.related_product.name}
                    </p>
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                        <span>Verified Price:</span>
                        <span className="font-semibold text-emerald-400">
                            {activeConversation.lead.related_product.selling_price} BDT
                        </span>
                    </div>
                </div>
            )}

            {/* Quick Action Buttons */}
            <div className="space-y-2 border-t border-slate-800/80 pt-3">
                <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start"
                    icon={Calendar}
                    onClick={() => setFollowupModal(true)}
                >
                    Schedule Follow-up
                </Button>
                <Button
                    variant="primary"
                    size="sm"
                    className="w-full justify-start"
                    icon={ShoppingBag}
                    onClick={() => setOrderModal(true)}
                >
                    Create Verified Order
                </Button>
            </div>

            {/* Tags */}
            <div className="border-t border-slate-800/80 pt-3 space-y-2">
                <span className="text-xs font-semibold text-slate-300 block">Conversation Tags</span>
                <div className="flex flex-wrap gap-1.5">
                    {activeConversation?.tags?.map((t) => (
                        <Badge key={t.id} variant="neutral" size="xs">
                            {t.tag}
                        </Badge>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div
            ref={containerRef}
            className="w-full h-full flex-1 flex flex-col md:flex-row bg-slate-900 border-0 md:border border-slate-800 rounded-none md:rounded-2xl overflow-hidden shadow-2xl relative min-h-0"
        >
            {/* COLUMN 1: Conversation List (Left Panel - Resizable & Slimmer) */}
            {(!isMobile || mobileView === 'list') && (
                <div
                    style={isMobile ? undefined : { width: `${leftWidth}px` }}
                    className="flex flex-col w-full md:w-auto border-r border-slate-800 bg-slate-950/60 shrink-0 relative transition-none h-full min-h-0 overflow-hidden"
                >
                {/* Search & Platform Filter */}
                <div className="p-3 border-b border-slate-800 space-y-2">
                    <div className="flex items-center gap-1.5">
                        <div className="relative flex-1">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search inbox..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && fetchConversations()}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSyncNames}
                            disabled={syncingNames}
                            title="Sync Customer Real Names from Facebook"
                            className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                        >
                            <Users className={`w-3.5 h-3.5 ${syncingNames ? 'animate-spin text-cyan-400' : ''}`} />
                        </button>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPlatformFilter('')}
                            className={`flex-1 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                                !platformFilter ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setPlatformFilter('facebook_page')}
                            className={`flex-1 py-1 text-[11px] font-medium rounded-md flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                                platformFilter === 'facebook_page' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Facebook className="w-3 h-3" /> FB
                        </button>
                        <button
                            onClick={() => setPlatformFilter('instagram_business')}
                            className={`flex-1 py-1 text-[11px] font-medium rounded-md flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                                platformFilter === 'instagram_business' ? 'bg-pink-600/20 text-pink-400 border border-pink-500/30' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Instagram className="w-3 h-3" /> IG
                        </button>
                        <button
                            onClick={() => setPlatformFilter('whatsapp_cloud')}
                            className={`flex-1 py-1 text-[11px] font-medium rounded-md flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                                platformFilter === 'whatsapp_cloud' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <PhoneCall className="w-3 h-3" /> WA
                        </button>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-1 overflow-x-auto pb-1 text-[10px] text-slate-400">
                        {['all', 'unread', 'assigned_to_me', 'unassigned', 'human_takeover'].map((tab) => {
                            const unreadTabCount = conversations.filter(c => (c.unread_count || 0) > 0).length;
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setFilterTab(tab)}
                                    className={`px-2.5 py-1 rounded-full capitalize whitespace-nowrap cursor-pointer flex items-center gap-1.5 transition-colors ${
                                        filterTab === tab
                                            ? 'bg-indigo-600 text-white font-bold shadow-sm'
                                            : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {tab.replace(/_/g, ' ')}
                                    {tab === 'unread' && unreadTabCount > 0 && (
                                        <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                                            {unreadTabCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Conversation Items List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 min-h-0 overscroll-contain scroll-smooth">
                    {loadingList ? (
                        <div className="p-8 text-center text-xs text-slate-400">Loading inbox...</div>
                    ) : conversations.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                            <p>No conversations found.</p>
                            {(filterTab !== 'all' || platformFilter || searchQuery) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilterTab('all');
                                        setPlatformFilter('');
                                        setSearchQuery('');
                                    }}
                                    className="inline-block text-indigo-400 hover:text-indigo-300 underline cursor-pointer text-[11px]"
                                >
                                    ফিল্টার ক্লিয়ার করে সব কনভারসেশন দেখুন
                                </button>
                            )}
                        </div>
                    ) : (
                        conversations.map((c) => {
                            const isSelected = activeConversation?.id === c.id;
                            const isUnread = (c.unread_count || 0) > 0;
                            const isFB = c.platform === 'facebook_page';
                            const isIG = c.platform === 'instagram_business';
                            const customerName = c.customer?.name || 'Customer';
                            const pageName = c.social_account?.name || c.socialAccount?.name;

                            return (
                                <div
                                    key={c.id}
                                    onClick={() => {
                                        // Optimistically mark as read in local list for instant visual update
                                        if (c.unread_count > 0) {
                                            setConversations((prev) =>
                                                prev.map((item) =>
                                                    item.id === c.id ? { ...item, unread_count: 0 } : item
                                                )
                                            );
                                        }
                                        loadConversationDetails(c.id, true);
                                        if (isMobile) {
                                            setMobileView('chat');
                                            setMobileCrmExpanded(false);
                                        }
                                    }}
                                    className={`p-2.5 flex items-start gap-2.5 transition-all cursor-pointer relative ${
                                        isSelected
                                            ? 'bg-indigo-950/60 border-l-[3.5px] border-indigo-500 shadow-sm'
                                            : isUnread
                                            ? 'bg-slate-900/95 hover:bg-slate-850 border-l-[3.5px] border-indigo-400 shadow-sm'
                                            : 'border-l-[3.5px] border-transparent hover:bg-slate-900/50 opacity-85 hover:opacity-100'
                                    }`}
                                >
                                    <div className="relative shrink-0">
                                        <CustomerAvatar
                                            name={customerName}
                                            avatarUrl={c.customer?.avatar_url}
                                            size="sm"
                                        />
                                        <span
                                            className={`absolute -bottom-1 -right-1 p-0.5 rounded-full text-white ${
                                                isFB ? 'bg-blue-600' : isIG ? 'bg-pink-600' : 'bg-emerald-600'
                                            }`}
                                        >
                                            {isFB ? <Facebook className="w-2 h-2" /> : isIG ? <Instagram className="w-2 h-2" /> : <PhoneCall className="w-2 h-2" />}
                                        </span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1.5">
                                            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden" title={`${customerName}${pageName ? ` (${pageName})` : ''}`}>
                                                {isUnread && (
                                                    <span className="w-2 h-2 rounded-full bg-indigo-400 ring-2 ring-indigo-400/40 animate-pulse shrink-0" title="Unread Message" />
                                                )}
                                                <span className={`text-xs truncate ${isUnread ? 'font-bold text-white' : 'font-medium text-slate-300'}`}>
                                                    {customerName}
                                                </span>
                                                {pageName && (
                                                    <span className="text-[11px] font-semibold text-cyan-400 shrink-0">
                                                        ({pageName})
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-[10px] shrink-0 ${isUnread ? 'font-bold text-indigo-400' : 'text-slate-400'}`}>
                                                {c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>

                                        <p className={`text-[11px] truncate mt-0.5 ${isUnread ? 'font-semibold text-slate-100' : 'font-normal text-slate-400'}`}>
                                            {c.latest_message?.text || 'No messages yet'}
                                        </p>

                                        <div className="flex items-center gap-1.5 mt-1.5">
                                            {c.lead?.status && (
                                                <Badge variant={c.lead.status} size="xs">
                                                    {c.lead.status}
                                                </Badge>
                                            )}
                                            {c.is_human_takeover ? (
                                                <Badge variant="warning" size="xs">
                                                    Human
                                                </Badge>
                                            ) : (
                                                <Badge variant="primary" size="xs">
                                                    AI
                                                </Badge>
                                            )}
                                            {isUnread ? (
                                                <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-[10px] flex items-center justify-center font-black shadow-md shadow-indigo-500/25 ring-2 ring-indigo-400/30">
                                                    {c.unread_count}
                                                </span>
                                            ) : (
                                                <span className="ml-auto text-[10px] text-slate-600 font-medium select-none">
                                                    Read
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
            )}

            {/* Draggable Divider between Left Panel and Center Chat */}
            {!isMobile && (
                <div
                    onMouseDown={() => setIsDraggingLeft(true)}
                    className={`hidden md:flex w-2 hover:w-2.5 bg-slate-950/90 hover:bg-indigo-500/70 cursor-col-resize items-center justify-center transition-colors group shrink-0 z-10 border-x border-slate-800/80 ${
                        isDraggingLeft ? 'bg-indigo-500 w-2.5' : ''
                    }`}
                    title="Drag to resize customer list (মাউস দিয়ে টেনে বড়-ছোট করুন)"
                >
                    <div className="w-0.5 h-7 bg-slate-700 group-hover:bg-white rounded-full transition-colors" />
                </div>
            )}

            {/* COLUMN 2: Center Message Thread & Composer */}
            {(!isMobile || mobileView === 'chat') && (
                <div className="flex-1 flex flex-col min-w-0 bg-slate-900 h-full min-h-0 overflow-hidden">
                {activeConversation ? (
                    <>
                        {/* Conversation Header */}
                        <div className="h-14 md:h-16 px-2.5 md:px-5 border-b border-slate-800 flex items-center bg-slate-950/70 shrink-0 gap-2 relative">
                            {/* Pinned / Fixed Left: Mobile Back Button */}
                            <div className="md:hidden shrink-0 flex items-center pr-2 border-r border-slate-800/80 z-20">
                                <button
                                    type="button"
                                    onClick={handleBackToList}
                                    onTouchEnd={(e) => {
                                        e.preventDefault();
                                        handleBackToList();
                                    }}
                                    title="Back to conversation list"
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-100 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 active:scale-95 border border-slate-700/90 rounded-lg shrink-0 cursor-pointer shadow-sm select-none touch-manipulation"
                                >
                                    <ArrowLeft className="w-4 h-4 text-indigo-400 shrink-0" />
                                    <span>Chats</span>
                                </button>
                            </div>

                            {/* Horizontally Scrollable Content Area: Customer Info + Action Buttons */}
                            <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1">
                                {/* Customer Info */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="relative shrink-0">
                                        <CustomerAvatar
                                            name={activeConversation.customer?.name}
                                            avatarUrl={activeConversation.customer?.avatar_url}
                                            size="md"
                                        />
                                        <span
                                            className={`absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full text-white text-[8px] ${
                                                activeConversation.platform === 'facebook_page'
                                                    ? 'bg-blue-600'
                                                    : activeConversation.platform === 'instagram_business'
                                                    ? 'bg-pink-600'
                                                    : 'bg-emerald-600'
                                            }`}
                                        >
                                            {activeConversation.platform === 'facebook_page' ? (
                                                <Facebook className="w-2 h-2" />
                                            ) : activeConversation.platform === 'instagram_business' ? (
                                                <Instagram className="w-2 h-2" />
                                            ) : (
                                                <PhoneCall className="w-2 h-2" />
                                            )}
                                        </span>
                                    </div>
                                    <div className="shrink-0 max-w-[140px] xs:max-w-[180px] sm:max-w-xs">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <h2 className="text-xs md:text-sm font-bold text-white truncate">
                                                {activeConversation.customer?.name || 'Customer'}
                                            </h2>
                                            {(activeConversation.social_account?.name || activeConversation.socialAccount?.name) && (
                                                <span className="text-[10px] md:text-xs font-semibold text-cyan-400 shrink-0 truncate hidden xs:inline">
                                                    ({activeConversation.social_account?.name || activeConversation.socialAccount?.name})
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-slate-400 truncate block">
                                            Assigned: {activeConversation.assigned_user?.name || 'Unassigned'}
                                        </span>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-5 w-px bg-slate-800 shrink-0" />

                                {/* Action Buttons: Guaranteed No Overlap with shrink-0 and whitespace-nowrap */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            fetchConversations(true);
                                            if (activeConversation) loadConversationDetails(activeConversation.id);
                                        }}
                                        title="Manual Refresh"
                                        className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSyncNames}
                                        disabled={syncingNames}
                                        title="Sync Real Customer Names from Facebook"
                                        className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                                    >
                                        <Users className={`w-3.5 h-3.5 ${syncingNames ? 'animate-spin text-cyan-400' : ''}`} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleToggleTakeover}
                                        title={activeConversation.is_human_takeover ? 'Switch to AI Auto-Reply' : 'Take over as Human Moderator'}
                                        className={`px-2 py-1 text-[11px] font-semibold rounded-lg border transition-colors flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap ${
                                            activeConversation.is_human_takeover
                                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                        }`}
                                    >
                                        <Bot className="w-3.5 h-3.5 shrink-0" />
                                        <span>{activeConversation.is_human_takeover ? 'Human' : 'AI Active'}</span>
                                    </button>

                                    {/* Mobile Customer Details Button (Toggle Bottom CRM Panel) */}
                                    <button
                                        type="button"
                                        onClick={() => setMobileCrmExpanded((prev) => !prev)}
                                        title="Customer Details & CRM"
                                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap ${
                                            mobileCrmExpanded
                                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                                        }`}
                                    >
                                        <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                        <span>CRM</span>
                                        {mobileCrmExpanded ? (
                                            <ChevronUp className="w-3 h-3 text-cyan-400 shrink-0" />
                                        ) : (
                                            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
                                        )}
                                    </button>

                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        onClick={() => setShowRightPanel((prev) => !prev)}
                                        icon={showRightPanel ? PanelRightClose : PanelRightOpen}
                                        title={showRightPanel ? 'Hide Details Panel (Expand Chat)' : 'Show Customer Details'}
                                        className="hidden md:flex text-slate-400 hover:text-white shrink-0 whitespace-nowrap"
                                    >
                                        {showRightPanel ? 'Hide Details' : 'Details'}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Token Error / Expiration Banner */}
                        {(activeConversation.social_account?.status === 'expired' || activeConversation.social_account?.last_error) && (
                            <div className="bg-rose-950/70 border-b border-rose-500/40 px-4 py-2.5 flex items-center justify-between text-xs text-rose-200 animate-fade-in shadow-inner">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                    <span>
                                        <strong>Facebook Page Token Expired:</strong> ড্যাশবোর্ড থেকে রিপ্লাই গ্রাহকের ফেসবুক মেসেঞ্জারে যাচ্ছে না। দয়া করে নতুন পেইজ টোকেন আপডেট করুন।
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTokenModalAccount(activeConversation.social_account);
                                        setNewToken('');
                                    }}
                                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors shrink-0 shadow cursor-pointer ml-2"
                                >
                                    Update Token
                                </button>
                            </div>
                        )}

                        {/* Messages Scroll Area */}
                        <div className="flex-1 p-3 md:p-6 overflow-y-auto space-y-3 md:space-y-4 min-h-0 overscroll-contain scroll-smooth">
                            {loadingThread ? (
                                <div className="py-20 text-center text-xs text-slate-400">Loading conversation...</div>
                            ) : (
                                activeConversation.messages?.map((msg) => {
                                    const isCustomer = msg.sender_type === 'customer';
                                    const isAi = msg.sender_type === 'ai';
                                    const isMod = msg.sender_type === 'moderator';
                                    const isNote = msg.is_internal_note;
                                    const isFailed = msg.delivery_status === 'failed';
                                    const senderName = msg.sender_user?.name || msg.senderUser?.name;

                                    if (isNote) {
                                        return (
                                            <div key={msg.id} className="mx-auto max-w-lg p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                                                <span className="font-semibold block mb-0.5">
                                                    Internal Team Note{senderName ? ` (by ${senderName})` : ''}:
                                                </span>
                                                {msg.text}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                                        >
                                            <div
                                                className={`max-w-md rounded-2xl px-4 py-2.5 text-xs ${
                                                    isCustomer
                                                        ? 'bg-slate-800 text-slate-200 rounded-bl-sm'
                                                        : isAi
                                                        ? 'bg-gradient-to-r from-violet-900/60 to-indigo-900/60 border border-indigo-500/30 text-indigo-100 rounded-br-sm'
                                                        : isFailed
                                                        ? 'bg-rose-950/80 border border-rose-500/40 text-rose-100 rounded-br-sm shadow-md'
                                                        : 'bg-indigo-600 text-white rounded-br-sm shadow-md'
                                                }`}
                                            >
                                                {isAi && (
                                                    <div className="flex items-center gap-1 text-[10px] font-bold text-violet-300 mb-1">
                                                        <Sparkles className="w-3 h-3" /> NexFlow AI Automated Reply
                                                    </div>
                                                )}
                                                {isMod && (
                                                    <div className={`flex items-center gap-1 text-[10px] font-semibold mb-1 ${isFailed ? 'text-rose-300' : 'text-indigo-200'}`}>
                                                        <User className="w-3 h-3" /> {senderName || 'Team Moderator'}
                                                    </div>
                                                )}

                                                {/* Attachments rendering (Images, Videos, Voice/Audio, PDFs, Documents) */}
                                                {msg.attachments && msg.attachments.length > 0 && (
                                                    <div className="space-y-1.5 mb-1.5">
                                                        {msg.attachments.map((att) => {
                                                            const rawType = (att.file_type || '').toLowerCase();
                                                            const name = (att.file_name || '').toLowerCase();
                                                            const url = (att.file_url || '').toLowerCase();
                                                            const ext = (name.split('.').pop() || url.split('.').pop() || '').split('?')[0];

                                                            const isImage = rawType.startsWith('image') || rawType === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
                                                            const isVideo = rawType.startsWith('video') || rawType === 'video' || ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v'].includes(ext);
                                                            const isAudio = rawType.startsWith('audio') || rawType === 'audio' || ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext) || (ext === 'webm' && !isVideo);
                                                            const isPdf = rawType.includes('pdf') || ext === 'pdf';

                                                            if (isImage) {
                                                                return (
                                                                    <div key={att.id} className="relative group my-1">
                                                                        <div
                                                                            onClick={() => handleOpenImageLightbox(att)}
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
                                                                    <div key={att.id} className="my-1.5 max-w-[280px] md:max-w-xs rounded-xl overflow-hidden border border-slate-700/70 bg-black/80 shadow-md">
                                                                        <video
                                                                            controls
                                                                            preload="metadata"
                                                                            className="w-full max-h-72 rounded-t-xl bg-black"
                                                                        >
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
                                                                    <div key={att.id} className="my-1.5 p-2.5 rounded-xl bg-slate-900/95 border border-slate-700/70 max-w-[280px] md:max-w-xs shadow-md">
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
                                                                        className="flex items-center gap-3 p-2.5 my-1.5 rounded-xl bg-slate-900/95 border border-rose-500/30 hover:border-rose-400/60 text-slate-200 transition-all max-w-[280px] md:max-w-xs shadow-md group"
                                                                        title="Open / Download PDF"
                                                                    >
                                                                        <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 group-hover:scale-105 transition-transform shrink-0">
                                                                            <FileText className="w-5 h-5" />
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-xs font-medium text-slate-100 truncate group-hover:text-rose-300 transition-colors">
                                                                                {att.file_name || 'Document.pdf'}
                                                                            </p>
                                                                            <p className="text-[10px] text-rose-400/80">
                                                                                PDF Document {att.file_size ? `· ${(att.file_size / 1024).toFixed(0)} KB` : ''}
                                                                            </p>
                                                                        </div>
                                                                        <div className="p-1.5 text-slate-400 group-hover:text-white shrink-0">
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
                                                                    className="flex items-center gap-3 p-2.5 my-1.5 rounded-xl bg-slate-900/95 border border-cyan-500/30 hover:border-cyan-400/60 text-slate-200 transition-all max-w-[280px] md:max-w-xs shadow-md group"
                                                                    title="Download file"
                                                                >
                                                                    <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 group-hover:scale-105 transition-transform shrink-0">
                                                                        <File className="w-5 h-5" />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-xs font-medium text-slate-100 truncate group-hover:text-cyan-300 transition-colors">
                                                                            {att.file_name || 'Attached File'}
                                                                        </p>
                                                                        <p className="text-[10px] text-cyan-400/80">
                                                                            Attachment {att.file_size ? `· ${(att.file_size / 1024).toFixed(0)} KB` : ''}
                                                                        </p>
                                                                    </div>
                                                                    <div className="p-1.5 text-slate-400 group-hover:text-white shrink-0">
                                                                        <Download className="w-4 h-4" />
                                                                    </div>
                                                                </a>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Message Text (Hide placeholder if attachment is already displayed) */}
                                                {msg.text && (
                                                    !msg.attachments ||
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
                                                    ].includes(msg.text.trim())
                                                ) && (
                                                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                                )}
                                                {isFailed && (
                                                    <div className="mt-1.5 pt-1.5 border-t border-rose-400/25 text-[10px] text-rose-300 flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3 shrink-0 text-rose-400" />
                                                        <span className="truncate">Facebook-এ সেন্ড হয়নি: {msg.metadata?.error || 'Page Token Expired'}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 px-1">
                                                {isMod && (
                                                    <span className="text-slate-400 font-medium">
                                                        Sent by {senderName || 'Moderator'} · 
                                                    </span>
                                                )}
                                                <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                {!isCustomer && (
                                                    isFailed ? (
                                                        <span
                                                            className="inline-flex items-center gap-1 text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/25 ml-1"
                                                            title={msg.metadata?.error || 'Message delivery failed'}
                                                        >
                                                            <AlertCircle className="w-3 h-3 text-rose-400" /> Delivery failed
                                                        </span>
                                                    ) : (
                                                        <CheckCheck className="w-3 h-3 text-indigo-400" />
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* AI Suggested Response Pill Box */}
                        {suggestedData && (
                            <div className="mx-4 mb-2 p-3 bg-violet-950/40 border border-violet-500/30 rounded-xl text-xs space-y-1.5 animate-fade-in">
                                <div className="flex items-center justify-between text-violet-300">
                                    <span className="font-semibold flex items-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5" /> OpenAI Suggested Contextual Draft
                                    </span>
                                    <span className="text-[10px] text-violet-400">
                                        Confidence: {Math.round((suggestedData.confidence || 0.95) * 100)}% · Intent: {suggestedData.intent}
                                    </span>
                                </div>
                                <p className="text-slate-300 italic">{suggestedData.suggested_reply}</p>
                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setReplyText(suggestedData.suggested_reply)}
                                        className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                                    >
                                        Apply to Composer
                                    </button>
                                    <span className="text-slate-600">·</span>
                                    <button
                                        type="button"
                                        onClick={() => setSuggestedData(null)}
                                        className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Message Composer Area */}
                        <div className="p-2.5 md:p-4 border-t border-slate-800 bg-slate-950/95 shrink-0 z-10">
                            {/* Human Takeover Notice */}
                            {activeConversation.is_human_takeover && (
                                <div className="flex items-center justify-between px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-[11px] text-amber-300 mb-2 animate-fade-in">
                                    <span className="flex items-center gap-1.5 truncate">
                                        <Bot className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        <span className="truncate">AI সাময়িক পজ (হিউম্যান টেকওভার সক্রিয়)</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleToggleTakeover}
                                        className="font-bold underline text-amber-200 hover:text-white cursor-pointer ml-2 text-[10px] whitespace-nowrap shrink-0"
                                    >
                                        AI চালু করুন
                                    </button>
                                </div>
                            )}

                            <form onSubmit={handleSendMessage} className="space-y-1.5 md:space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5 md:gap-3 overflow-x-auto pb-0.5 max-w-full">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="xs"
                                            loading={suggesting}
                                            onClick={handleAiSuggest}
                                            icon={Sparkles}
                                            className="text-violet-400 border-violet-500/30 hover:bg-violet-500/10 shrink-0 text-[11px]"
                                        >
                                            AI Suggest
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="xs"
                                            onClick={() => setOrderModal(true)}
                                            icon={ShoppingBag}
                                            className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer font-medium shrink-0 text-[11px]"
                                            title="Create Customer Order"
                                        >
                                            Order
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="xs"
                                            onClick={() => setMediaPickerOpen(true)}
                                            icon={FolderOpen}
                                            className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10 cursor-pointer font-medium shrink-0 text-[11px]"
                                            title="Browse Media Library (Uploads, Images, Videos, Audio)"
                                        >
                                            Media
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="xs"
                                            onClick={() => fileInputRef.current?.click()}
                                            icon={Paperclip}
                                            className="text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 cursor-pointer font-medium shrink-0 text-[11px]"
                                            title="Attach File (Image, Video, Audio, PDF, Document)"
                                        >
                                            File
                                        </Button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                                            onChange={handleFileSelect}
                                            className="hidden"
                                        />

                                        {!isRecording ? (
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="xs"
                                                onClick={startRecording}
                                                icon={Mic}
                                                className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer font-medium shrink-0 text-[11px]"
                                                title="Record Voice Note"
                                            >
                                                Voice
                                            </Button>
                                        ) : null}

                                        <label className="flex items-center gap-1 text-slate-400 text-[11px] cursor-pointer shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={isInternalNote}
                                                onChange={(e) => setIsInternalNote(e.target.checked)}
                                                className="rounded bg-slate-900 border-slate-800 text-amber-500"
                                            />
                                            <span>Note</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Active Voice Recording Status Bar */}
                                {isRecording && (
                                    <div className="flex items-center justify-between p-2.5 px-3 bg-rose-950/80 border border-rose-500/50 rounded-xl animate-fade-in text-xs shadow-lg">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="relative flex h-3 w-3 shrink-0">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                                            </span>
                                            <span className="font-semibold text-rose-200 text-xs truncate">ভয়েস রেকর্ড হচ্ছে...</span>
                                            <span className="font-mono text-rose-100 bg-rose-900/90 px-2 py-0.5 rounded-md border border-rose-700/60 font-bold shrink-0">
                                                {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={cancelRecording}
                                                className="text-[11px] text-slate-300 hover:text-rose-300 px-2 py-1 rounded hover:bg-rose-900/40 transition-colors cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="button"
                                                onClick={stopRecording}
                                                className="flex items-center gap-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-500 px-3 py-1 rounded-lg transition-colors cursor-pointer shadow-sm"
                                                title="রেকর্ডিং শেষ করুন"
                                            >
                                                <Square className="w-3 h-3 fill-white text-white" />
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Recorded Voice Note Review Card */}
                                {selectedFile && fileTypeCategory === 'audio' && (
                                    <div className="p-2.5 px-3 bg-slate-900/90 border border-indigo-500/40 rounded-xl shadow-lg animate-fade-in space-y-2 max-w-lg">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                                                    <Mic className="w-3.5 h-3.5" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-semibold text-slate-100">
                                                        ভয়েস মেসেজ প্রস্তুত
                                                    </p>
                                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium font-mono">
                                                        {selectedFile.size > 1024
                                                            ? `${(selectedFile.size / 1024).toFixed(0)} KB`
                                                            : `${selectedFile.size || 0} B`}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleRemoveFile}
                                                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                                title="ভয়েস ডিলিট করুন"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Audio Player Preview */}
                                        {filePreviewUrl && (
                                            <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                                                <audio controls src={filePreviewUrl} className="w-full h-8" />
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Selected Non-Audio File / Media Preview Chip */}
                                {selectedFile && fileTypeCategory !== 'audio' && (
                                    <div className="flex items-center gap-2.5 p-2 px-3 bg-slate-900 border border-indigo-500/40 rounded-xl animate-fade-in max-w-md">
                                        {fileTypeCategory === 'image' && filePreviewUrl && (
                                            <img
                                                src={filePreviewUrl}
                                                alt="Selected"
                                                className="w-10 h-10 object-cover rounded-lg border border-slate-700 shrink-0"
                                            />
                                        )}
                                        {fileTypeCategory === 'video' && (
                                            <div className="w-10 h-10 rounded-lg bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center shrink-0 text-cyan-400">
                                                <Video className="w-5 h-5" />
                                            </div>
                                        )}
                                        {fileTypeCategory === 'pdf' && (
                                            <div className="w-10 h-10 rounded-lg bg-rose-950/60 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-400">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                        )}
                                        {fileTypeCategory === 'file' && (
                                            <div className="w-10 h-10 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center shrink-0 text-indigo-400">
                                                <File className="w-5 h-5" />
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-semibold text-slate-200 truncate">{selectedFile.name}</p>
                                            <p className="text-[10px] text-indigo-400">
                                                {selectedFile.size > 1024 * 1024
                                                    ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
                                                    : `${(selectedFile.size / 1024).toFixed(0)} KB`}{' '}
                                                · Ready to send
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleRemoveFile}
                                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0 ml-auto"
                                            title="Remove attachment"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                {/* Selected Media Library Item Preview Chip */}
                                {selectedMediaItem && (
                                    <div className="flex items-center gap-2.5 p-2 px-3 bg-slate-900 border border-amber-500/40 rounded-xl animate-fade-in max-w-md">
                                        {selectedMediaItem.file_type === 'image' && (
                                            <img
                                                src={selectedMediaItem.file_url}
                                                alt="Selected"
                                                className="w-10 h-10 object-cover rounded-lg border border-slate-700 shrink-0"
                                            />
                                        )}
                                        {selectedMediaItem.file_type === 'video' && (
                                            <div className="w-10 h-10 rounded-lg bg-purple-950/60 border border-purple-500/30 flex items-center justify-center shrink-0 text-purple-400">
                                                <Video className="w-5 h-5" />
                                            </div>
                                        )}
                                        {selectedMediaItem.file_type === 'audio' && (
                                            <div className="w-10 h-10 rounded-lg bg-amber-950/60 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
                                                <Music className="w-5 h-5" />
                                            </div>
                                        )}
                                        {selectedMediaItem.file_type === 'document' && (
                                            <div className="w-10 h-10 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold uppercase">
                                                    Library
                                                </span>
                                                {selectedMediaItem.folder && (
                                                    <span
                                                        className="text-[9px] px-1.5 py-0.2 rounded font-semibold text-white truncate max-w-[130px] flex items-center gap-1"
                                                        style={{ backgroundColor: selectedMediaItem.folder.color || '#6366f1' }}
                                                    >
                                                        📁 {selectedMediaItem.folder.name}
                                                    </span>
                                                )}
                                                <p className="text-[11px] font-semibold text-slate-200 truncate">{selectedMediaItem.title}</p>
                                            </div>
                                            <p className="text-[10px] text-amber-400">
                                                {selectedMediaItem.formatted_size || ''} · Ready to send
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleRemoveFile}
                                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0 ml-auto"
                                            title="Remove attachment"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                <div className="relative">
                                    <textarea
                                        rows={2}
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage(e);
                                            }
                                        }}
                                        placeholder={
                                            isInternalNote
                                                ? 'Add an internal team note...'
                                                : selectedMediaItem
                                                ? 'Add a message/caption to this media (optional)...'
                                                : selectedFile
                                                ? `Add a message/caption to this ${fileTypeCategory === 'audio' ? 'voice note' : fileTypeCategory} (optional)...`
                                                : 'Type message...'
                                        }
                                        className={`w-full rounded-xl p-2.5 pr-20 md:p-3 md:pr-24 text-xs text-slate-100 placeholder-slate-400 focus:outline-none transition-all resize-none ${
                                            isInternalNote
                                                ? 'bg-amber-950/20 border border-amber-500/30 focus:border-amber-500'
                                                : 'bg-slate-900 border border-slate-800 focus:border-indigo-500'
                                        }`}
                                    />
                                    <div className="absolute right-2 bottom-2">
                                        <Button
                                            type="submit"
                                            variant={isInternalNote ? 'warning' : 'primary'}
                                            size="xs"
                                            loading={sending}
                                            disabled={(!replyText.trim() && !selectedFile && !selectedMediaItem) || isRecording}
                                            icon={Send}
                                        >
                                            Send
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Mobile Bottom CRM Section (r dan pasher ta nice thakbe) */}
                        <div className="md:hidden border-t border-slate-800 bg-slate-950 shrink-0">
                            <button
                                type="button"
                                onClick={() => setMobileCrmExpanded((prev) => !prev)}
                                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-200 bg-slate-900/70 hover:bg-slate-900 active:bg-slate-800 transition-colors cursor-pointer"
                            >
                                <span className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-cyan-400" />
                                    <span>Customer & Lead CRM (কাস্টমার ও লিড তথ্য)</span>
                                    {activeConversation.lead?.status && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase font-bold">
                                            {activeConversation.lead.status}
                                        </span>
                                    )}
                                </span>
                                <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                    <span>{mobileCrmExpanded ? 'Hide' : 'View'}</span>
                                    {mobileCrmExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-cyan-400" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                    )}
                                </span>
                            </button>
                            {mobileCrmExpanded && (
                                <div className="max-h-[50vh] overflow-y-auto p-4 border-t border-slate-800/80 overscroll-contain scroll-smooth animate-fade-in bg-slate-950/90">
                                    {renderCrmDetails()}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                        Select a conversation from the left to start messaging.
                    </div>
                )}
            </div>
            )}

            {/* Draggable Divider between Center Chat and Right CRM Panel */}
            {!isMobile && activeConversation && showRightPanel && (
                <div
                    onMouseDown={() => setIsDraggingRight(true)}
                    className={`hidden md:flex w-2 hover:w-2.5 bg-slate-950/90 hover:bg-indigo-500/70 cursor-col-resize items-center justify-center transition-colors group shrink-0 z-10 border-x border-slate-800/80 ${
                        isDraggingRight ? 'bg-indigo-500 w-2.5' : ''
                    }`}
                    title="Drag to resize customer details panel (মাউস দিয়ে টেনে বড়-ছোট করুন)"
                >
                    <div className="w-0.5 h-7 bg-slate-700 group-hover:bg-white rounded-full transition-colors" />
                </div>
            )}

            {/* COLUMN 3: Customer CRM & Details (Desktop Right Panel - Resizable & Collapsible) */}
            {activeConversation && !isMobile && showRightPanel && (
                <div
                    style={{ width: `${rightWidth}px` }}
                    className="hidden md:flex flex-col border-l border-slate-800 bg-slate-950/80 p-4 md:p-5 overflow-y-auto shrink-0 h-full min-h-0 overscroll-contain scroll-smooth"
                >
                    {renderCrmDetails()}
                </div>
            )}

            {/* Schedule Follow-up Modal */}
            <Modal isOpen={followupModal} onClose={() => setFollowupModal(false)} title="Schedule Moderator Follow-up">
                <form onSubmit={handleFollowupSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Follow-up Date</label>
                        <input
                            type="date"
                            required
                            value={followupForm.followup_date}
                            onChange={(e) => setFollowupForm({ ...followupForm, followup_date: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Time</label>
                        <input
                            type="time"
                            value={followupForm.followup_time}
                            onChange={(e) => setFollowupForm({ ...followupForm, followup_time: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Priority</label>
                        <select
                            value={followupForm.priority}
                            onChange={(e) => setFollowupForm({ ...followupForm, priority: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        >
                            <option value="low">Low Priority</option>
                            <option value="medium">Medium Priority</option>
                            <option value="high">High Priority (Urgent Purchase Intent)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Follow-up Notes / Reason</label>
                        <textarea
                            rows={3}
                            required
                            placeholder="e.g. Call customer to confirm size and delivery address..."
                            value={followupForm.notes}
                            onChange={(e) => setFollowupForm({ ...followupForm, notes: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        ></textarea>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => setFollowupModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" type="submit">
                            Save Follow-up
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Create Order Modal */}
            <CreateOrderModal
                isOpen={orderModal}
                onClose={() => setOrderModal(false)}
                initialData={React.useMemo(() => ({
                    customer_id: activeConversation?.customer_id,
                    customer_name: activeConversation?.customer?.name?.startsWith('Facebook Customer') ? '' : (activeConversation?.customer?.name || ''),
                    customer_phone: activeConversation?.customer?.phone || '',
                    customer_address: '',
                    conversation_id: activeConversation?.id,
                }), [orderModal, activeConversation?.id, activeConversation?.customer?.name, activeConversation?.customer?.phone])}
                onOrderCreated={(newOrder) => {
                    if (activeConversation) {
                        loadConversationDetails(activeConversation.id);
                    }
                    fetchConversations(true);
                }}
            />

            {/* Quick Update Page Access Token Modal */}
            {tokenModalAccount && (
                <Modal
                    isOpen={Boolean(tokenModalAccount)}
                    onClose={() => setTokenModalAccount(null)}
                    title={`Update Facebook Token: ${tokenModalAccount?.name || 'Page'}`}
                >
                    <form onSubmit={handleUpdateChannelToken} className="space-y-4">
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-1.5">
                            <p className="font-semibold">ফেসবুক মেসেজ সেন্ড না হওয়ার কারণ:</p>
                            <p className="text-slate-300 leading-relaxed">
                                এই ফেসবুক পেইজের অ্যাক্সেস টোকেনের সেশন এক্সপায়ার (Session Expired) হয়ে গেছে। এর ফলে মেটা মেসেজ ডেলিভারি ব্লক করে দিয়েছে।
                            </p>
                            <p className="text-slate-300">
                                সমাধান: Facebook Graph API Explorer থেকে এই পেইজের নতুন একটি <strong>Page Access Token</strong> তৈরি করে নিচে পেস্ট করুন।
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                New Page Access Token (নতুন অ্যাক্সেস টোকেন)
                            </label>
                            <textarea
                                rows={4}
                                required
                                value={newToken}
                                onChange={(e) => setNewToken(e.target.value)}
                                placeholder="EAA..."
                                className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setTokenModalAccount(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                loading={savingToken}
                            >
                                Verify & Update Token
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* WordPress-style Media Library Picker Modal */}
            <MediaPickerModal
                isOpen={mediaPickerOpen}
                onClose={() => setMediaPickerOpen(false)}
                onSelectMedia={handleSelectMediaLibraryItem}
            />

            {/* Messenger-style Full-screen Image Lightbox Overlay */}
            <ImageLightboxModal
                isOpen={isLightboxOpen}
                onClose={() => setIsLightboxOpen(false)}
                images={conversationImages}
                currentIndex={lightboxImageIndex}
                onIndexChange={(idx) => setLightboxImageIndex(idx)}
            />
        </div>
    );
};
