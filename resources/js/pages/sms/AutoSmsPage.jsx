import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
    Zap,
    MessageSquare,
    CheckCircle2,
    AlertTriangle,
    RefreshCw,
    Smartphone,
    Eye,
    Save,
    Clock,
} from 'lucide-react';

export const AutoSmsPage = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Auto SMS state
    const [autoSmsEnabled, setAutoSmsEnabled] = useState(true);
    const [template, setTemplate] = useState('');
    const [gatewayEnabled, setGatewayEnabled] = useState(false);
    const [hasApiKey, setHasApiKey] = useState(false);
    const [recentLogs, setRecentLogs] = useState([]);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await api.get('/sms/auto-sms');
            const data = res.data.data;
            setAutoSmsEnabled(Boolean(data.auto_sms_enabled));
            setTemplate(data.auto_sms_template || '');
            setGatewayEnabled(Boolean(data.gateway_enabled));
            setHasApiKey(Boolean(data.has_api_key));
            setRecentLogs(data.recent_logs || []);
        } catch (err) {
            console.error('Failed to load auto-sms config:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const insertTag = (tag) => {
        setTemplate((prev) => prev + tag);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/sms/auto-sms', {
                auto_sms_enabled: autoSmsEnabled,
                auto_sms_template: template.trim(),
            });
            alert('Auto-SMS configuration and template saved successfully!');
            fetchConfig();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save auto-sms settings.');
        } finally {
            setSaving(false);
        }
    };

    // Live preview replacement
    const samplePreview = template
        .replace(/{customer_name}/g, 'Shakib Al Hasan')
        .replace(/{order_id}/g, 'NF-2611-4821')
        .replace(/{product_name}/g, 'Premium Cotton Panjabi (Size: 42)')
        .replace(/{quantity}/g, '1')
        .replace(/{unit_price}/g, '1850')
        .replace(/{delivery_charge}/g, '60')
        .replace(/{total_amount}/g, '1910')
        .replace(/{phone}/g, '01712345678')
        .replace(/{address}/g, 'House 14, Road 5, Uttara, Dhaka');

    if (loading) {
        return <div className="py-20 text-center text-xs text-slate-400">Loading Auto-SMS configuration...</div>;
    }

    return (
        <div className="space-y-6 max-w-6xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Auto SMS on Order Creation (অটো এসএমএস)
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Automatically dispatch order confirmation SMS to customers the moment a moderator places an order in chat.
                    </p>
                </div>
            </div>

            {/* Warning if gateway not configured */}
            {(!gatewayEnabled || !hasApiKey) && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                            <strong>SMS Gateway inactive:</strong> BulkSMS BD API Key এখনো সেট করা নেই অথবা গেটওয়ে বন্ধ রয়েছে। 
                            দয়া করে <strong>Configure SMS Gateway</strong> পেজ থেকে টোকেন সেট করে গেটওয়ে অন করুন।
                        </span>
                    </div>
                    <a
                        href="/sms/gateway"
                        className="px-3 py-1 rounded bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 shrink-0 transition-colors"
                    >
                        Configure Gateway
                    </a>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Column */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-6">
                        <form onSubmit={handleSave} className="space-y-5 text-xs">
                            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-emerald-400" /> Order Confirmation Auto-SMS
                                    </h3>
                                    <p className="text-slate-400 text-[11px] mt-0.5">
                                        Customize the automated message sent instantly when an order is created.
                                    </p>
                                </div>
                            </div>

                            {/* Enable Toggle Switch */}
                            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                                <div>
                                    <span className="font-semibold text-slate-200 block text-xs">
                                        Send Auto SMS on Order Creation
                                    </span>
                                    <span className="text-[11px] text-slate-400 block mt-0.5">
                                        মডারেটর চ্যাট থেকে অর্ডার এন্ট্রি করলেই কাস্টমারের ফোনে স্বয়ংক্রিয় এসএমএস চলে যাবে।
                                    </span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={autoSmsEnabled}
                                        onChange={(e) => setAutoSmsEnabled(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>

                            {/* Dynamic Tag Quick Inserts */}
                            <div>
                                <label className="block font-medium text-slate-300 mb-1.5">
                                    Available Dynamic Tags (ট্যাগ যোগ করতে ক্লিক করুন):
                                </label>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {[
                                        '{customer_name}',
                                        '{order_id}',
                                        '{product_name}',
                                        '{quantity}',
                                        '{total_amount}',
                                        '{delivery_charge}',
                                        '{phone}',
                                        '{address}',
                                    ].map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => insertTag(tag)}
                                            className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-mono text-[11px] border border-indigo-500/30 transition-colors"
                                        >
                                            + {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Template Textarea */}
                            <div>
                                <label className="block font-medium text-slate-300 mb-1">
                                    SMS Template Content (এসএমএস মেসেজ ফরম্যাট) <span className="text-rose-400">*</span>
                                </label>
                                <textarea
                                    rows={5}
                                    required
                                    value={template}
                                    onChange={(e) => setTemplate(e.target.value)}
                                    placeholder="Dear {customer_name}, apnar order #{order_id} grohon kora hoyeche. Total: {total_amount} TK. Dhonnobad NexFlow."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
                                />
                                <span className="text-[10px] text-slate-500 mt-1 block">
                                    অর্ডার তৈরির সময় এই ট্যাগগুলো স্বয়ংক্রিয়ভাবে কাস্টমারের আসল নাম, অর্ডার আইডি ও মূল্য দিয়ে প্রতিস্থাপিত হবে।
                                </span>
                            </div>

                            <div className="flex justify-end pt-2">
                                <Button
                                    variant="primary"
                                    size="sm"
                                    type="submit"
                                    loading={saving}
                                    icon={Save}
                                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                                >
                                    Save Auto-SMS Settings
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>

                {/* Smartphone Live Preview Column */}
                <div>
                    <Card className="p-4 bg-slate-900/60 border-slate-800">
                        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                            <Smartphone className="w-4 h-4 text-indigo-400" />
                            <h4 className="font-bold text-slate-200 text-xs">Customer SMS Live Preview</h4>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                            গ্রাহকের ফোনে এসএমএসটি যেমন দেখাবে:
                        </p>

                        {/* Phone Mockup Screen */}
                        <div className="mt-4 p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl space-y-3">
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pb-2 border-b border-slate-900">
                                <span>BulkSMS / NexFlow</span>
                                <span>Now</span>
                            </div>

                            <div className="p-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 text-xs font-mono leading-relaxed break-words shadow-inner">
                                {samplePreview || 'Type your template to see live preview...'}
                            </div>

                            <div className="text-[10px] text-slate-500 text-right">
                                Delivered via BulkSMS BD
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* Recent Auto-SMS Logs */}
            <Card>
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-400" /> Recent Auto-SMS Activity Logs
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Real-time delivery status of automatic order confirmation SMS.
                        </p>
                    </div>
                    <Button variant="secondary" size="xs" icon={RefreshCw} onClick={fetchConfig}>
                        Refresh Logs
                    </Button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Order Number</th>
                                <th className="px-4 py-3">Recipient Phone</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Message Dispatched</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Sent At</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {recentLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                        No auto-order SMS sent yet. Create an order in chat to test!
                                    </td>
                                </tr>
                            ) : (
                                recentLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3 font-mono font-bold text-indigo-400">
                                            {log.order?.order_number || '—'}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-slate-200">
                                            {log.phone_number}
                                        </td>
                                        <td className="px-4 py-3 text-slate-300">
                                            {log.customer?.name || 'Customer'}
                                        </td>
                                        <td className="px-4 py-3 max-w-xs">
                                            <span className="text-slate-400 text-[11px] truncate block font-mono" title={log.message}>
                                                {log.message}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {log.status === 'sent' ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Delivered
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-rose-400 font-semibold" title={log.error_message}>
                                                    <AlertTriangle className="w-3.5 h-3.5" /> Failed
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                                            {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

