import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Facebook, Instagram, WhatsApp } from '../../components/common/SocialIcons';
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

    // Update Token Modal State
    const [tokenModalAccount, setTokenModalAccount] = useState(null);
    const [newToken, setNewToken] = useState('');
    const [savingToken, setSavingToken] = useState(false);
    const [verifyingTokens, setVerifyingTokens] = useState(false);
    const [connecting, setConnecting] = useState(false);

    const handleUpdateToken = async (e) => {
        e.preventDefault();
        if (!tokenModalAccount || !newToken.trim()) return;
        setSavingToken(true);
        try {
            await api.put(`/social-accounts/${tokenModalAccount.id}`, {
                access_token: newToken.trim(),
            });
            alert(`Token for "${tokenModalAccount.name}" updated and verified with Meta!`);
            setTokenModalAccount(null);
            setNewToken('');
            fetchAccounts();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update token.');
        } finally {
            setSavingToken(false);
        }
    };

    const handleVerifyAllTokens = async () => {
        setVerifyingTokens(true);
        try {
            const res = await api.post('/social-accounts/verify-all-tokens');
            alert(res.data.message || 'Health check complete!');
            fetchAccounts();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to verify tokens with Meta.');
        } finally {
            setVerifyingTokens(false);
        }
    };

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
        setConnecting(true);
        try {
            await api.post('/social-accounts', connectForm);
            alert('Channel successfully connected and verified with Meta!');
            setConnectModal(false);
            setConnectForm({ platform: 'facebook_page', name: '', account_id: '', username: '', access_token: '' });
            fetchAccounts();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to connect account.');
        } finally {
            setConnecting(false);
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
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={RefreshCw}
                        loading={verifyingTokens}
                        onClick={handleVerifyAllTokens}
                        title="Meta-র সাথে সব চ্যানেলের টোকেন স্ট্যাটাস লাইভ চেক করুন"
                    >
                        Verify Token Health
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={Plus}
                        onClick={() => setConnectModal(true)}
                    >
                        Connect New Channel
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="py-20 text-center text-xs text-slate-400">Loading channels...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {accounts.map((acc) => {
                        const isFB = acc.platform === 'facebook_page';
                        const isIG = acc.platform === 'instagram_business';
                        const isWA = acc.platform === 'whatsapp_cloud';
                        const isExpired = acc.status === 'expired' || acc.is_token_expired || Boolean(acc.last_error);

                        return (
                            <Card
                                key={acc.id}
                                className={`relative flex flex-col justify-between transition-all duration-200 ${
                                    isExpired
                                        ? 'border-rose-500/80 bg-gradient-to-b from-rose-950/30 via-slate-900 to-slate-900 shadow-lg shadow-rose-950/40 ring-1 ring-rose-500/40'
                                        : 'hover:border-slate-700'
                                }`}
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="relative shrink-0">
                                                <img
                                                    src={acc.profile_picture_url || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=100'}
                                                    alt={acc.name}
                                                    className={`w-11 h-11 rounded-xl object-cover ring-2 ${isExpired ? 'ring-rose-500/60' : 'ring-slate-800'}`}
                                                />
                                                <span
                                                    className={`absolute -bottom-1 -right-1 p-1 rounded-full text-white text-[9px] ${
                                                        isFB ? 'bg-blue-600' : isIG ? 'bg-pink-600' : 'bg-emerald-600'
                                                    }`}
                                                >
                                                    {isFB ? <Facebook className="w-2.5 h-2.5" /> : isIG ? <Instagram className="w-2.5 h-2.5" /> : <WhatsApp className="w-2.5 h-2.5" />}
                                                </span>
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-semibold text-slate-100 truncate" title={acc.name}>{acc.name}</h3>
                                                <p className="text-xs text-slate-400 truncate">@{acc.username || acc.account_id}</p>
                                            </div>
                                        </div>

                                        {isExpired ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 animate-pulse shadow-sm shadow-rose-950 shrink-0">
                                                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                                Token Expired
                                            </span>
                                        ) : acc.status === 'connected' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                                Connected
                                            </span>
                                        ) : (
                                            <Badge variant="neutral" size="xs" className="shrink-0">
                                                Disconnected
                                            </Badge>
                                        )}
                                    </div>

                                    {/* Prominent Banner if Token Expired */}
                                    {isExpired && (
                                        <div className="mt-3 p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-start gap-2.5 animate-fade-in shadow-inner">
                                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                            <div className="space-y-1 min-w-0">
                                                <p className="font-bold text-rose-200 text-xs">⚠️ Facebook Token Expired!</p>
                                                <p className="text-[11px] text-rose-300/90 leading-relaxed">
                                                    টোকেনের মেয়াদ শেষ হওয়ায় এই পেইজের মেসেজ ও অটো-রিপ্লাই সাময়িকভাবে বন্ধ আছে। নিচে <strong>"Update Token"</strong> বাটনে ক্লিক করে নতুন পার্মানেন্ট টোকেন দিন।
                                                </p>
                                                {acc.last_error && (
                                                    <p className="text-[10px] font-mono text-rose-400/90 pt-0.5 truncate" title={acc.last_error}>
                                                        Meta: {acc.last_error}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

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
                                            {isExpired ? (
                                                <span className="flex items-center gap-1 text-rose-400 font-bold" title={acc.last_error || 'Token expired'}>
                                                    <AlertTriangle className="w-3.5 h-3.5" /> Token Expired
                                                </span>
                                            ) : acc.status === 'connected' ? (
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
                                            <span>Token Validity:</span>
                                            {isExpired ? (
                                                <span className="text-rose-400 font-semibold">Expired ❌</span>
                                            ) : acc.is_permanent || (!acc.token_expires_at && acc.status === 'connected') ? (
                                                <span className="text-emerald-400 font-medium flex items-center gap-1" title="Lifetime Permanent Token">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Lifetime (Never) ♾️
                                                </span>
                                            ) : acc.token_expires_at ? (
                                                <span className="text-amber-300 font-medium" title={acc.token_expires_at}>
                                                    Expires {new Date(acc.token_expires_at).toLocaleDateString()}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">Active</span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span>AI Automation:</span>
                                            <span className="text-indigo-400 font-medium">
                                                {acc.status === 'connected' && !isExpired ? (acc.settings?.ai_mode === 'auto' ? 'Full Auto' : 'Suggestion Only') : 'Paused'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-1.5 flex-wrap">
                                    {isExpired ? (
                                        <Button
                                            variant="primary"
                                            size="xs"
                                            className="bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center justify-center gap-1.5 shadow-md shadow-rose-900/40 w-full"
                                            onClick={() => {
                                                setTokenModalAccount(acc);
                                                setNewToken('');
                                            }}
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" /> Update Token Now
                                        </Button>
                                    ) : (
                                        <>
                                            <Button
                                                variant="secondary"
                                                size="xs"
                                                onClick={() => {
                                                    setTokenModalAccount(acc);
                                                    setNewToken('');
                                                }}
                                            >
                                                Update Token
                                            </Button>

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

                    {connectForm.platform === 'instagram_business' && (
                        <div className="p-3 rounded-xl bg-pink-950/30 border border-pink-500/30 text-xs text-pink-200/90 space-y-1.5">
                            <div className="font-semibold text-pink-300 flex items-center gap-1.5">
                                <Instagram className="w-3.5 h-3.5" /> ইনস্টাগ্রাম কানেক্ট করার প্রয়োজনীয় শর্ত:
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-[11px] text-pink-100/80">
                                <li>অ্যাকাউন্টটি <strong>Professional (Business বা Creator)</strong> হতে হবে।</li>
                                <li>ইনস্টাগ্রামটি আপনার ফেসবুক পেইজের সাথে লিঙ্কড থাকতে হবে (Page Settings &rarr; Linked Accounts)।</li>
                                <li>Instagram অ্যাপে: <strong>Settings &rarr; Messages &rarr; Message controls &rarr; "Allow access to messages"</strong> অন রাখুন।</li>
                                <li>নিচে আপনার <strong>Instagram Business Account ID</strong> এবং পেইজের <strong>Access Token</strong> দিন।</li>
                            </ul>
                        </div>
                    )}

                    {connectForm.platform === 'whatsapp_cloud' && (
                        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-200/90 space-y-1.5">
                            <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                                <WhatsApp className="w-3.5 h-3.5" /> হোয়াটসঅ্যাপ কানেক্ট করার প্রয়োজনীয় গাইড:
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-[11px] text-emerald-100/80">
                                <li><strong>developers.facebook.com</strong>-এ গিয়ে আপনার মেটা অ্যাপে <strong>WhatsApp</strong> প্রোডাক্ট সেটআপ করুন।</li>
                                <li>WhatsApp &rarr; API Setup পেজ থেকে <strong>Phone Number ID</strong> (প্রায় ১৫ ডিজিটের সংখ্যা) কপি করে নিচে দিন।</li>
                                <li>আপনার হোয়াটসঅ্যাপ বিজনেস ফোন নম্বরটি দিন (যেমন: <code>+88018xxxxxxxx</code>)।</li>
                                <li>একটি <strong>Permanent System User Access Token</strong> তৈরি করে নিচে দিন (পারমিশন: <code>whatsapp_business_messaging</code> ও <code>whatsapp_business_management</code>)।</li>
                                <li>মেটা পোর্টালে Webhook URL দিন: <code>https://nexflow.auliro.xyz/api/webhooks/whatsapp</code> (Verify Token: <code>nexflow_secure_webhook_token_2026</code>) এবং <strong>messages</strong> সাবস্ক্রাইব করুন।</li>
                            </ul>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                            {connectForm.platform === 'instagram_business'
                                ? 'Instagram Brand / Account Name'
                                : connectForm.platform === 'whatsapp_cloud'
                                ? 'WhatsApp Business Name'
                                : 'Account / Page Name'}
                        </label>
                        <input
                            type="text"
                            required
                            placeholder={
                                connectForm.platform === 'instagram_business'
                                    ? 'e.g. NexFlow Fashion Official'
                                    : connectForm.platform === 'whatsapp_cloud'
                                    ? 'e.g. NexFlow Support BD'
                                    : 'e.g. NexFlow Fashion Official'
                            }
                            value={connectForm.name}
                            onChange={(e) => setConnectForm({ ...connectForm, name: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                            {connectForm.platform === 'instagram_business'
                                ? 'Instagram Business Account ID (IG ID)'
                                : connectForm.platform === 'whatsapp_cloud'
                                ? 'Phone Number ID'
                                : 'Facebook Page ID'}
                        </label>
                        <input
                            type="text"
                            required
                            placeholder={
                                connectForm.platform === 'instagram_business'
                                    ? 'e.g. 178414002938192'
                                    : connectForm.platform === 'whatsapp_cloud'
                                    ? 'e.g. 1092837482910'
                                    : 'e.g. 1092837482910'
                            }
                            value={connectForm.account_id}
                            onChange={(e) => setConnectForm({ ...connectForm, account_id: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                            {connectForm.platform === 'instagram_business'
                                ? 'Instagram Handle (@username)'
                                : connectForm.platform === 'whatsapp_cloud'
                                ? 'WhatsApp Phone Number'
                                : 'Page Username / Slug'}
                        </label>
                        <input
                            type="text"
                            placeholder={
                                connectForm.platform === 'instagram_business'
                                    ? 'e.g. @nexflow.official'
                                    : connectForm.platform === 'whatsapp_cloud'
                                    ? 'e.g. +8801812345678'
                                    : 'e.g. nexflow.fashion.bd'
                            }
                            value={connectForm.username}
                            onChange={(e) => setConnectForm({ ...connectForm, username: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                            {connectForm.platform === 'instagram_business'
                                ? 'Page Access Token (with instagram_manage_messages)'
                                : 'Access Token (Stored Encrypted)'}
                        </label>
                        <textarea
                            rows={3}
                            required
                            placeholder="EAAX... (Never exposed to frontend)"
                            value={connectForm.access_token}
                            onChange={(e) => setConnectForm({ ...connectForm, access_token: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                        ></textarea>
                    </div>

                    <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300">
                        💡 <strong>টিপস:</strong> সাময়িক ইউজার টোকেন ১-২ ঘণ্টা পর মেয়াদ শেষ হয়ে যায়। ফেসবুক/ইনস্টাগ্রামের জন্য <strong>Permanent Page Access Token</strong> এবং হোয়াটসঅ্যাপের জন্য <strong>System User Permanent Token</strong> ব্যবহার করলে চ্যানেলের টোকেন আর কখনো এক্সপায়ার হবে না।
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => setConnectModal(false)} disabled={connecting}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" type="submit" loading={connecting}>
                            Save & Verify with Meta
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

            {/* Update Page Access Token Modal */}
            {tokenModalAccount && (
                <Modal
                    isOpen={Boolean(tokenModalAccount)}
                    onClose={() => setTokenModalAccount(null)}
                    title={`Update Token: ${tokenModalAccount.name}`}
                >
                    <form onSubmit={handleUpdateToken} className="space-y-4">
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-1.5">
                            <p className="font-semibold">ফেসবুক এক্সেস টোকেন কেন আপডেট করবেন?</p>
                            <p className="text-slate-300 leading-relaxed">
                                মেটা/ফেসবুকের সাময়িক ইউজার টোকেন ১-২ ঘণ্টা পর পর এক্সপায়ার হয়ে যায়। টোকেন এক্সপায়ার হলে ড্যাশবোর্ড থেকে মেসেঞ্জারে কোনো রিপ্লাই পাঠানো যায় না।
                            </p>
                            <p className="text-slate-300">
                                সমাধান: Facebook Graph API Explorer থেকে এই পেইজের জন্য একটি নতুন <strong>Page Access Token</strong> তৈরি করে নিচে পেস্ট করে সেভ করুন।
                            </p>
                            {tokenModalAccount.last_error && (
                                <p className="text-rose-300 text-[11px] font-mono bg-rose-950/40 p-2 rounded border border-rose-500/20 mt-1">
                                    Last Error: {tokenModalAccount.last_error}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                New Page Access Token (নতুন অ্যাক্সেস টোকেন)
                            </label>
                            <textarea
                                rows={4}
                                required
                                value={newToken}
                                onChange={(e) => setNewToken(e.target.value)}
                                placeholder="EAA..."
                                className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setTokenModalAccount(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                loading={savingToken}
                            >
                                Verify & Update Token
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};
