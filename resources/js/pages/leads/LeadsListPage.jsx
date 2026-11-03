import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import {
    Users,
    Search,
    Flame,
    Filter,
    Calendar,
    PhoneCall,
    ShoppingBag,
    CheckCircle2,
    ArrowRight,
} from 'lucide-react';

export const LeadsListPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
    const [statusModal, setStatusModal] = useState(null);
    const [newStatus, setNewStatus] = useState('warm');
    const [reason, setReason] = useState('');

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const params = {};
            if (statusFilter) params.status = statusFilter;
            if (search) params.search = search;

            const res = await api.get('/leads', { params });
            setLeads(res.data.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeads();
    }, [statusFilter, search]);

    const handleOpenStatusModal = (lead) => {
        setStatusModal(lead);
        setNewStatus(lead.status);
        setReason('');
    };

    const handleUpdateStatus = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/leads/${statusModal.id}/status`, {
                status: newStatus,
                reason,
            });
            setStatusModal(null);
            fetchLeads();
        } catch (err) {
            alert('Failed to update lead status');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Lead Management CRM
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Track customer purchase intent across Cold, Warm, Hot, and Converted stages with AI confidence scoring.
                    </p>
                </div>
            </div>

            {/* Quick Status Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                    { id: '', label: 'All Leads' },
                    { id: 'cold', label: 'Cold Leads' },
                    { id: 'warm', label: 'Warm Leads' },
                    { id: 'hot', label: 'Hot Leads' },
                    { id: 'converted', label: 'Converted' },
                    { id: 'lost', label: 'Lost' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setStatusFilter(tab.id);
                            setSearchParams(tab.id ? { status: tab.id } : {});
                        }}
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

            {/* Search Input */}
            <div className="relative max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    placeholder="Search by customer name or phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                />
            </div>

            {/* Leads Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Platform</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">AI Recommendation</th>
                                <th className="px-4 py-3">Assigned Moderator</th>
                                <th className="px-4 py-3">Related Product</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {leads.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                        No leads found matching criteria.
                                    </td>
                                </tr>
                            ) : (
                                leads.map((l) => (
                                    <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <img
                                                    src={l.customer?.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80'}
                                                    alt={l.customer?.name}
                                                    className="w-8 h-8 rounded-full object-cover"
                                                />
                                                <div>
                                                    <span className="font-semibold text-slate-200 block">{l.customer?.name}</span>
                                                    <span className="text-[10px] text-slate-400">{l.customer?.phone || 'No phone'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="capitalize text-slate-300">
                                                {l.conversation?.platform?.replace('_', ' ') || 'Web'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <Badge variant={l.status} size="sm">
                                                {l.status}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            {l.suggested_status ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Badge variant={l.suggested_status} size="xs">
                                                        AI: {l.suggested_status}
                                                    </Badge>
                                                    <span className="text-[10px] text-slate-400">
                                                        {(l.confidence * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-500">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-300">
                                            {l.assigned_user?.name || 'Unassigned'}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            {l.related_product ? (
                                                <span className="font-medium text-indigo-300">
                                                    {l.related_product.name}
                                                </span>
                                            ) : (
                                                <span className="text-slate-500">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <Button
                                                variant="secondary"
                                                size="xs"
                                                onClick={() => handleOpenStatusModal(l)}
                                            >
                                                Change Status
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Change Status Modal */}
            <Modal
                isOpen={!!statusModal}
                onClose={() => setStatusModal(null)}
                title={`Transition Lead Status: ${statusModal?.customer?.name}`}
            >
                <form onSubmit={handleUpdateStatus} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Select New Status</label>
                        <select
                            value={newStatus}
                            onChange={(e) => setNewStatus(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 capitalize"
                        >
                            <option value="cold">Cold Lead</option>
                            <option value="warm">Warm Lead</option>
                            <option value="hot">Hot Lead</option>
                            <option value="converted">Converted (Verified Order)</option>
                            <option value="lost">Lost</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Reason / Note</label>
                        <textarea
                            rows={3}
                            placeholder="Reason for status change..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        ></textarea>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => setStatusModal(null)}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" type="submit">
                            Save Transition
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
