import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
    Calendar,
    PhoneCall,
    CheckCircle2,
    AlertCircle,
    Clock,
    User,
    ShoppingBag,
    RefreshCw,
} from 'lucide-react';

export const FollowupsPage = () => {
    const [followups, setFollowups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');

    const fetchFollowups = async () => {
        try {
            setLoading(true);
            const params = {};
            if (statusFilter) params.status = statusFilter;

            const res = await api.get('/followups', { params });
            setFollowups(res.data.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFollowups();
    }, [statusFilter]);

    const handleMarkComplete = async (f) => {
        try {
            await api.put(`/followups/${f.id}`, { status: 'completed' });
            fetchFollowups();
        } catch (err) {
            alert('Failed to update follow-up');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Lead Follow-up Reminders
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Scheduled moderator tasks to ensure timely customer phone calls, inquiries, and checkout conversions.
                    </p>
                </div>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                    { id: '', label: 'All Tasks' },
                    { id: 'due_today', label: 'Due Today' },
                    { id: 'overdue', label: 'Overdue Alerts' },
                    { id: 'scheduled', label: 'Upcoming' },
                    { id: 'completed', label: 'Completed' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setStatusFilter(tab.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                            statusFilter === tab.id
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Followups List */}
            <Card>
                <div className="divide-y divide-slate-800/60">
                    {followups.length === 0 ? (
                        <div className="py-12 text-center text-xs text-slate-400">
                            No follow-up reminders scheduled.
                        </div>
                    ) : (
                        followups.map((f) => {
                            const isDone = f.status === 'completed';
                            const isOverdue = f.status === 'overdue';

                            return (
                                <div key={f.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <div
                                            className={`p-2.5 rounded-xl shrink-0 ${
                                                isDone
                                                    ? 'bg-slate-800 text-slate-500'
                                                    : f.priority === 'high'
                                                    ? 'bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30'
                                                    : 'bg-indigo-500/10 text-indigo-400'
                                            }`}
                                        >
                                            <PhoneCall className="w-5 h-5" />
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold ${isDone ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                                                    {f.lead?.customer?.name || 'Customer'}
                                                </span>
                                                <Badge
                                                    variant={
                                                        f.priority === 'high'
                                                            ? 'danger'
                                                            : f.priority === 'medium'
                                                            ? 'warning'
                                                            : 'neutral'
                                                    }
                                                    size="xs"
                                                >
                                                    {f.priority} priority
                                                </Badge>
                                                <Badge
                                                    variant={
                                                        f.status === 'completed'
                                                            ? 'success'
                                                            : f.status === 'due_today'
                                                            ? 'warning'
                                                            : f.status === 'overdue'
                                                            ? 'danger'
                                                            : 'primary'
                                                    }
                                                    size="xs"
                                                >
                                                    {f.status.replace('_', ' ')}
                                                </Badge>
                                            </div>

                                            <p className="text-xs text-slate-300">{f.notes}</p>

                                            <div className="flex items-center gap-4 text-[10px] text-slate-400 pt-1">
                                                <span className="flex items-center gap-1">
                                                    <Calendar className="w-3 h-3 text-slate-500" />
                                                    Date: {f.followup_date} at {f.followup_time || 'Anytime'}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3 h-3 text-slate-500" />
                                                    Moderator: {f.user?.name}
                                                </span>
                                                {f.lead?.related_product && (
                                                    <span className="flex items-center gap-1 text-indigo-300">
                                                        <ShoppingBag className="w-3 h-3" />
                                                        {f.lead.related_product.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-center">
                                        {!isDone ? (
                                            <Button
                                                variant="success"
                                                size="xs"
                                                icon={CheckCircle2}
                                                onClick={() => handleMarkComplete(f)}
                                            >
                                                Mark Done
                                            </Button>
                                        ) : (
                                            <span className="text-xs text-emerald-400 flex items-center gap-1">
                                                <CheckCircle2 className="w-4 h-4" /> Completed
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </Card>
        </div>
    );
};

