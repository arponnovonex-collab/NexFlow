import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ShieldCheck, RefreshCw, CheckCircle2, Code } from 'lucide-react';

export const WebhookDiagnosticsPage = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchEvents = async () => {
        try {
            setLoading(true);
            const res = await api.get('/system/webhooks');
            setEvents(res.data.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Meta Webhooks & Diagnostics
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Live incoming webhook event stream verifying idempotent signature validation and queue processing.
                    </p>
                </div>
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={fetchEvents}>
                    Refresh Ledger
                </Button>
            </div>

            {/* Webhook Endpoints Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card title="Facebook Pages & Messenger Webhook">
                    <p className="text-[11px] font-mono text-indigo-400 bg-slate-950 p-2 rounded border border-slate-800 break-all">
                        {window.location.origin}/api/webhooks/facebook
                    </p>
                    <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Challenge verification active
                    </div>
                </Card>

                <Card title="Instagram Direct Messaging Webhook">
                    <p className="text-[11px] font-mono text-pink-400 bg-slate-950 p-2 rounded border border-slate-800 break-all">
                        {window.location.origin}/api/webhooks/instagram
                    </p>
                    <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Graph API Webhook subscribed
                    </div>
                </Card>

                <Card title="WhatsApp Cloud API Webhook">
                    <p className="text-[11px] font-mono text-emerald-400 bg-slate-950 p-2 rounded border border-slate-800 break-all">
                        {window.location.origin}/api/webhooks/whatsapp
                    </p>
                    <div className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 24h Messaging Window validator
                    </div>
                </Card>
            </div>

            {/* Webhook Ledger */}
            <Card title="Raw Inbound Event Ledger" subtitle="Deduplicated idempotent event store">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Platform</th>
                                <th className="px-4 py-3">Event Type</th>
                                <th className="px-4 py-3">Event ID</th>
                                <th className="px-4 py-3">Processed Status</th>
                                <th className="px-4 py-3 text-right">Received At</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {events.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                        No recent webhook events logged. Local development simulation is active.
                                    </td>
                                </tr>
                            ) : (
                                events.map((ev) => (
                                    <tr key={ev.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3 capitalize text-slate-200">
                                            {ev.platform}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-indigo-400">
                                            {ev.event_type}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-slate-400">
                                            {ev.event_id || '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Badge variant={ev.processed ? 'success' : 'warning'} size="xs">
                                                {ev.processed ? 'Processed' : 'Queued'}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-400">
                                            {new Date(ev.created_at).toLocaleString()}
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

