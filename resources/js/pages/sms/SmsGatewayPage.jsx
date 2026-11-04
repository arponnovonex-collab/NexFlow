import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
    Radio,
    ShieldCheck,
    CheckCircle2,
    AlertTriangle,
    RefreshCw,
    Send,
    Key,
    Phone,
    DollarSign,
    ExternalLink,
    HelpCircle,
    Eye,
    EyeOff,
} from 'lucide-react';

export const SmsGatewayPage = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [checkingBalance, setCheckingBalance] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);

    // Gateway config state
    const [apiKey, setApiKey] = useState('');
    const [senderId, setSenderId] = useState('');
    const [isEnabled, setIsEnabled] = useState(false);
    const [lastBalance, setLastBalance] = useState(0);
    const [lastCheckedAt, setLastCheckedAt] = useState(null);

    // Test SMS state
    const [testPhone, setTestPhone] = useState('');
    const [testMessage, setTestMessage] = useState('This is a test SMS from NexFlow AI CRM.');
    const [sendingTest, setSendingTest] = useState(false);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await api.get('/sms/gateway');
            const data = res.data.data;
            setApiKey(data.api_key || '');
            setSenderId(data.sender_id || '');
            setIsEnabled(Boolean(data.is_enabled));
            setLastBalance(data.last_balance || 0);
            setLastCheckedAt(data.last_balance_checked_at);
        } catch (err) {
            console.error('Failed to load SMS gateway config:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const handleSaveConfig = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.post('/sms/gateway', {
                api_key: apiKey.trim(),
                sender_id: senderId.trim(),
                is_enabled: isEnabled,
            });

            alert('BulkSMS BD Gateway configuration saved successfully!');
            fetchConfig();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save gateway configuration.');
        } finally {
            setSaving(false);
        }
    };

    const handleCheckBalance = async () => {
        setCheckingBalance(true);
        try {
            const res = await api.get('/sms/gateway/balance');
            setLastBalance(res.data.balance);
            setLastCheckedAt(new Date().toISOString());
            alert(`Current BulkSMS BD Balance: ৳${res.data.balance}`);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to check balance. Please verify your API Key.');
        } finally {
            setCheckingBalance(false);
        }
    };

    const handleSendTestSms = async (e) => {
        e.preventDefault();
        if (!testPhone.trim() || !testMessage.trim()) return;

        setSendingTest(true);
        try {
            await api.post('/sms/gateway/test', {
                phone: testPhone.trim(),
                message: testMessage.trim(),
            });
            alert(`✅ Test SMS delivered successfully to ${testPhone}!`);
            handleCheckBalance();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to send test SMS.');
        } finally {
            setSendingTest(false);
        }
    };

    if (loading) {
        return <div className="py-20 text-center text-xs text-slate-400">Loading SMS gateway configuration...</div>;
    }

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Configure SMS Gateway (BulkSMS BD)
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Connect BulkSMS BD API token and sender ID to enable automatic order notifications and marketing SMS.
                    </p>
                </div>
            </div>

            {/* Status & Balance Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-slate-900/60 border-slate-800">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Gateway Status</span>
                    <div className="mt-2 flex items-center gap-2">
                        {isEnabled ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Gateway Active (সক্রিয়)
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                Gateway Disabled (নিষ্ক্রিয়)
                            </span>
                        )}
                    </div>
                </Card>

                <Card className="p-4 bg-slate-900/60 border-slate-800">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">BulkSMS BD Balance</span>
                    <div className="mt-2 flex items-center justify-between">
                        <span className="text-2xl font-extrabold text-emerald-400 font-mono">
                            ৳{Number(lastBalance || 0).toFixed(2)}
                        </span>
                        <Button
                            variant="secondary"
                            size="xs"
                            icon={RefreshCw}
                            loading={checkingBalance}
                            onClick={handleCheckBalance}
                            title="Check live balance"
                        >
                            Refresh
                        </Button>
                    </div>
                    {lastCheckedAt && (
                        <span className="text-[10px] text-slate-500 mt-1 block">
                            Last checked: {new Date(lastCheckedAt).toLocaleTimeString()}
                        </span>
                    )}
                </Card>

                <Card className="p-4 bg-slate-900/60 border-slate-800">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">SMS Provider</span>
                    <div className="mt-2 flex items-center justify-between">
                        <div>
                            <span className="font-bold text-slate-100 text-sm block">BulkSMS BD</span>
                            <span className="text-[10px] text-slate-400">bulksmsbd.net</span>
                        </div>
                        <a
                            href="https://bulksmsbd.net"
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                        >
                            Portal <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </Card>
            </div>

            {/* Gateway Configuration Form */}
            <Card className="p-6">
                <form onSubmit={handleSaveConfig} className="space-y-5 text-xs">
                    <div className="border-b border-slate-800 pb-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Key className="w-4 h-4 text-indigo-400" /> API Credentials & Settings
                        </h3>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                            Enter your official BulkSMS BD API Key and approved Sender ID.
                        </p>
                    </div>

                    {/* Enable / Disable Switch */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                        <div>
                            <span className="font-semibold text-slate-200 block text-xs">
                                Enable SMS Gateway (গেটওয়ে চালু করুন)
                            </span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                                Switch on to allow automated order confirmation SMS and bulk campaigns to be sent.
                            </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={(e) => setIsEnabled(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                    </div>

                    {/* API Key / Token */}
                    <div>
                        <label className="block font-medium text-slate-300 mb-1">
                            BulkSMS BD API Key / Token <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                required={isEnabled}
                                placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j..."
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 pr-10 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 block">
                            Found in BulkSMS BD Dashboard → Developer API → API Key.
                        </span>
                    </div>

                    {/* Sender ID */}
                    <div>
                        <label className="block font-medium text-slate-300 mb-1">
                            Sender ID (সেন্ডার আইডি / মাস্কিং নাম)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. 880961761... or Approved Brand Name"
                            value={senderId}
                            onChange={(e) => setSenderId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                            Non-masking approved number or alphanumeric Sender ID assigned to your BulkSMS BD account.
                        </span>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button variant="primary" size="sm" type="submit" loading={saving}>
                            Save & Verify Gateway Settings
                        </Button>
                    </div>
                </form>
            </Card>

            {/* Test SMS Sender */}
            <Card className="p-6">
                <form onSubmit={handleSendTestSms} className="space-y-4 text-xs">
                    <div className="border-b border-slate-800 pb-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Send className="w-4 h-4 text-emerald-400" /> Send Test SMS (টেস্ট এসএমএস পাঠান)
                        </h3>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                            Verify your BulkSMS BD integration by sending a live test SMS to your mobile phone.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block font-medium text-slate-300 mb-1">
                                Test Recipient Number (মোবাইল নম্বর)
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="01XXXXXXXXX"
                                value={testPhone}
                                onChange={(e) => setTestPhone(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block font-medium text-slate-300 mb-1">Test Message Text</label>
                            <input
                                type="text"
                                required
                                value={testMessage}
                                onChange={(e) => setTestMessage(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            variant="primary"
                            size="sm"
                            type="submit"
                            icon={Send}
                            loading={sendingTest}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        >
                            Send Test SMS Now
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
