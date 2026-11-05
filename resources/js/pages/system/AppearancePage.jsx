import React, { useState, useEffect } from 'react';
import { useAppearance } from '../../context/AppearanceContext';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import {
    Sparkles,
    Palette,
    UploadCloud,
    Check,
    RotateCcw,
    Image as ImageIcon,
    Sliders,
    Eye,
    Globe,
    Type,
    Layers,
    Save,
} from 'lucide-react';

const COLOR_PRESETS = [
    { name: 'Indigo Classic', primary: '#6366f1', secondary: '#8b5cf6' },
    { name: 'Ocean Cyan', primary: '#0ea5e9', secondary: '#06b6d4' },
    { name: 'Emerald Forest', primary: '#10b981', secondary: '#059669' },
    { name: 'Royal Violet', primary: '#8b5cf6', secondary: '#a855f7' },
    { name: 'Rose Blossom', primary: '#f43f5e', secondary: '#e11d48' },
    { name: 'Amber Sunset', primary: '#f59e0b', secondary: '#d97706' },
    { name: 'Midnight Blue', primary: '#3b82f6', secondary: '#1d4ed8' },
    { name: 'Crimson Flame', primary: '#ef4444', secondary: '#b91c1c' },
];

export const AppearancePage = () => {
    const { appearance, updateAppearanceState, fetchAppearance } = useAppearance();

    const [form, setForm] = useState({
        app_name: 'NexFlow AI',
        app_tagline: 'One Inbox. Every Conversation. Smarter Sales.',
        primary_color: '#6366f1',
        secondary_color: '#8b5cf6',
    });

    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [faviconFile, setFaviconFile] = useState(null);
    const [faviconPreview, setFaviconPreview] = useState(null);

    const [saving, setSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (appearance) {
            setForm({
                app_name: appearance.app_name || 'NexFlow AI',
                app_tagline: appearance.app_tagline || '',
                primary_color: appearance.primary_color || '#6366f1',
                secondary_color: appearance.secondary_color || '#8b5cf6',
            });
            if (appearance.app_logo_url) {
                setLogoPreview(appearance.app_logo_url);
            }
            if (appearance.app_favicon_url) {
                setFaviconPreview(appearance.app_favicon_url);
            }
        }
    }, [appearance]);

    const handleLogoSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleFaviconSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setFaviconFile(file);
            setFaviconPreview(URL.createObjectURL(file));
        }
    };

    const handlePresetClick = (preset) => {
        setForm((prev) => ({
            ...prev,
            primary_color: preset.primary,
            secondary_color: preset.secondary,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSavedMsg('');
        setErrorMsg('');

        try {
            const formData = new FormData();
            formData.append('app_name', form.app_name);
            formData.append('app_tagline', form.app_tagline);
            formData.append('primary_color', form.primary_color);
            formData.append('secondary_color', form.secondary_color);

            if (logoFile) {
                formData.append('logo', logoFile);
            }
            if (faviconFile) {
                formData.append('favicon', faviconFile);
            }

            const res = await api.post('/appearance', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (res.data?.status === 'success') {
                setSavedMsg('Appearance and branding settings saved successfully!');
                updateAppearanceState(res.data.data);
                setTimeout(() => setSavedMsg(''), 4000);
            }
        } catch (err) {
            setErrorMsg(err.response?.data?.message || 'Failed to save appearance settings.');
        } finally {
            setSaving(false);
        }
    };

    const handleResetDefaults = () => {
        setForm({
            app_name: 'NexFlow AI',
            app_tagline: 'One Inbox. Every Conversation. Smarter Sales.',
            primary_color: '#6366f1',
            secondary_color: '#8b5cf6',
        });
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-800">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                        <Palette className="w-6 h-6 text-indigo-400" />
                        Appearance & Branding
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        Customize website name, tagline, branding logo, favicon, and primary/secondary color palette.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleResetDefaults}
                        icon={RotateCcw}
                    >
                        Reset Defaults
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        loading={saving}
                        onClick={handleSubmit}
                        icon={Save}
                    >
                        Save Changes
                    </Button>
                </div>
            </div>

            {/* Notification messages */}
            {savedMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs sm:text-sm flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{savedMsg}</span>
                </div>
            )}
            {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs sm:text-sm">
                    {errorMsg}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Main Settings Form (8 cols) */}
                <div className="lg:col-span-7 space-y-6">
                    {/* Brand Identity */}
                    <Card className="p-5 sm:p-6 border border-slate-800 bg-slate-900/60 shadow-xl rounded-2xl">
                        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-800">
                            <Globe className="w-5 h-5 text-indigo-400" />
                            <h2 className="text-sm font-semibold text-white tracking-wide">Brand Identity</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    Website / Platform Name
                                </label>
                                <input
                                    type="text"
                                    value={form.app_name}
                                    onChange={(e) => setForm({ ...form, app_name: e.target.value })}
                                    placeholder="e.g. NexFlow AI"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Displayed in sidebar, browser tab title, emails, and header.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    Tagline / Slogan
                                </label>
                                <input
                                    type="text"
                                    value={form.app_tagline}
                                    onChange={(e) => setForm({ ...form, app_tagline: e.target.value })}
                                    placeholder="e.g. One Inbox. Every Conversation. Smarter Sales."
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                                />
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Displayed under the platform logo in the sidebar and meta tags.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                {/* Logo Upload */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                        Website Logo
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <div className="w-14 h-14 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
                                            {logoPreview ? (
                                                <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                                            ) : (
                                                <Sparkles className="w-6 h-6 text-slate-600" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer transition-colors border border-slate-700">
                                                <UploadCloud className="w-3.5 h-3.5" />
                                                <span>Upload Logo</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleLogoSelect}
                                                    className="hidden"
                                                />
                                            </label>
                                            <p className="text-[10px] text-slate-400 mt-1 truncate">
                                                PNG, SVG, JPG (Max 4MB)
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Favicon Upload */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                        Favicon
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <div className="w-14 h-14 rounded-xl border border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
                                            {faviconPreview ? (
                                                <img src={faviconPreview} alt="Favicon" className="w-7 h-7 object-contain" />
                                            ) : (
                                                <Globe className="w-6 h-6 text-slate-600" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 cursor-pointer transition-colors border border-slate-700">
                                                <UploadCloud className="w-3.5 h-3.5" />
                                                <span>Upload Favicon</span>
                                                <input
                                                    type="file"
                                                    accept="image/*,.ico"
                                                    onChange={handleFaviconSelect}
                                                    className="hidden"
                                                />
                                            </label>
                                            <p className="text-[10px] text-slate-400 mt-1 truncate">
                                                ICO, PNG (32x32 recommended)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Color Palette */}
                    <Card className="p-5 sm:p-6 border border-slate-800 bg-slate-900/60 shadow-xl rounded-2xl">
                        <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-slate-800">
                            <Sliders className="w-5 h-5 text-indigo-400" />
                            <h2 className="text-sm font-semibold text-white tracking-wide">Brand Colors & Palette</h2>
                        </div>

                        {/* Presets */}
                        <div className="mb-5">
                            <label className="block text-xs font-semibold text-slate-300 mb-2">
                                Recommended Color Themes
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {COLOR_PRESETS.map((preset) => (
                                    <button
                                        key={preset.name}
                                        type="button"
                                        onClick={() => handlePresetClick(preset)}
                                        className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                                            form.primary_color === preset.primary && form.secondary_color === preset.secondary
                                                ? 'border-indigo-500 bg-indigo-500/10'
                                                : 'border-slate-800 hover:border-slate-700 bg-slate-950/60'
                                        }`}
                                    >
                                        <div className="flex -space-x-1 shrink-0">
                                            <span
                                                className="w-4 h-4 rounded-full border border-slate-800"
                                                style={{ backgroundColor: preset.primary }}
                                            />
                                            <span
                                                className="w-4 h-4 rounded-full border border-slate-800"
                                                style={{ backgroundColor: preset.secondary }}
                                            />
                                        </div>
                                        <span className="text-[11px] font-medium text-slate-300 truncate">
                                            {preset.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Pickers */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Primary Color */}
                            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                                <label className="block text-xs font-semibold text-slate-300 mb-2">
                                    Primary Brand Color
                                </label>
                                <div className="flex items-center gap-2.5">
                                    <input
                                        type="color"
                                        value={form.primary_color}
                                        onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                                        className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                                    />
                                    <input
                                        type="text"
                                        value={form.primary_color}
                                        onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 uppercase"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1.5">
                                    Main buttons, active menu states, header accents.
                                </p>
                            </div>

                            {/* Secondary Color */}
                            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                                <label className="block text-xs font-semibold text-slate-300 mb-2">
                                    Secondary Accent Color
                                </label>
                                <div className="flex items-center gap-2.5">
                                    <input
                                        type="color"
                                        value={form.secondary_color}
                                        onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                                        className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                                    />
                                    <input
                                        type="text"
                                        value={form.secondary_color}
                                        onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 uppercase"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1.5">
                                    Gradients, secondary highlights, badges.
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Live Preview Column (5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                    <Card className="p-5 border border-slate-800 bg-slate-900/60 shadow-xl rounded-2xl sticky top-20">
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                            <Eye className="w-4 h-4 text-emerald-400" />
                            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                                Live Preview
                            </h3>
                        </div>

                        {/* Mock Header & Brand Preview */}
                        <div className="space-y-4">
                            {/* Brand Card Mock */}
                            <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 flex items-center gap-3">
                                <div
                                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-md text-white overflow-hidden"
                                    style={{
                                        background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})`,
                                    }}
                                >
                                    {logoPreview ? (
                                        <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                                    ) : (
                                        <Sparkles className="w-5 h-5 text-white" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-extrabold text-sm text-white tracking-tight truncate">
                                            {form.app_name || 'NexFlow AI'}
                                        </span>
                                        <span
                                            className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide text-white"
                                            style={{ backgroundColor: form.primary_color }}
                                        >
                                            Pro
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                        {form.app_tagline || 'Smarter Sales CRM'}
                                    </p>
                                </div>
                            </div>

                            {/* Button styles preview */}
                            <div className="space-y-2 pt-2 border-t border-slate-800/80">
                                <p className="text-[11px] font-semibold text-slate-400">Button Styles</p>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-md transition-opacity hover:opacity-95"
                                        style={{ backgroundColor: form.primary_color }}
                                    >
                                        Primary Button
                                    </button>
                                    <button
                                        type="button"
                                        className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white shadow-md transition-opacity hover:opacity-95"
                                        style={{ backgroundColor: form.secondary_color }}
                                    >
                                        Secondary Button
                                    </button>
                                </div>
                            </div>

                            {/* Chat bubble mock */}
                            <div className="space-y-2 pt-2 border-t border-slate-800/80">
                                <p className="text-[11px] font-semibold text-slate-400">Customer & Agent Chat Preview</p>
                                <div className="space-y-2 bg-slate-900/90 p-3 rounded-xl border border-slate-800/80">
                                    {/* Customer Bubble */}
                                    <div className="flex justify-start">
                                        <div className="bg-slate-800 text-slate-200 text-xs px-3 py-2 rounded-2xl rounded-tl-sm max-w-[80%]">
                                            Hello! How can I order this product?
                                        </div>
                                    </div>
                                    {/* Moderator Bubble */}
                                    <div className="flex justify-end">
                                        <div
                                            className="text-white text-xs px-3 py-2 rounded-2xl rounded-tr-sm max-w-[80%] shadow-sm"
                                            style={{
                                                background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})`,
                                            }}
                                        >
                                            Hi there! You can click here to confirm your order immediately.
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Save CTA */}
                            <div className="pt-2">
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="md"
                                    loading={saving}
                                    onClick={handleSubmit}
                                    icon={Save}
                                    className="w-full justify-center"
                                >
                                    Apply & Save Appearance
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
export default AppearancePage;

