import React, { useState, useEffect } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
    Volume2,
    VolumeX,
    Bell,
    Play,
    CheckCircle2,
    AlertTriangle,
    Radio,
    Sparkles,
    Sliders,
    Send,
    MessageSquare,
    RefreshCw,
    ExternalLink,
    Sun,
    Moon,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import {
    getSoundSettings,
    saveSoundSettings,
    playIncomingMessageSound,
    playOutgoingMessageSound,
} from '../../utils/soundEffects';

export const NotificationSoundSettingsPage = () => {
    const { isDark, setTheme } = useTheme();
    const [settings, setSettings] = useState(() => getSoundSettings());
    const [savedToast, setSavedToast] = useState(false);
    const [smsBalance, setSmsBalance] = useState(null);
    const [balanceLoading, setBalanceLoading] = useState(false);

    useEffect(() => {
        fetchBalance();
    }, []);

    const fetchBalance = async () => {
        try {
            setBalanceLoading(true);
            const res = await api.get('/sms/gateway/balance');
            if (res.data?.success) {
                setSmsBalance(parseFloat(res.data.balance));
            }
        } catch (e) {
            // Ignore if SMS gateway is not yet configured
        } finally {
            setBalanceLoading(false);
        }
    };

    const handleToggle = (key) => {
        setSettings((prev) => {
            const updated = { ...prev, [key]: !prev[key] };
            saveSoundSettings(updated);
            return updated;
        });
        showSaved();
    };

    const handleVolumeChange = (e) => {
        const val = parseInt(e.target.value, 10);
        setSettings((prev) => {
            const updated = { ...prev, volume: val };
            saveSoundSettings(updated);
            return updated;
        });
        showSaved();
    };

    const showSaved = () => {
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 2500);
    };

    const isLowBalance = smsBalance !== null && smsBalance < 50;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        <Volume2 className="w-6 h-6 text-indigo-400" />
                        Notification & Sound Settings
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        ইনকামিং ও আউটগোয়িং মেসেজের সাউন্ড ইফেক্ট এবং গুরুত্বপূর্ণ সিস্টেম নোটিফিকেশন অ্যালার্ট নিয়ন্ত্রণ করুন।
                    </p>
                </div>
                {savedToast && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold animate-fade-in">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        সেটিংস সংরক্ষিত হয়েছে
                    </div>
                )}
            </div>

            {/* Display Theme & Appearance Card */}
            <Card
                title="Display Theme & Appearance (ডিসপ্লে মোড)"
                subtitle="ডার্ক মোড ও লাইট/হোয়াইট মোডের মধ্যে যেকোনো একটি বেছে নিন"
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Dark Mode Card */}
                    <div
                        onClick={() => setTheme('dark')}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                            isDark
                                ? 'bg-slate-950 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                    >
                        <div className={`p-2.5 rounded-lg shrink-0 ${isDark ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                            <Moon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-slate-100">Dark Mode (ডার্ক মোড)</span>
                                {isDark && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                        Active
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                ক্লান্তহীন দীর্ঘ কাজের জন্য প্রিমিয়াম ডার্ক ইন্টারফেস।
                            </p>
                        </div>
                    </div>

                    {/* Light Mode Card */}
                    <div
                        onClick={() => setTheme('light')}
                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                            !isDark
                                ? 'bg-white border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                    >
                        <div className={`p-2.5 rounded-lg shrink-0 ${!isDark ? 'bg-amber-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                            <Sun className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                                <span className="font-bold text-sm text-slate-900">Light / White Mode (হোয়াইট মোড)</span>
                                {!isDark && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 border border-amber-500/30">
                                        Active
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                উজ্জ্বল দিনের আলোয় পরিষ্কার ও ঝকঝকে সাদা ইন্টারফেস।
                            </p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Sound Controls Card */}
            <Card
                title="Message Audio Alerts (মেসেজ সাউন্ড ইফেক্টস)"
                subtitle="মেসেঞ্জার স্টাইল ইনকামিং ও আউটগোয়িং অডিও নোটিফিকেশন"
            >
                <div className="space-y-5 text-xs">
                    {/* Incoming Message Sound */}
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 font-semibold text-slate-100 text-sm">
                                <MessageSquare className="w-4 h-4 text-indigo-400" />
                                <span>Incoming Message Sound (নতুন মেসেজ সাউন্ড)</span>
                                <Badge variant={settings.incoming_enabled ? 'primary' : 'neutral'} size="xs">
                                    {settings.incoming_enabled ? 'Active' : 'Muted'}
                                </Badge>
                            </div>
                            <p className="text-slate-400 text-xs">
                                ফেসবুক পেইজ, ইনস্টাগ্রাম বা হোয়াটসঅ্যাপ থেকে কোনো গ্রাহক নতুন মেসেজ পাঠালে একটি মিষ্টি ঘণ্টার শব্দ হবে।
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                variant="secondary"
                                size="xs"
                                icon={Play}
                                onClick={() => playIncomingMessageSound(true)}
                                title="টেস্ট সাউন্ড শুনুন"
                            >
                                Play Sound
                            </Button>
                            <button
                                type="button"
                                onClick={() => handleToggle('incoming_enabled')}
                                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                                    settings.incoming_enabled ? 'bg-indigo-600 justify-end' : 'bg-slate-800 justify-start'
                                }`}
                            >
                                <span className="bg-white w-4 h-4 rounded-full shadow-md transform transition"></span>
                            </button>
                        </div>
                    </div>

                    {/* Outgoing Message Sound (Messenger style) */}
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 font-semibold text-slate-100 text-sm">
                                <Send className="w-4 h-4 text-emerald-400" />
                                <span>Outgoing Message Sound (মেসেজ সেন্ড সাউন্ড)</span>
                                <Badge variant={settings.outgoing_enabled ? 'success' : 'neutral'} size="xs">
                                    {settings.outgoing_enabled ? 'Active' : 'Muted'}
                                </Badge>
                            </div>
                            <p className="text-slate-400 text-xs">
                                ইনবক্স থেকে গ্রাহককে মেসেজ বা ফাইল সেন্ড করার সাথে সাথে মেসেঞ্জার স্টাইলের সন্তোষজনক পপ/সোউশ সাউন্ড প্লে হবে।
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                variant="secondary"
                                size="xs"
                                icon={Play}
                                onClick={() => playOutgoingMessageSound(true)}
                                title="টেস্ট সাউন্ড শুনুন"
                            >
                                Play Sound
                            </Button>
                            <button
                                type="button"
                                onClick={() => handleToggle('outgoing_enabled')}
                                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                                    settings.outgoing_enabled ? 'bg-emerald-600 justify-end' : 'bg-slate-800 justify-start'
                                }`}
                            >
                                <span className="bg-white w-4 h-4 rounded-full shadow-md transform transition"></span>
                            </button>
                        </div>
                    </div>

                    {/* Volume Slider */}
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 font-medium text-slate-200">
                                <Sliders className="w-4 h-4 text-cyan-400" />
                                <span>Sound Volume (সাউন্ড ভলিউম)</span>
                            </div>
                            <span className="font-mono text-cyan-400 font-bold">{settings.volume}%</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="100"
                            step="5"
                            value={settings.volume}
                            onChange={handleVolumeChange}
                            className="w-full accent-indigo-500 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500">
                            <span>10% (Low)</span>
                            <span>50% (Medium)</span>
                            <span>100% (High)</span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* BulkSMS BD Low Balance Alert Card */}
            <Card
                title="BulkSMS BD Balance Monitor & Low Alert"
                subtitle="৫০ টাকার নিচে নামলে স্বয়ংক্রিয় জরুরি নোটিফিকেশন পাঠানো হয়"
            >
                <div className="space-y-4 text-xs">
                    <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isLowBalance
                            ? 'bg-rose-950/30 border-rose-500/50 text-rose-200'
                            : 'bg-slate-950/80 border-slate-800 text-slate-200'
                    }`}>
                        <div className="flex items-start gap-3">
                            <div className={`p-2.5 rounded-xl shrink-0 ${
                                isLowBalance ? 'bg-rose-500/20 text-rose-400' : 'bg-indigo-500/10 text-indigo-400'
                            }`}>
                                <Radio className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                                    <span>BulkSMS BD লাইভ ব্যালেন্স</span>
                                    {isLowBalance ? (
                                        <Badge variant="danger" size="xs">Low Balance (&lt; ৳50)</Badge>
                                    ) : (
                                        <Badge variant="success" size="xs">Sufficient</Badge>
                                    )}
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    বর্তমান একাউন্ট ব্যালেন্স:{' '}
                                    <strong className="text-white text-sm">
                                        {smsBalance !== null ? `৳${smsBalance.toFixed(2)}` : 'ব্যালেন্স যাচাই হচ্ছে...'}
                                    </strong>
                                </p>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    💡 <strong>নিয়ম:</strong> ব্যালেন্স ৫০ টাকার কম হলে সিস্টেমের উপরে নোটিফিকেশন বেল-এ স্বয়ংক্রিয়ভাবে জরুরি ওয়ার্নিং এলার্ট দেখাবে, যাতে কাস্টমারদের অর্ডার SMS পাঠানো বন্ধ না হয়।
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={RefreshCw}
                                loading={balanceLoading}
                                onClick={fetchBalance}
                            >
                                Recheck
                            </Button>
                            <a
                                href="/sms/gateway"
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
                            >
                                <span>SMS Gateway</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    </div>

                    {isLowBalance && (
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-2 text-xs">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                            <span>
                                <strong>সতর্কতা:</strong> আপনার BulkSMS BD ব্যালেন্স ৫০ টাকার নিচে নেমে গেছে! দ্রুত রিচার্জ করতে bulksmsbd.net প্যানেল ভিজিট করুন।
                            </span>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

