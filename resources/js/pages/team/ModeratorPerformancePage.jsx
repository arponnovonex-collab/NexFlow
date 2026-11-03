import React, { useEffect, useState } from 'react';
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
    const getTodayString = () => new Date().toISOString().split('T')[0];
    const getYesterdayString = () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d.toISOString().split('T')[0];
    };

    const [selectedDate, setSelectedDate] = useState(getTodayString);
    const [performance, setPerformance] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchPerformance = async (date = selectedDate) => {
        try {
            setLoading(true);
            const res = await api.get(`/analytics/moderators?date=${date}`);
            setPerformance(res.data.data || []);
            setSummary(res.data.summary || null);
        } catch (err) {
            console.error('Failed to load moderator performance:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPerformance(selectedDate);
    }, [selectedDate]);

    const chartData = performance.map((p) => ({
        name: p.name,
        'Customers Handled': p.customers_handled_today || 0,
        'Messages Sent': p.messages_sent_today || 0,
        'Converted Orders': p.converted_leads || 0,
    }));

    const isToday = selectedDate === getTodayString();
    const isYesterday = selectedDate === getYesterdayString();

    return (
        <div className="space-y-6">
            {/* Page Header & Date Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                        <UserCheck className="w-6 h-6 text-indigo-400" />
                        Moderator Performance Analytics
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Track daily customer interactions, handled customer count, messages sent, and conversion throughput per moderator.
                    </p>
                </div>

                {/* Filter Toolbar */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-1">
                        <button
                            type="button"
                            onClick={() => setSelectedDate(getTodayString())}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                                isToday
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            Today
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedDate(getYesterdayString())}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                                isYesterday
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            Yesterday
                        </button>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                            className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => fetchPerformance(selectedDate)}
                        disabled={loading}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                        title="Refresh data"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Daily KPI Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                    <div className="mt-1 text-[11px] text-slate-400">
                        Distinct customers replied on {isToday ? 'today' : selectedDate}
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
                    <div className="mt-1 text-[11px] text-slate-400">
                        Inbox chat replies on {isToday ? 'today' : selectedDate}
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
                    <div className="mt-1 text-[11px] text-slate-400">
                        Approved & manual comment replies
                    </div>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-xs font-medium">Active Moderators</span>
                        <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            <UserCheck className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 text-2xl font-black text-white">
                        {summary?.active_moderators_count ?? 0}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                        Moderators active on {isToday ? 'today' : selectedDate}
                    </div>
                </div>
            </div>

            {/* Performance Visual Chart */}
            <Card
                title={`Moderator Activity Breakdown (${isToday ? 'Today' : selectedDate})`}
                subtitle="Side-by-side comparison of unique customers handled, total messages sent, and converted orders"
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
                subtitle={`Showing detailed metrics for ${isToday ? 'today' : selectedDate} and all-time totals`}
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Moderator</th>
                                <th className="px-4 py-3 text-center">
                                    <span className="text-indigo-400">Handled on {isToday ? 'Today' : selectedDate}</span>
                                </th>
                                <th className="px-4 py-3 text-center">Messages Sent (Date)</th>
                                <th className="px-4 py-3 text-center">FB Comments (Date)</th>
                                <th className="px-4 py-3 text-center">Total Handled (All Time)</th>
                                <th className="px-4 py-3 text-center">Assigned Chats</th>
                                <th className="px-4 py-3 text-center">Converted Sales</th>
                                <th className="px-4 py-3 text-right">Conversion Rate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {performance.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-8 text-slate-500">
                                        {loading ? 'Loading moderator metrics...' : 'No moderator data found.'}
                                    </td>
                                </tr>
                            ) : (
                                performance.map((m) => (
                                    <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <img
                                                    src={m.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                                                    alt={m.name}
                                                    className="w-8 h-8 rounded-full object-cover border border-slate-700"
                                                />
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-semibold text-slate-200">{m.name}</span>
                                                        <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                                                            m.role === 'admin'
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
                                                {m.customers_handled_today} customers
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 text-center font-semibold text-cyan-300">
                                            {m.messages_sent_today}
                                        </td>
                                        <td className="px-4 py-3.5 text-center text-emerald-400 font-medium">
                                            {m.comments_replied_today}
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
