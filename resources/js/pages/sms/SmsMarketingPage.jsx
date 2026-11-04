import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
    Send,
    Users,
    Package,
    Sparkles,
    Tag,
    Clock,
    CheckCircle2,
    AlertTriangle,
    BarChart3,
    Search,
    RefreshCw,
} from 'lucide-react';

export const SmsMarketingPage = () => {
    const [products, setProducts] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [loadingCampaigns, setLoadingCampaigns] = useState(true);
    const [sending, setSending] = useState(false);

    // Campaign Builder State
    const [title, setTitle] = useState('');
    const [targetType, setTargetType] = useState('all_customers');
    const [targetProductId, setTargetProductId] = useState('');
    const [message, setMessage] = useState('');
    const [recipientCount, setRecipientCount] = useState(0);
    const [sampleCustomers, setSampleCustomers] = useState([]);
    const [countingRecipients, setCountingRecipients] = useState(false);

    // Character counting
    const isUnicode = /[^\u0000-\u007F]/.test(message);
    const charLimitSingle = isUnicode ? 70 : 160;
    const charLimitMulti = isUnicode ? 67 : 153;
    const charLength = message.length;
    const smsCount = charLength === 0
        ? 0
        : charLength <= charLimitSingle
        ? 1
        : Math.ceil(charLength / charLimitMulti);

    // Load products and campaigns on mount
    useEffect(() => {
        fetchProducts();
        fetchCampaigns();
    }, []);

    // Update recipient count when target changes
    useEffect(() => {
        fetchRecipients();
    }, [targetType, targetProductId]);

    const fetchProducts = async () => {
        try {
            const res = await api.get('/products');
            setProducts(res.data.data?.data || res.data.data || []);
        } catch (err) {
            console.error('Failed to load products:', err);
        }
    };

    const fetchCampaigns = async () => {
        setLoadingCampaigns(true);
        try {
            const res = await api.get('/sms/campaigns');
            setCampaigns(res.data.data?.data || []);
        } catch (err) {
            console.error('Failed to load campaigns:', err);
        } finally {
            setLoadingCampaigns(false);
        }
    };

    const fetchRecipients = async () => {
        setCountingRecipients(true);
        try {
            const params = { target_type: targetType };
            if (targetType === 'product_buyers' && targetProductId) {
                params.product_id = targetProductId;
            }
            const res = await api.get('/sms/marketing/recipients', { params });
            setRecipientCount(res.data.recipient_count || 0);
            setSampleCustomers(res.data.sample || []);
        } catch (err) {
            console.error('Failed to count recipients:', err);
        } finally {
            setCountingRecipients(false);
        }
    };

    const insertTag = (tag) => {
        setMessage((prev) => prev + tag);
    };

    const handleSendCampaign = async (e) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            alert('দয়া করে ক্যাম্পেইনের নাম এবং মেসেজ লিখুন।');
            return;
        }

        if (recipientCount === 0) {
            alert('এই টার্গেট অডিয়েন্সে কোনো গ্রাহক খুঁজে পাওয়া যায়নি।');
            return;
        }

        const confirmed = window.confirm(
            `আপনি কি নিশ্চিত যে আপনি ${recipientCount} জন গ্রাহককে এই SMS ক্যাম্পেইনটি পাঠাতে চান?`
        );
        if (!confirmed) return;

        setSending(true);
        try {
            const res = await api.post('/sms/marketing/send', {
                title: title.trim(),
                message: message.trim(),
                target_type: targetType,
                target_product_id: targetType === 'product_buyers' && targetProductId ? targetProductId : null,
            });

            alert(res.data.message || 'SMS Campaign dispatched successfully!');
            setTitle('');
            setMessage('');
            fetchCampaigns();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to dispatch SMS campaign.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6 max-w-6xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        SMS Marketing Campaigns (এসএমএস মার্কেটিং)
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Send targeted promotional SMS with dynamic tags to all customers or customers who bought a specific product.
                    </p>
                </div>
            </div>

            {/* Campaign Builder Card */}
            <Card className="p-6">
                <form onSubmit={handleSendCampaign} className="space-y-5 text-xs">
                    <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Send className="w-4 h-4 text-indigo-400" /> Create SMS Campaign
                            </h3>
                            <p className="text-slate-400 text-[11px] mt-0.5">
                                Configure target audience, insert personalized dynamic tags, and launch bulk SMS.
                            </p>
                        </div>

                        {/* Recipient Counter Badge */}
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400">Target Audience:</span>
                            <span className="px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold font-mono">
                                {countingRecipients ? 'Counting...' : `${recipientCount} Customers`}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Campaign Title */}
                        <div>
                            <label className="block font-medium text-slate-300 mb-1">
                                Campaign Name (ক্যাম্পেইনের নাম) <span className="text-rose-400">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Eid Mega Sale or New Panjabi Arrival"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        {/* Target Audience Selector */}
                        <div>
                            <label className="block font-medium text-slate-300 mb-1">
                                Target Audience (কাদের কাছে পাঠাবেন) <span className="text-rose-400">*</span>
                            </label>
                            <select
                                value={targetType}
                                onChange={(e) => setTargetType(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                            >
                                <option value="all_customers">👥 All Customers (সকল গ্রাহক)</option>
                                <option value="product_buyers">📦 Buyers of Specific Product (নির্দিষ্ট প্রোডাক্ট ক্রেতা)</option>
                            </select>
                        </div>
                    </div>

                    {/* Product Selection if Target is Product Buyers */}
                    {targetType === 'product_buyers' && (
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-2 animate-fade-in">
                            <label className="block font-medium text-indigo-300">
                                Select Purchased Product (কোন প্রোডাক্টটি যারা কিনেছে তাদের পাঠাবেন):
                            </label>
                            <select
                                value={targetProductId}
                                onChange={(e) => setTargetProductId(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                            >
                                <option value="">-- Choose a Product --</option>
                                {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} (৳{p.selling_price || p.regular_price})
                                    </option>
                                ))}
                            </select>
                            <span className="text-[10px] text-slate-400 block">
                                এই প্রোডাক্টটির সফল অর্ডার প্রদানকারী গ্রাহকদের স্বয়ংক্রিয়ভাবে ফিল্টার করা হবে।
                            </span>
                        </div>
                    )}

                    {/* Dynamic Tag Buttons */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="font-medium text-slate-300">
                                SMS Message Text <span className="text-rose-400">*</span>
                            </label>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-slate-400">Click to insert tag:</span>
                                <button
                                    type="button"
                                    onClick={() => insertTag('{customer_name}')}
                                    className="px-2 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-mono text-[10px] border border-indigo-500/30"
                                >
                                    + {'{customer_name}'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => insertTag('{phone}')}
                                    className="px-2 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-mono text-[10px] border border-indigo-500/30"
                                >
                                    + {'{phone}'}
                                </button>
                                {targetType === 'product_buyers' && (
                                    <button
                                        type="button"
                                        onClick={() => insertTag('{product_name}')}
                                        className="px-2 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-mono text-[10px] border border-indigo-500/30"
                                    >
                                        + {'{product_name}'}
                                    </button>
                                )}
                            </div>
                        </div>

                        <textarea
                            rows={4}
                            required
                            placeholder="Dear {customer_name}, apnar jonno NexFlow-te exclusive offer! Aj-i shop korun..."
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
                        />

                        {/* Character and SMS Count Bar */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                            <span className="flex items-center gap-1">
                                <span>Encoding:</span>
                                <strong className={isUnicode ? 'text-amber-400' : 'text-slate-300'}>
                                    {isUnicode ? 'Unicode (Bangla)' : 'Standard GSM (English)'}
                                </strong>
                            </span>
                            <span className="font-mono">
                                Characters: <strong className="text-slate-200">{charLength}</strong> | Parts:{' '}
                                <strong className="text-emerald-400 font-bold">{smsCount} SMS</strong>
                            </span>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            variant="primary"
                            size="sm"
                            type="submit"
                            icon={Send}
                            loading={sending}
                            disabled={recipientCount === 0 || !message.trim()}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5"
                        >
                            Launch Campaign to {recipientCount} Customers
                        </Button>
                    </div>
                </form>
            </Card>

            {/* Campaign History Table */}
            <Card>
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-emerald-400" /> Campaign History & Logs
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Track dispatched marketing campaigns and recipient delivery statistics.
                        </p>
                    </div>
                    <Button variant="secondary" size="xs" icon={RefreshCw} onClick={fetchCampaigns}>
                        Refresh
                    </Button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Campaign Title</th>
                                <th className="px-4 py-3">Target Audience</th>
                                <th className="px-4 py-3">Message Preview</th>
                                <th className="px-4 py-3">Recipients</th>
                                <th className="px-4 py-3">Sent / Failed</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {loadingCampaigns ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                                        Loading campaigns...
                                    </td>
                                </tr>
                            ) : campaigns.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                                        No SMS marketing campaigns dispatched yet.
                                    </td>
                                </tr>
                            ) : (
                                campaigns.map((c) => (
                                    <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3.5 font-semibold text-slate-100">
                                            {c.title}
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-300">
                                            {c.target_type === 'product_buyers' ? (
                                                <span className="inline-flex items-center gap-1 text-indigo-300 font-medium">
                                                    <Package className="w-3 h-3" /> {c.target_product?.name || 'Product Buyers'}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-slate-300">
                                                    <Users className="w-3 h-3" /> All Customers
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5 max-w-xs">
                                            <span className="text-slate-400 truncate block font-mono text-[11px]" title={c.message}>
                                                {c.message}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5 font-bold font-mono text-slate-200">
                                            {c.recipient_count}
                                        </td>
                                        <td className="px-4 py-3.5 font-mono text-[11px]">
                                            <span className="text-emerald-400 font-bold">{c.sent_count} sent</span>
                                            {c.failed_count > 0 && (
                                                <span className="text-rose-400 font-bold ml-1">({c.failed_count} failed)</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <Badge
                                                variant={
                                                    c.status === 'completed'
                                                        ? 'success'
                                                        : c.status === 'sending'
                                                        ? 'info'
                                                        : 'warning'
                                                }
                                                size="xs"
                                            >
                                                {c.status}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                                            {new Date(c.created_at).toLocaleDateString()}
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
