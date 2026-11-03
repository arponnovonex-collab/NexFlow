import React from 'react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ShieldCheck, Lock, Key, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const SecuritySettingsPage = () => {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    Security, Privacy & Compliance
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                    System-wide data minimization, encrypted credential vaults, and Meta Platform Policies compliance overview.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title="Encryption & Vault Architecture" subtitle="All external API keys and page tokens are encrypted">
                    <div className="space-y-3 text-xs">
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <span className="text-slate-300">Database Token Encryption</span>
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> AES-256-CBC Active
                            </span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <span className="text-slate-300">Frontend Credentials Protection</span>
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Zero Secret Leakage
                            </span>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <span className="text-slate-300">Moderator Token Isolation</span>
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> No Direct Meta Access Needed
                            </span>
                        </div>
                    </div>
                </Card>

                <Card title="Meta Platform Policies Compliance" subtitle="Capabilities matrix for live production deployment">
                    <div className="space-y-3 text-xs">
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <span className="text-slate-300">WhatsApp 24h Messaging Window</span>
                            <Badge variant="success" size="xs">Enforced</Badge>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <span className="text-slate-300">Facebook Human Agent Tag</span>
                            <Badge variant="success" size="xs">Supported</Badge>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <span className="text-slate-300">Rate Limiting & Loop Prevention</span>
                            <Badge variant="success" size="xs">Protected</Badge>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

