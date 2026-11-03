import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import {
    Zap,
    Plus,
    CheckCircle,
    XCircle,
    ShieldAlert,
    Sliders,
    ArrowRight,
} from 'lucide-react';

export const AutomationRulesPage = () => {
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [createModal, setCreateModal] = useState(false);
    const [form, setForm] = useState({
        name: '',
        scope: 'global',
        condition_type: 'price_inquiry',
        action_type: 'auto_reply_verified_price',
        priority: 10,
    });

    const fetchRules = async () => {
        try {
            setLoading(true);
            const res = await api.get('/automation/rules');
            setRules(res.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRules();
    }, []);

    const handleToggleRule = async (rule) => {
        try {
            await api.put(`/automation/rules/${rule.id}/toggle`);
            fetchRules();
        } catch (err) {
            alert('Failed to toggle rule');
        }
    };

    const handleCreateRule = async (e) => {
        e.preventDefault();
        try {
            await api.post('/automation/rules', form);
            setCreateModal(false);
            setForm({ name: '', scope: 'global', condition_type: 'price_inquiry', action_type: 'auto_reply_verified_price', priority: 10 });
            fetchRules();
        } catch (err) {
            alert('Failed to create rule');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Automation Rules Engine
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Define conditional logic for customer inquiries, human handoffs, and lead status triggers.
                    </p>
                </div>
                <Button variant="primary" size="sm" icon={Plus} onClick={() => setCreateModal(true)}>
                    Create New Rule
                </Button>
            </div>

            <Card title="Active Automation Rules" subtitle="Executed sequentially by priority during webhook ingestion">
                <div className="divide-y divide-slate-800/60">
                    {rules.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-400">
                            No rules configured. Default system logic active.
                        </div>
                    ) : (
                        rules.map((r) => (
                            <div key={r.id} className="py-3.5 flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-200">{r.name}</span>
                                        <Badge variant={r.scope === 'global' ? 'primary' : 'info'} size="xs">
                                            {r.scope}
                                        </Badge>
                                        <span className="text-[10px] text-slate-400">Priority: {r.priority}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <span className="font-mono text-indigo-400">IF {r.condition_type}</span>
                                        <ArrowRight className="w-3 h-3 text-slate-600" />
                                        <span className="font-mono text-emerald-400">THEN {r.action_type}</span>
                                    </div>
                                </div>

                                <Button
                                    variant={r.is_active ? 'secondary' : 'ghost'}
                                    size="xs"
                                    onClick={() => handleToggleRule(r)}
                                >
                                    {r.is_active ? 'Active' : 'Disabled'}
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </Card>

            {/* Create Rule Modal */}
            <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create Automation Rule">
                <form onSubmit={handleCreateRule} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Rule Name</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Auto-escalate human complaints"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Channel Scope</label>
                        <select
                            value={form.scope}
                            onChange={(e) => setForm({ ...form, scope: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        >
                            <option value="global">Global (All Channels)</option>
                            <option value="facebook">Facebook Only</option>
                            <option value="instagram">Instagram Only</option>
                            <option value="whatsapp">WhatsApp Only</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Condition Trigger</label>
                        <select
                            value={form.condition_type}
                            onChange={(e) => setForm({ ...form, condition_type: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        >
                            <option value="price_inquiry">Customer asks about product price</option>
                            <option value="human_requested">Customer asks for human agent</option>
                            <option value="order_address_provided">Customer provides delivery address</option>
                            <option value="complaint_detected">Customer expresses negative complaint</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Action to Execute</label>
                        <select
                            value={form.action_type}
                            onChange={(e) => setForm({ ...form, action_type: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        >
                            <option value="auto_reply_verified_price">Auto-reply with verified price from DB</option>
                            <option value="pause_ai_assign_moderator">Pause AI & assign to active moderator</option>
                            <option value="classify_hot_lead">Classify lead as HOT and schedule follow-up</option>
                            <option value="require_moderator_approval">Draft response for moderator approval</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => setCreateModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" type="submit">
                            Save Rule
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

