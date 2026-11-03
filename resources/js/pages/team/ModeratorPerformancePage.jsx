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
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';

export const ModeratorPerformancePage = () => {
    const [performance, setPerformance] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPerformance = async () => {
            try {
                setLoading(true);
                const res = await api.get('/analytics/moderators');
                setPerformance(res.data.data || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchPerformance();
    }, []);

    const chartData = performance.map((p) => ({
        name: p.name,
        conversations: p.assigned_conversations,
        converted: p.converted_leads,
    }));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    Moderator Performance Analytics
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                    Evaluate moderator response latency, conversation throughput, follow-up completions, and verified lead conversions.
                </p>
            </div>

            {/* Performance Visual Chart */}
            <Card title="Conversion Throughput by Team Member" subtitle="Assigned leads vs verified customer orders">
                <div className="h-60 w-full pt-4">
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
                            <Bar dataKey="conversations" fill="#6366f1" radius={[4, 4, 0, 0]} name="Assigned Chats" />
                            <Bar dataKey="converted" fill="#10b981" radius={[4, 4, 0, 0]} name="Converted Orders" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Performance Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Moderator</th>
                                <th className="px-4 py-3">Assigned Chats</th>
                                <th className="px-4 py-3">Messages Sent</th>
                                <th className="px-4 py-3">Avg Response Time</th>
                                <th className="px-4 py-3">Follow-ups Done</th>
                                <th className="px-4 py-3">Converted Sales</th>
                                <th className="px-4 py-3 text-right">Conversion Rate</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {performance.map((m) => (
                                <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-2.5">
                                            <img
                                                src={m.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                                                alt={m.name}
                                                className="w-8 h-8 rounded-full object-cover"
                                            />
                                            <span className="font-semibold text-slate-200">{m.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 font-semibold text-slate-200">
                                        {m.assigned_conversations}
                                    </td>
                                    <td className="px-4 py-3.5 text-slate-300">
                                        {m.messages_sent}
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <span className="font-medium text-cyan-400">{m.avg_first_response_min} min</span>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <span className="text-emerald-400 font-semibold">{m.followups_completed}</span>
                                        <span className="text-[10px] text-slate-400"> ({m.followups_pending} due)</span>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <span className="font-bold text-emerald-400">{m.converted_leads} orders</span>
                                    </td>
                                    <td className="px-4 py-3.5 text-right font-bold text-indigo-400">
                                        {m.conversion_rate}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

