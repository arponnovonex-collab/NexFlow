import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import {
    Users,
    Plus,
    UserCheck,
    Shield,
    Trash2,
    Lock,
    Mail,
    Phone,
} from 'lucide-react';

export const TeamManagementPage = () => {
    const [users, setUsers] = useState([]);
    const [channels, setChannels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [createModal, setCreateModal] = useState(false);
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'moderator',
        phone: '',
        social_account_ids: [],
    });

    const fetchData = async () => {
        try {
            setLoading(true);
            const [usersRes, channelsRes] = await Promise.all([
                api.get('/users'),
                api.get('/social-accounts'),
            ]);
            setUsers(usersRes.data.data.data || []);
            setChannels(channelsRes.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/users', form);
            setCreateModal(false);
            setForm({ name: '', email: '', password: '', role: 'moderator', phone: '', social_account_ids: [] });
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to create user');
        }
    };

    const handleDelete = async (u) => {
        if (!confirm(`Delete user ${u.name}?`)) return;
        try {
            await api.delete(`/users/${u.id}`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete');
        }
    };

    const toggleChannelSelection = (id) => {
        setForm((prev) => ({
            ...prev,
            social_account_ids: prev.social_account_ids.includes(id)
                ? prev.social_account_ids.filter((chId) => chId !== id)
                : [...prev.social_account_ids, id],
        }));
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Team & Moderator Management
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Create independent NexFlow AI moderator accounts. Moderators handle conversations without social media admin access.
                    </p>
                </div>
                <Button variant="primary" size="sm" icon={Plus} onClick={() => setCreateModal(true)}>
                    Add Team Member
                </Button>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Member Name</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Assigned Channels</th>
                                <th className="px-4 py-3">Conversations</th>
                                <th className="px-4 py-3">Assigned Leads</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {users.map((u) => (
                                <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-2.5">
                                            <img
                                                src={u.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80'}
                                                alt={u.name}
                                                className="w-8 h-8 rounded-full object-cover"
                                            />
                                            <div>
                                                <span className="font-semibold text-slate-200 block">{u.name}</span>
                                                <span className="text-[10px] text-slate-400">{u.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <Badge
                                            variant={
                                                u.role === 'super_admin'
                                                    ? 'primary'
                                                    : u.role === 'admin'
                                                    ? 'info'
                                                    : 'neutral'
                                            }
                                            size="xs"
                                        >
                                            {u.role.replace('_', ' ')}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div className="flex flex-wrap gap-1">
                                            {u.assigned_social_accounts?.length > 0 ? (
                                                u.assigned_social_accounts.map((acc) => (
                                                    <span
                                                        key={acc.id}
                                                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300"
                                                    >
                                                        {acc.name}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-slate-500 text-[10px]">All Channels</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 font-semibold text-slate-200">
                                        {u.assigned_conversations_count || 0}
                                    </td>
                                    <td className="px-4 py-3.5 font-semibold text-slate-200">
                                        {u.assigned_leads_count || 0}
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <Badge variant={u.status === 'active' ? 'success' : 'danger'} size="xs">
                                            {u.status}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3.5 text-right">
                                        {u.role === 'super_admin' || u.email === 'atanjimurrahman@gmail.com' ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                                                Permanent Super Admin
                                            </span>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                                icon={Trash2}
                                                onClick={() => handleDelete(u)}
                                            >
                                                Delete
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Create Member Modal */}
            <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create New Moderator / Admin">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Sarah Jenkins"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Work Email</label>
                            <input
                                type="email"
                                required
                                placeholder="sarah@nexflow.ai"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Initial Password</label>
                            <input
                                type="password"
                                required
                                minLength={8}
                                placeholder="••••••••"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Role Permission Level</label>
                        <select
                            value={form.role}
                            onChange={(e) => setForm({ ...form, role: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        >
                            <option value="moderator">Moderator (Inbox, AI Suggestions, Lead Status, Follow-ups)</option>
                            <option value="admin">Admin / Team Manager (Channel, Product & Team Management)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">Assign Specific Channels</label>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                            {channels.map((ch) => (
                                <label
                                    key={ch.id}
                                    className="flex items-center gap-2 p-2 rounded bg-slate-950 border border-slate-800 text-xs text-slate-300 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={form.social_account_ids.includes(ch.id)}
                                        onChange={() => toggleChannelSelection(ch.id)}
                                        className="rounded bg-slate-900 border-slate-700 text-indigo-600"
                                    />
                                    <span>{ch.name} ({ch.platform.replace('_', ' ')})</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => setCreateModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" type="submit">
                            Create Account
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

