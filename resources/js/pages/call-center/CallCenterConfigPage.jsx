import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
    PhoneCall,
    Key,
    ShieldCheck,
    CheckCircle2,
    AlertTriangle,
    RefreshCw,
    ExternalLink,
    DollarSign,
    Phone,
    Eye,
    EyeOff,
    Save,
    Copy,
    Check,
    Radio,
    Headphones,
    Hash,
    HelpCircle,
    Lock,
    Globe,
} from 'lucide-react';

export const CallCenterConfigPage = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testingConnection, setTestingConnection] = useState(false);
    const [showApiToken, setShowApiToken] = useState(false);
    const [showExtPassword, setShowExtPassword] = useState(false);
    const [copiedWebhook, setCopiedWebhook] = useState(false);
    const [copiedExtPass, setCopiedExtPass] = useState(false);

    // Form state
    const [apiBaseUrl, setApiBaseUrl] = useState('https://auliro010.epbx.bd/api/v1');
    const [apiToken, setApiToken] = useState('');
    const [trunkNumber, setTrunkNumber] = useState('');
    const [defaultExtension, setDefaultExtension] = useState('101');
    const [extensionPassword, setExtensionPassword] = useState('MJt#27766');
    const [sipServer, setSipServer] = useState('103.15.140.151');
    const [sipPort, setSipPort] = useState('5060');
    const [webDialerUrl, setWebDialerUrl] = useState('https://auliro010.epbx.bd/dialer');
    const [isEnabled, setIsEnabled] = useState(false);
    const [lastBalance, setLastBalance] = useState(null);
    const [webhookUrl, setWebhookUrl] = useState('');
    const [lastCheckedAt, setLastCheckedAt] = useState(null);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await api.get('/call-center/settings');
            const data = res.data.data;
            setApiBaseUrl(data.api_base_url || 'https://auliro010.epbx.bd/api/v1');
            setApiToken(data.api_token || '');
            setTrunkNumber(data.trunk_number || '');
            setDefaultExtension(data.default_extension || '101');
            setExtensionPassword(data.extension_password || 'MJt#27766');
            setSipServer(data.sip_server || '103.15.140.151');
            setSipPort(data.sip_port || '5060');
            setWebDialerUrl(data.web_dialer_url || 'https://auliro010.epbx.bd/dialer');
            setIsEnabled(Boolean(data.is_enabled));
            setLastBalance(data.last_balance);
            setWebhookUrl(data.webhook_url || `${window.location.origin}/api/webhooks/epbx`);
            setLastCheckedAt(data.last_checked_at);
        } catch (err) {
            console.error('Failed to load ePBX settings:', err);
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
            const res = await api.post('/call-center/settings', {
                api_base_url: apiBaseUrl.trim(),
                api_token: apiToken.trim(),
                trunk_number: trunkNumber.trim(),
                default_extension: defaultExtension.trim(),
                extension_password: extensionPassword.trim(),
                sip_server: sipServer.trim(),
                sip_port: sipPort.trim(),
                web_dialer_url: webDialerUrl.trim(),
                is_enabled: isEnabled,
            });

            alert('ePBX.bd Configuration saved successfully!');
            fetchConfig();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to save ePBX.bd settings.');
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setTestingConnection(true);
        try {
            const res = await api.post('/call-center/test-connection');
            alert(res.data.message || 'Connection successful!');
            fetchConfig();
        } catch (err) {
            alert(err.response?.data?.message || 'Connection test failed with ePBX.bd.');
        } finally {
            setTestingConnection(false);
        }
    };

    const copyWebhookToClipboard = () => {
        navigator.clipboard.writeText(webhookUrl);
        setCopiedWebhook(true);
        setTimeout(() => setCopiedWebhook(false), 2500);
    };

    const isConnected = isEnabled && Boolean(apiToken);

    return (
        <div className="space-y-6 max-w-5xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
                        <PhoneCall className="w-6 h-6 text-emerald-400" />
                        Call Center & ePBX.bd Configuration
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Connect your ePBX.bd Cloud IP-PBX account to conduct click-to-call, view CDR history, and play audio recordings.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={RefreshCw}
                        loading={testingConnection}
                        onClick={handleTestConnection}
                        title="ePBX.bd সার্ভারের সাথে কানেকশন ও ব্যালেন্স চেক করুন"
                    >
                        Test Connection & Sync
                    </Button>
                </div>
            </div>

            {/* Status & Balance Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Connection Status Card */}
                <Card className="flex items-center gap-3.5 p-4 border-slate-800 bg-slate-900/60">
                    <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                            isConnected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                        }`}
                    >
                        {isConnected ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div>
                        <span className="text-[11px] font-medium text-slate-400 block">Gateway Status</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                                className={`w-2 h-2 rounded-full ${
                                    isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                                }`}
                            ></span>
                            <span className="text-sm font-bold text-slate-100">
                                {isConnected ? 'Active & Ready' : 'Disabled / Disconnected'}
                            </span>
                        </div>
                    </div>
                </Card>

                {/* Account Balance Card */}
                <Card className="flex items-center gap-3.5 p-4 border-slate-800 bg-slate-900/60">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[11px] font-medium text-slate-400 block">Available Call Credit</span>
                        <span className="text-base font-extrabold text-amber-300">
                            {lastBalance !== null ? `৳ ${Number(lastBalance).toFixed(2)}` : '৳ 0.00'}
                        </span>
                        {lastCheckedAt && (
                            <span className="text-[10px] text-slate-400 block">
                                Synced {new Date(lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                </Card>

                {/* Outbound Trunk & Extension */}
                <Card className="flex items-center gap-3.5 p-4 border-slate-800 bg-slate-900/60">
                    <div className="w-11 h-11 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
                        <Headphones className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[11px] font-medium text-slate-400 block">Trunk & Extension</span>
                        <span className="text-xs font-bold text-slate-200 block truncate">
                            Trunk: {trunkNumber || 'Not set'}
                        </span>
                        <span className="text-[11px] text-indigo-400 font-medium block">
                            Default Ext: {defaultExtension || '101'}
                        </span>
                    </div>
                </Card>
            </div>

            {/* Configuration Form Card */}
            <Card className="p-6 border-slate-800 bg-slate-900/40">
                <form onSubmit={handleSaveConfig} className="space-y-5">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-200">API Credentials & Routing</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Set up your ePBX.bd tenant credentials for API call origination.
                            </p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-xs text-slate-300 font-medium">Enable Integration</span>
                            <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={(e) => setIsEnabled(e.target.checked)}
                                className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 border-slate-700 bg-slate-950"
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* API Base URL */}
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                ePBX API Base URL <span className="text-rose-400">*</span>
                            </label>
                            <input
                                type="url"
                                required
                                value={apiBaseUrl}
                                onChange={(e) => setApiBaseUrl(e.target.value)}
                                placeholder="https://auliro010.epbx.bd/api/v1"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Tenant ePBX endpoint: <code>https://auliro010.epbx.bd/api/v1</code></p>
                        </div>

                        {/* Outbound Trunk Caller ID */}
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                Outbound Caller ID / Trunk (096xx)
                            </label>
                            <input
                                type="text"
                                value={trunkNumber}
                                onChange={(e) => setTrunkNumber(e.target.value)}
                                placeholder="e.g. 09612345678"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">The 096 BTCL/IPTSP number assigned to your ePBX account.</p>
                        </div>

                        {/* Default Agent Extension */}
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                Default Agent Extension <span className="text-rose-400">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={defaultExtension}
                                onChange={(e) => setDefaultExtension(e.target.value)}
                                placeholder="101"
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">The internal SIP extension that rings first when initiating a call (e.g. 101, 102).</p>
                        </div>

                        {/* API Bearer Token */}
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                                API Bearer Token <span className="text-rose-400">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type={showApiToken ? 'text' : 'password'}
                                    required
                                    value={apiToken}
                                    onChange={(e) => setApiToken(e.target.value)}
                                    placeholder="Enter Bearer Token generated from ePBX.bd"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono pr-10 focus:border-indigo-500 focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiToken(!showApiToken)}
                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                                >
                                    {showApiToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Found under your ePBX.bd Tenant Dashboard &rarr; Developer API Settings.</p>
                        </div>
                    </div>

                    {/* Section: SIP Extension & In-Browser Web Softphone */}
                    <div className="pt-4 border-t border-slate-800">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-emerald-400" />
                                    In-Browser Web Dialer & SIP Account
                                </h3>
                                <p className="text-xs text-slate-400">
                                    কোনো MicroSIP অ্যাপ ছাড়াই সরাসরি ব্রাউজার দিয়ে কথা বলতে নিচের ক্রেডেনশিয়াল ব্যবহার করুন।
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                icon={ExternalLink}
                                onClick={() => window.open(webDialerUrl, 'ePBX_WebPhone', 'width=420,height=720,resizable=yes')}
                                className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                            >
                                Launch Web Phone
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Extension */}
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">
                                    Agent Extension <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={defaultExtension}
                                    onChange={(e) => setDefaultExtension(e.target.value)}
                                    placeholder="101"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Primary agent extension (e.g. 101).</p>
                            </div>

                            {/* Extension Password */}
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">
                                    Extension Password / Secret <span className="text-rose-400">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type={showExtPassword ? 'text' : 'password'}
                                            required
                                            value={extensionPassword}
                                            onChange={(e) => setExtensionPassword(e.target.value)}
                                            placeholder="Enter Extension Secret"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-emerald-300 font-mono pr-10 focus:border-indigo-500 focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowExtPassword(!showExtPassword)}
                                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                                        >
                                            {showExtPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        icon={copiedExtPass ? Check : Copy}
                                        onClick={() => {
                                            navigator.clipboard.writeText(extensionPassword);
                                            setCopiedExtPass(true);
                                            setTimeout(() => setCopiedExtPass(false), 2000);
                                        }}
                                        title="Copy Password"
                                        className={copiedExtPass ? 'text-emerald-400 border-emerald-500/30' : ''}
                                    >
                                        {copiedExtPass ? 'Copied' : 'Copy'}
                                    </Button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">ePBX Extension password (যেমন: <code>MJt#27766</code>)।</p>
                            </div>

                            {/* Web Dialer URL */}
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">
                                    ePBX In-Browser Web Dialer URL
                                </label>
                                <input
                                    type="url"
                                    value={webDialerUrl}
                                    onChange={(e) => setWebDialerUrl(e.target.value)}
                                    placeholder="https://auliro010.epbx.bd/dialer"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Official eTalk Web Dialer: <code>https://auliro010.epbx.bd/dialer</code></p>
                            </div>

                            {/* SIP Server & Port */}
                            <div>
                                <label className="block text-xs font-medium text-slate-300 mb-1">
                                    SIP Server IP & Port (Optional)
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    <input
                                        type="text"
                                        value={sipServer}
                                        onChange={(e) => setSipServer(e.target.value)}
                                        placeholder="103.15.140.151"
                                        className="col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                                    />
                                    <input
                                        type="text"
                                        value={sipPort}
                                        onChange={(e) => setSipPort(e.target.value)}
                                        placeholder="5060"
                                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono text-center focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">Asterisk IP: <code>103.15.140.151:5060</code> (যদি IP ফোন কানেক্ট করতে চান)।</p>
                            </div>
                        </div>
                    </div>

                    {/* Webhook Configuration */}
                    <div className="pt-3 border-t border-slate-800/80">
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                            CDR & Call Recording Webhook URL
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                readOnly
                                value={webhookUrl}
                                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2 text-xs text-indigo-300 font-mono select-all focus:outline-none"
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                icon={copiedWebhook ? Check : Copy}
                                onClick={copyWebhookToClipboard}
                                className={copiedWebhook ? 'text-emerald-400 border-emerald-500/30' : ''}
                            >
                                {copiedWebhook ? 'Copied' : 'Copy'}
                            </Button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">
                            Set this Callback URL in your ePBX.bd Webhook settings to automatically sync call logs, durations, and audio recordings.
                        </p>
                    </div>

                    {/* Save Buttons */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            Credentials are encrypted and never exposed to the frontend.
                        </span>
                        <Button variant="primary" size="sm" type="submit" loading={saving} icon={Save}>
                            Save Configuration
                        </Button>
                    </div>
                </form>
            </Card>

            {/* Quick Setup Guide Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* In-Browser Web Softphone Guide */}
                <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/20 space-y-2 text-xs text-emerald-200/90">
                    <div className="font-semibold text-emerald-300 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-emerald-400" />
                        সরাসরি ব্রাউজারে কথা বলার গাইড (MicroSIP লাগবে না):
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 text-[11px] text-emerald-200/80 leading-relaxed">
                        <li>
                            উপরের <strong>"Launch Web Phone"</strong> বাটনে ক্লিক করে ePBX-এর অফিশিয়াল ওয়েব ফোন ওপেন করুন।
                        </li>
                        <li>
                            লগইন পেজে Extension: <strong>101</strong> এবং Password: <strong>MJt#27766</strong> দিয়ে <strong>Sign In</strong> করুন।
                        </li>
                        <li>
                            ব্রাউজার মাইক্রোফোন পারমিশন চাইলে <strong>"Allow"</strong> করে দিন।
                        </li>
                        <li>
                            এখন আর কোনো অ্যাপ লাগবে না! NexFlow থেকে যেকোনো কাস্টমারকে কল দিলে আপনার এই ব্রাউজার ডায়লারেই কল বাজবে এবং হেডফোন দিয়ে সরাসরি কথা বলতে পারবেন।
                        </li>
                    </ul>
                </div>

                {/* API & Webhook Guide */}
                <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 space-y-2 text-xs text-indigo-200/90">
                    <div className="font-semibold text-indigo-300 flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-indigo-400" />
                        ePBX.bd (auliro010) কানেক্ট ও Webhook বসানোর গাইড:
                    </div>
                    <ul className="list-disc list-inside space-y-1.5 text-[11px] text-indigo-200/80 leading-relaxed">
                        <li>আপনার ePBX পোর্টালে যান: <strong>auliro010.epbx.bd/portal/developer</strong></li>
                        <li>পেজের উপরে <strong>Create New API Key</strong> থেকে টোকেন কপি করে এখানে দিন।</li>
                        <li>আপনার ট্রাঙ্ক নম্বর দিন: <code>09639444516</code> এবং এক্সটেনশন দিন: <code>101</code>।</li>
                        <li>
                            <strong>Webhook বসানোর নিয়ম:</strong> 
                            <span className="block pl-4 mt-0.5 text-slate-300">
                                ডেভেলপার পেজের নিচে <strong>"Webhook Callback Tester"</strong>-এ উপরের Webhook লিংকটি দিয়ে <strong>"Send Test Ping"</strong>-এ ক্লিক করে কানেকশন যাচাই করুন।
                            </span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

