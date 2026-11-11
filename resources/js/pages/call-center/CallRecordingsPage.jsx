import React, { useEffect, useState, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import api from '../../api/client';
import { useSipPhone } from '../../context/SipPhoneContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
    Volume2,
    VolumeX,
    Play,
    Pause,
    Download,
    RefreshCw,
    Search,
    PhoneCall,
    PhoneOutgoing,
    PhoneIncoming,
    Calendar,
    Clock,
    User,
    ShoppingBag,
    FileAudio,
    Sparkles,
    CheckCircle2,
    ArrowUpRight,
    RotateCcw,
    ExternalLink,
    Filter,
} from 'lucide-react';

export const CallRecordingsPage = () => {
    const { makeCall } = useSipPhone();

    // Data states
    const [recordings, setRecordings] = useState([]);
    const [stats, setStats] = useState({
        total_recordings: 0,
        total_minutes: 0,
        today_recordings: 0,
        today_minutes: 0,
    });
    const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState('all'); // 'all' | 'today' | 'yesterday' | 'last_7_days' | 'this_month'
    const [direction, setDirection] = useState('all'); // 'all' | 'inbound' | 'outbound'
    const [minDuration, setMinDuration] = useState(0);

    // Audio playback state
    const [activePlayingId, setActivePlayingId] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const audioRef = useRef(null);

    useEffect(() => {
        fetchRecordings(1);

        // Immediate background sync on page open to fetch newly completed calls
        api.post('/call-center/sync-logs').then(() => {
            fetchRecordings(1);
        }).catch(() => {});
    }, [dateRange, direction, minDuration]);

    // Periodic 12-second background sync while on recordings page
    useEffect(() => {
        const interval = setInterval(() => {
            api.post('/call-center/sync-logs').then(() => {
                fetchRecordings(meta.current_page || 1);
            }).catch(() => {});
        }, 12000);

        return () => clearInterval(interval);
    }, [meta.current_page]);

    const fetchRecordings = async (page = 1) => {
        try {
            setLoading(true);
            const res = await api.get('/call-center/recordings', {
                params: {
                    page,
                    search: searchTerm || undefined,
                    date_range: dateRange !== 'all' ? dateRange : undefined,
                    direction: direction !== 'all' ? direction : undefined,
                    min_duration: minDuration > 0 ? minDuration : undefined,
                },
            });
            setRecordings(res.data.data || []);
            setMeta(res.data.meta || { current_page: 1, last_page: 1, total: 0 });
            if (res.data.stats) {
                setStats(res.data.stats);
            }
        } catch (err) {
            console.error('Failed to load recordings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchRecordings(1);
    };

    const handleSyncFromEpbx = async () => {
        try {
            setSyncing(true);
            const res = await api.post('/call-center/sync-logs');
            alert(res.data.message || 'Call history and recordings synced from ePBX!');
            fetchRecordings(1);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to sync recordings. Please check your ePBX settings.');
        } finally {
            setSyncing(false);
        }
    };

    // Playback control
    const togglePlay = (log) => {
        if (!audioRef.current) return;

        if (activePlayingId === log.id) {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                audioRef.current.play();
                setIsPlaying(true);
            }
        } else {
            // Switch to new recording
            setActivePlayingId(log.id);
            const callId = log.call_session_id || log.id;
            let streamUrl = `/api/call-center/recordings/${callId}`;
            if (log.stream_url) {
                streamUrl = log.stream_url;
            }
            audioRef.current.src = streamUrl;
            audioRef.current.playbackRate = playbackRate;
            audioRef.current.volume = isMuted ? 0 : volume;
            audioRef.current.play().then(() => {
                setIsPlaying(true);
            }).catch(e => {
                console.warn('Playback error:', e);
                setIsPlaying(false);
            });
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
                setDuration(audioRef.current.duration);
            }
        }
    };

    const handleSeek = (e) => {
        const seekTo = parseFloat(e.target.value);
        if (audioRef.current) {
            audioRef.current.currentTime = seekTo;
            setCurrentTime(seekTo);
        }
    };

    const togglePlaybackRate = () => {
        const rates = [1, 1.25, 1.5, 2];
        const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
        const newRate = rates[nextIdx];
        setPlaybackRate(newRate);
        if (audioRef.current) {
            audioRef.current.playbackRate = newRate;
        }
    };

    const toggleMute = () => {
        if (audioRef.current) {
            const nextMuted = !isMuted;
            setIsMuted(nextMuted);
            audioRef.current.volume = nextMuted ? 0 : volume;
        }
    };

    const formatTime = (secs) => {
        if (!secs || isNaN(secs)) return '00:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const activeRecording = recordings.find(r => r.id === activePlayingId);

    return (
        <div className="space-y-6">
            {/* Global Native Audio Element */}
            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleTimeUpdate}
                onEnded={() => {
                    setIsPlaying(false);
                    setCurrentTime(0);
                }}
            />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                        <Volume2 className="w-6 h-6 text-indigo-400" />
                        কল রেকর্ডিং ও অডিও হিস্ট্রি (Call Recordings)
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Asterisk ও ePBX.bd সার্ভার থেকে স্বয়ংক্রিয়ভাবে সংগৃহীত সমস্ত গ্রাহক কলের অডিও রেকর্ড শুনুন ও ডাউনলোড করুন।
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <NavLink
                        to="/call-center/ip-call"
                        className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <PhoneCall className="w-4 h-4 text-emerald-400" />
                        <span>ইন-ব্রাউজার ডায়লার</span>
                    </NavLink>
                    <Button
                        variant="primary"
                        icon={RefreshCw}
                        loading={syncing}
                        onClick={handleSyncFromEpbx}
                        className="shadow-lg shadow-indigo-950/50 text-xs"
                    >
                        Sync Recordings
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-4 border-slate-800/80 bg-slate-900/60 flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
                        <FileAudio className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[11px] font-medium text-slate-400 block">মোট রেকর্ডিংস</span>
                        <span className="text-xl font-extrabold text-white font-mono">
                            {stats.total_recordings || meta.total || 0}
                        </span>
                    </div>
                </Card>

                <Card className="p-4 border-slate-800/80 bg-slate-900/60 flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[11px] font-medium text-slate-400 block">মোট অডিও সময়</span>
                        <span className="text-xl font-extrabold text-white font-mono">
                            {stats.total_minutes} <span className="text-xs font-normal text-slate-400">মিনিট</span>
                        </span>
                    </div>
                </Card>

                <Card className="p-4 border-slate-800/80 bg-slate-900/60 flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[11px] font-medium text-slate-400 block">আজকের রেকর্ডিংস</span>
                        <span className="text-xl font-extrabold text-white font-mono">
                            {stats.today_recordings}
                        </span>
                    </div>
                </Card>

                <Card className="p-4 border-slate-800/80 bg-slate-900/60 flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center shrink-0 border border-violet-500/30">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[11px] font-medium text-slate-400 block">আজকের কথা</span>
                        <span className="text-xl font-extrabold text-white font-mono">
                            {stats.today_minutes} <span className="text-xs font-normal text-slate-400">মিনিট</span>
                        </span>
                    </div>
                </Card>
            </div>

            {/* Persistent Floating Bottom Audio Player Bar if a track is active */}
            {activeRecording && (
                <div className="sticky top-2 z-40 p-4 rounded-2xl bg-slate-900/95 border-2 border-indigo-500/60 shadow-2xl backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-200">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            type="button"
                            onClick={() => togglePlay(activeRecording)}
                            className="w-11 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-indigo-900/50 transition-colors"
                        >
                            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                        </button>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-white truncate">
                                    {activeRecording.customer_phone}
                                </span>
                                {activeRecording.customer?.name && (
                                    <span className="text-xs text-indigo-300 font-medium truncate">
                                        ({activeRecording.customer.name})
                                    </span>
                                )}
                            </div>
                            <span className="text-[11px] text-slate-400 flex items-center gap-2">
                                <span>Ext: {activeRecording.agent_extension}</span>
                                <span>•</span>
                                <span>{new Date(activeRecording.started_at || activeRecording.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                            </span>
                        </div>
                    </div>

                    {/* Scrubber & Time */}
                    <div className="flex-1 max-w-xl flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-400 w-11 text-right">
                            {formatTime(currentTime)}
                        </span>
                        <input
                            type="range"
                            min="0"
                            max={duration || activeRecording.duration_seconds || 100}
                            step="0.1"
                            value={currentTime}
                            onChange={handleSeek}
                            className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <span className="text-xs font-mono text-slate-300 font-semibold w-11">
                            {formatTime(duration || activeRecording.duration_seconds)}
                        </span>
                    </div>

                    {/* Speed & Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={togglePlaybackRate}
                            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono text-xs font-bold transition-colors"
                            title="Playback Speed"
                        >
                            {playbackRate}x
                        </button>
                        <button
                            type="button"
                            onClick={toggleMute}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                        {(activeRecording.stream_url || activeRecording.recording_url) && (
                            <a
                                href={activeRecording.stream_url || activeRecording.recording_url}
                                download={`call_${activeRecording.customer_phone}_${activeRecording.id}.wav`}
                                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 transition-colors"
                                title="Download Recording (.wav)"
                            >
                                <Download className="w-4 h-4" />
                            </a>
                        )}
                    </div>
                </div>
            )}

            {/* Filter Bar & Search */}
            <Card className="p-4 border-slate-800/80 bg-slate-900/60">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Search Input */}
                    <form onSubmit={handleSearchSubmit} className="flex-1 max-w-md relative">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="গ্রাহকের ফোন নম্বর বা নাম দিয়ে খুঁজুন..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-20 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                            type="submit"
                            className="absolute right-1.5 top-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] transition-colors"
                        >
                            খুঁজুন
                        </button>
                    </form>

                    {/* Filter Pills */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        {/* Date Filter */}
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="all">সব সময় (All Time)</option>
                            <option value="today">আজকে (Today)</option>
                            <option value="yesterday">গতকাল (Yesterday)</option>
                            <option value="last_7_days">গত ৭ দিন (Last 7 Days)</option>
                            <option value="this_month">চলতি মাস (This Month)</option>
                        </select>

                        {/* Direction Filter */}
                        <select
                            value={direction}
                            onChange={(e) => setDirection(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="all">সব কল (In & Out)</option>
                            <option value="outbound">আউটবাউন্ড কল (Outbound)</option>
                            <option value="inbound">ইনবাউন্ড কল (Inbound)</option>
                        </select>

                        {/* Duration Filter */}
                        <select
                            value={minDuration}
                            onChange={(e) => setMinDuration(Number(e.target.value))}
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                        >
                            <option value={0}>সকল দৈর্ঘ্য</option>
                            <option value={30}>&gt; ৩০ সেকেন্ড</option>
                            <option value={60}>&gt; ১ মিনিট</option>
                            <option value={180}>&gt; ৩ মিনিট</option>
                        </select>

                        <button
                            type="button"
                            onClick={() => {
                                setSearchTerm('');
                                setDateRange('all');
                                setDirection('all');
                                setMinDuration(0);
                            }}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            title="Reset Filters"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </Card>

            {/* Recordings List */}
            <Card className="p-0 border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="border-b border-slate-800 text-slate-400 font-semibold bg-slate-950/40">
                                <th className="py-3.5 px-4">কল টাইপ</th>
                                <th className="py-3.5 px-4">গ্রাহক / ফোন নম্বর</th>
                                <th className="py-3.5 px-4">অডিও প্লেয়ার</th>
                                <th className="py-3.5 px-4">কল ডিউরেশন</th>
                                <th className="py-3.5 px-4">তারিখ ও সময়</th>
                                <th className="py-3.5 px-4 text-right">অ্যাকশন</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                            <span>কল রেকর্ডিংস লোড হচ্ছে...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : recordings.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-14 text-slate-400">
                                        <div className="max-w-sm mx-auto space-y-3">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
                                                <Volume2 className="w-6 h-6" />
                                            </div>
                                            <p className="font-bold text-slate-200">কোনো কল রেকর্ডিং পাওয়া যায়নি</p>
                                            <p className="text-[11px] text-slate-400">
                                                সার্ভারে কল সম্পন্ন হওয়ার পর FreePBX স্বয়ংক্রিয়ভাবে অডিও সংরক্ষণ করে। নতুন কল রেকর্ড দেখতে উপরের <strong>"Sync Recordings"</strong> বাটনে ক্লিক করুন।
                                            </p>
                                            <div className="pt-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    icon={RefreshCw}
                                                    onClick={handleSyncFromEpbx}
                                                >
                                                    Sync Now
                                                </Button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                recordings.map((log) => {
                                    const isOutbound = log.direction === 'outbound';
                                    const isActiveRow = activePlayingId === log.id;
                                    const hasAudio = !!(log.stream_url || log.recording_url);

                                    return (
                                        <tr
                                            key={log.id}
                                            className={`hover:bg-slate-800/40 transition-colors ${
                                                isActiveRow ? 'bg-indigo-950/20' : ''
                                            }`}
                                        >
                                            {/* Direction */}
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                            isOutbound
                                                                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                                                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                                        }`}
                                                    >
                                                        {isOutbound ? (
                                                            <PhoneOutgoing className="w-3.5 h-3.5" />
                                                        ) : (
                                                            <PhoneIncoming className="w-3.5 h-3.5" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="capitalize text-slate-200 font-semibold block text-[11px]">
                                                            {log.direction}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                            Ext: {log.agent_extension}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Customer */}
                                            <td className="py-3.5 px-4">
                                                <div className="font-mono text-white font-bold text-xs">
                                                    {log.customer_phone}
                                                </div>
                                                {log.customer?.name ? (
                                                    <div className="text-[11px] text-slate-300 font-medium flex items-center gap-1 mt-0.5">
                                                        <User className="w-3 h-3 text-slate-400" />
                                                        <span>{log.customer.name}</span>
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-slate-500 italic">
                                                        New Customer
                                                    </div>
                                                )}
                                                {log.notes && (
                                                    <div className="text-[10px] text-indigo-300/80 truncate max-w-xs mt-0.5">
                                                        📝 {log.notes}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Inline Audio Player */}
                                            <td className="py-3.5 px-4">
                                                {hasAudio ? (
                                                    <div className="flex items-center gap-2.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => togglePlay(log)}
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors shadow-sm ${
                                                                isActiveRow && isPlaying
                                                                    ? 'bg-emerald-600 text-white'
                                                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                                            }`}
                                                            title={isActiveRow && isPlaying ? 'Pause' : 'Play Audio'}
                                                        >
                                                            {isActiveRow && isPlaying ? (
                                                                <Pause className="w-3.5 h-3.5" />
                                                            ) : (
                                                                <Play className="w-3.5 h-3.5 ml-0.5" />
                                                            )}
                                                        </button>

                                                        <div className="min-w-[130px]">
                                                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                                                                <span>{isActiveRow ? formatTime(currentTime) : '00:00'}</span>
                                                                <span>{formatTime(log.duration_seconds)}</span>
                                                            </div>
                                                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                                <div
                                                                    className="bg-indigo-500 h-full rounded-full transition-all"
                                                                    style={{
                                                                        width: isActiveRow && duration > 0
                                                                            ? `${(currentTime / duration) * 100}%`
                                                                            : '0%'
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] text-slate-500 italic flex items-center gap-1">
                                                        <span>Recording sync pending</span>
                                                    </span>
                                                )}
                                            </td>

                                            {/* Duration */}
                                            <td className="py-3.5 px-4">
                                                <Badge
                                                    variant={log.duration_seconds > 0 ? 'success' : 'secondary'}
                                                    size="xs"
                                                >
                                                    ⏱️ {formatTime(log.duration_seconds || 1)}
                                                </Badge>
                                            </td>

                                            {/* Date / Time */}
                                            <td className="py-3.5 px-4 text-slate-300">
                                                <div className="font-medium text-slate-200">
                                                    {new Date(log.started_at || log.created_at).toLocaleDateString([], {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric',
                                                    })}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono">
                                                    {new Date(log.started_at || log.created_at).toLocaleTimeString([], {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {hasAudio && (
                                                        <a
                                                            href={log.stream_url || log.recording_url}
                                                            download={`call_${log.customer_phone}_${log.id}.wav`}
                                                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                                            title="ডাউনলোড অডিও (.wav)"
                                                        >
                                                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                                                        </a>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => makeCall(log.customer_phone)}
                                                        className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors"
                                                        title="ব্রাউজার থেকে রি-ডায়াল করুন"
                                                    >
                                                        <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
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

                {/* Pagination */}
                {meta.last_page > 1 && (
                    <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <span>
                            পৃষ্ঠা {meta.current_page} এর {meta.last_page} (মোট {meta.total} টি রেকর্ড)
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                size="xs"
                                disabled={meta.current_page <= 1}
                                onClick={() => fetchRecordings(meta.current_page - 1)}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="secondary"
                                size="xs"
                                disabled={meta.current_page >= meta.last_page}
                                onClick={() => fetchRecordings(meta.current_page + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

