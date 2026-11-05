import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Link } from 'react-router-dom';
import {
    Sun,
    Moon,
    Monitor,
    CheckCircle2,
    Eye,
    Palette,
    Layers,
    Volume2,
    Sliders,
    Sparkles,
    Check,
    ArrowRight,
    Smartphone,
} from 'lucide-react';

export const DisplayAccessibilityPage = () => {
    const { theme, isDark, isLight, setTheme, toggleTheme } = useTheme();
    const [savedToast, setSavedToast] = useState(false);

    const handleSelectTheme = (newTheme) => {
        setTheme(newTheme);
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 2500);
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                        <Palette className="w-6 h-6 text-indigo-400" />
                        Display & Accessibility (ডিসপ্লে ও অ্যাক্সেসিবিলিটি)
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        আপনার পছন্দ অনুযায়ী প্ল্যাটফর্মের ইন্টারফেস থিম, ডার্ক মোড এবং ডিসপ্লে অপশন নিয়ন্ত্রণ করুন।
                    </p>
                </div>
                {savedToast && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold animate-fade-in shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        থিম সফলভাবে পরিবর্তিত হয়েছে
                    </div>
                )}
            </div>

            {/* Quick Status Bar */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-slate-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30' : 'bg-amber-500/20 text-amber-500 border-amber-500/30'}`}>
                        {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                    </div>
                    <div>
                        <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                            <span>Current Mode: {isDark ? 'Dark Mode (ডার্ক মোড)' : 'White / Light Mode (হোয়াইট মোড)'}</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            ব্রাউজারের লোকাল স্টোরেজে স্বয়ংক্রিয়ভাবে সংরক্ষিত রয়েছে।
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={toggleTheme}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm cursor-pointer bg-slate-900 hover:bg-slate-850 text-slate-200 border-slate-700"
                >
                    {isDark ? (
                        <>
                            <Sun className="w-3.5 h-3.5 text-amber-400" />
                            Switch to White Mode
                        </>
                    ) : (
                        <>
                            <Moon className="w-3.5 h-3.5 text-indigo-400" />
                            Switch to Dark Mode
                        </>
                    )}
                </button>
            </div>

            {/* Theme Selection Cards */}
            <Card
                title="Theme Mode (থিম সিলেক্ট করুন)"
                subtitle="আপনার কাজের ধরন ও আলোর পরিবেশের সাথে মিলিয়ে যেকোনো একটি মোড নির্বাচন করুন"
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                    {/* Dark Mode Card */}
                    <div
                        onClick={() => handleSelectTheme('dark')}
                        className={`relative rounded-2xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between overflow-hidden group ${
                            isDark
                                ? 'bg-slate-950 border-indigo-500 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500/20'
                                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                    >
                        {/* Selected Indicator Pill */}
                        {isDark && (
                            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                                <Check className="w-3 h-3" /> Active
                            </div>
                        )}

                        <div>
                            {/* Visual Mockup Preview for Dark Mode */}
                            <div className="w-full h-24 rounded-xl bg-slate-950 border border-slate-800 p-2.5 mb-4 shadow-inner flex flex-col justify-between">
                                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                                        <div className="w-12 h-2 rounded-full bg-slate-800" />
                                    </div>
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 rounded-full bg-slate-800" />
                                        <div className="w-2 h-2 rounded-full bg-slate-800" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 pt-1">
                                    <div className="h-8 rounded bg-slate-900 border border-slate-800 p-1">
                                        <div className="w-6 h-1.5 bg-slate-800 rounded mb-1" />
                                        <div className="w-4 h-2 bg-indigo-400 rounded" />
                                    </div>
                                    <div className="h-8 rounded bg-slate-900 border border-slate-800 p-1">
                                        <div className="w-6 h-1.5 bg-slate-800 rounded mb-1" />
                                        <div className="w-4 h-2 bg-cyan-400 rounded" />
                                    </div>
                                    <div className="h-8 rounded bg-slate-900 border border-slate-800 p-1">
                                        <div className="w-6 h-1.5 bg-slate-800 rounded mb-1" />
                                        <div className="w-4 h-2 bg-emerald-400 rounded" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                                <div className={`p-2 rounded-xl border ${isDark ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                    <Moon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                                        Dark Mode (ডার্ক মোড)
                                    </h3>
                                    <span className="text-[10px] text-indigo-400 font-medium">Night-time Optimized</span>
                                </div>
                            </div>

                            <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">
                                চোখের চাপ কমাতে এবং দীর্ঘ সময় টানা চ্যাট ও সেলস হ্যান্ডেল করার জন্য অত্যন্ত আরামদায়ক ডার্ক ইন্টারফেস।
                            </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                            <span className="text-[11px] text-slate-500">Dark Palette: Slate 950/900</span>
                            <span className={`font-bold ${isDark ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                {isDark ? 'Selected ✓' : 'Click to Enable →'}
                            </span>
                        </div>
                    </div>

                    {/* Light Mode Card */}
                    <div
                        onClick={() => handleSelectTheme('light')}
                        className={`relative rounded-2xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between overflow-hidden group ${
                            !isDark
                                ? 'bg-white border-indigo-500 shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500/20'
                                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                        }`}
                    >
                        {/* Selected Indicator Pill */}
                        {!isDark && (
                            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                                <Check className="w-3 h-3" /> Active
                            </div>
                        )}

                        <div>
                            {/* Visual Mockup Preview for Light Mode */}
                            <div className="w-full h-24 rounded-xl bg-slate-50 border border-slate-200 p-2.5 mb-4 shadow-inner flex flex-col justify-between">
                                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                        <div className="w-12 h-2 rounded-full bg-slate-300" />
                                    </div>
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 pt-1">
                                    <div className="h-8 rounded bg-white border border-slate-200 p-1 shadow-xs">
                                        <div className="w-6 h-1.5 bg-slate-200 rounded mb-1" />
                                        <div className="w-4 h-2 bg-indigo-500 rounded" />
                                    </div>
                                    <div className="h-8 rounded bg-white border border-slate-200 p-1 shadow-xs">
                                        <div className="w-6 h-1.5 bg-slate-200 rounded mb-1" />
                                        <div className="w-4 h-2 bg-cyan-500 rounded" />
                                    </div>
                                    <div className="h-8 rounded bg-white border border-slate-200 p-1 shadow-xs">
                                        <div className="w-6 h-1.5 bg-slate-200 rounded mb-1" />
                                        <div className="w-4 h-2 bg-emerald-500 rounded" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5">
                                <div className={`p-2 rounded-xl border ${!isDark ? 'bg-amber-500 text-white border-amber-400' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                                    <Sun className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                        White / Light Mode (হোয়াইট মোড)
                                    </h3>
                                    <span className="text-[10px] text-amber-500 font-medium">Daylight High Contrast</span>
                                </div>
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 leading-relaxed">
                                উজ্জ্বল দিনের আলোয় ক্রিস্প এবং ঝকঝকে সাদা ইন্টারফেস। টেক্সট ও কাস্টমার তথ্যের সর্বোচ্চ স্বচ্ছতা প্রদান করে।
                            </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                            <span className="text-[11px] text-slate-400">White Palette: Pure White / Slate 50</span>
                            <span className={`font-bold ${!isDark ? 'text-amber-500' : 'text-slate-400 group-hover:text-slate-200'}`}>
                                {!isDark ? 'Selected ✓' : 'Click to Enable →'}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Accessibility & Visual Comfort */}
            <Card
                title="Accessibility & Layout Features (অ্যাক্সেসিবিলিটি সুবিধাসমূহ)"
                subtitle="উন্নত ইউজার এক্সপেরিয়েন্স ও মসৃণ কাজ করার জন্য সিস্টেম ফিচার"
            >
                <div className="divide-y divide-slate-800/60 text-xs">
                    <div className="py-3.5 flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                            <div className="font-semibold text-slate-200 flex items-center gap-2">
                                <Sliders className="w-4 h-4 text-indigo-400" />
                                <span>Fast Switch from Header (টপ হেডার শর্টকাট)</span>
                            </div>
                            <p className="text-slate-400 text-[11px]">
                                যেকোনো পেজে কাজ করার সময় টপ নেভিগেশন বারের ☀️ / 🌙 আইকনে ক্লিক করে সরাসরি মোড পরিবর্তন করতে পারবেন।
                            </p>
                        </div>
                        <Badge variant="primary" size="xs">Enabled</Badge>
                    </div>

                    <div className="py-3.5 flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                            <div className="font-semibold text-slate-200 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-emerald-400" />
                                <span>Zero-Flicker Persistence (স্মার্ট মেমোরি সংরক্ষণ)</span>
                            </div>
                            <p className="text-slate-400 text-[11px]">
                                আপনার নির্বাচিত থিমটি ডিভাইসে সংরক্ষিত থাকে, ফলে পেজ রিলোড দিলেও চোখের ওপর কোনো ফ্লিকার হয় না।
                            </p>
                        </div>
                        <Badge variant="success" size="xs">Active</Badge>
                    </div>

                    <div className="py-3.5 flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                            <div className="font-semibold text-slate-200 flex items-center gap-2">
                                <Volume2 className="w-4 h-4 text-amber-400" />
                                <span>Audio Alerts & Notification Sounds</span>
                            </div>
                            <p className="text-slate-400 text-[11px]">
                                নতুন মেসেজ আসলে মেসেঞ্জার সাউন্ড এবং কাস্টম নোটিফিকেশন অ্যালার্ট নিয়ন্ত্রণ করুন।
                            </p>
                        </div>
                        <Link
                            to="/settings/notifications"
                            className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold"
                        >
                            Sound Settings &rarr;
                        </Link>
                    </div>
                </div>
            </Card>
        </div>
    );
};
