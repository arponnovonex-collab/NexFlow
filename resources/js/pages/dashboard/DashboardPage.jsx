import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { MetricCard } from '../../components/common/MetricCard';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { CustomerAvatar } from '../../components/common/CustomerAvatar';
import {
    Share2,
    MessageSquare,
    Bot,
    Flame,
    Users,
    Calendar,
    AlertCircle,
    ArrowRight,
    TrendingUp,
    Clock,
    DollarSign,
    ShieldCheck,
    PhoneCall,
    Sparkles,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
} from 'recharts';

export const DashboardPage = () => {
    const navigate = useNavigate();
    const { user, isAdmin } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const res = await api.get('/dashboard/metrics');
                setData(res.data.data);
            } catch (err) {
                console.error('Failed to load dashboard metrics', err);
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs text-slate-400">Loading live business metrics...</p>
                </div>
            </div>
        );
    }

    const metrics = data?.metrics || {};
    const leadFunnel = data?.lead_funnel || [];
    const platformBreakdown = [
        { name: 'Facebook', value: data?.platform_breakdown?.facebook || 0, color: '#3b82f6' },
        { name: 'Instagram', value: data?.platform_breakdown?.instagram || 0, color: '#ec4899' },
        { name: 'WhatsApp', value: data?.platform_breakdown?.whatsapp || 0, color: '#10b981' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header & Greeting */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Welcome back, {user?.name}
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Here is the live omnichannel pulse across your Facebook, Instagram, and WhatsApp channels.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate('/automation/playground')}
                        icon={Bot}
                    >
                        AI Playground
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate('/inbox')}
                        icon={ArrowRight}
                    >
                        Open Unified Inbox
                    </Button>
                </div>
            </div>

            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="Connected Channels"
                    value={metrics.connected_accounts}
                    subtitle={`${metrics.facebook_pages} FB Pages · ${metrics.instagram_accounts} IG · ${metrics.whatsapp_numbers} WA`}
                    icon={Share2}
                    iconColor="text-indigo-400"
                    iconBg="bg-indigo-500/10"
                    onClick={() => navigate('/connections')}
                />
                <MetricCard
                    title="FB Comment Automation"
                    value={metrics.automated_comment_replies}
                    subtitle={`${metrics.comments_received} comments auto-answered with verified prices`}
                    icon={MessageSquare}
                    iconColor="text-blue-400"
                    iconBg="bg-blue-500/10"
                    onClick={() => navigate('/automation/comments')}
                />
                <MetricCard
                    title="Hot Purchase Leads"
                    value={metrics.hot_leads}
                    subtitle={`${metrics.warm_leads} warm inquiring leads in pipeline`}
                    change="+24% this week"
                    isPositive={true}
                    icon={Flame}
                    iconColor="text-orange-400"
                    iconBg="bg-orange-500/10"
                    onClick={() => navigate('/leads?status=hot')}
                />
                <MetricCard
                    title="Follow-ups Due Today"
                    value={metrics.today_followups}
                    subtitle={`${metrics.overdue_followups} overdue pending calls/chats`}
                    icon={Calendar}
                    iconColor="text-emerald-400"
                    iconBg="bg-emerald-500/10"
                    onClick={() => navigate('/leads/followups')}
                />
            </div>

            {/* AI Usage & Cost Summary Bar */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-200">OpenAI Automation Intelligence</p>
                        <p className="text-[11px] text-slate-400">
                            Zero-hallucination engine verified against your MySQL Product Catalog & Variant Stock
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-right">
                        <span className="text-[11px] text-slate-400 block">Total Tokens Used</span>
                        <span className="text-sm font-bold text-slate-200">{metrics.total_ai_tokens?.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-[11px] text-slate-400 block">Est. OpenAI Cost</span>
                        <span className="text-sm font-bold text-emerald-400">${metrics.estimated_ai_cost?.toFixed(3)}</span>
                    </div>
                    <div className="text-right">
                        <span className="text-[11px] text-slate-400 block">Avg Response Time</span>
                        <span className="text-sm font-bold text-cyan-400">{metrics.avg_response_time_minutes} min</span>
                    </div>
                </div>
            </div>

            {/* Visual Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Lead Funnel Chart */}
                <Card
                    title="Sales CRM Lead Funnel"
                    subtitle="Progression from incoming inquiry to verified customer order"
                    className="lg:col-span-2"
                >
                    <div className="h-64 w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={leadFunnel} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#0f172a',
                                        borderColor: '#1e293b',
                                        borderRadius: '0.75rem',
                                        color: '#f8fafc',
                                        fontSize: '12px',
                                    }}
                                />
                                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                    {leadFunnel.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Platform Distribution */}
                <Card
                    title="Omnichannel Volume"
                    subtitle="Active conversation share per platform"
                >
                    <div className="h-48 w-full flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={platformBreakdown}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={75}
                                    paddingAngle={4}
                                    dataKey="value"
                                >
                                    {platformBreakdown.map((entry, index) => (
                                        <Cell key={`pie-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: '#0f172a',
                                        borderColor: '#1e293b',
                                        borderRadius: '0.5rem',
                                        fontSize: '12px',
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-2 space-y-1.5 border-t border-slate-800/80 pt-3">
                        {platformBreakdown.map((p) => (
                            <div key={p.name} className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-2 text-slate-300">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }}></span>
                                    {p.name}
                                </span>
                                <span className="font-semibold text-slate-200">{p.value} active</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            {/* Bottom Section: Urgent Follow-ups & Recent Conversations */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Due Follow-ups */}
                <Card
                    title="Scheduled Moderator Follow-ups"
                    subtitle="Upcoming and due customer outreach actions"
                    action={
                        <Button variant="ghost" size="xs" onClick={() => navigate('/leads/followups')}>
                            View Calendar
                        </Button>
                    }
                >
                    <div className="divide-y divide-slate-800/60">
                        {data?.upcoming_followups?.length > 0 ? (
                            data.upcoming_followups.map((f) => (
                                <div key={f.id} className="py-3 flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5">
                                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5">
                                            <PhoneCall className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-slate-200">
                                                    {f.lead?.customer?.name || 'Customer'}
                                                </span>
                                                <Badge variant={f.priority === 'high' ? 'danger' : 'warning'} size="xs">
                                                    {f.priority}
                                                </Badge>
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-0.5">{f.notes}</p>
                                            {f.lead?.related_product && (
                                                <span className="text-[10px] text-slate-400 mt-1 block">
                                                    Product: {f.lead.related_product.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-xs font-medium text-slate-300 block">{f.followup_date}</span>
                                        <span className="text-[10px] text-slate-400">{f.followup_time || 'Anytime'}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="py-6 text-center text-xs text-slate-400">No pending follow-ups scheduled for today.</p>
                        )}
                    </div>
                </Card>

                {/* Recent Live Conversations */}
                <Card
                    title="Recent Omnichannel Conversations"
                    subtitle="Latest customer touchpoints across all channels"
                    action={
                        <Button variant="ghost" size="xs" onClick={() => navigate('/inbox')}>
                            Open Inbox
                        </Button>
                    }
                >
                    <div className="divide-y divide-slate-800/60">
                        {data?.recent_conversations?.length > 0 ? (
                            data.recent_conversations.map((c) => (
                                <div
                                    key={c.id}
                                    onClick={() => navigate(`/inbox?conversation=${c.id}`)}
                                    className="py-3 flex items-start justify-between gap-3 hover:bg-slate-800/40 px-2 rounded-lg transition-colors cursor-pointer"
                                >
                                    <div className="flex items-start gap-2.5">
                                        <div className="relative">
                                            <CustomerAvatar
                                                name={c.customer?.name}
                                                avatarUrl={c.customer?.avatar_url}
                                                size="sm"
                                            />
                                            <span
                                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                                                    c.platform === 'facebook_page'
                                                        ? 'bg-blue-500'
                                                        : c.platform === 'instagram_business'
                                                        ? 'bg-pink-500'
                                                        : 'bg-emerald-500'
                                                }`}
                                            ></span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-slate-200">
                                                    {c.customer?.name}
                                                </span>
                                                <Badge variant={c.ai_mode === 'auto' ? 'primary' : 'neutral'} size="xs">
                                                    {c.ai_mode === 'auto' ? 'AI Auto' : 'Manual'}
                                                </Badge>
                                            </div>
                                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                                                {c.latest_message?.text || 'No message'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className="text-[10px] text-slate-400 block">
                                            {c.social_account?.name}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="py-6 text-center text-xs text-slate-400">No active conversations found.</p>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};
