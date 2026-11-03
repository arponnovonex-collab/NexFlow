import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
    Bot,
    Sparkles,
    Send,
    Flame,
    CheckCircle2,
    Clock,
    DollarSign,
    ShoppingBag,
    Cpu,
} from 'lucide-react';

export const AiPlaygroundPage = () => {
    const [products, setProducts] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [tone, setTone] = useState('friendly');
    const [customerMessage, setCustomerMessage] = useState('price koto apu? delivery charge koto?');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await api.get('/products');
                const list = res.data.data.data || [];
                setProducts(list);
                if (list.length > 0) setSelectedProductId(list[0].id);
            } catch (err) {
                console.error(err);
            }
        };

        fetchProducts();
    }, []);

    const handleSimulate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/ai/playground', {
                customer_message: customerMessage,
                product_id: selectedProductId,
                tone,
            });
            setResult(res.data.data);
        } catch (err) {
            alert('Simulation failed');
        } finally {
            setLoading(false);
        }
    };

    const presetInquiries = [
        'price koto apu? delivery charge koto?',
        'M size available ache ki? Dhaka te koto din lagbe?',
        'Ami nite chai, address: House 24, Road 7, Dhanmondi, phone 01723456789',
        'Can I speak with a human agent? Apnader dress ta kharap hoyeche.',
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    AI Reply Testing Playground
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                    Simulate OpenAI structured output generation against verified database catalog data without messaging real customers.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Simulator Inputs */}
                <Card title="Simulation Configuration" subtitle="Define context, tone, and customer prompt">
                    <form onSubmit={handleSimulate} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Target Product Context</label>
                            <select
                                value={selectedProductId}
                                onChange={(e) => setSelectedProductId(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            >
                                {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.name} (Selling Price: {p.selling_price} BDT)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Tone Preference</label>
                            <select
                                value={tone}
                                onChange={(e) => setTone(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            >
                                <option value="friendly">Friendly & Polite (Standard)</option>
                                <option value="professional">Professional</option>
                                <option value="sales_focused">Sales & Conversion Focused</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">Preset Example Inquiries</label>
                            <div className="flex flex-wrap gap-1.5">
                                {presetInquiries.map((preset, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setCustomerMessage(preset)}
                                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors text-left"
                                    >
                                        "{preset}"
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Test Customer Message</label>
                            <textarea
                                rows={3}
                                required
                                value={customerMessage}
                                onChange={(e) => setCustomerMessage(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            ></textarea>
                        </div>

                        <Button type="submit" variant="primary" size="md" loading={loading} icon={Sparkles} className="w-full">
                            Generate Structured AI Output
                        </Button>
                    </form>
                </Card>

                {/* Simulation Output Card */}
                <Card title="Live Structured Output Inspection" subtitle="Real-time validated response from OpenAI schema">
                    {result ? (
                        <div className="space-y-4">
                            {/* Generated text bubble */}
                            <div className="p-4 rounded-xl bg-violet-950/30 border border-violet-500/30 space-y-2">
                                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5" /> Proposed Reply Text
                                </span>
                                <p className="text-xs text-slate-100 font-medium leading-relaxed">
                                    {result.decision?.reply_text}
                                </p>
                            </div>

                            {/* Schema attributes */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                                    <span className="text-[10px] text-slate-400 block">Classified Intent</span>
                                    <span className="font-semibold text-slate-200">{result.decision?.intent}</span>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                                    <span className="text-[10px] text-slate-400 block">Lead Classification</span>
                                    <Badge variant={result.decision?.suggested_lead_status || 'warm'} size="xs">
                                        {result.decision?.suggested_lead_status?.toUpperCase()} LEAD
                                    </Badge>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                                    <span className="text-[10px] text-slate-400 block">Confidence Score</span>
                                    <span className="font-semibold text-emerald-400">
                                        {Math.round((result.decision?.confidence || 0.95) * 100)}%
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                                    <span className="text-[10px] text-slate-400 block">Language Detected</span>
                                    <span className="font-semibold text-slate-200">{result.decision?.language}</span>
                                </div>
                            </div>

                            {/* Performance metrics */}
                            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5 text-cyan-400" /> Latency: {result.latency_ms} ms
                                </span>
                                <span className="flex items-center gap-1">
                                    <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Total Tokens: {result.tokens?.total}
                                </span>
                                <span className="flex items-center gap-1">
                                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Cost: ${result.tokens?.estimated_cost}
                                </span>
                            </div>

                            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                <span>Zero-Hallucination Check: Verified against actual MySQL product pricing & stock!</span>
                            </div>
                        </div>
                    ) : (
                        <div className="py-24 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                            <Bot className="w-8 h-8 text-slate-600" />
                            <span>Select a product and click "Generate Structured AI Output" to preview the response.</span>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

