import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { CustomerAvatar } from '../../components/common/CustomerAvatar';
import {
    Users,
    Search,
    Phone,
    Mail,
    MessageSquare,
    ShoppingBag,
    PhoneCall,
} from 'lucide-react';

export const CustomersPage = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const res = await api.get('/customers', { params: { search } });
            setCustomers(res.data.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, [search]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Customers Directory
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Unified customer directory linking Facebook, Instagram, and WhatsApp identities with verified order histories.
                    </p>
                </div>
            </div>

            <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    placeholder="Search by customer name, email, or phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Customer Profile</th>
                                <th className="px-4 py-3">Contact</th>
                                <th className="px-4 py-3">Connected Channels</th>
                                <th className="px-4 py-3">Conversations</th>
                                <th className="px-4 py-3">Orders Placed</th>
                                <th className="px-4 py-3">Internal Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {customers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                        No customer records found.
                                    </td>
                                </tr>
                            ) : (
                                customers.map((c) => (
                                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <CustomerAvatar
                                                    name={c.name}
                                                    avatarUrl={c.avatar_url}
                                                    size="md"
                                                />
                                                <div>
                                                    <span className="font-semibold text-slate-200 block">{c.name}</span>
                                                    <span className="text-[10px] text-slate-400">ID: #{c.id}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 space-y-0.5">
                                            <div className="flex items-center gap-1.5 text-slate-300">
                                                <Phone className="w-3 h-3 text-slate-500" />
                                                <span>{c.phone || '—'}</span>
                                                {c.phone && (
                                                    <Link
                                                        to={`/call-center/ip-call?phone=${encodeURIComponent(c.phone)}`}
                                                        className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors"
                                                        title="IP Call দিন (ePBX)"
                                                    >
                                                        <PhoneCall className="w-3 h-3" />
                                                    </Link>
                                                )}
                                            </div>
                                            {c.email && (
                                                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                                                    <Mail className="w-3 h-3 text-slate-500" />
                                                    {c.email}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1">
                                                {c.channel_identities?.map((ch) => (
                                                    <span
                                                        key={ch.id}
                                                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 capitalize"
                                                    >
                                                        {ch.platform.replace('_', ' ')}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="font-semibold text-slate-200">{c.conversations_count || 0}</span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <Badge variant={c.orders_count > 0 ? 'success' : 'neutral'} size="xs">
                                                {c.orders_count || 0} verified
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-400 max-w-xs truncate">
                                            {c.notes || '—'}
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
