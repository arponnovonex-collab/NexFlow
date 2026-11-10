import React, { useEffect, useState, useRef } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
    Phone,
    PhoneCall,
    PhoneOff,
    PhoneForwarded,
    PhoneIncoming,
    PhoneOutgoing,
    Delete,
    User,
    ShoppingBag,
    Clock,
    Volume2,
    Search,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    UserCheck,
    MessageSquare,
    Save,
    Play,
    Pause,
    History,
    Globe,
    ExternalLink,
    Copy,
    Check,
    Headphones,
    Mic,
    Sparkles,
    LayoutPanelLeft,
    X,
    Info,
} from 'lucide-react';

export const IpCallPage = () => {
    // Dialer state
    const [phoneNumber, setPhoneNumber] = useState('');
    const [agentExtension, setAgentExtension] = useState('101');
    const [extensionPassword, setExtensionPassword] = useState('MJt#27766');
    const [webDialerUrl, setWebDialerUrl] = useState('https://auliro010.epbx.bd/dialer');
    const [customerMatch, setCustomerMatch] = useState(null);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [showDockedDialer, setShowDockedDialer] = useState(false);
    const [copiedPass, setCopiedPass] = useState(false);

    // Call execution state
    const [callState, setCallState] = useState('idle'); // 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'
    const [activeCallLog, setActiveCallLog] = useState(null);
    const [callDuration, setCallDuration] = useState(0);
    const [callNotes, setCallNotes] = useState('');
    const [callDisposition, setCallDisposition] = useState('');
    const [savingNotes, setSavingNotes] = useState(false);

    // CDR Logs state
    const [callLogs, setCallLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(true);
    const [syncingLogs, setSyncingLogs] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Audio player state
    const [playingRecordingId, setPlayingRecordingId] = useState(null);
    const audioRef = useRef(null);
    const timerRef = useRef(null);

    // Keypad numbers
    const keypadKeys = [
        { digit: '1', sub: '' },
        { digit: '2', sub: 'ABC' },
        { digit: '3', sub: 'DEF' },
        { digit: '4', sub: 'GHI' },
        { digit: '5', sub: 'JKL' },
        { digit: '6', sub: 'MNO' },
        { digit: '7', sub: 'PQRS' },
        { digit: '8', sub: 'TUV' },
        { digit: '9', sub: 'WXYZ' },
        { digit: '*', sub: '' },
        { digit: '0', sub: '+' },
        { digit: '#', sub: '' },
    ];

    // Load initial settings and logs
    useEffect(() => {
        loadSettings();
        fetchCallLogs();

        // Check if phone number was passed via URL query param (e.g. from Orders/Customers page)
        try {
            const params = new URLSearchParams(window.location.search);
            const targetPhone = params.get('phone');
            if (targetPhone) {
                setPhoneNumber(targetPhone);
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    const loadSettings = async () => {
        try {
            const res = await api.get('/call-center/settings');
            const data = res.data.data;
            if (data?.default_extension) {
                setAgentExtension(data.default_extension);
            }
            if (data?.extension_password) {
                setExtensionPassword(data.extension_password);
            }
            if (data?.web_dialer_url) {
                setWebDialerUrl(data.web_dialer_url);
            }
        } catch (err) {
            console.error('Failed to load extension settings:', err);
        }
    };

    const handleLaunchWebPhone = () => {
        window.open(webDialerUrl, 'ePBX_WebPhone', 'width=420,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes');
    };

    const handleCopyPassword = () => {
        navigator.clipboard.writeText(extensionPassword);
        setCopiedPass(true);
        setTimeout(() => setCopiedPass(false), 2000);
    };

    const fetchCallLogs = async () => {
        try {
            setLogsLoading(true);
            const res = await api.get('/call-center/logs', {
                params: {
                    search: searchTerm || undefined,
                    status: statusFilter !== 'all' ? statusFilter : undefined,
                },
            });
            setCallLogs(res.data.data || []);
        } catch (err) {
            console.error('Failed to load call logs:', err);
        } finally {
            setLogsLoading(false);
        }
    };

    const handleSyncEpbxHistory = async () => {
        setSyncingLogs(true);
        try {
            const res = await api.post('/call-center/sync-logs');
            alert(res.data.message || 'Call history synced with ePBX!');
            fetchCallLogs();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to sync call history with ePBX. Please verify API Token.');
        } finally {
            setSyncingLogs(false);
        }
    };

    // Instant Customer Lookup when typing phone number
    useEffect(() => {
        const clean = phoneNumber.replace(/[^0-9]/g, '');
        if (clean.length < 5) {
            setCustomerMatch(null);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setLookupLoading(true);
                const res = await api.get('/call-center/customer-lookup', {
                    params: { phone: clean },
                });
                setCustomerMatch(res.data.customer || null);
            } catch (err) {
                console.error(err);
            } finally {
                setLookupLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [phoneNumber]);

    // Active Call Timer
    useEffect(() => {
        if (callState === 'connected') {
            timerRef.current = setInterval(() => {
                setCallDuration((prev) => prev + 1);
            }, 1000);
        } else if (callState === 'idle' || callState === 'ended') {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [callState]);

    const handleDigitClick = (digit) => {
        if (callState !== 'idle') return;
        setPhoneNumber((prev) => prev + digit);
    };

    const handleBackspace = () => {
        if (callState !== 'idle') return;
        setPhoneNumber((prev) => prev.slice(0, -1));
    };

    const handleClear = () => {
        if (callState !== 'idle') return;
        setPhoneNumber('');
        setCustomerMatch(null);
    };

    // Trigger Outbound Call
    const handleStartCall = async (targetPhone = null) => {
        const numberToCall = targetPhone || phoneNumber;
        const clean = numberToCall.replace(/[^0-9]/g, '');
        if (clean.length < 6) {
            alert('Please enter a valid phone number.');
            return;
        }

        setCallState('calling');
        setCallDuration(0);
        setCallNotes('');
        setCallDisposition('');

        try {
            const res = await api.post('/call-center/originate', {
                phone: clean,
                extension: agentExtension,
            });

            const log = res.data.call_log;
            setActiveCallLog(log);
            setCallState('ringing');

            // Simulate call connection progression for UI responsiveness
            setTimeout(() => {
                setCallState('connected');
            }, 2500);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to initiate call via ePBX.');
            setCallState('idle');
            setActiveCallLog(null);
        }
    };

    const handleEndCall = () => {
        setCallState('ended');
        fetchCallLogs();
    };

    const handleSaveCallNotes = async () => {
        if (!activeCallLog?.id) return;
        setSavingNotes(true);
        try {
            await api.put(`/call-center/logs/${activeCallLog.id}`, {
                disposition: callDisposition,
                notes: callNotes,
            });
            alert('Call notes & disposition saved.');
            fetchCallLogs();
            setCallState('idle');
            setActiveCallLog(null);
        } catch (err) {
            alert('Failed to save notes.');
        } finally {
            setSavingNotes(false);
        }
    };

    const formatTimer = (seconds) => {
        const m = Math.floor(seconds / 60)
            .toString()
            .padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handlePlayRecording = (log) => {
        if (!log.recording_url) return;
        if (playingRecordingId === log.id) {
            audioRef.current?.pause();
            setPlayingRecordingId(null);
        } else {
            setPlayingRecordingId(log.id);
            if (audioRef.current) {
                audioRef.current.src = log.recording_url;
                audioRef.current.play();
            }
        }
    };

    return (
        <div className="space-y-6">
            {/* Audio player element */}
            <audio
                ref={audioRef}
                onEnded={() => setPlayingRecordingId(null)}
                className="hidden"
            />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                        <Phone className="w-6 h-6 text-emerald-400" />
                        IP Call & Web Dialer
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Conduct outbound phone calls via ePBX.bd with live customer lookup, call recording, and instant order disposition.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                        <span className="text-slate-400">Agent Ext:</span>
                        <input
                            type="text"
                            value={agentExtension}
                            onChange={(e) => setAgentExtension(e.target.value)}
                            placeholder="101"
                            className="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center font-mono text-emerald-400 font-bold focus:outline-none"
                            title="Current SIP extension"
                        />
                    </div>
                </div>
            </div>

            {/* In-Browser Web Softphone Control Bar */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-inner">
                        <Globe className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-100">
                                ইন-ব্রাউজার ওয়েব ফোন (MicroSIP লাগবে না)
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Ext: {agentExtension}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            ব্রাউজার থেকেই সরাসরি কথা বলতে নিচের বাটনে ক্লিক করে Extension <strong className="text-emerald-400 font-mono">101</strong> ও Password <strong className="text-emerald-400 font-mono">{extensionPassword}</strong> দিয়ে একবার লগইন করে রাখুন।
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
                        <span className="text-[11px] text-slate-400">Pass:</span>
                        <code className="text-emerald-300 font-mono font-bold">{extensionPassword}</code>
                        <button
                            type="button"
                            onClick={handleCopyPassword}
                            className="ml-1 p-1 text-slate-400 hover:text-white rounded"
                            title="পাসওয়ার্ড কপি করুন"
                        >
                            {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                    </div>

                    <Button
                        variant="primary"
                        size="sm"
                        icon={ExternalLink}
                        onClick={handleLaunchWebPhone}
                        className="bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-950/40 text-xs font-bold"
                    >
                        🌐 ওপেন ওয়েব ফোন
                    </Button>

                    <Button
                        variant="secondary"
                        size="sm"
                        icon={showDockedDialer ? X : LayoutPanelLeft}
                        onClick={() => setShowDockedDialer(!showDockedDialer)}
                        title="NexFlow পেজের ভেতরেই ডায়লার দেখুন"
                        className="text-xs border-slate-700"
                    >
                        {showDockedDialer ? 'Close Dock' : 'Dock View'}
                    </Button>
                </div>
            </div>

            {/* Docked iframe View if toggled */}
            {showDockedDialer && (
                <div className="p-4 rounded-2xl bg-slate-900 border border-indigo-500/40 shadow-2xl space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-indigo-400" />
                            <span className="text-xs font-bold text-slate-200">
                                ePBX.bd Docked Web Softphone (Extension 101)
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="xs"
                                variant="secondary"
                                icon={ExternalLink}
                                onClick={handleLaunchWebPhone}
                            >
                                Open in Window
                            </Button>
                            <button
                                onClick={() => setShowDockedDialer(false)}
                                className="p-1 text-slate-400 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <div className="w-full h-[580px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 relative">
                        <iframe
                            src={webDialerUrl}
                            title="ePBX Web Dialer"
                            className="w-full h-full border-0"
                            allow="microphone; camera; autoplay; display-capture"
                        />
                    </div>
                </div>
            )}

            {/* Main Layout: Left Dialer + Right CDR History */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left 5 Cols: Interactive Dialer */}
                <div className="lg:col-span-5 space-y-4">
                    <Card className="p-6 border-slate-800 bg-slate-900/60 shadow-xl relative overflow-hidden">
                        {/* Dialing State Header Banner */}
                        {callState !== 'idle' && (
                            <div className="mb-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`w-3 h-3 rounded-full ${
                                                callState === 'connected'
                                                    ? 'bg-emerald-400 animate-pulse'
                                                    : callState === 'ringing'
                                                    ? 'bg-amber-400 animate-ping'
                                                    : 'bg-indigo-400 animate-pulse'
                                            }`}
                                        ></span>
                                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                                            {callState === 'calling'
                                                ? 'Initiating via ePBX...'
                                                : callState === 'ringing'
                                                ? 'Ringing Phone...'
                                                : callState === 'connected'
                                                ? 'Call In Progress'
                                                : 'Call Ended'}
                                        </span>
                                    </div>
                                    <span className="text-sm font-mono font-bold text-emerald-400">
                                        {formatTimer(callDuration)}
                                    </span>
                                </div>

                                {callState === 'connected' && (
                                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
                                        <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                                        <span>ওয়েব সফটফোনে সরাসরি কথা বলুন (Microphone Active)</span>
                                    </div>
                                )}
                                {callState === 'ringing' && (
                                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300">
                                        <Headphones className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                                        <span>ওয়েব সফটফোনে কল বাজছে... রিসিভ করলেই কাস্টমার যুক্ত হবে</span>
                                    </div>
                                )}

                                {callState === 'ended' && (
                                    <div className="space-y-2 pt-2 border-t border-slate-800">
                                        <label className="block text-[11px] font-medium text-slate-300">
                                            Call Outcome / Disposition
                                        </label>
                                        <select
                                            value={callDisposition}
                                            onChange={(e) => setCallDisposition(e.target.value)}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                                        >
                                            <option value="">Select Call Outcome</option>
                                            <option value="order_confirmed">✅ Order Confirmed</option>
                                            <option value="interested_followup">⏳ Interested / Call Later</option>
                                            <option value="busy">📵 Busy / Line Engaged</option>
                                            <option value="no_answer">❌ No Answer</option>
                                            <option value="cancelled">🚫 Cancelled / Not Interested</option>
                                            <option value="wrong_number">⚠️ Wrong Number</option>
                                        </select>
                                        <textarea
                                            rows={2}
                                            value={callNotes}
                                            onChange={(e) => setCallNotes(e.target.value)}
                                            placeholder="Write brief notes from the call..."
                                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none"
                                        ></textarea>
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                size="xs"
                                                variant="primary"
                                                icon={Save}
                                                loading={savingNotes}
                                                onClick={handleSaveCallNotes}
                                            >
                                                Save to CRM
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Phone Number Input Screen */}
                        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 mb-5 text-center relative group">
                            <input
                                type="text"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="Enter phone number..."
                                disabled={callState !== 'idle'}
                                className="w-full bg-transparent text-center text-xl sm:text-2xl font-bold font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none tracking-wider"
                            />
                            {phoneNumber && callState === 'idle' && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={handleBackspace}
                                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                                        title="Backspace"
                                    >
                                        <Delete className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Customer Match Card */}
                        {customerMatch && (
                            <div className="mb-4 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between gap-3 animate-fade-in">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                        <UserCheck className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-xs font-bold text-emerald-300 truncate">
                                            {customerMatch.name}
                                        </h4>
                                        <p className="text-[10px] text-slate-400 truncate">
                                            {customerMatch.city || customerMatch.address || 'Verified Customer'}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium shrink-0">
                                    {customerMatch.orders_count || 0} Orders
                                </span>
                            </div>
                        )}

                        {/* Keypad Grid (3x4) */}
                        <div className="grid grid-cols-3 gap-3 mb-6">
                            {keypadKeys.map(({ digit, sub }) => (
                                <button
                                    key={digit}
                                    type="button"
                                    onClick={() => handleDigitClick(digit)}
                                    disabled={callState !== 'idle'}
                                    className="h-14 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 active:bg-slate-800 border border-slate-800/80 flex flex-col items-center justify-center transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm hover:border-slate-700"
                                >
                                    <span className="text-lg font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                                        {digit}
                                    </span>
                                    {sub && (
                                        <span className="text-[9px] font-semibold text-slate-400 tracking-widest uppercase">
                                            {sub}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Call Action Button */}
                        <div className="flex items-center justify-center gap-3">
                            {callState === 'idle' ? (
                                <button
                                    type="button"
                                    onClick={() => handleStartCall()}
                                    disabled={!phoneNumber.trim()}
                                    className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                                >
                                    <PhoneCall className="w-5 h-5" />
                                    <span>Dial with ePBX</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleEndCall}
                                    className="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 transition-all duration-200 cursor-pointer active:scale-[0.98]"
                                >
                                    <PhoneOff className="w-5 h-5" />
                                    <span>Hangup / End Call</span>
                                </button>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Right 7 Cols: Call Detail Records (CDR) */}
                <div className="lg:col-span-7 space-y-4">
                    <Card className="p-5 border-slate-800 bg-slate-900/60 shadow-xl">
                        {/* Table Header & Search */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                            <div>
                                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                                    <History className="w-4 h-4 text-indigo-400" />
                                    Call Detail Records (CDR)
                                </h3>
                                <p className="text-[11px] text-slate-400">
                                    Live history of incoming and outgoing calls, duration, and recordings.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && fetchCallLogs()}
                                        placeholder="Search number/name..."
                                        className="w-40 sm:w-48 bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                                    />
                                </div>
                                <Button
                                    size="xs"
                                    variant="secondary"
                                    icon={RefreshCw}
                                    loading={syncingLogs}
                                    onClick={handleSyncEpbxHistory}
                                    title="ePBX.bd সার্ভার থেকে অতীত কলের হিস্ট্রি সরাসরি সিঙ্ক করুন"
                                >
                                    Sync ePBX
                                </Button>
                                <Button
                                    size="xs"
                                    variant="secondary"
                                    icon={RefreshCw}
                                    loading={logsLoading}
                                    onClick={fetchCallLogs}
                                    title="Reload call logs"
                                />
                            </div>
                        </div>

                        {/* CDR Table */}
                        <div className="overflow-x-auto mt-3">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800/80 text-[11px] text-slate-400 font-semibold uppercase">
                                        <th className="py-2.5 px-3">Type</th>
                                        <th className="py-2.5 px-3">Customer</th>
                                        <th className="py-2.5 px-3">Ext</th>
                                        <th className="py-2.5 px-3">Duration</th>
                                        <th className="py-2.5 px-3">Status</th>
                                        <th className="py-2.5 px-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                                    {logsLoading ? (
                                        <tr>
                                            <td colSpan="6" className="py-12 text-center text-xs text-slate-400">
                                                Loading call records...
                                            </td>
                                        </tr>
                                    ) : callLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="py-12 text-center text-xs text-slate-400">
                                                No calls recorded yet. Use the dialer on the left to make your first call.
                                            </td>
                                        </tr>
                                    ) : (
                                        callLogs.map((log) => {
                                            const isAnswered = log.status === 'answered';
                                            const isOutbound = log.direction === 'outbound';

                                            return (
                                                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                                        <span
                                                            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                                                                isOutbound ? 'text-indigo-400' : 'text-emerald-400'
                                                            }`}
                                                            title={isOutbound ? 'Outbound Call' : 'Inbound Call'}
                                                        >
                                                            {isOutbound ? (
                                                                <PhoneOutgoing className="w-3 h-3" />
                                                            ) : (
                                                                <PhoneIncoming className="w-3 h-3" />
                                                            )}
                                                            {isOutbound ? 'Out' : 'In'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-semibold text-slate-200 truncate max-w-[140px]">
                                                            {log.customer?.name || log.customer_phone}
                                                        </div>
                                                        {log.customer?.name && (
                                                            <div className="text-[10px] text-slate-400 font-mono">
                                                                {log.customer_phone}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                                                        {log.agent_extension}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-slate-300">
                                                        {formatTimer(log.duration_seconds || 0)}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <span
                                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                isAnswered
                                                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                                                    : log.status === 'busy'
                                                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                                                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                                            }`}
                                                        >
                                                            {log.status.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {log.recording_url && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handlePlayRecording(log)}
                                                                    className={`p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${
                                                                        playingRecordingId === log.id
                                                                            ? 'text-emerald-400 bg-emerald-500/10'
                                                                            : ''
                                                                    }`}
                                                                    title="Play recording"
                                                                >
                                                                    {playingRecordingId === log.id ? (
                                                                        <Pause className="w-3.5 h-3.5" />
                                                                    ) : (
                                                                        <Play className="w-3.5 h-3.5" />
                                                                    )}
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setPhoneNumber(log.customer_phone);
                                                                    handleStartCall(log.customer_phone);
                                                                }}
                                                                className="p-1 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                                                                title="Redial this number"
                                                            >
                                                                <PhoneCall className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

