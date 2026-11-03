import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Facebook, Instagram } from '../../components/common/SocialIcons';
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
} from 'lucide-react';

export const UnifiedInboxPage = () => {
    const { user, isModerator } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

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

    const [conversations, setConversations] = useState([]);
    const [activeConversation, setActiveConversation] = useState(null);
    const [loadingList, setLoadingList] = useState(true);
    const [loadingThread, setLoadingThread] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isInternalNote, setIsInternalNote] = useState(false);
    const [sending, setSending] = useState(false);
    const [suggesting, setSuggesting] = useState(false);
    const [suggestedData, setSuggestedData] = useState(null);

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

    const messagesEndRef = useRef(null);
    const activeConvIdRef = useRef(null);
    const lastMsgIdRef = useRef(null);
    const containerRef = useRef(null);

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

    // Play subtle audio alert for inbound messages
    const playNotificationSound = () => {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) {
            // Audio context might be restricted before first user gesture; ignore
        }
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
            const list = res.data.data.data || [];
            setConversations(list);

            if (!silent) {
                // Set active conversation from query param or first item
                const queryConvId = searchParams.get('conversation');
                if (queryConvId) {
                    const found = list.find((c) => c.id === parseInt(queryConvId));
                    if (found) loadConversationDetails(found.id);
                    else if (list.length > 0) loadConversationDetails(list[0].id);
                } else if (!activeConversation && list.length > 0) {
                    loadConversationDetails(list[0].id);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (!silent) setLoadingList(false);
        }
    };

    const loadConversationDetails = async (id) => {
        try {
            setLoadingThread(true);
            const res = await api.get(`/conversations/${id}`);
            setActiveConversation(res.data.data);
            setSearchParams({ conversation: id });

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
        }, 2200);

        // Poller for conversation sidebar list updates (every 5 seconds)
        const listInterval = setInterval(() => {
            fetchConversations(true);
        }, 5000);

        return () => {
            clearInterval(threadInterval);
            clearInterval(listInterval);
        };
    }, []);

    useEffect(() => {
        fetchConversations();
    }, [filterTab, platformFilter]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeConversation?.messages]);

    // Send Message
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!replyText.trim() || !activeConversation) return;

        setSending(true);
        try {
            const res = await api.post(`/conversations/${activeConversation.id}/messages`, {
                text: replyText,
                is_internal_note: isInternalNote,
            });

            // Append message locally
            setActiveConversation((prev) => ({
                ...prev,
                is_human_takeover: isInternalNote ? prev.is_human_takeover : true,
                messages: [...(prev.messages || []), res.data.data],
            }));
            lastMsgIdRef.current = res.data.data.id;
            setReplyText('');
            setIsInternalNote(false);
            setSuggestedData(null);
            fetchConversations(true);
        } catch (err) {
            alert('Failed to send message: ' + (err.response?.data?.message || err.message));
        } finally {
            setSending(false);
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

    return (
        <div
            ref={containerRef}
            className="h-[calc(100vh-6.5rem)] flex flex-col md:flex-row bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative"
        >
            {/* COLUMN 1: Conversation List (Left Panel - Resizable & Slimmer) */}
            <div
                style={{ width: `${leftWidth}px` }}
                className="w-full md:w-auto border-r border-slate-800 flex flex-col bg-slate-950/60 shrink-0 relative transition-none"
            >
                {/* Search & Platform Filter */}
                <div className="p-3 border-b border-slate-800 space-y-2">
                    <div className="relative">
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
                        {['all', 'assigned_to_me', 'unassigned', 'human_takeover'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setFilterTab(tab)}
                                className={`px-2 py-0.5 rounded-full capitalize whitespace-nowrap cursor-pointer ${
                                    filterTab === tab ? 'bg-indigo-600 text-white font-semibold' : 'hover:bg-slate-800'
                                }`}
                            >
                                {tab.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Conversation Items List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
                    {loadingList ? (
                        <div className="p-8 text-center text-xs text-slate-400">Loading inbox...</div>
                    ) : conversations.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400">No conversations found.</div>
                    ) : (
                        conversations.map((c) => {
                            const isSelected = activeConversation?.id === c.id;
                            const isFB = c.platform === 'facebook_page';
                            const isIG = c.platform === 'instagram_business';

                            return (
                                <div
                                    key={c.id}
                                    onClick={() => loadConversationDetails(c.id)}
                                    className={`p-2.5 flex items-start gap-2.5 transition-colors cursor-pointer ${
                                        isSelected ? 'bg-indigo-950/40 border-l-2 border-indigo-500' : 'hover:bg-slate-900/60'
                                    }`}
                                >
                                    <div className="relative shrink-0">
                                        <img
                                            src={c.customer?.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80'}
                                            alt={c.customer?.name}
                                            className="w-8 h-8 rounded-full object-cover"
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
                                        <div className="flex items-center justify-between gap-1">
                                            <span className="text-xs font-semibold text-slate-200 truncate" title={`${c.customer?.name || 'Customer'} ${c.social_account?.name ? `(${c.social_account.name})` : ''}`}>
                                                {c.customer?.name}
                                                {c.social_account?.name && (
                                                    <span className="text-[10px] font-normal text-slate-400 ml-1">
                                                        ({c.social_account.name})
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-[10px] text-slate-400 shrink-0">
                                                {c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                        </div>

                                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
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
                                            {c.unread_count > 0 && (
                                                <span className="ml-auto w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                                                    {c.unread_count}
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

            {/* Draggable Divider between Left Panel and Center Chat */}
            <div
                onMouseDown={() => setIsDraggingLeft(true)}
                className={`hidden md:flex w-2 hover:w-2.5 bg-slate-950/90 hover:bg-indigo-500/70 cursor-col-resize items-center justify-center transition-colors group shrink-0 z-10 border-x border-slate-800/80 ${
                    isDraggingLeft ? 'bg-indigo-500 w-2.5' : ''
                }`}
                title="Drag to resize customer list (মাউস দিয়ে টেনে বড়-ছোট করুন)"
            >
                <div className="w-0.5 h-7 bg-slate-700 group-hover:bg-white rounded-full transition-colors" />
            </div>

            {/* COLUMN 2: Center Message Thread & Composer */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-900">
                {activeConversation ? (
                    <>
                        {/* Conversation Header */}
                        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <img
                                        src={activeConversation.customer?.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80'}
                                        alt={activeConversation.customer?.name}
                                        className="w-9 h-9 rounded-full object-cover"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm font-semibold text-white flex items-center gap-1.5 truncate">
                                            <span>{activeConversation.customer?.name}</span>
                                            {activeConversation.social_account?.name && (
                                                <span className="text-xs font-normal text-slate-400">
                                                    ({activeConversation.social_account.name})
                                                </span>
                                            )}
                                        </h2>
                                        <Badge
                                            variant={
                                                activeConversation.platform === 'facebook_page'
                                                    ? 'facebook'
                                                    : activeConversation.platform === 'instagram_business'
                                                    ? 'instagram'
                                                    : 'whatsapp'
                                            }
                                            size="xs"
                                        >
                                            {activeConversation.social_account?.name}
                                        </Badge>
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[10px] font-medium tracking-wide">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                            </span>
                                            <span>Live Sync</span>
                                        </div>
                                    </div>
                                    <span className="text-[11px] text-slate-400">
                                        Assigned to: {activeConversation.assigned_user?.name || 'Unassigned'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        fetchConversations(true);
                                        if (activeConversation) loadConversationDetails(activeConversation.id);
                                    }}
                                    title="Manual Refresh"
                                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                                <Button
                                    variant={activeConversation.is_human_takeover ? 'warning' : 'secondary'}
                                    size="xs"
                                    onClick={handleToggleTakeover}
                                    icon={Bot}
                                >
                                    {activeConversation.is_human_takeover ? 'Human Takeover (AI Paused)' : 'AI Auto-Reply Active'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => setShowRightPanel((prev) => !prev)}
                                    icon={showRightPanel ? PanelRightClose : PanelRightOpen}
                                    title={showRightPanel ? 'Hide Details Panel (Expand Chat)' : 'Show Customer Details'}
                                    className="hidden md:flex text-slate-400 hover:text-white"
                                >
                                    {showRightPanel ? 'Hide Details' : 'Details'}
                                </Button>
                            </div>
                        </div>

                        {/* Messages Scroll Area */}
                        <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4">
                            {loadingThread ? (
                                <div className="py-20 text-center text-xs text-slate-400">Loading conversation...</div>
                            ) : (
                                activeConversation.messages?.map((msg) => {
                                    const isCustomer = msg.sender_type === 'customer';
                                    const isAi = msg.sender_type === 'ai';
                                    const isMod = msg.sender_type === 'moderator';
                                    const isNote = msg.is_internal_note;

                                    if (isNote) {
                                        return (
                                            <div key={msg.id} className="mx-auto max-w-lg p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                                                <span className="font-semibold block mb-0.5">Internal Team Note:</span>
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
                                                        : 'bg-indigo-600 text-white rounded-br-sm shadow-md'
                                                }`}
                                            >
                                                {isAi && (
                                                    <div className="flex items-center gap-1 text-[10px] font-bold text-violet-300 mb-1">
                                                        <Sparkles className="w-3 h-3" /> NexFlow AI Automated Reply
                                                    </div>
                                                )}
                                                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 px-1">
                                                <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                {!isCustomer && <CheckCheck className="w-3 h-3 text-indigo-400" />}
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
                        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
                            <form onSubmit={handleSendMessage} className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-3">
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="xs"
                                            loading={suggesting}
                                            onClick={handleAiSuggest}
                                            icon={Sparkles}
                                            className="text-violet-400 border-violet-500/30 hover:bg-violet-500/10"
                                        >
                                            AI Suggest Reply
                                        </Button>

                                        <label className="flex items-center gap-1.5 text-slate-400 text-xs cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isInternalNote}
                                                onChange={(e) => setIsInternalNote(e.target.checked)}
                                                className="rounded bg-slate-900 border-slate-800 text-amber-500"
                                            />
                                            <span>Internal Note</span>
                                        </label>
                                    </div>
                                    <span className="text-[10px] text-slate-400">
                                        Press Enter to send reply
                                    </span>
                                </div>

                                <div className="relative">
                                    <textarea
                                        rows={3}
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
                                                ? 'Add an internal team note (visible to moderators only)...'
                                                : 'Type response to customer in Bangla, English, or Banglish...'
                                        }
                                        className={`w-full rounded-xl p-3 text-xs text-slate-100 placeholder-slate-400 focus:outline-none transition-all ${
                                            isInternalNote
                                                ? 'bg-amber-950/20 border border-amber-500/30 focus:border-amber-500'
                                                : 'bg-slate-900 border border-slate-800 focus:border-indigo-500'
                                        }`}
                                    />
                                    <div className="absolute right-2.5 bottom-2.5">
                                        <Button
                                            type="submit"
                                            variant={isInternalNote ? 'warning' : 'primary'}
                                            size="sm"
                                            loading={sending}
                                            disabled={!replyText.trim()}
                                            icon={Send}
                                        >
                                            {isInternalNote ? 'Save Note' : 'Send'}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                        Select a conversation from the left to start messaging.
                    </div>
                )}
            </div>

            {/* Draggable Divider between Center Chat and Right CRM Panel */}
            {activeConversation && showRightPanel && (
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

            {/* COLUMN 3: Customer CRM & Details (Right Panel - Resizable & Collapsible) */}
            {activeConversation && showRightPanel && (
                <div
                    style={{ width: `${rightWidth}px` }}
                    className="w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-800 bg-slate-950/80 p-5 overflow-y-auto space-y-5 shrink-0 flex flex-col"
                >
                    {/* Customer Identity */}
                    <div className="text-center">
                        <img
                            src={activeConversation.customer?.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100'}
                            alt={activeConversation.customer?.name}
                            className="w-16 h-16 rounded-full mx-auto object-cover ring-2 ring-indigo-500/20"
                        />
                        <h3 className="text-sm font-bold text-slate-100 mt-2">{activeConversation.customer?.name}</h3>
                        {activeConversation.social_account?.name && (
                            <p className="text-[11px] text-indigo-400 font-medium">({activeConversation.social_account.name})</p>
                        )}
                        <p className="text-xs text-slate-400 mt-0.5">{activeConversation.customer?.phone || 'No phone recorded'}</p>
                    </div>

                    {/* Quick Lead Status Selector */}
                    <div className="space-y-1.5 border-t border-slate-800/80 pt-4">
                        <label className="text-xs font-semibold text-slate-300 block">Lead CRM Classification</label>
                        <select
                            value={activeConversation.lead?.status || 'cold'}
                            onChange={(e) => handleLeadStatusChange(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-medium capitalize"
                        >
                            <option value="cold">Cold Lead (Browsing / Passive)</option>
                            <option value="warm">Warm Lead (Price / Size / Specs Inquired)</option>
                            <option value="hot">Hot Lead (Purchase Intent / Address Shared)</option>
                            <option value="converted">Converted (Verified Order Created)</option>
                            <option value="lost">Lost Lead (Declined / Cancelled)</option>
                        </select>
                        {activeConversation.lead?.suggested_status && (
                            <p className="text-[10px] text-violet-400 mt-1">
                                AI Suggested: <span className="font-semibold uppercase">{activeConversation.lead.suggested_status}</span> ({(activeConversation.lead.confidence * 100).toFixed(0)}% confidence)
                            </p>
                        )}
                    </div>

                    {/* Mapped Product Context */}
                    {activeConversation.lead?.related_product && (
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
                    <div className="space-y-2 border-t border-slate-800/80 pt-4">
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
                    <div className="border-t border-slate-800/80 pt-4 space-y-2">
                        <span className="text-xs font-semibold text-slate-300 block">Conversation Tags</span>
                        <div className="flex flex-wrap gap-1.5">
                            {activeConversation.tags?.map((t) => (
                                <Badge key={t.id} variant="neutral" size="xs">
                                    {t.tag}
                                </Badge>
                            ))}
                        </div>
                    </div>
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
            <Modal isOpen={orderModal} onClose={() => setOrderModal(false)} title="Create Verified Order Draft">
                <form onSubmit={handleOrderSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Quantity</label>
                            <input
                                type="number"
                                min={1}
                                required
                                value={orderForm.quantity}
                                onChange={(e) => setOrderForm({ ...orderForm, quantity: parseInt(e.target.value) || 1 })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Unit Price (BDT)</label>
                            <input
                                type="number"
                                required
                                value={orderForm.unit_price}
                                onChange={(e) => setOrderForm({ ...orderForm, unit_price: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Delivery Charge (BDT)</label>
                        <select
                            value={orderForm.delivery_charge}
                            onChange={(e) => setOrderForm({ ...orderForm, delivery_charge: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        >
                            <option value={70}>Inside Dhaka (70 BDT)</option>
                            <option value={130}>Outside Dhaka (130 BDT)</option>
                            <option value={0}>Free Delivery (0 BDT)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Customer Phone Number</label>
                        <input
                            type="text"
                            required
                            placeholder="017XXXXXXXX"
                            value={orderForm.customer_phone}
                            onChange={(e) => setOrderForm({ ...orderForm, customer_phone: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Shipping Address</label>
                        <textarea
                            rows={2}
                            required
                            placeholder="Full delivery address with house, road, area..."
                            value={orderForm.customer_address}
                            onChange={(e) => setOrderForm({ ...orderForm, customer_address: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        ></textarea>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-300">Total Payable (Cash on Delivery):</span>
                        <span className="text-base font-bold text-emerald-400">
                            {(orderForm.unit_price * orderForm.quantity + orderForm.delivery_charge)} BDT
                        </span>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => setOrderModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="success" size="sm" type="submit">
                            Confirm Order & Convert Lead
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
