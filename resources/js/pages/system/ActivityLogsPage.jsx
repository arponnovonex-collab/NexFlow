import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Activity, Shield, User, Clock } from 'lucide-react';

export const ActivityLogsPage = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                setLoading(true);
                const res = await api.get('/system/activity-logs');
                setLogs(res.data.data.data || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    Security & Activity Audit Trail
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                    Immutable event ledger recording moderator logins, configuration updates, and automated actions.
                </p>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Action</th>
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Description</th>
                                <th className="px-4 py-3">IP Address</th>
                                <th className="px-4 py-3 text-right">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                                        No activity logs recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-slate-200">
                                            {log.action}
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">
                                            {log.user?.name || 'System / Automated'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">
                                            {log.description}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-slate-400">
                                            {log.ip_address || '127.0.0.1'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-400">
                                            {new Date(log.created_at).toLocaleString()}
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

