import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Facebook, Instagram } from '../../components/common/SocialIcons';
import {
    Share2,
    CheckCircle2,
    AlertTriangle,
    RefreshCw,
    Plus,
    Activity,
    Shield,
    Trash2,
    Sliders,
    PhoneCall,
    ExternalLink,
} from 'lucide-react';

export const SocialConnectionsPage = () => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [diagnosticsModal, setDiagnosticsModal] = useState(null);
    const [connectModal, setConnectModal] = useState(false);
    const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [connectForm, setConnectForm] = useState({
        platform: 'facebook_page',
        name: '',
        account_id: '',
        username: '',
        access_token: '',
    });

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const res = await api.get('/social-accounts');
            setAccounts(res.data.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const runDiagnostics = async (account) => {
        setDiagnosticsLoading(true);
        try {
            const res = await api.get(`/social-accounts/${account.id}/diagnostics`);
            setDiagnosticsModal({ account, data: res.data });
        } catch (err) {
            alert('Failed to run diagnostics');
        } finally {
            setDiagnosticsLoading(false);
        }
    };

    const handleConnectSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/social-accounts', connectForm);
            setConnectModal(false);
            setConnectForm({ platform: 'facebook_page', name: '', account_id: '', username: '', access_token: '' });
            fetchAccounts();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to connect account');
        }
    };

    const handleDisconnectChannel = async (account) => {
        const confirmed = window.confirm(
            `Are you sure you want to disconnect "${account.name}"?\n\nThe connection will be paused, and you will have the option to reconnect or permanently delete it.`
        );
        if (!confirmed) return;

        setActionLoadingId(account.id);
        try {
            await api.post(`/social-accounts/${account.id}/disconnect`);
            fetchAccounts();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to disconnect channel.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleReconnectChannel = async (account) => {
        setActionLoadingId(account.id);
        try {
            await api.post(`/social-accounts/${account.id}/reconnect`);
            fetchAccounts();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to reconnect channel.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleDeleteChannel = async (account) => {
        const confirmed = window.confirm(
            `Are you sure you want to permanently delete the channel "${account.name}"?\n\nThis will remove the channel connection and its synchronized messages.`
        );
        if (!confirmed) return;

        setDeletingId(account.id);
        try {
            const res = await api.delete(`/social-accounts/${account.id}`);
            alert(res.data?.message || 'Channel deleted successfully!');
            fetchAccounts();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete channel.');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Social Media Connections
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Connect and monitor official Facebook Pages, Instagram Professional Accounts, and WhatsApp Cloud API numbers.
                    </p>
                </div>
                <Button
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={() => setConnectModal(true)}
                >
                    Connect New Channel
                </Button>
            </div>

            {loading ? (
                <div className="py-20 text-center text-xs text-slate-400">Loading channels...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {accounts.map((acc) => {
                        const isFB = acc.platform === 'facebook_page';
                        const isIG = acc.platform === 'instagram_business';
                        const isWA = acc.platform === 'whatsapp_cloud';

                        return (
                            <Card key={acc.id} className="relative flex flex-col justify-between">
                                <div>
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <img
                                                    src={acc.profile_picture_url || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=100'}
                                                    alt={acc.name}
                                                    className="w-11 h-11 rounded-xl object-cover ring-2 ring-slate-800"
                                                />
                                                <span
                                                    className={`absolute -bottom-1 -right-1 p-1 rounded-full text-white text-[9px] ${
                                                        isFB ? 'bg-blue-600' : isIG ? 'bg-pink-600' : 'bg-emerald-600'
                                                    }`}
                                                >
                                                    {isFB ? <Facebook className="w-2.5 h-2.5" /> : isIG ? <Instagram className="w-2.5 h-2.5" /> : <PhoneCall className="w-2.5 h-2.5" />}
                                                </span>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-semibold text-slate-100">{acc.name}</h3>
                                                <p className="text-xs text-slate-400">@{acc.username || acc.account_id}</p>
                                            </div>
                                        </div>
                                        <Badge variant={acc.status === 'connected' ? 'success' : 'neutral'} size="xs">
                                            {acc.status === 'connected' ? 'Connected' : 'Disconnected'}
                                        </Badge>
                                    </div>

                                    {/* Stats grid */}
                                    <div className="mt-4 grid grid-cols-3 gap-2 py-3 border-y border-slate-800/80 text-center">
                                        <div>
                                            <span className="text-xs font-bold text-slate-200">{acc.conversations_count || 0}</span>
                                            <span className="text-[10px] text-slate-400 block">Chats</span>
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-200">{acc.posts_count || 0}</span>
                                            <span className="text-[10px] text-slate-400 block">Posts</span>
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-slate-200">{acc.products_count || 0}</span>
                                            <span className="text-[10px] text-slate-400 block">Products</span>
                                        </div>
                                    </div>

                                    {/* Permissions & Webhook Status */}
                                    <div className="mt-3 space-y-1.5 text-xs text-slate-400">
                                        <div className="flex items-center justify-between">
                                            <span>Channel Status:</span>
                                            {acc.status === 'connected' ? (
                                                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Active & Verified
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-amber-400 font-medium">
                                                    <AlertTriangle className="w-3.5 h-3.5" /> Disconnected
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>AI Automation:</span>
                                            <span className="text-indigo-400 font-medium">
                                                {acc.status === 'connected' ? (acc.settings?.ai_mode === 'auto' ? 'Full Auto' : 'Suggestion Only') : 'Paused'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                                    {acc.status === 'connected' ? (
                                        <>
                                            <Button
                                                variant="secondary"
                                                size="xs"
                                                icon={Activity}
                                                onClick={() => runDiagnostics(acc)}
                                            >
                                                Diagnostics
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                                                icon={Sliders}
                                                loading={actionLoadingId === acc.id}
                                                onClick={() => handleDisconnectChannel(acc)}
                                            >
                                                Disconnect
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button
                                                variant="primary"
                                                size="xs"
                                                className="bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                                icon={CheckCircle2}
                                                loading={actionLoadingId === acc.id}
                                                onClick={() => handleReconnectChannel(acc)}
                                            >
                                                Connect
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                                                icon={Trash2}
                                                loading={deletingId === acc.id}
                                                onClick={() => handleDeleteChannel(acc)}
                                            >
                                                Delete Channel
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {!loading && accounts.length === 0 && (
                <div className="py-16 text-center bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
                    <Share2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-slate-200">No Connected Channels</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Connect your Facebook Pages, Instagram Accounts, or WhatsApp Numbers to start omnichannel automation.
                    </p>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={Plus}
                        className="mt-4"
                        onClick={() => setConnectModal(true)}
                    >
                        Connect First Channel
                    </Button>
                </div>
            )}

            {/* Connect Channel Modal */}
            <Modal isOpen={connectModal} onClose={() => setConnectModal(false)} title="Connect Social Media Channel">
                <form onSubmit={handleConnectSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Platform Type</label>
                        <select
                            value={connectForm.platform}
                            onChange={(e) => setConnectForm({ ...connectForm, platform: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        >
                            <option value="facebook_page">Facebook Page (Official Pages API)</option>
                            <option value="instagram_business">Instagram Professional Account (Graph API)</option>
                            <option value="whatsapp_cloud">WhatsApp Business (Cloud API)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Account / Page Name</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. NexFlow Fashion Official"
                            value={connectForm.name}
                            onChange={(e) => setConnectForm({ ...connectForm, name: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">External ID (Page ID / Phone Number ID)</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. 1092837482910"
                            value={connectForm.account_id}
                            onChange={(e) => setConnectForm({ ...connectForm, account_id: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Username / Phone Handle</label>
                        <input
                            type="text"
                            placeholder="e.g. nexflow.fashion.bd or +88018..."
                            value={connectForm.username}
                            onChange={(e) => setConnectForm({ ...connectForm, username: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Access Token (Stored Encrypted)</label>
                        <textarea
                            rows={3}
                            required
                            placeholder="EAAX... (Never exposed to frontend)"
                            value={connectForm.access_token}
                            onChange={(e) => setConnectForm({ ...connectForm, access_token: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                        ></textarea>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => setConnectModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" type="submit">
                            Save & Verify Connection
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Diagnostics Modal */}
            <Modal
                isOpen={!!diagnosticsModal}
                onClose={() => setDiagnosticsModal(null)}
                title={`Channel Diagnostics: ${diagnosticsModal?.account?.name}`}
            >
                {diagnosticsModal && (
                    <div className="space-y-4 text-xs">
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <span className="font-medium text-slate-300">Overall Health Status</span>
                            <Badge variant={diagnosticsModal.data.overall === 'healthy' ? 'success' : 'warning'}>
                                {diagnosticsModal.data.overall.toUpperCase()}
                            </Badge>
                        </div>

                        <div className="space-y-2 border border-slate-800 rounded-xl p-3 bg-slate-950/60">
                            {Object.entries(diagnosticsModal.data.checks).map(([check, passed]) => (
                                <div key={check} className="flex items-center justify-between py-1 border-b border-slate-800/40 last:border-none">
                                    <span className="capitalize text-slate-400">{check.replace(/_/g, ' ')}</span>
                                    {passed ? (
                                        <span className="flex items-center gap-1 text-emerald-400 font-medium">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Passed
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-rose-400 font-medium">
                                            <AlertTriangle className="w-3.5 h-3.5" /> Failed
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button variant="primary" size="sm" onClick={() => setDiagnosticsModal(null)}>
                                Close Diagnostics
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};
