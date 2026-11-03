import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
    Bot,
    Save,
    ShieldAlert,
    CheckCircle2,
    Sliders,
    Key,
    Lock,
    Sparkles,
} from 'lucide-react';

export const AiControlCenterPage = () => {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedNotice, setSavedNotice] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/ai/settings');
                setSettings(res.data.data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleChange = (key, value) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/ai/settings', settings);
            setSavedNotice(true);
            setTimeout(() => setSavedNotice(false), 3000);
        } catch (err) {
            alert('Failed to save AI configuration');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="py-20 text-center text-xs text-slate-400">Loading AI settings...</div>;
    }

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        AI Automation Control Center
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Configure OpenAI parameters, custom prompt instructions, token budgets, and emergency kill switches.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {savedNotice && (
                        <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-4 h-4" /> Changes Applied
                        </span>
                    )}
                    <Button type="submit" variant="primary" size="sm" loading={saving} icon={Save}>
                        Save AI Settings
                    </Button>
                </div>
            </div>

            {/* Emergency Kill Switches */}
            <Card
                title="Emergency Automation Kill Switches"
                subtitle="Instantly pause AI automated message and comment replies across all channels"
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                            <span className="text-xs font-semibold text-slate-200 block">FB Comments</span>
                            <span className="text-[10px] text-slate-400">Auto comment replies</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.comment_auto_reply_enabled === 'true'}
                            onChange={(e) => handleChange('comment_auto_reply_enabled', e.target.checked ? 'true' : 'false')}
                            className="w-5 h-5 rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-0"
                        />
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                            <span className="text-xs font-semibold text-slate-200 block">Messenger DM</span>
                            <span className="text-[10px] text-slate-400">Incoming inbox DMs</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.messenger_auto_reply_enabled === 'true'}
                            onChange={(e) => handleChange('messenger_auto_reply_enabled', e.target.checked ? 'true' : 'false')}
                            className="w-5 h-5 rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-0"
                        />
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                            <span className="text-xs font-semibold text-slate-200 block">Instagram DM</span>
                            <span className="text-[10px] text-slate-400">Direct Messages</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.instagram_auto_reply_enabled === 'true'}
                            onChange={(e) => handleChange('instagram_auto_reply_enabled', e.target.checked ? 'true' : 'false')}
                            className="w-5 h-5 rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-0"
                        />
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div>
                            <span className="text-xs font-semibold text-slate-200 block">WhatsApp Cloud</span>
                            <span className="text-[10px] text-slate-400">Business Chats</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={settings.whatsapp_auto_reply_enabled === 'true'}
                            onChange={(e) => handleChange('whatsapp_auto_reply_enabled', e.target.checked ? 'true' : 'false')}
                            className="w-5 h-5 rounded bg-slate-900 border-slate-800 text-indigo-600 focus:ring-0"
                        />
                    </div>
                </div>
            </Card>

            {/* Model & Credentials */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="OpenAI API Integration" subtitle="Model selection and API key stored encrypted on server">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">OpenAI Model</label>
                            <select
                                value={settings.openai_model || 'gpt-4o-mini'}
                                onChange={(e) => handleChange('openai_model', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            >
                                <option value="gpt-4o-mini">gpt-4o-mini (Recommended: Fast, Structured & Cost Efficient)</option>
                                <option value="gpt-4o">gpt-4o (High Intelligence Multimodal)</option>
                                <option value="gpt-4-turbo">gpt-4-turbo</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">OpenAI API Key</label>
                            <input
                                type="password"
                                value={settings.openai_api_key || ''}
                                onChange={(e) => handleChange('openai_api_key', e.target.value)}
                                placeholder="sk-proj-..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                                Stored securely in database. React never receives or exposes this key to browsers.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Default Reply Tone</label>
                            <select
                                value={settings.default_tone || 'friendly'}
                                onChange={(e) => handleChange('default_tone', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            >
                                <option value="friendly">Warm & Friendly (Polite Bangladeshi eCommerce Tone)</option>
                                <option value="professional">Professional & Formal</option>
                                <option value="sales_focused">Sales & Conversion Focused</option>
                            </select>
                        </div>
                    </div>
                </Card>

                {/* Token Quotas */}
                <Card title="Token Quotas & Safety Controls" subtitle="Set daily usage thresholds to prevent runaway costs">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Daily Token Limit</label>
                            <input
                                type="number"
                                value={settings.daily_token_limit || 250000}
                                onChange={(e) => handleChange('daily_token_limit', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Temperature (Creativity vs Strictness)</label>
                            <input
                                type="text"
                                value={settings.temperature || '0.3'}
                                onChange={(e) => handleChange('temperature', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                                Recommended 0.2 - 0.4 to prevent hallucinations and strictly follow product catalog prices.
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* System Instructions / Prompt */}
            <Card
                title="Global AI Prompt Instructions"
                subtitle="Primary system prompt supplied to OpenAI for contextual intent parsing and multi-lingual generation"
            >
                <textarea
                    rows={6}
                    value={settings.global_ai_instructions || ''}
                    onChange={(e) => handleChange('global_ai_instructions', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
                ></textarea>
            </Card>
        </form>
    );
};

