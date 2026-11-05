import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
    BarChart3,
    Clock,
    Flame,
    CheckCircle2,
    Calendar,
    MessageSquare,
    UserCheck,
    Users,
    Send,
    RefreshCw,
    TrendingUp,
    Shield,
    CalendarDays,
    ArrowRight,
    Filter,
    Mail,
    MailCheck,
    AlertCircle,
    Timer,
    Zap,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';

export const ModeratorPerformancePage = () => {
    const formatDate = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const getTodayString = () => formatDate(new Date());

    const getYesterdayString = () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return formatDate(d);
    };

    const getLast7DaysString = () => {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        return formatDate(d);
    };

    const getThisMonthStartString = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    };

    const [preset, setPreset] = useState('today'); // 'today' | 'yesterday' | '7days' | 'month' | 'custom'
    const [startDate, setStartDate] = useState(getTodayString);
    const [endDate, setEndDate] = useState(getTodayString);
    const [performance, setPerformance] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    const handlePresetChange = (type) => {
        setPreset(type);
        const today = getTodayString();
        if (type === 'today') {
            setStartDate(today);
            setEndDate(today);
        } else if (type === 'yesterday') {
            const yesterday = getYesterdayString();
            setStartDate(yesterday);
            setEndDate(yesterday);
        } else if (type === '7days') {
            setStartDate(getLast7DaysString());
            setEndDate(today);
        } else if (type === 'month') {
            setStartDate(getThisMonthStartString());
            setEndDate(today);
        }
    };

    const fetchPerformance = async (start = startDate, end = endDate) => {
        try {
            setLoading(true);
            const res = await api.get(`/analytics/moderators?start_date=${start}&end_date=${end}`);
            setPerformance(res.data.data || []);
            setSummary(res.data.summary || null);
        } catch (err) {
            console.error('Failed to load moderator performance:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPerformance(startDate, endDate);
    }, [startDate, endDate]);

    const chartData = performance.map((p) => ({
        name: p.name,
        'Customers Handled': p.customers_handled ?? p.customers_handled_today ?? 0,
        'Messages Sent': p.messages_sent_range ?? p.messages_sent_today ?? 0,
        'Converted Orders': p.converted_leads_range ?? 0,
    }));

    const getDateRangeLabel = () => {
        if (startDate === endDate) {
            if (startDate === getTodayString()) return 'Today (আজকের পারফরম্যান্স)';
            if (startDate === getYesterdayString()) return 'Yesterday (গতকালের পারফরম্যান্স)';
            return `Single Date: ${startDate}`;
        }
        return `Custom Range: ${startDate} to ${endDate}`;
    };

    return (
        <div className="space-y-6">
            {/* Page Header & Comprehensive Filter Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                        <UserCheck className="w-6 h-6 text-indigo-400" />
                        Moderator Performance & Handling Analytics
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Track customer interactions, handled customer volume, chat replies, and conversion throughput per moderator over any date range.
                    </p>
                </div>

                {/* Filter Toolbar with Preset & Custom Range Controls */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Presets: Today, Yesterday, Last 7 Days, This Month */}
                    <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-1">
                        <button
                            type="button"
                            onClick={() => handlePresetChange('today')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                                preset === 'today'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePresetChange('yesterday')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                                preset === 'yesterday'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            Yesterday
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePresetChange('7days')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                                preset === '7days'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            Last 7 Days
                        </button>
                        <button
                            type="button"
                            onClick={() => handlePresetChange('month')}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                                preset === 'month'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            This Month
                        </button>
                    </div>

                    {/* Custom Range: Start Date & End Date */}
                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
                        <CalendarDays className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="text-[11px] text-slate-400 font-medium">From:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                if (e.target.value) {
                                    setPreset('custom');
                                    setStartDate(e.target.value);
                                }
                            }}
                            className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                        />
                        <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="text-[11px] text-slate-400 font-medium">To:</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                if (e.target.value) {
                                    setPreset('custom');
                                    setEndDate(e.target.value);
                                }
                            }}
                            className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => fetchPerformance(startDate, endDate)}
                        disabled={loading}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                        title="Refresh data"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Active Range Indicator Pill */}
            <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800/80 px-4 py-2 rounded-xl text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                    <Filter className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Filtering:</span>
                    <span className="font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                        {getDateRangeLabel()}
                    </span>
                </div>
                <div className="text-[11px] text-slate-400">
                    {summary?.is_single_day ? '1 Day Selected' : `From ${startDate} to ${endDate}`}
                </div>
            </div>

            {/* Range KPI Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-medium">Customers Handled</span>
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <Users className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 text-2xl font-black text-white">
                        {summary?.total_customers_handled ?? 0}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400 truncate">
                        Distinct customers handled in period
                    </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-medium">Messages Sent</span>
                        <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            <Send className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 text-2xl font-black text-white">
                        {summary?.total_messages_sent ?? 0}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400 truncate">
                        Total moderator chat replies in period
                    </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-medium">FB Comments Replied</span>
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <MessageSquare className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 text-2xl font-black text-white">
                        {summary?.total_comments_replied ?? 0}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400 truncate">
                        Approved & manual comment replies
                    </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-medium">Avg Response Time</span>
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 text-2xl font-black text-amber-300">
                        {summary?.avg_response_time_formatted || 'No replies yet'}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400 truncate">
                        {summary?.total_replies_timed ?? 0} customer replies timed
                    </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-medium">Active Moderators</span>
                        <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            <UserCheck className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 text-2xl font-black text-white">
                        {summary?.active_moderators_count ?? 0}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400 truncate">
                        Active staff with replies in range
                    </div>
                </div>
            </div>

            {/* Date-Selected Read & Unread Messages Audit Box */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <Mail className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white flex items-center gap-2">
                                Customer Messages & Read Status (মেসেজ রিড ও আনরিড অডিট)
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Live status of customer inquiries received in this period ({getDateRangeLabel()})
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700/80">
                            Read Rate: <span className="text-emerald-400 font-bold">{summary?.read_rate_percentage ?? 100}%</span>
                        </span>
                        {(summary?.unread_messages_count ?? 0) > 0 ? (
                            <Link
                                to="/inbox?filter=unread"
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
                            >
                                View {summary.unread_messages_count} Unread in Inbox
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                All Read (সব পড়া হয়েছে)
                            </span>
                        )}
                    </div>
                </div>

                {/* Stat Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                    {/* Total Incoming Messages */}
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex items-center gap-3.5">
                        <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-medium text-slate-400">Total Customer Inbound (মোট মেসেজ)</div>
                            <div className="text-2xl font-black text-white mt-0.5">
                                {summary?.total_customer_messages ?? 0}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                                Received from {summary?.active_conversations_count ?? 0} active conversations
                            </div>
                        </div>
                    </div>

                    {/* Read Messages */}
                    <div className="bg-slate-950/60 border border-emerald-900/30 rounded-xl p-4 flex items-center gap-3.5">
                        <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-medium text-emerald-400">Read Messages (পড়া হয়েছে / রিড)</div>
                            <div className="text-2xl font-black text-emerald-300 mt-0.5">
                                {summary?.read_messages_count ?? 0}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                                {summary?.read_rate_percentage ?? 100}% of received messages attended
                            </div>
                        </div>
                    </div>

                    {/* Unread Messages */}
                    <div className="bg-slate-950/60 border border-amber-900/30 rounded-xl p-4 flex items-center gap-3.5">
                        <div className={`p-2.5 rounded-lg border shrink-0 ${
                            (summary?.unread_messages_count ?? 0) > 0
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-medium text-amber-300">Unread Messages (অপঠিত / আনরিড)</div>
                            <div className={`text-2xl font-black mt-0.5 ${
                                (summary?.unread_messages_count ?? 0) > 0 ? 'text-amber-400' : 'text-slate-400'
                            }`}>
                                {summary?.unread_messages_count ?? 0}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                                {summary?.unread_conversations_count ?? 0} chats currently waiting for reply
                            </div>
                        </div>
                    </div>
                </div>

                {/* Visual Progress Bar */}
                {(summary?.total_customer_messages ?? 0) > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800/60">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 font-medium">
                            <span>Read vs Unread Ratio:</span>
                            <span>
                                <span className="text-emerald-400 font-bold">{summary?.read_messages_count ?? 0} Read</span>
                                {' / '}
                                <span className="text-amber-400 font-bold">{summary?.unread_messages_count ?? 0} Unread</span>
                            </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
                            <div
                                style={{ width: `${summary?.read_rate_percentage ?? 100}%` }}
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                                title={`Read: ${summary?.read_messages_count ?? 0}`}
                            />
                            <div
                                style={{ width: `${100 - (summary?.read_rate_percentage ?? 100)}%` }}
                                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500"
                                title={`Unread: ${summary?.unread_messages_count ?? 0}`}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Performance Visual Chart */}
            <Card
                title={`Moderator Activity Overview (${getDateRangeLabel()})`}
                subtitle="Comparison of unique customers handled, chat messages sent, and verified order conversions"
            >
                <div className="h-64 w-full pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                            <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#0f172a',
                                    borderColor: '#1e293b',
                                    borderRadius: '0.75rem',
                                    fontSize: '12px',
                                }}
                            />
                            <Legend
                                wrapperStyle={{
                                    fontSize: '11px',
                                    paddingTop: '8px',
                                }}
                            />
                            <Bar dataKey="Customers Handled" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Messages Sent" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Converted Orders" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Performance Table */}
            <Card
                title="Moderator Performance Details"
                subtitle={`Showing metrics for selected period (${startDate} to ${endDate}) alongside all-time stats`}
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Moderator</th>
                                <th className="px-4 py-3 text-center">
                                    <span className="text-indigo-400">Handled in Period</span>
                                </th>
                                <th className="px-4 py-3 text-center">Messages Sent (Range)</th>
                                <th className="px-4 py-3 text-center">Avg Response Time</th>
                                <th className="px-4 py-3 text-center">FB Comments (Range)</th>
                                <th className="px-4 py-3 text-center">Converted (Range)</th>
                                <th className="px-4 py-3 text-center">Total Handled (All Time)</th>
                                <th className="px-4 py-3 text-center">Assigned Chats</th>
                                <th className="px-4 py-3 text-center">All-Time Converted</th>
                                <th className="px-4 py-3 text-right">Conversion Rate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {performance.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-8 text-slate-500">
                                        {loading ? 'Loading moderator metrics...' : 'No moderator data found for this date range.'}
                                    </td>
                                </tr>
                            ) : (
                                performance.map((m) => (
                                    <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                {m.avatar_url && !m.avatar_url.includes('unsplash.com') ? (
                                                    <img
                                                        src={m.avatar_url}
                                                        alt={m.name}
                                                        referrerPolicy="no-referrer"
                                                        className="w-8 h-8 rounded-full object-cover border border-slate-700"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xs flex items-center justify-center border border-slate-700 uppercase">
                                                        {(m.name || 'U').split(' ').map((p) => p[0]).slice(0, 2).join('')}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-semibold text-slate-200">{m.name}</span>
                                                        <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                                                            m.role === 'admin' || m.role === 'super_admin'
                                                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                                : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                                        }`}>
                                                            {m.role}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400">{m.email}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold text-xs">
                                                <Users className="w-3 h-3 text-indigo-400" />
                                                {m.customers_handled ?? m.customers_handled_today ?? 0} customers
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-center font-semibold text-cyan-300">
                                            {m.messages_sent_range ?? m.messages_sent_today ?? 0}
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                m.avg_response_time_seconds !== null && m.avg_response_time_seconds < 120
                                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                                    : m.avg_response_time_seconds !== null && m.avg_response_time_seconds < 600
                                                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                                                    : m.avg_response_time_formatted && m.avg_response_time_formatted !== 'No replies yet'
                                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                                    : 'text-slate-500'
                                            }`}>
                                                <Clock className="w-3 h-3 shrink-0" />
                                                {m.avg_response_time_formatted || (m.avg_first_response_min ? `${m.avg_first_response_min}m` : 'No replies')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-center text-emerald-400 font-medium">
                                            {m.comments_replied_range ?? m.comments_replied_today ?? 0}
                                        </td>
                                        <td className="px-4 py-3.5 text-center font-semibold text-emerald-400">
                                            {m.converted_leads_range ?? 0} orders
                                        </td>
                                        <td className="px-4 py-3.5 text-center font-semibold text-slate-300">
                                            {m.total_customers_handled}
                                        </td>
                                        <td className="px-4 py-3.5 text-center text-slate-400">
                                            {m.assigned_conversations}
                                        </td>
                                        <td className="px-4 py-3.5 text-center">
                                            <span className="font-bold text-emerald-400">{m.converted_leads} orders</span>
                                        </td>
                                        <td className="px-4 py-3.5 text-right font-bold text-indigo-400">
                                            {m.conversion_rate}%
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
