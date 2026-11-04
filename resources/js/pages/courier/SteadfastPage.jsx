import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
    Truck,
    Key,
    ShieldCheck,
    CheckCircle2,
    AlertTriangle,
    RefreshCw,
    ExternalLink,
    DollarSign,
    Phone,
    User,
    Eye,
    EyeOff,
    Save,
} from 'lucide-react';

export const SteadfastPage = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [checkingBalance, setCheckingBalance] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [showSecretKey, setShowSecretKey] = useState(false);

    // Form state
    const [apiKey, setApiKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [isEnabled, setIsEnabled] = useState(false);
    const [contactName, setContactName] = useState('Auliro');
    const [contactPhone, setContactPhone] = useState('01333-447475');
    const [deliveryType, setDeliveryType] = useState('home');
    const [lastBalance, setLastBalance] = useState(0);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await api.get('/courier/steadfast/settings');
            const data = res.data.data;
            setApiKey(data.api_key || '');
            setSecretKey(data.secret_key || '');
            setIsEnabled(Boolean(data.is_enabled));
            setContactName(data.contact_name || 'Auliro');
            setContactPhone(data.contact_phone || '01333-447475');
            setDeliveryType(data.delivery_type || 'home');
            setLastBalance(data.last_balance || 0);
        } catch (err) {
            console.error('Failed to load Steadfast settings:', err);
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
            const res = await api.post('/courier/steadfast/settings', {
                api_key: apiKey.trim(),
                secret_key: secretKey.trim(),
                is_enabled: isEnabled,
                contact_name: contactName.trim(),
                contact_phone: contactPhone.trim(),
                delivery_type: deliveryType.trim(),
            });

            alert('Steadfast Courier configuration saved successfully!');
            fetchConfig();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save Steadfast settings.');
        } finally {
            setSaving(false);
        }
    };

    const handleCheckBalance = async () => {
        setCheckingBalance(true);
        try {
            const res = await api.get('/courier/steadfast/balance');
            setLastBalance(res.data.balance);
            alert(`Steadfast Current Balance: ৳${res.data.balance}`);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to connect to Steadfast. Check API Key & Secret Key.');
        } finally {
            setCheckingBalance(false);
        }
    };

    if (loading) {
        return <div className="py-20 text-center text-xs text-slate-400">Loading Steadfast configuration...</div>;
    }

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Steadfast Courier Configuration (স্টেডফাস্ট কুরিয়ার)
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Connect Steadfast Courier API to send customer orders directly with automated consignment and tracking codes.
                    </p>
                </div>
            </div>

            {/* Quick Status & Balance */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-slate-900/60 border-slate-800">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Steadfast Status</span>
                    <div className="mt-2 flex items-center gap-2">
                        {isEnabled ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Integration Active (সক্রিয়)
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                Integration Inactive (নিষ্ক্রিয়)
                            </span>
                        )}
                    </div>
                </Card>

                <Card className="p-4 bg-slate-900/60 border-slate-800">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Steadfast Balance</span>
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
                </Card>

                <Card className="p-4 bg-slate-900/60 border-slate-800">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Steadfast Portal</span>
                    <div className="mt-2 flex items-center justify-between">
                        <div>
                            <span className="font-bold text-slate-100 text-sm block">Steadfast Courier</span>
                            <span className="text-[10px] text-slate-400">portal.steadfast.com.bd</span>
                        </div>
                        <a
                            href="https://portal.steadfast.com.bd"
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                        >
                            Login <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </Card>
            </div>

            {/* Configuration Form */}
            <Card className="p-6">
                <form onSubmit={handleSaveConfig} className="space-y-5 text-xs">
                    <div className="border-b border-slate-800 pb-3">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Key className="w-4 h-4 text-indigo-400" /> API Keys & Merchant Information
                        </h3>
                        <p className="text-slate-400 text-[11px] mt-0.5">
                            Enter your official Steadfast Courier API Key and Secret Key to activate 1-click order dispatch.
                        </p>
                    </div>

                    {/* Enable / Disable Switch */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                        <div>
                            <span className="font-semibold text-slate-200 block text-xs">
                                Enable Steadfast Integration (স্টেডফাস্ট চালু করুন)
                            </span>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                                চালু থাকলে Customer Orders পেজ থেকে সরাসরি Steadfast-এ অর্ডার পাঠানো যাবে।
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

                    {/* API Key */}
                    <div>
                        <label className="block font-medium text-slate-300 mb-1">
                            Steadfast API Key <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                required={isEnabled}
                                placeholder="Enter Steadfast API Key"
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
                    </div>

                    {/* Secret Key */}
                    <div>
                        <label className="block font-medium text-slate-300 mb-1">
                            Steadfast Secret Key <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showSecretKey ? 'text' : 'password'}
                                required={isEnabled}
                                placeholder="Enter Steadfast Secret Key"
                                value={secretKey}
                                onChange={(e) => setSecretKey(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 pr-10 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                            />
                            <button
                                type="button"
                                onClick={() => setShowSecretKey(!showSecretKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                                {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Default Merchant / Pickup Details */}
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                        <span className="font-semibold text-slate-200 block text-xs">
                            Default Merchant & Delivery Settings (পিকআপ ও মার্চেন্ট তথ্য)
                        </span>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Contact Name (মার্চেন্ট নাম)</label>
                                <input
                                    type="text"
                                    value={contactName}
                                    onChange={(e) => setContactName(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Contact Phone (মার্চেন্ট ফোন)</label>
                                <input
                                    type="text"
                                    value={contactPhone}
                                    onChange={(e) => setContactPhone(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Delivery Type</label>
                                <select
                                    value={deliveryType}
                                    onChange={(e) => setDeliveryType(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none"
                                >
                                    <option value="home">Home Delivery (হোম ডেলিভারি)</option>
                                    <option value="point">Point Delivery</option>
                                </select>
                            </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300">
                            💡 <strong>অটোমেশন ফরম্যাট:</strong> Steadfast-এ অর্ডার পাঠানোর সময় Invoice ফিল্ডে স্বয়ংক্রিয়ভাবে 
                            <code> Product Name | Product Variation | Quantity </code> বসে যাবে। একাধিক আইটেম থাকলে <code> | </code> দিয়ে পর পর বসবে।
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button variant="primary" size="sm" type="submit" loading={saving} icon={Save}>
                            Save Steadfast Settings
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

