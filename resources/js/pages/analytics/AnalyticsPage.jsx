import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { MetricCard } from '../../components/common/MetricCard';
import {
    BarChart3,
    DollarSign,
    Cpu,
    Sparkles,
    Calendar,
    Activity,
} from 'lucide-react';

export const AnalyticsPage = () => {
    const [usage, setUsage] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                setLoading(true);
                const res = await api.get('/analytics/ai-usage');
                setUsage(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchUsage();
    }, []);

    if (loading) {
        return <div className="py-20 text-center text-xs text-slate-400">Loading AI usage analytics...</div>;
    }

    const summary = usage?.summary || {};
    const byContext = usage?.by_context || [];
    const recentLogs = usage?.recent_logs || [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    AI Usage & Cost Auditing
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                    Transparent monitoring of OpenAI token consumption, latency, and estimated cost across comment replies and inbox automations.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MetricCard
                    title="Total AI Tokens Used"
                    value={summary.total_tokens?.toLocaleString() || 0}
                    subtitle="Includes prompt context and completion tokens"
                    icon={Cpu}
                    iconColor="text-indigo-400"
                    iconBg="bg-indigo-500/10"
                />
                <MetricCard
                    title="Estimated OpenAI Cost"
                    value={`$${summary.total_cost?.toFixed(4) || '0.0000'}`}
                    subtitle="Calculated at official gpt-4o-mini pricing tier"
                    icon={DollarSign}
                    iconColor="text-emerald-400"
                    iconBg="bg-emerald-500/10"
                />
                <MetricCard
                    title="Automated Interventions"
                    value={recentLogs.length}
                    subtitle="Zero-hallucination structured inferences recorded"
                    icon={Sparkles}
                    iconColor="text-violet-400"
                    iconBg="bg-violet-500/10"
                />
            </div>

            {/* Usage by context */}
            <Card title="Token Usage by Context Type" subtitle="Breakdown across comment replies, suggestion drafts, and lead detections">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {byContext.map((c) => (
                        <div key={c.context_type} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                {c.context_type.replace('_', ' ')}
                            </span>
                            <h4 className="text-xl font-bold text-slate-100">{c.tokens?.toLocaleString()} tokens</h4>
                            <p className="text-xs text-emerald-400 font-semibold">${parseFloat(c.cost || 0).toFixed(4)}</p>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Recent AI Generation Logs */}
            <Card title="Recent AI Decision Audit Trail" subtitle="Verified logs showing prompt token consumption and model latency">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Context</th>
                                <th className="px-4 py-3">Model</th>
                                <th className="px-4 py-3">Tokens (Prompt + Comp)</th>
                                <th className="px-4 py-3">Est. Cost</th>
                                <th className="px-4 py-3">Proposed Output Preview</th>
                                <th className="px-4 py-3 text-right">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {recentLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                                    <td className="px-4 py-3">
                                        <Badge variant="primary" size="xs">
                                            {log.context_type}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                                        {log.model}
                                    </td>
                                    <td className="px-4 py-3 text-slate-300">
                                        {log.total_tokens} ({log.prompt_tokens} + {log.completion_tokens})
                                    </td>
                                    <td className="px-4 py-3 font-bold text-emerald-400">
                                        ${log.estimated_cost}
                                    </td>
                                    <td className="px-4 py-3 max-w-xs truncate text-slate-300">
                                        {log.response_payload?.reply_text || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-400">
                                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

