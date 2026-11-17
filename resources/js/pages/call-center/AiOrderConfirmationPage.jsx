import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import {
    Bot,
    Sparkles,
    PhoneCall,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Settings,
    HelpCircle,
    RefreshCw,
    Save,
    Phone,
    Clock,
    ArrowRight,
    Sliders,
    Globe,
    Volume2,
    Check,
    Copy,
    ExternalLink,
    Play,
    Zap,
} from 'lucide-react';

export const AiOrderConfirmationPage = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);

    // Master Settings
    const [isEnabled, setIsEnabled] = useState(true);
    const [autoCallOrdersEnabled, setAutoCallOrdersEnabled] = useState(false);
    const [autoCallOrdersTrigger, setAutoCallOrdersTrigger] = useState('auto_on_order');
    const [autoCallDelaySeconds, setAutoCallDelaySeconds] = useState(60);
    const [autoCallMaxRetries, setAutoCallMaxRetries] = useState(2);

    // Global TTS Template
    const defaultGlobalTts =
        'আসসালামু আলাইকুম {customer_name}, আপনি অলিরো থেকে {product_name} অর্ডার করেছেন। পণ্যটির মূল্য {amount} টাকা। অর্ডার কনফার্ম করতে ১ চাপুন। অর্ডার ক্যানসেল করতে ২ চাপুন।';
    const [orderCallCustomText, setOrderCallCustomText] = useState(defaultGlobalTts);

    // Key 1 (Confirm)
    const defaultConfirmText = 'অর্ডারটি কনফার্ম করা হয়েছে। ধন্যবাদ।';
    const [orderCallConfirmText, setOrderCallConfirmText] = useState(defaultConfirmText);
    const [orderCallKey1Status, setOrderCallKey1Status] = useState('confirmed');
    const [orderCallKey1WcStatus, setOrderCallKey1WcStatus] = useState('processing');
    const [orderCallKey1Action, setOrderCallKey1Action] = useState('hangup');

    // Key 2 (Cancel)
    const defaultCancelText =
        'আপনার অর্ডারটি ক্যানসেল করা হয়েছে। ক্যানসেলের কারণ জানতে আমাদের একজন প্রতিনিধি আপনার সাথে যোগাযোগ করতে পারেন। অনুগ্রহ করে সহযোগিতা করবেন। ধন্যবাদ।';
    const [orderCallCancelText, setOrderCallCancelText] = useState(defaultCancelText);
    const [orderCallKey2Status, setOrderCallKey2Status] = useState('cancelled');
    const [orderCallKey2WcStatus, setOrderCallKey2WcStatus] = useState('cancelled');
    const [orderCallKey2Action, setOrderCallKey2Action] = useState('hangup');

    // No Answer / Fallback
    const [orderCallNoAnswerStatus, setOrderCallNoAnswerStatus] = useState('pending_confirmation');
    const [orderCallAgentExtension, setOrderCallAgentExtension] = useState('101');

    // ePBX Connection details
    const [trunkNumber, setTrunkNumber] = useState('');
    const [lastBalance, setLastBalance] = useState(null);
    const [apiToken, setApiToken] = useState('');

    // Test Call Modal
    const [testModalOpen, setTestModalOpen] = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [sendingTestCall, setSendingTestCall] = useState(false);
    const [testCallResult, setTestCallResult] = useState(null);

    // Sample preview variables
    const samplePreview = orderCallCustomText
        .replace(/{customer_name}/g, 'তানজিমুর রহমান')
        .replace(/{product_name}/g, 'প্রিমিয়াম ওয়াচ')
        .replace(/{amount}/g, '১৮৫০')
        .replace(/{order_number}/g, '#35288')
        .replace(/{store_name}/g, 'অলিরো');

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await api.get('/call-center/settings');
            const data = res.data?.data || {};

            setIsEnabled(Boolean(data.is_enabled));
            setAutoCallOrdersEnabled(Boolean(data.auto_call_orders_enabled));
            setAutoCallOrdersTrigger(data.auto_call_orders_trigger || 'auto_on_order');
            setAutoCallDelaySeconds(data.auto_call_delay_seconds || 60);
            setAutoCallMaxRetries(data.auto_call_max_retries || 2);

            setOrderCallCustomText(data.order_call_custom_text || defaultGlobalTts);
            setOrderCallConfirmText(data.order_call_confirm_text || defaultConfirmText);
            setOrderCallKey1Status(data.order_call_key_1_status || 'confirmed');
            setOrderCallKey1WcStatus(data.order_call_key_1_wc_status || 'processing');
            setOrderCallKey1Action(data.order_call_key_1_action || 'hangup');

            setOrderCallCancelText(data.order_call_cancel_text || defaultCancelText);
            setOrderCallKey2Status(data.order_call_key_2_status || 'cancelled');
            setOrderCallKey2WcStatus(data.order_call_key_2_wc_status || 'cancelled');
            setOrderCallKey2Action(data.order_call_key_2_action || 'hangup');

            setOrderCallNoAnswerStatus(data.order_call_no_answer_status || 'pending_confirmation');
            setOrderCallAgentExtension(data.order_call_agent_extension || '101');

            setTrunkNumber(data.trunk_number || '');
            setLastBalance(data.last_balance);
            setApiToken(data.api_token || '');
        } catch (err) {
            console.error('Failed to load AI Order Confirmation settings:', err);
            setErrorMessage('সেটিংস লোড করতে ব্যর্থ হয়েছে: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        try {
            setSaving(true);
            setSuccessMessage(null);
            setErrorMessage(null);

            const payload = {
                is_enabled: isEnabled,
                auto_call_orders_enabled: autoCallOrdersEnabled,
                auto_call_orders_trigger: autoCallOrdersTrigger,
                auto_call_delay_seconds: parseInt(autoCallDelaySeconds, 10) || 60,
                auto_call_max_retries: parseInt(autoCallMaxRetries, 10) || 2,

                order_call_custom_text: orderCallCustomText,
                order_call_confirm_text: orderCallConfirmText,
                order_call_key_1_status: orderCallKey1Status,
                order_call_key_1_wc_status: orderCallKey1WcStatus,
                order_call_key_1_action: orderCallKey1Action,

                order_call_cancel_text: orderCallCancelText,
                order_call_key_2_status: orderCallKey2Status,
                order_call_key_2_wc_status: orderCallKey2WcStatus,
                order_call_key_2_action: orderCallKey2Action,

                order_call_no_answer_status: orderCallNoAnswerStatus,
                order_call_agent_extension: orderCallAgentExtension,
            };

            const res = await api.post('/call-center/settings', payload);
            if (res.data?.status === 'success') {
                setSuccessMessage('✅ AI অর্ডার কনফার্মেশন সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
                setTimeout(() => setSuccessMessage(null), 6000);
            }
        } catch (err) {
            setErrorMessage('❌ সেটিংস সেভ ব্যর্থ হয়েছে: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    const insertVariable = (variable) => {
        setOrderCallCustomText((prev) => prev + ` ${variable} `);
    };

    const handleSendTestCall = async (e) => {
        e.preventDefault();
        if (!testPhone.trim()) {
            alert('অনুগ্রহ করে সঠিক ফোন নম্বর দিন (যেমন: 017XXXXXXXX)');
            return;
        }

        try {
            setSendingTestCall(true);
            setTestCallResult(null);
            const res = await api.post('/call-center/ai-order-confirmation/test-call', {
                phone: testPhone.trim(),
                custom_script: orderCallCustomText,
                confirm_script: orderCallConfirmText,
                cancel_script: orderCallCancelText,
            });

            if (res.data?.status === 'success') {
                setTestCallResult({
                    type: 'success',
                    message: res.data.message || 'টেস্ট কল সফলভাবে ডায়াল করা হয়েছে!',
                    spoken: res.data.spoken_text,
                });
            } else {
                setTestCallResult({
                    type: 'error',
                    message: res.data?.message || 'টেস্ট কল পাঠাতে ব্যর্থ হয়েছে।',
                });
            }
        } catch (err) {
            setTestCallResult({
                type: 'error',
                message: err.response?.data?.message || err.message || 'টেস্ট কল ত্রুটি',
            });
        } finally {
            setSendingTestCall(false);
        }
    };

    if (loading) {
        return (
            <div className="p-12 text-center text-slate-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-cyan-400" />
                <p className="text-sm">AI Order Confirmation কনফিগারেশন লোড হচ্ছে...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-16">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600/30 to-indigo-600/30 border border-cyan-500/30 text-cyan-400 shadow-sm">
                            <Bot className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
                                AI Order Confirmation
                                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    ePBX Voice IVR
                                </span>
                            </h1>
                            <p className="text-xs text-slate-400 mt-0.5">
                                ওয়েবসাইট ও WooCommerce অর্ডারের জন্য স্বয়ংক্রিয় বাংলা ভয়েস কল, ১ ও ২ চাপার অ্যাকশন এবং স্ট্যাটাস কনফিগারেশন।
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={PhoneCall}
                        onClick={() => {
                            setTestCallResult(null);
                            setTestModalOpen(true);
                        }}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 font-semibold"
                    >
                        টেস্ট ভয়েস কল দিন
                    </Button>

                    <Button
                        variant="primary"
                        size="sm"
                        icon={Save}
                        loading={saving}
                        onClick={handleSave}
                        className="bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold px-5 shadow-lg shadow-cyan-600/20"
                    >
                        সেটিংস সেভ করুন
                    </Button>
                </div>
            </div>

            {/* Alerts */}
            {successMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-lg">
                    <span>{successMessage}</span>
                    <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">✕</button>
                </div>
            )}
            {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center justify-between shadow-lg">
                    <span>{errorMessage}</span>
                    <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">✕</button>
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
                {/* 1. Master Enable / Disable Card */}
                <Card className="border-slate-800 bg-slate-900/60 shadow-lg">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-2">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Zap className="w-5 h-5 text-amber-400" />
                                <h3 className="text-base font-bold text-white">AI কল সার্ভিস স্টেটাস (Enable / Disable)</h3>
                                <Badge variant={autoCallOrdersEnabled ? 'success' : 'secondary'}>
                                    {autoCallOrdersEnabled ? 'Auto-Call Active' : 'Manual Call Only'}
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-400 max-w-2xl">
                                নতুন ওয়েবসাইট অর্ডার আসার সাথে সাথে সিস্টেম কি স্বয়ংক্রিয়ভাবে গ্রাহককে কল করবে নাকি শুধুমাত্র অ্যাডমিন/এজেন্ট Website Orders পেজ থেকে "AI কল দিন" বাটনে চাপলে কল যাবে?
                            </p>
                        </div>

                        {/* Big Toggle Switch */}
                        <div className="flex items-center gap-3 self-start md:self-center bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 shrink-0">
                            <span className="text-xs font-semibold text-slate-300">অটো-কল চালু রাখুন:</span>
                            <button
                                type="button"
                                onClick={() => setAutoCallOrdersEnabled(!autoCallOrdersEnabled)}
                                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    autoCallOrdersEnabled ? 'bg-cyan-500 shadow-md shadow-cyan-500/30' : 'bg-slate-700'
                                }`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                        autoCallOrdersEnabled ? 'translate-x-7' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>
                    </div>

                    {autoCallOrdersEnabled && (
                        <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    অটো-কল শুরু হওয়ার সময় (Delay Seconds)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="600"
                                        value={autoCallDelaySeconds}
                                        onChange={(e) => setAutoCallDelaySeconds(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                                    />
                                    <span className="absolute right-3 top-2 text-xs text-slate-500">সেকেন্ড</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1">
                                    অর্ডার আসার কত সেকেন্ড পর গ্রাহকের ফোনে রিং হওয়া শুরু হবে। (ডিফল্ট: ৬০ সেকেন্ড)
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    অটো-কল ট্রিগার মোড
                                </label>
                                <select
                                    value={autoCallOrdersTrigger}
                                    onChange={(e) => setAutoCallOrdersTrigger(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                                >
                                    <option value="auto_on_order">সব নতুন অর্ডারে অটোমেটিক কল যাবে (Recommended)</option>
                                    <option value="pending_only">শুধুমাত্র Pending Confirmation অর্ডারে যাবে</option>
                                </select>
                            </div>
                        </div>
                    )}
                </Card>

                {/* 2. Global TTS Voice Script Template */}
                <Card className="border-slate-800 bg-slate-900/60 shadow-lg">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Volume2 className="w-5 h-5 text-cyan-400" />
                                <h3 className="text-base font-bold text-white">
                                    Global TTS Voice Template (কল রিসিভ করার পর প্রাথমিক বক্তব্য)
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOrderCallCustomText(defaultGlobalTts)}
                                className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
                            >
                                <RefreshCw className="w-3 h-3" />
                                ডিফল্ট বাংলা স্ক্রিপ্ট রিসেট করুন
                            </button>
                        </div>

                        <p className="text-xs text-slate-400">
                            গ্রাহক ফোন রিসিভ করলে AI ঠিক যা বলবে তা এখানে লিখুন। নিচের ডাইনামিক ভ্যারিয়েবল ট্যাগগুলোতে ক্লিক করে আপনার পছন্দমতো জায়গায় বসাতে পারেন:
                        </p>

                        {/* Dynamic Variable Chips */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-slate-400 mr-1">ভ্যারিয়েবল ট্যাগ:</span>
                            {[
                                { tag: '{customer_name}', label: 'গ্রাহকের নাম' },
                                { tag: '{product_name}', label: 'পণ্যের নাম' },
                                { tag: '{amount}', label: 'মোট মূল্য (টাকা)' },
                                { tag: '{order_number}', label: 'অর্ডার নম্বর' },
                                { tag: '{store_name}', label: 'দোকানের নাম (অলিরো)' },
                            ].map((v) => (
                                <button
                                    key={v.tag}
                                    type="button"
                                    onClick={() => insertVariable(v.tag)}
                                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 active:scale-95 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                                    title={`ক্লিক করে ${v.tag} ইনসার্ট করুন`}
                                >
                                    <span>{v.tag}</span>
                                    <span className="text-[10px] text-slate-400 font-sans font-normal">({v.label})</span>
                                </button>
                            ))}
                        </div>

                        {/* Textarea */}
                        <div className="space-y-1.5">
                            <textarea
                                rows={4}
                                value={orderCallCustomText}
                                onChange={(e) => setOrderCallCustomText(e.target.value)}
                                placeholder="বাংলায় ভয়েস স্ক্রিপ্ট লিখুন..."
                                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 leading-relaxed font-sans"
                            />
                            <div className="flex justify-between items-center text-[11px] text-slate-500">
                                <span>অবশ্যই ১ চাপতে এবং ২ চাপতে অনুরোধের বাক্যটি রাখবেন।</span>
                                <span>{orderCallCustomText.length} characters</span>
                            </div>
                        </div>

                        {/* Live Synthesized Speech Preview */}
                        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 text-xs">
                            <div className="flex items-center gap-2 text-cyan-400 font-bold mb-1.5">
                                <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                                <span>ভয়েস প্রিভিউ (গ্রাহক ফোনে ঠিক যেমন শুনবেন):</span>
                            </div>
                            <p className="text-slate-300 italic leading-relaxed font-serif bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                                "{samplePreview}"
                            </p>
                        </div>
                    </div>
                </Card>

                {/* 3. Action on 1 Pressed (Confirmation) */}
                <Card className="border-emerald-500/30 bg-emerald-950/10 shadow-lg">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-black text-emerald-300 text-sm">
                                    ১
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-emerald-300">
                                        ১ চাপার পর অ্যাকশন (Order Confirmed Flow)
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        গ্রাহক ফোনে ১ চেপে কনফার্ম করলে AI কি বলবে এবং অর্ডারের স্ট্যাটাস কি হবে।
                                    </p>
                                </div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                Key 1 (Confirm)
                            </span>
                        </div>

                        {/* Voice Speech on Key 1 */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                                ১ চাপার পর AI ভয়েস যা বলবে (Confirmation Speech):
                            </label>
                            <input
                                type="text"
                                value={orderCallConfirmText}
                                onChange={(e) => setOrderCallConfirmText(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-emerald-500"
                                placeholder="অর্ডারটি কনফার্ম করা হয়েছে। ধন্যবাদ।"
                            />
                        </div>

                        {/* Status Selectors */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    NexFlow অর্ডার স্ট্যাটাস (১ চাপার পর):
                                </label>
                                <select
                                    value={orderCallKey1Status}
                                    onChange={(e) => setOrderCallKey1Status(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-emerald-500/40 text-xs text-emerald-300 font-bold focus:outline-none focus:border-emerald-400 cursor-pointer"
                                >
                                    <option value="confirmed">Confirmed (নিশ্চিত) — [Recommended]</option>
                                    <option value="processing">Processing (প্রসেসিং)</option>
                                    <option value="shipped">Shipped (কুরিয়ারে রেডি)</option>
                                    <option value="delivered">Delivered (সম্পন্ন)</option>
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">NexFlow CRM-এ অর্ডারের স্ট্যাটাস এটিতে আপডেট হবে।</p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    WooCommerce স্টোরে স্ট্যাটাস সিঙ্ক:
                                </label>
                                <select
                                    value={orderCallKey1WcStatus}
                                    onChange={(e) => setOrderCallKey1WcStatus(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-cyan-300 font-semibold focus:outline-none focus:border-cyan-400 cursor-pointer"
                                >
                                    <option value="processing">Processing (প্রসেসিং) — [Standard]</option>
                                    <option value="completed">Completed (সম্পন্ন)</option>
                                    <option value="on-hold">On Hold (হোল্ড)</option>
                                    <option value="none">ওয়ার্ডপ্রেস স্ট্যাটাস পরিবর্তন করবেন না</option>
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">গ্রাহকের ওয়ার্ডপ্রেস স্টোরে এই স্ট্যাটাস অটোমেটিক সিঙ্ক হবে।</p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    কল পরবর্তী পদক্ষেপ (Call Action):
                                </label>
                                <select
                                    value={orderCallKey1Action}
                                    onChange={(e) => setOrderCallKey1Action(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
                                >
                                    <option value="hangup">ধন্যবাদ জানিয়ে কল সমাপ্ত করা (Hangup)</option>
                                    <option value="transfer_agent">এজেন্ট এক্সটেনশনে কল ট্রান্সফার করা</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* 4. Action on 2 Pressed (Cancellation) */}
                <Card className="border-rose-500/30 bg-rose-950/10 shadow-lg">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center font-black text-rose-300 text-sm">
                                    ২
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-rose-300">
                                        ২ চাপার পর অ্যাকশন (Order Cancellation Flow)
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        গ্রাহক ফোনে ২ চেপে ক্যানসেল করতে চাইলে AI কি বলবে এবং অর্ডারের স্ট্যাটাস কি হবে।
                                    </p>
                                </div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                Key 2 (Cancel)
                            </span>
                        </div>

                        {/* Voice Speech on Key 2 */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                                ২ চাপার পর AI ভয়েস যা বলবে (Cancellation Speech):
                            </label>
                            <textarea
                                rows={2}
                                value={orderCallCancelText}
                                onChange={(e) => setOrderCallCancelText(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-500 leading-relaxed"
                                placeholder="আপনার অর্ডারটি ক্যানসেল করা হয়েছে..."
                            />
                        </div>

                        {/* Status Selectors */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    NexFlow অর্ডার স্ট্যাটাস (২ চাপার পর):
                                </label>
                                <select
                                    value={orderCallKey2Status}
                                    onChange={(e) => setOrderCallKey2Status(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-rose-500/40 text-xs text-rose-300 font-bold focus:outline-none focus:border-rose-400 cursor-pointer"
                                >
                                    <option value="cancelled">Cancelled (বাতিল) — [Recommended]</option>
                                    <option value="pending_confirmation">Pending Confirmation (পুনরায় যাচাই)</option>
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">NexFlow CRM-এ অর্ডারের স্ট্যাটাস এটিতে আপডেট হবে।</p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    WooCommerce স্টোরে স্ট্যাটাস সিঙ্ক:
                                </label>
                                <select
                                    value={orderCallKey2WcStatus}
                                    onChange={(e) => setOrderCallKey2WcStatus(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-rose-300 font-semibold focus:outline-none focus:border-rose-400 cursor-pointer"
                                >
                                    <option value="cancelled">Cancelled (বাতিল) — [Standard]</option>
                                    <option value="failed">Failed (ব্যর্থ)</option>
                                    <option value="refunded">Refunded (ফেরত)</option>
                                    <option value="none">ওয়ার্ডপ্রেস স্ট্যাটাস পরিবর্তন করবেন না</option>
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">গ্রাহকের ওয়ার্ডপ্রেস স্টোরে এই স্ট্যাটাস অটোমেটিক সিঙ্ক হবে।</p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    কল পরবর্তী পদক্ষেপ (Call Action):
                                </label>
                                <select
                                    value={orderCallKey2Action}
                                    onChange={(e) => setOrderCallKey2Action(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
                                >
                                    <option value="hangup">কল সমাপ্ত করা (Hangup)</option>
                                    <option value="transfer_agent">ক্যানসেলের কারণ জানতে এজেন্টের সাথে কানেক্ট করা</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* 5. Fallback & No Answer Settings */}
                <Card className="border-slate-800 bg-slate-900/60 shadow-lg">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                            <Clock className="w-5 h-5 text-amber-400" />
                            <div>
                                <h3 className="text-base font-bold text-white">
                                    কল না ধরলে বা ব্যস্ত থাকলে ফলব্যাক স্ট্যাটাস (No Answer / Busy Fallback)
                                </h3>
                                <p className="text-xs text-slate-400">
                                    গ্রাহক যদি কল না ধরে বা কেটে দেয়, অর্ডারটি কোন অবস্থায় থাকবে।
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    কল মিসড / ব্যস্ত থাকলে অর্ডারের স্ট্যাটাস:
                                </label>
                                <select
                                    value={orderCallNoAnswerStatus}
                                    onChange={(e) => setOrderCallNoAnswerStatus(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-amber-300 font-semibold focus:outline-none focus:border-amber-400 cursor-pointer"
                                >
                                    <option value="pending_confirmation">Pending Confirmation (যাচাই অপেক্ষমান) — [Default]</option>
                                    <option value="processing">Processing (প্রসেসিং)</option>
                                </select>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    গ্রাহক ফোন না ধরলে অর্ডারটি বাতিল হবে না, পুনরায় যাচাই বা কল করার জন্য অপেক্ষমান থাকবে।
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    সর্বোচ্চ পুনরায় কল চেষ্টা (Max Retries):
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="5"
                                    value={autoCallMaxRetries}
                                    onChange={(e) => setAutoCallMaxRetries(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">কল না ধরলে সর্বোচ্চ কতবার স্বয়ংক্রিয়ভাবে পুনরায় চেষ্টা করবে।</p>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Bottom Save Bar */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-xl">
                    <div className="text-xs text-slate-400">
                        {trunkNumber ? (
                            <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                ePBX ট্রাঙ্ক: <strong className="text-slate-200">{trunkNumber}</strong> | ব্যালেন্স: ৳{lastBalance ?? '0.00'}
                            </span>
                        ) : (
                            <span className="text-amber-400">⚠️ ePBX ট্রাঙ্ক কনফিগার করা নেই। Settings পেজ চেক করুন।</span>
                        )}
                    </div>

                    <Button
                        type="submit"
                        variant="primary"
                        icon={Save}
                        loading={saving}
                        className="bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold px-6 shadow-lg shadow-cyan-600/20"
                    >
                        সকল সেটিংস সংরক্ষণ করুন
                    </Button>
                </div>
            </form>

            {/* Test Voice Call Modal */}
            <Modal
                isOpen={testModalOpen}
                onClose={() => setTestModalOpen(false)}
                title="📞 টেস্ট AI ভয়েস কল ডায়াল করুন"
            >
                <form onSubmit={handleSendTestCall} className="space-y-4">
                    <p className="text-xs text-slate-400">
                        আপনার বর্তমান বাংলা TTS স্ক্রিপ্টটি গ্রাহকের ফোনে কেমন শোনাবে তা নিজে কল রিসিভ করে সরাসরি যাচাই করুন।
                    </p>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            আপনার ফোন নম্বর (যেটিতে কল আসবে):
                        </label>
                        <div className="relative">
                            <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                value={testPhone}
                                onChange={(e) => setTestPhone(e.target.value)}
                                placeholder="01XXXXXXXXX"
                                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                                required
                            />
                        </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                        <div className="font-semibold text-slate-200">যা টেস্ট করা হবে:</div>
                        <div>• প্রাথমিক টেমপ্লেট উচ্চারণ</div>
                        <div>• ১ চেপে কনফার্মেশন রেসপন্স</div>
                        <div>• ২ চেপে ক্যানসেলেশন রেসপন্স</div>
                    </div>

                    {testCallResult && (
                        <div
                            className={`p-3 rounded-lg text-xs font-medium ${
                                testCallResult.type === 'success'
                                    ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-rose-950/70 text-rose-300 border border-rose-500/40'
                            }`}
                        >
                            {testCallResult.message}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setTestModalOpen(false)}
                        >
                            বন্ধ করুন
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            loading={sendingTestCall}
                            icon={PhoneCall}
                            className="bg-cyan-600 hover:bg-cyan-500 font-bold"
                        >
                            কল পাঠান
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
