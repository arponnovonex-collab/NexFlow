import React, { useEffect, useState, useRef } from 'react';
import api from '../../api/client';
import { useSipPhone } from '../../context/SipPhoneContext';
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
    MicOff,
    Sparkles,
    Info,
    Radio,
} from 'lucide-react';

export const IpCallPage = () => {
    // WebRTC SIP Phone from Context
    const {
        sipStatus,
        statusMessage,
        credentials,
        callState: sipCallState,
        callDirection: sipCallDirection,
        callNumber: sipCallNumber,
        callDuration: sipCallDuration,
        isMuted,
        makeCall,
        hangupCall,
        toggleMute,
        sendDTMF,
        reconnect,
    } = useSipPhone();

    // Local dialer input
    const [phoneNumber, setPhoneNumber] = useState('');
    const [customerMatch, setCustomerMatch] = useState(null);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [copiedPass, setCopiedPass] = useState(false);

    // Call notes and disposition
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

    // Load initial logs and check URL phone parameter
    useEffect(() => {
        fetchCallLogs();

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

    // When SIP call number changes, update local state
    useEffect(() => {
        if (sipCallNumber && sipCallState !== 'idle') {
            setPhoneNumber(sipCallNumber);
        }
    }, [sipCallNumber, sipCallState]);

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

    const handleDigitClick = (digit) => {
        sendDTMF(digit);
        if (sipCallState === 'idle') {
            setPhoneNumber((prev) => prev + digit);
        }
    };

    const handleBackspace = () => {
        if (sipCallState !== 'idle') return;
        setPhoneNumber((prev) => prev.slice(0, -1));
    };

    const handleClear = () => {
        if (sipCallState !== 'idle') return;
        setPhoneNumber('');
        setCustomerMatch(null);
    };

    // Trigger Direct Outbound WebRTC Call
    const handleStartCall = (targetPhone = null) => {
        const numberToCall = targetPhone || phoneNumber;
        const clean = numberToCall.replace(/[^0-9]/g, '');
        if (clean.length < 5) {
            alert('Please enter a valid phone number.');
            return;
        }

        setCallNotes('');
        setCallDisposition('');
        makeCall(clean);
    };

    const handleEndCall = () => {
        hangupCall();
        setTimeout(fetchCallLogs, 1500);
    };

    const handleSaveCallNotes = async () => {
        const phone = sipCallNumber || phoneNumber;
        if (!phone) return;

        setSavingNotes(true);
        try {
            await api.post('/call-center/logs', {
                direction: sipCallDirection || 'outbound',
                customer_phone: phone,
                status: sipCallState === 'connected' ? 'answered' : 'completed',
                duration_seconds: sipCallDuration,
                disposition: callDisposition,
                notes: callNotes,
            });

            alert('Call notes & disposition saved to CRM.');
            setCallNotes('');
            setCallDisposition('');
            fetchCallLogs();
        } catch (err) {
            alert('Failed to save call notes.');
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

    const isOnline = sipStatus === 'registered';

    return (
        <div className="space-y-6">
            {/* Audio player element for CDR recordings */}
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
                        ইন-ব্রাউজার ওয়েব ডায়লার ও আইপি কল (ePBX.bd)
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        সরাসরি ব্রাউজার থেকেই কাস্টমারকে কল দিন এবং ইনকামিং কল রিসিভ করুন — কোনো আলাদা সফটওয়্যার বা অ্যাপ লাগবে না।
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                        <span className="text-slate-400">Extension:</span>
                        <span className="font-mono text-emerald-400 font-bold">{credentials.extension}</span>
                    </div>
                </div>
            </div>

            {/* Real-time WebRTC SIP Phone Status Bar */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-start sm:items-center gap-3.5">
                    <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                            isOnline
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-emerald-950/50'
                                : sipStatus === 'connecting'
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                        }`}
                    >
                        <Radio className={`w-5 h-5 ${isOnline ? 'animate-pulse' : ''}`} />
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-100">
                                সরাসরি ব্রাউজার ফোন (WebRTC Engine)
                            </span>
                            <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${
                                    isOnline
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                        : sipStatus === 'connecting'
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`}></span>
                                {isOnline ? 'Active & Ready' : sipStatus === 'connecting' ? 'Connecting...' : 'Offline'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                                Ext: {credentials.extension}
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            {isOnline ? (
                                <span className="text-emerald-300">
                                    ✅ ব্রাউজার সরাসরি Asterisk PBX-এর সাথে সংযুক্ত। হেডফোন/মাইক্রোফোন দিয়ে কথা বলতে পারবেন।
                                </span>
                            ) : (
                                <span>{statusMessage}</span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!isOnline && (
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={RefreshCw}
                            onClick={reconnect}
                            className="text-xs border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
                        >
                            Reconnect SIP
                        </Button>
                    )}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
                        <span className="text-[11px] text-slate-400">Pass:</span>
                        <code className="text-emerald-300 font-mono font-bold">{credentials.password}</code>
                        <button
                            type="button"
                            onClick={() => {
                                navigator.clipboard.writeText(credentials.password);
                                setCopiedPass(true);
                                setTimeout(() => setCopiedPass(false), 2000);
                            }}
                            className="ml-1 p-1 text-slate-400 hover:text-white rounded"
                            title="পাসওয়ার্ড কপি করুন"
                        >
                            {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Layout: Left Dialer + Right CDR History */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left 5 Cols: Interactive Dialer */}
                <div className="lg:col-span-5 space-y-4">
                    <Card className="p-6 border-slate-800 bg-slate-900/60 shadow-xl relative overflow-hidden">
                        {/* Dialing State Header Banner */}
                        {sipCallState !== 'idle' && (
                            <div className="mb-4 p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`w-3 h-3 rounded-full ${
                                                sipCallState === 'connected'
                                                    ? 'bg-emerald-400 animate-pulse'
                                                    : sipCallState === 'ringing'
                                                    ? 'bg-amber-400 animate-ping'
                                                    : 'bg-indigo-400 animate-pulse'
                                            }`}
                                        ></span>
                                        <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                                            {sipCallState === 'calling'
                                                ? 'Calling Customer...'
                                                : sipCallState === 'ringing'
                                                ? 'Ringing...'
                                                : sipCallState === 'connected'
                                                ? 'Call In Progress'
                                                : 'Call Ended'}
                                        </span>
                                    </div>
                                    <span className="text-sm font-mono font-bold text-emerald-400">
                                        {formatTimer(sipCallDuration)}
                                    </span>
                                </div>

                                {sipCallState === 'connected' && (
                                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300">
                                        <div className="flex items-center gap-2">
                                            <Mic className="w-4 h-4 text-emerald-400 animate-pulse" />
                                            <span>কথা বলা চলছে (Headphone Active)</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={toggleMute}
                                            className={`p-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors ${
                                                isMuted ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                                            }`}
                                        >
                                            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                                            <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                                        </button>
                                    </div>
                                )}

                                {sipCallState === 'ended' && (
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
                                disabled={sipCallState !== 'idle'}
                                className="w-full bg-transparent text-center text-xl sm:text-2xl font-bold font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none tracking-wider"
                            />
                            {phoneNumber && sipCallState === 'idle' && (
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
                                    className="h-14 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 active:bg-slate-800 border border-slate-800/80 flex flex-col items-center justify-center transition-all duration-150 cursor-pointer group shadow-sm hover:border-slate-700"
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
                            {sipCallState === 'idle' ? (
                                <button
                                    type="button"
                                    onClick={() => handleStartCall()}
                                    disabled={!phoneNumber.trim() || !isOnline}
                                    className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                                >
                                    <PhoneCall className="w-5 h-5" />
                                    <span>{isOnline ? 'কল দিন (Direct In-Browser Call)' : 'Connecting SIP...'}</span>
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

                    {/* How It Works Guidance Card */}
                    <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-200/90 space-y-2">
                        <div className="font-bold text-indigo-300 flex items-center gap-2">
                            <Info className="w-4 h-4 text-indigo-400" />
                            সরাসরি ব্রাউজার কলিং সুবিধা:
                        </div>
                        <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300 leading-relaxed">
                            <li>আপনার এক্সটেনশন <strong>102</strong> সরাসরি এই ব্রাউজারেই সক্রিয় করা হয়েছে।</li>
                            <li>ডায়প্যাডে নম্বর লিখে <strong>"কল দিন"</strong> চাপলেই সরাসরি হেডফোন দিয়ে কথা শুরু হবে।</li>
                            <li>কাস্টমার আপনার ট্রাঙ্ক নম্বরে কল দিলে স্ক্রিনের উপরে <strong>Answer</strong> বাটন ভেসে উঠবে।</li>
                        </ul>
                    </div>
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
                                        placeholder="Search by phone..."
                                        className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 w-40 sm:w-48 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <Button
                                    variant="secondary"
                                    size="xs"
                                    icon={RefreshCw}
                                    loading={syncingLogs}
                                    onClick={handleSyncEpbxHistory}
                                    title="Sync history from ePBX server"
                                >
                                    Sync ePBX
                                </Button>
                            </div>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-2 py-3 border-b border-slate-800/60 text-xs">
                            <span className="text-slate-400 text-[11px]">Filter:</span>
                            {['all', 'answered', 'no_answer', 'failed'].map((st) => (
                                <button
                                    key={st}
                                    onClick={() => setStatusFilter(st)}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors capitalize ${
                                        statusFilter === st
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {st.replace('_', ' ')}
                                </button>
                            ))}
                        </div>

                        {/* CDR Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead>
                                    <tr className="border-b border-slate-800 text-slate-400 font-medium">
                                        <th className="py-2.5 px-3">Direction</th>
                                        <th className="py-2.5 px-3">Customer / Phone</th>
                                        <th className="py-2.5 px-3">Status</th>
                                        <th className="py-2.5 px-3">Duration</th>
                                        <th className="py-2.5 px-3">Time</th>
                                        <th className="py-2.5 px-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {logsLoading ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-slate-400">
                                                Loading call records...
                                            </td>
                                        </tr>
                                    ) : callLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-slate-400">
                                                No calls recorded yet. Enter a phone number on the left to dial!
                                            </td>
                                        </tr>
                                    ) : (
                                        callLogs.map((log) => {
                                            const isOutbound = log.direction === 'outbound';
                                            return (
                                                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="py-3 px-3">
                                                        <div className="flex items-center gap-1.5">
                                                            {isOutbound ? (
                                                                <PhoneOutgoing className="w-3.5 h-3.5 text-indigo-400" />
                                                            ) : (
                                                                <PhoneIncoming className="w-3.5 h-3.5 text-emerald-400" />
                                                            )}
                                                            <span className="capitalize text-slate-300 text-[11px] font-medium">
                                                                {log.direction}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <div className="font-mono text-slate-100 font-semibold">
                                                            {log.customer_phone}
                                                        </div>
                                                        {log.customer?.name && (
                                                            <div className="text-[10px] text-slate-400">
                                                                {log.customer.name}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-3">
                                                        <Badge
                                                            variant={
                                                                log.status === 'answered'
                                                                    ? 'success'
                                                                    : log.status === 'ringing'
                                                                    ? 'warning'
                                                                    : 'danger'
                                                            }
                                                            size="xs"
                                                        >
                                                            {log.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-3 px-3 font-mono text-slate-300">
                                                        {formatTimer(log.duration_seconds || 0)}
                                                    </td>
                                                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                                                        {new Date(log.started_at || log.created_at).toLocaleTimeString([], {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </td>
                                                    <td className="py-3 px-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {log.recording_url && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handlePlayRecording(log)}
                                                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 transition-colors"
                                                                    title="Play Recording"
                                                                >
                                                                    {playingRecordingId === log.id ? (
                                                                        <Pause className="w-3 h-3 text-emerald-400" />
                                                                    ) : (
                                                                        <Play className="w-3 h-3" />
                                                                    )}
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleStartCall(log.customer_phone)}
                                                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 transition-colors"
                                                                title="Redial via WebRTC"
                                                            >
                                                                <PhoneCall className="w-3 h-3" />
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
