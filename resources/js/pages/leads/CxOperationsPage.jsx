import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import {
    Headphones,
    Copy,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    PhoneCall,
    MessageCircle,
    Edit3,
    Check,
    Truck,
    RefreshCw,
    Search,
    Package,
    User,
    MapPin,
    ShoppingBag,
    Loader2,
    RotateCcw,
    Trash2,
    History,
    UserCheck,
    Clock,
    Bot,
    Volume2,
} from 'lucide-react';

/**
 * Helper to robustly resolve customer name from order, customer relation, or WooCommerce raw billing/shipping.
 */
const resolveCustomerName = (order) => {
    if (!order) return 'সম্মানিত গ্রাহক';
    if (order.customer_display_name && order.customer_display_name !== 'Customer') {
        return order.customer_display_name;
    }
    const cName = order.customer?.name?.trim();
    if (cName && cName.toLowerCase() !== 'customer' && cName.toLowerCase() !== 'website customer' && cName.toLowerCase() !== 'guest customer') {
        return cName;
    }
    const raw = order.wc_raw_data;
    if (raw && typeof raw === 'object') {
        const bFirst = raw.billing?.first_name || raw.shipping?.first_name || '';
        const bLast = raw.billing?.last_name || raw.shipping?.last_name || '';
        const bFull = `${bFirst} ${bLast}`.trim();
        if (bFull && bFull.toLowerCase() !== 'customer') {
            return bFull;
        }
    }
    return cName || order.customer_name || 'সম্মানিত গ্রাহক';
};

/**
 * Helper to robustly extract order items with Name, Size, Color, Quantity, and Price.
 */
const extractOrderItems = (order) => {
    let rawItems = order.items_data;
    if ((!rawItems || rawItems.length === 0) && order.wc_raw_data?.line_items) {
        rawItems = order.wc_raw_data.line_items;
    }

    if (Array.isArray(rawItems) && rawItems.length > 0) {
        return rawItems.map((item, idx) => {
            let name = item.name || item.product_name || order.product?.name || `Product #${idx + 1}`;
            let size = item.size || '';
            let color = item.color || '';
            let qty = parseInt(item.quantity || item.qty, 10) || 1;
            let price = parseFloat(item.price || item.unit_price) || 0;

            // 1. Check meta_data if size/color empty
            if ((!size || !color) && Array.isArray(item.meta_data)) {
                for (const m of item.meta_data) {
                    const k = String(m.key || m.display_key || '').toLowerCase();
                    const v = String(m.value || m.display_value || '').trim();
                    if (!v || typeof m.value === 'object') continue;
                    if (!size && (k.includes('size') || k.includes('সাইজ'))) {
                        size = v;
                    }
                    if (!color && (k.includes('color') || k.includes('colour') || k.includes('কালার'))) {
                        color = v;
                    }
                }
            }

            // 2. Check variation string if size/color empty
            if ((!size || !color) && item.variation) {
                const varStr = String(item.variation);
                const sizeMatch = varStr.match(/size:\s*([^,;]+)/i);
                if (!size && sizeMatch) size = sizeMatch[1].trim();
                const colorMatch = varStr.match(/colou?r:\s*([^,;]+)/i);
                if (!color && colorMatch) color = colorMatch[1].trim();
            }

            // 3. If product name has " - Variation" appended (e.g. "Luna Ruby - 2-3 YEAR, Red")
            if ((!size || !color) && name.includes(' - ')) {
                const parts = name.split(' - ');
                const possibleVar = parts.slice(1).join(' - ').trim();
                name = parts[0].trim();
                if (possibleVar) {
                    if (possibleVar.includes(',')) {
                        const [s, c] = possibleVar.split(',').map((x) => x.trim());
                        if (!size) size = s;
                        if (!color && c) color = c;
                    } else {
                        if (!size) size = possibleVar;
                    }
                }
            }

            // 4. Fallback for single item order attributes
            if (!size && rawItems.length === 1 && order.size) size = order.size;
            if (!color && rawItems.length === 1 && order.color) color = order.color;

            return {
                id: item.id || idx,
                product_id: item.product_id || null,
                name: name,
                size: size,
                color: color,
                quantity: qty,
                price: price,
            };
        });
    }

    return [
        {
            id: 1,
            name: order.product?.name || 'Product',
            size: order.size || '',
            color: order.color || '',
            quantity: order.quantity || 1,
            price: parseFloat(order.unit_price) || 0,
        },
    ];
};

/**
 * Individual Order Card (used inside Duplicate Groups and Standalone Multi-Qty).
 */
const OrderCard = ({
    order,
    isDuplicateSubCard = false,
    orderIndex = 1,
    onEdit,
    onCancel,
    onConfirm,
    onResolve,
    onSetQtyOne,
    onDispatchSteadfast,
    onTriggerAiCall,
    actionLoadingId,
    dispatchingId,
}) => {
    const isCancelled = order.order_status === 'cancelled';
    const isConfirmed = order.order_status === 'confirmed';
    const isResolved = order.is_cx_resolved;
    const isActionLoading = actionLoadingId === order.id;
    const isDispatching = dispatchingId === order.id;

    const rawPhone = order.customer_phone || order.customer?.phone || '';
    const cleanDigits = rawPhone.replace(/[^0-9]/g, '');
    const waPhone = cleanDigits.startsWith('880') ? cleanDigits : (cleanDigits.startsWith('0') ? '88' + cleanDigits : '880' + cleanDigits);

    const rawData = order.wc_raw_data || {};
    const lastChange = rawData.cx_last_change || (Array.isArray(rawData.cx_history) && rawData.cx_history.length > 0 ? rawData.cx_history[rawData.cx_history.length - 1] : null);
    const historyList = Array.isArray(rawData.cx_history) ? rawData.cx_history : (lastChange ? [lastChange] : []);

    const resolvedBy = lastChange?.performed_by || rawData.cx_resolved_by || rawData.cx_cancelled_by || (() => {
        const m = (order.notes || '').match(/by\s+([^\]\n]+)\s+on/i);
        return m ? m[1].trim() : (isResolved ? 'CX Agent' : null);
    })();
    const resolvedTime = lastChange?.formatted_time || (() => {
        if (rawData.cx_cancelled_at) {
            return new Date(rawData.cx_cancelled_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        if (rawData.cx_resolved_at) {
            return new Date(rawData.cx_resolved_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        const m = (order.notes || '').match(/on\s+([0-9A-Za-z\s:,]+)\]/);
        return m ? m[1].trim() : null;
    })();

    const cancelledBy = rawData.cx_cancelled_by || resolvedBy || order.user?.name;
    const cancelledTime = rawData.cx_cancelled_at
        ? new Date(rawData.cx_cancelled_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : resolvedTime;

    const hasHistory = !isCancelled && (!!(lastChange?.before && lastChange?.after) || isResolved);

    return (
        <div
            className={`rounded-xl border transition-all p-3.5 space-y-3 flex flex-col justify-between ${
                isCancelled
                    ? 'border-rose-900/40 bg-slate-950/70 opacity-75'
                    : isConfirmed
                    ? 'border-emerald-500/30 bg-slate-900/90 hover:border-emerald-500/60'
                    : isDuplicateSubCard
                    ? 'border-rose-500/30 bg-slate-900/90 hover:border-rose-500/60'
                    : 'border-cyan-500/30 bg-slate-900/90 hover:border-cyan-500/60'
            }`}
        >
            <div className="space-y-3">
                {/* Header: Order ID, Date & Status */}
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        {isDuplicateSubCard && (
                            <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center justify-center text-[10px] font-black shrink-0">
                                #{orderIndex}
                            </span>
                        )}
                        <span className="font-mono font-bold text-white text-xs truncate">
                            #{order.order_number}
                        </span>
                        {order.order_source === 'woocommerce' ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                                WC #{order.wc_order_id || order.order_number}
                            </span>
                        ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                CRM
                            </span>
                        )}
                        <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(order.created_at).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </span>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5 flex-wrap justify-end">
                        {order.ai_call_status && (
                            <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                    order.ai_call_status === 'confirmed'
                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                        : order.ai_call_status === 'rejected'
                                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                        : order.ai_call_status === 'calling'
                                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse'
                                        : order.ai_call_status === 'no_answer'
                                        ? 'bg-slate-800 text-slate-400 border-slate-700'
                                        : order.ai_call_status === 'busy'
                                        ? 'bg-slate-800 text-slate-400 border-slate-700'
                                        : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
                                }`}
                                title={order.ai_call_notes || `AI Call Status: ${order.ai_call_status}`}
                            >
                                <Bot className="w-3 h-3 text-indigo-400" />
                                <span>
                                    {order.ai_call_status === 'confirmed'
                                        ? 'AI Confirmed (১)'
                                        : order.ai_call_status === 'rejected'
                                        ? 'AI Cancelled (২)'
                                        : order.ai_call_status === 'calling'
                                        ? 'AI কল চলছে...'
                                        : order.ai_call_status === 'no_answer'
                                        ? 'কল ধরেনি'
                                        : order.ai_call_status === 'busy'
                                        ? 'ব্যস্ত'
                                        : order.ai_call_status}
                                </span>
                            </span>
                        )}
                        {order.ai_call_recording_url && (
                            <a
                                href={order.ai_call_recording_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-500/20 rounded transition-colors inline-flex items-center"
                                title="AI কল রেকর্ডিং শুনুন"
                            >
                                <Volume2 className="w-3.5 h-3.5" />
                            </a>
                        )}
                        {isCancelled ? (
                            <Badge variant="danger" size="xs">
                                ❌ বাতিলকৃত (Cancelled)
                            </Badge>
                        ) : isConfirmed ? (
                            <Badge variant="success" size="xs">
                                ✅ কনফার্মড (Confirmed)
                            </Badge>
                        ) : (
                            <Badge variant="warning" size="xs">
                                ⏳ {order.order_status}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Customer Information Row */}
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <div className="min-w-0">
                        <span className="text-xs font-bold text-white truncate flex items-center gap-1.5" title={resolveCustomerName(order)}>
                            <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="truncate">{resolveCustomerName(order)}</span>
                        </span>
                        <span className="text-[11px] font-mono text-indigo-300 block mt-0.5">
                            {rawPhone || 'No Phone'}
                        </span>
                    </div>
                    {rawPhone && (
                        <div className="flex items-center gap-1.5 shrink-0">
                            {onTriggerAiCall && !isCancelled && (
                                <button
                                    type="button"
                                    onClick={() => onTriggerAiCall(order)}
                                    disabled={actionLoadingId === `ai-${order.id}`}
                                    className="p-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                                    title="AI ভয়েস ভেরিফিকেশন কল দিন"
                                >
                                    {actionLoadingId === `ai-${order.id}` ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Bot className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            )}
                            <Link
                                to={`/call-center/ip-call?phone=${encodeURIComponent(rawPhone)}`}
                                className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1"
                                title="IP কল দিন"
                            >
                                <PhoneCall className="w-3.5 h-3.5" />
                            </Link>
                            <a
                                href={`https://wa.me/${waPhone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                title="WhatsApp"
                            >
                                <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    )}
                </div>

                {/* Product & Attribute Specs */}
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                    {(() => {
                        const items = extractOrderItems(order);
                        return items.map((it, idx) => (
                            <div key={idx} className="flex items-start gap-2.5 pb-2 border-b border-slate-850/60 last:border-0 last:pb-0">
                                <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0 mt-0.5">
                                    {order.product?.primary_image_url ? (
                                        <img src={order.product.primary_image_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <ShoppingBag className="w-4 h-4 text-indigo-400" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-white truncate" title={it.name}>
                                        {it.name}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        {it.size ? (
                                            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">
                                                Size: {it.size}
                                            </span>
                                        ) : (
                                            <span className="text-[9px] px-1 py-0.2 rounded font-mono bg-slate-800 text-slate-400">
                                                No Size
                                            </span>
                                        )}
                                        {it.color ? (
                                            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-purple-500/20 text-purple-200 border border-purple-500/30">
                                                Color: {it.color}
                                            </span>
                                        ) : null}
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${it.quantity > 1 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-300'}`}>
                                            Qty: {it.quantity}
                                        </span>
                                        {it.price > 0 && (
                                            <span className="text-[10px] text-slate-400 font-mono">
                                                ৳{it.price}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ));
                    })()}
                </div>

                {/* Pricing Breakdown */}
                <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-slate-950/40 border border-slate-800/60 text-xs">
                    <div>
                        <span className="text-[10px] text-slate-400 block">Unit Price:</span>
                        <span className="font-mono text-slate-200 font-semibold">৳{order.unit_price}</span>
                    </div>
                    <div>
                        <span className="text-[10px] text-slate-400 block">Delivery:</span>
                        <span className="font-mono text-slate-200 font-semibold">৳{order.delivery_charge}</span>
                    </div>
                    <div>
                        <span className="text-[10px] text-emerald-400 font-bold block">Total:</span>
                        <span className="font-mono text-emerald-300 font-black text-sm">৳{order.total_amount}</span>
                    </div>
                </div>

                {/* Customer Address & Courier Status */}
                <div className="text-[11px] text-slate-300 space-y-1">
                    <p className="flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{order.customer_address || 'ঠিকানা দেওয়া নেই'}</span>
                    </p>
                    {order.tracking_code ? (
                        <p className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                            <Truck className="w-3 h-3 text-emerald-400" />
                            <span>Steadfast Tracking: {order.tracking_code}</span>
                        </p>
                    ) : null}
                    {order.notes && (
                        <p className="text-[10px] text-amber-300/90 italic bg-amber-950/20 p-1.5 rounded border border-amber-500/20 line-clamp-2">
                            {order.notes}
                        </p>
                    )}
                </div>

                {/* Cancellation Details Box (If Cancelled) */}
                {isCancelled && (
                    <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs space-y-1.5 shadow-sm">
                        <div className="flex items-center justify-between border-b border-rose-500/20 pb-1.5 flex-wrap gap-1">
                            <span className="font-extrabold text-rose-300 flex items-center gap-1.5">
                                <XCircle className="w-4 h-4 text-rose-400" />
                                <span>বাতিল করেছেন: <strong className="text-white font-bold underline">{cancelledBy || 'CX Agent'}</strong></span>
                            </span>
                            {cancelledTime && (
                                <span className="text-[10px] text-rose-300/80 font-mono flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-rose-400" />
                                    <span>{cancelledTime}</span>
                                </span>
                            )}
                        </div>
                        {(() => {
                            const reasonText = rawData.cx_last_change?.after?.reason 
                                || (order.notes?.includes('[CX Cancelled') ? order.notes.match(/\[CX Cancelled[^\]]*\]/)?.[0] : null)
                                || order.return_reason
                                || 'গ্রাহক ডুপ্লিকেট অর্ডার করেছেন / বাতিল করতে চেয়েছেন';
                            return (
                                <p className="text-[11px] text-slate-300">
                                    <span className="text-slate-400 font-medium">কারণ:</span> <span className="italic text-rose-200">{reasonText}</span>
                                </p>
                            );
                        })()}
                    </div>
                )}

                {/* Resolution & Audit Trail History Box */}
                {hasHistory && (
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 flex-wrap gap-1">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                <span className="text-xs font-extrabold text-emerald-300 flex items-center gap-1">
                                    <History className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>সমাধান ও পরিবর্তন হিস্ট্রি</span>
                                </span>
                            </div>
                            {resolvedBy && (
                                <span className="text-[10px] font-bold text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1">
                                    <UserCheck className="w-3 h-3 text-emerald-400" />
                                    <span>সম্পাদনকারী: <strong className="text-emerald-400">{resolvedBy}</strong> {resolvedTime ? `(${resolvedTime})` : ''}</span>
                                </span>
                            )}
                        </div>

                        {lastChange?.before && lastChange?.after ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                {/* BEFORE ACTION */}
                                <div className="p-2.5 rounded-lg bg-amber-950/15 border border-amber-500/25 space-y-1.5">
                                    <div className="flex items-center justify-between text-amber-400 font-bold border-b border-amber-500/20 pb-1">
                                        <span>আগের পণ্য ও অবস্থা (Before)</span>
                                        <span className="text-[9px] text-amber-300/70 font-mono">পূর্বের হিসাব</span>
                                    </div>
                                    <div className="space-y-1 max-h-36 overflow-y-auto">
                                        {(lastChange.before.items || []).map((it, i) => (
                                            <div key={i} className="flex justify-between items-start gap-1 text-slate-300 text-[10px]">
                                                <div className="min-w-0">
                                                    <span className="font-semibold block truncate text-slate-200">{it.name}</span>
                                                    <div className="text-[9px] text-slate-400 font-mono">
                                                        {it.size ? `Size: ${it.size} ` : ''}
                                                        {it.color ? `Color: ${it.color} ` : ''}
                                                        <span>(Qty: {it.quantity} × ৳{it.price})</span>
                                                    </div>
                                                </div>
                                                <span className="font-mono text-slate-200 font-semibold shrink-0">৳{(it.quantity * it.price).toFixed(0)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-1 border-t border-amber-500/20 flex justify-between font-mono font-bold text-amber-200 text-[10px]">
                                        <span>মোট: {lastChange.before.quantity} পিস</span>
                                        <span>৳{parseFloat(lastChange.before.total_amount).toFixed(0)}</span>
                                    </div>
                                </div>

                                {/* AFTER ACTION */}
                                <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                                    <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-emerald-500/20 pb-1">
                                        <span>কনফার্ম/এডিটের পর (After)</span>
                                        <span className="text-[9px] text-emerald-300/70 font-mono capitalize">{lastChange.after.order_status || 'Confirmed'}</span>
                                    </div>
                                    <div className="space-y-1 max-h-36 overflow-y-auto">
                                        {(lastChange.after.items || []).map((it, i) => (
                                            <div key={i} className="flex justify-between items-start gap-1 text-emerald-200 text-[10px]">
                                                <div className="min-w-0">
                                                    <span className="font-semibold block truncate text-emerald-100">{it.name}</span>
                                                    <div className="text-[9px] text-emerald-300/80 font-mono">
                                                        {it.size ? `Size: ${it.size} ` : ''}
                                                        {it.color ? `Color: ${it.color} ` : ''}
                                                        <span>(Qty: {it.quantity} × ৳{it.price})</span>
                                                    </div>
                                                </div>
                                                <span className="font-mono font-bold text-emerald-300 shrink-0">৳{(it.quantity * it.price).toFixed(0)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-1 border-t border-emerald-500/20 flex justify-between font-mono font-bold text-emerald-300 text-[10px]">
                                        <span>মোট: {lastChange.after.quantity} পিস</span>
                                        <span>৳{parseFloat(lastChange.after.total_amount).toFixed(0)}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center justify-between">
                                <span>এই অর্ডারটি ভেরিফাই ও কনফার্ম করে সমাধান করা হয়েছে।</span>
                                <span className="font-mono font-bold text-xs">৳{order.total_amount}</span>
                            </div>
                        )}

                        {/* Detailed Timeline if multiple actions taken */}
                        {historyList.length > 1 && (
                            <details className="text-[10px] text-slate-400 pt-1 cursor-pointer">
                                <summary className="hover:text-slate-200 font-semibold flex items-center gap-1">
                                    <span>সম্পূর্ণ অ্যাকশন হিস্ট্রি দেখুন ({historyList.length}টি অ্যাকশন)</span>
                                </summary>
                                <div className="mt-2 space-y-1 pl-2 border-l-2 border-slate-800">
                                    {historyList.map((h, idx) => (
                                        <div key={idx} className="space-y-0.5 text-[10px]">
                                            <div className="text-slate-200 font-medium">
                                                #{idx + 1} <strong>{h.title || h.action}</strong> — <span className="text-emerald-400 font-bold">{h.performed_by}</span> ({h.formatted_time || ''})
                                            </div>
                                            {h.note && <div className="text-slate-400 italic text-[9px]">{h.note}</div>}
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </div>
                )}
            </div>

            {/* Actions Toolbar */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Quick Set Qty 1 button */}
                    {order.quantity > 1 && !isCancelled && (
                        <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => onSetQtyOne(order.id)}
                            className="px-2.5 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-600 text-cyan-200 hover:text-white border border-cyan-500/40 text-xs font-bold transition-all cursor-pointer"
                            title="কোয়ান্টিটি ১ পিস করে টোটাল রিক্যালকুলেট করুন"
                        >
                            Qty ১ করুন
                        </button>
                    )}

                    {/* Edit Order */}
                    <button
                        type="button"
                        onClick={() => onEdit(order)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                    >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                    </button>

                    {/* AI Verification Call */}
                    {!isCancelled && onTriggerAiCall && (
                        <button
                            type="button"
                            disabled={isActionLoading || actionLoadingId === `ai-${order.id}`}
                            onClick={() => onTriggerAiCall(order)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                            title="গ্রাহককে AI Verification কল পাঠান"
                        >
                            {actionLoadingId === `ai-${order.id}` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <Bot className="w-3 h-3" />
                            )}
                            <span>AI Call</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Cancel / Reject Order Button */}
                    {!isCancelled ? (
                        <button
                            type="button"
                            onClick={() => onCancel(order)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                            title="এই অর্ডারটি বাতিল (Reject) করুন"
                        >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>বাতিল (Cancel)</span>
                        </button>
                    ) : (
                        <span className="text-xs font-bold text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30">
                            বাতিল করা হয়েছে
                        </span>
                    )}

                    {/* Confirm Button (if not confirmed & not cancelled) */}
                    {!isConfirmed && !isCancelled && (
                        <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => onConfirm(order.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="এই অর্ডারটি কনফার্ম করুন"
                        >
                            {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            <span>কনফার্ম (Confirm)</span>
                        </button>
                    )}

                    {/* Confirmed Badge */}
                    {isConfirmed && !isCancelled && (
                        <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>কনফার্মড</span>
                        </span>
                    )}

                    {/* Resolve (সমাধান হয়েছে) Button ONLY for Standalone Multi-Qty Cards (in duplicate group, use top header resolve button) */}
                    {!isDuplicateSubCard && !isCancelled && !isResolved && (
                        <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => (onResolve ? onResolve(order.id) : onConfirm(order.id))}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-950/50 transition-all cursor-pointer"
                            title="এই অর্ডারটি সমাধান (Resolve) করুন"
                        >
                            {isActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            <span>Resolve (সমাধান হয়েছে)</span>
                        </button>
                    )}

                    {/* Resolved Badge for Standalone Cards */}
                    {!isDuplicateSubCard && isResolved && !isCancelled && (
                        <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>সমাধান হয়েছে</span>
                        </span>
                    )}

                    {/* Steadfast Dispatch button if confirmed and no tracking */}
                    {isConfirmed && !isCancelled && !order.tracking_code && (
                        <button
                            type="button"
                            disabled={isDispatching}
                            onClick={() => onDispatchSteadfast(order)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-indigo-950/50 transition-all cursor-pointer"
                            title="Steadfast কুরিয়ারে বুকিং দিন"
                        >
                            <Truck className="w-3 h-3" />
                            <span>কুরিয়ারে পাঠান</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export const CxOperationsPage = () => {
    const [cxData, setCxData] = useState({
        duplicate_groups: [],
        multi_qty_orders: [],
        cancelled_orders: [],
        other_resolved_orders: [],
    });

    const [meta, setMeta] = useState({
        total_review_needed: 0,
        duplicate_groups_count: 0,
        multi_qty_count: 0,
        resolved_count: 0,
        cancelled_count: 0,
        days: 10,
    });

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all'); // all, duplicates, multi_qty, resolved, cancelled
    const [search, setSearch] = useState('');
    const [days, setDays] = useState(10);
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [groupResolvingId, setGroupResolvingId] = useState(null);

    // Edit Order Modal State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [editForm, setEditForm] = useState({
        quantity: 1,
        size: '',
        color: '',
        unit_price: 0,
        delivery_charge: 0,
        total_amount: 0,
        customer_name: '',
        customer_phone: '',
        customer_address: '',
        customer_email: '',
        notes: '',
        order_status: 'confirmed',
    });
    const [savingEdit, setSavingEdit] = useState(false);

    // Cancel Order Prompt State
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [orderToCancel, setOrderToCancel] = useState(null);
    const [cancelReason, setCancelReason] = useState('গ্রাহক ডুপ্লিকেট অর্ডার করেছেন / একটি বাতিল করতে বলেছেন');
    const [cancelling, setCancelling] = useState(false);

    // Steadfast Courier dispatch state
    const [dispatchingId, setDispatchingId] = useState(null);

    const fetchCxOrders = async () => {
        try {
            setLoading(true);
            const params = {
                tab: activeTab,
                days: days,
            };
            if (search.trim()) params.search = search.trim();

            const res = await api.get('/orders/cx-operations', { params });
            if (res.data.status === 'success') {
                const d = res.data.data || {};
                setCxData({
                    duplicate_groups: d.duplicate_groups || [],
                    multi_qty_orders: d.multi_qty_orders || [],
                    cancelled_orders: d.cancelled_orders || [],
                    other_resolved_orders: d.other_resolved_orders || [],
                });
                setMeta(res.data.meta || {});
            }
        } catch (err) {
            console.error('Failed to load CX operations orders:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCxOrders();
    }, [activeTab, days]);

    // Live auto-refresh CX data periodically
    useEffect(() => {
        const interval = setInterval(() => {
            if (!document.hidden && !loading) {
                fetchCxOrders();
            }
        }, 30000);

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                fetchCxOrders();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [activeTab, days, loading]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchCxOrders();
    };

    // Quick Action on single order: Confirm, Set Qty to 1, Cancel, or Resolve
    const handleQuickAction = async (orderId, action, extra = {}) => {
        try {
            setActionLoadingId(orderId);
            const payload = { action, ...extra };
            const res = await api.post(`/orders/${orderId}/cx-action`, payload);

            if (res.data.status === 'success') {
                await fetchCxOrders();
            }
        } catch (err) {
            alert('Action failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setActionLoadingId(null);
        }
    };

    // AI Verification Call Trigger
    const handleTriggerAiCall = async (order) => {
        const phone = order.customer_phone || order.customer?.phone;
        if (!phone) {
            alert('গ্রাহকের কোনো ফোন নম্বর নেই!');
            return;
        }

        const confirmCall = window.confirm(
            `📞 AI Order Verification Call\n\nগ্রাহক: ${resolveCustomerName(order)}\nফোন: ${phone}\nঅর্ডার: #${order.order_number}\n\nসিস্টেম গ্রাহককে কল করে পণ্য নিশ্চিত (১) বা বাতিল (২) করতে বলবে। কল পাঠাতে চান?`
        );
        if (!confirmCall) return;

        try {
            setActionLoadingId(`ai-${order.id}`);
            const res = await api.post(`/orders/${order.id}/ai-call`);
            if (res.data.status === 'success') {
                alert(`✅ ${res.data.message || 'AI কল সফলভাবে ডায়াল করা হচ্ছে!'}`);
                await fetchCxOrders();
            } else {
                alert(`❌ ${res.data.message || 'AI কল ব্যর্থ হয়েছে'}`);
            }
        } catch (err) {
            alert(`❌ AI কল শুরু করতে সমস্যা হয়েছে: ${err.response?.data?.message || err.message}`);
        } finally {
            setActionLoadingId(null);
        }
    };

    // ONE RESOLVE BUTTON AT THE TOP OF THE DUPLICATE PROBLEM
    const handleResolveGroup = async (group, reopen = false) => {
        try {
            setGroupResolvingId(group.group_id);
            const orderIds = group.orders.map((o) => o.id);
            const payload = {
                order_ids: orderIds,
                reopen: reopen,
            };

            const res = await api.post('/orders/cx-resolve-group', payload);
            if (res.data.status === 'success') {
                await fetchCxOrders();
            }
        } catch (err) {
            alert('Resolve failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setGroupResolvingId(null);
        }
    };

    // Open Edit Order Modal
    const openEditModal = (order) => {
        setEditingOrder(order);
        const parsedItems = extractOrderItems(order);
        const totalQty = parsedItems.reduce((acc, it) => acc + (parseInt(it.quantity, 10) || 0), 0);
        const itemsTotal = parsedItems.reduce((acc, it) => acc + ((parseInt(it.quantity, 10) || 0) * (parseFloat(it.price) || 0)), 0);
        const delivery = parseFloat(order.delivery_charge) || 0;
        const totalAmount = parseFloat(order.total_amount) || (itemsTotal + delivery);

        setEditForm({
            items: parsedItems,
            quantity: totalQty || order.quantity || 1,
            delivery_charge: delivery,
            total_amount: totalAmount,
            customer_name: resolveCustomerName(order),
            customer_phone: order.customer_phone || order.customer?.phone || '',
            customer_address: order.customer_address || '',
            customer_email: order.customer_email || order.customer?.email || '',
            notes: order.notes || '',
            order_status: order.order_status || 'confirmed',
        });
        setEditModalOpen(true);
    };

    // Update single item attribute in editForm
    const handleItemChange = (idx, field, value) => {
        setEditForm((prev) => {
            const updatedItems = [...prev.items];
            updatedItems[idx] = { ...updatedItems[idx], [field]: value };

            const totalQty = updatedItems.reduce((acc, it) => acc + (parseInt(it.quantity, 10) || 0), 0);
            const itemsTotal = updatedItems.reduce((acc, it) => acc + ((parseInt(it.quantity, 10) || 0) * (parseFloat(it.price) || 0)), 0);
            const delivery = parseFloat(prev.delivery_charge) || 0;

            return {
                ...prev,
                items: updatedItems,
                quantity: totalQty,
                total_amount: itemsTotal + delivery,
            };
        });
    };

    // Remove an item from the order
    const handleRemoveItem = (idx) => {
        setEditForm((prev) => {
            if (prev.items.length <= 1) {
                alert('অন্তত একটি পণ্য অর্ডারে থাকতে হবে।');
                return prev;
            }
            const updatedItems = prev.items.filter((_, i) => i !== idx);
            const totalQty = updatedItems.reduce((acc, it) => acc + (parseInt(it.quantity, 10) || 0), 0);
            const itemsTotal = updatedItems.reduce((acc, it) => acc + ((parseInt(it.quantity, 10) || 0) * (parseFloat(it.price) || 0)), 0);
            const delivery = parseFloat(prev.delivery_charge) || 0;

            return {
                ...prev,
                items: updatedItems,
                quantity: totalQty,
                total_amount: itemsTotal + delivery,
            };
        });
    };

    // Delivery charge change
    const handleDeliveryChargeChange = (value) => {
        setEditForm((prev) => {
            const delivery = parseFloat(value) || 0;
            const itemsTotal = prev.items.reduce((acc, it) => acc + ((parseInt(it.quantity, 10) || 0) * (parseFloat(it.price) || 0)), 0);
            return {
                ...prev,
                delivery_charge: delivery,
                total_amount: itemsTotal + delivery,
            };
        });
    };

    // Handle Edit Form basic field changes
    const handleEditFormChange = (field, value) => {
        setEditForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    // Save Edit Form
    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editingOrder) return;

        try {
            setSavingEdit(true);
            const payload = {
                items_data: editForm.items,
                quantity: editForm.quantity,
                size: editForm.items[0]?.size || '',
                color: editForm.items[0]?.color || '',
                unit_price: editForm.items[0]?.price || 0,
                delivery_charge: editForm.delivery_charge,
                total_amount: editForm.total_amount,
                customer_name: editForm.customer_name,
                customer_phone: editForm.customer_phone,
                customer_address: editForm.customer_address,
                customer_email: editForm.customer_email,
                notes: editForm.notes,
                order_status: editForm.order_status,
            };

            const res = await api.put(`/orders/${editingOrder.id}`, payload);
            if (res.data.status === 'success') {
                alert(`✅ Order #${editingOrder.order_number} updated successfully!`);
                setEditModalOpen(false);
                setEditingOrder(null);
                fetchCxOrders();
            }
        } catch (err) {
            alert('Failed to update order: ' + (err.response?.data?.message || err.message));
        } finally {
            setSavingEdit(false);
        }
    };

    // Open Cancel Prompt
    const openCancelModal = (order) => {
        setOrderToCancel(order);
        setCancelReason('গ্রাহক ডুপ্লিকেট অর্ডার করেছেন / একটি বাতিল করতে বলেছেন');
        setCancelModalOpen(true);
    };

    const handleConfirmCancel = async () => {
        if (!orderToCancel) return;
        try {
            setCancelling(true);
            await handleQuickAction(orderToCancel.id, 'cancel', { reason: cancelReason });
            setCancelModalOpen(false);
            setOrderToCancel(null);
        } finally {
            setCancelling(false);
        }
    };

    // Dispatch to Steadfast Courier
    const handleDispatchSteadfast = async (order) => {
        if (!confirm(`Are you sure you want to send Order #${order.order_number} to Steadfast Courier?`)) {
            return;
        }

        try {
            setDispatchingId(order.id);
            const res = await api.post(`/courier/steadfast/send-order/${order.id}`);
            if (res.data.status === 'success') {
                const tracking = res.data.data?.tracking_code || '';
                alert(`✅ Order #${order.order_number} successfully dispatched to Steadfast!\nTracking Code: ${tracking}`);
                fetchCxOrders();
            }
        } catch (err) {
            alert(`❌ Steadfast Dispatch Error: ${err.response?.data?.message || err.message}`);
        } finally {
            setDispatchingId(null);
        }
    };

    const hasDuplicateGroups = cxData.duplicate_groups.length > 0;
    const hasMultiQtyOrders = cxData.multi_qty_orders.length > 0;
    const hasOtherResolved = cxData.other_resolved_orders.length > 0;
    const isFeedEmpty = !hasDuplicateGroups && !hasMultiQtyOrders && !hasOtherResolved;

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <Headphones className="w-3.5 h-3.5" /> CX Operations Desk
                        </span>
                        <span className="text-xs text-slate-400">· সমস্যা ভিত্তিক অর্ডার ভেরিফিকেশন ও সমাধান</span>
                    </div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2 mt-1">
                        Customer Experience (CX) Verification
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                        একই গ্রাহকের ডুপ্লিকেট অর্ডারকে একটি সমস্যা (Case) হিসেবে ধরা হয়েছে। কাস্টমারকে কল দিয়ে কোনটি কনফার্ম ও কোনটি বাতিল করবেন ঠিক করুন, তারপর উপরে থাকা <strong>Resolve</strong> বাটনে ক্লিক করলে পুরো কেসটি সমাধান হয়ে পাশের <strong>Resolved</strong> ট্যাবে চলে যাবে।
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <select
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value, 10))}
                        className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                        <option value={7}>গত ৭ দিনের অর্ডার</option>
                        <option value={10}>গত ১০ দিনের অর্ডার (ডিফল্ট)</option>
                        <option value={15}>গত ১৫ দিনের অর্ডার</option>
                        <option value={30}>গত ৩০ দিনের অর্ডার</option>
                    </select>

                    <Button
                        variant="secondary"
                        size="sm"
                        icon={RefreshCw}
                        loading={loading}
                        onClick={fetchCxOrders}
                        title="রিলোড করুন"
                    >
                        Refresh
                    </Button>
                </div>
            </div>

            {/* KPI Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                <Card
                    onClick={() => setActiveTab('all')}
                    className={`cursor-pointer transition-all ${
                        activeTab === 'all'
                            ? 'bg-indigo-950/40 border-indigo-500/60 ring-2 ring-indigo-500/30'
                            : 'hover:border-slate-700'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">সব সমস্যা (পেন্ডিং)</span>
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    </div>
                    <p className="text-2xl font-black text-white mt-1">{meta.total_review_needed || 0}</p>
                    <p className="text-[10px] text-amber-400 mt-0.5 font-medium">Pending Review</p>
                </Card>

                <Card
                    onClick={() => setActiveTab('duplicates')}
                    className={`cursor-pointer transition-all ${
                        activeTab === 'duplicates'
                            ? 'bg-rose-950/40 border-rose-500/60 ring-2 ring-rose-500/30'
                            : 'hover:border-slate-700'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">ডুপ্লিকেট কেস</span>
                        <Copy className="w-4 h-4 text-rose-400" />
                    </div>
                    <p className="text-2xl font-black text-rose-300 mt-1">{meta.duplicate_groups_count || 0}</p>
                    <p className="text-[10px] text-rose-400 mt-0.5 font-medium">Duplicate Cases</p>
                </Card>

                <Card
                    onClick={() => setActiveTab('multi_qty')}
                    className={`cursor-pointer transition-all ${
                        activeTab === 'multi_qty'
                            ? 'bg-cyan-950/40 border-cyan-500/60 ring-2 ring-cyan-500/30'
                            : 'hover:border-slate-700'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">একাধিক পিস (Qty &gt; 1)</span>
                        <Package className="w-4 h-4 text-cyan-400" />
                    </div>
                    <p className="text-2xl font-black text-cyan-300 mt-1">{meta.multi_qty_count || 0}</p>
                    <p className="text-[10px] text-cyan-400 mt-0.5 font-medium">Cart Bulk Quantity</p>
                </Card>

                <Card
                    onClick={() => setActiveTab('resolved')}
                    className={`cursor-pointer transition-all ${
                        activeTab === 'resolved'
                            ? 'bg-emerald-950/40 border-emerald-500/60 ring-2 ring-emerald-500/30'
                            : 'hover:border-slate-700'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">Resolved (সমাধান ও বাতিল)</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-2xl font-black text-emerald-300 mt-1">{meta.resolved_count || 0}</p>
                    <p className="text-[10px] text-emerald-400 mt-0.5 font-medium">Resolved & Cancelled</p>
                </Card>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-2xl border border-slate-800">
                {/* Tabs */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <button
                        type="button"
                        onClick={() => setActiveTab('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'all'
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-900'
                        }`}
                    >
                        সব রিভিউ প্রয়োজন ({meta.total_review_needed || 0})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('duplicates')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'duplicates'
                                ? 'bg-rose-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-900'
                        }`}
                    >
                        🔁 ডুপ্লিকেট সমস্যা ({meta.duplicate_groups_count || 0})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('multi_qty')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'multi_qty'
                                ? 'bg-cyan-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-900'
                        }`}
                    >
                        📦 একাধিক কোয়ান্টিটি ({meta.multi_qty_count || 0})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('resolved')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            activeTab === 'resolved'
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/50'
                                : 'text-emerald-400 hover:text-white hover:bg-slate-900 border border-emerald-500/20'
                        }`}
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolved ও বাতিলকৃত ({meta.resolved_count || 0})</span>
                    </button>
                </div>

                {/* Search */}
                <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:max-w-xs">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="ফোন নম্বর, নাম বা অর্ডার আইডি খুঁজুন..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                </form>
            </div>

            {/* Orders Feed */}
            {loading ? (
                <div className="py-24 text-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-400">ডুপ্লিকেট সমস্যা ও অর্ডার বিশ্লেষণ করা হচ্ছে...</p>
                </div>
            ) : isFeedEmpty ? (
                <div className="py-20 text-center bg-slate-950/40 rounded-3xl border border-slate-800 p-8">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-80" />
                    <h3 className="text-base font-bold text-white">সব সমস্যা সমাধান (Resolved) সম্পন্ন!</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        {activeTab === 'duplicates'
                            ? 'গত ১০ দিনে কোনো আনভেরিফাইড ডুপ্লিকেট সমস্যার রেকর্ড পাওয়া যায়নি।'
                            : activeTab === 'multi_qty'
                            ? 'একাধিক কোয়ান্টিটির কোনো আনভেরিফাইড অর্ডার নেই।'
                            : activeTab === 'resolved'
                            ? 'এখনো কোনো সমস্যা বা অর্ডার সমাধান করা হয়নি।'
                            : 'এই মুহূর্তে কোনো ডুপ্লিকেট বা অস্বাভাবিক সমস্যার রিভিউ বাকি নেই।'}
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* SECTION 1: DUPLICATE PROBLEM CASES (Both orders side-by-side + ONE Resolve button at top) */}
                    {hasDuplicateGroups && (
                        <div className="space-y-4">
                            {cxData.duplicate_groups.map((group) => {
                                const rawPhone = group.customer_phone || group.normalized_phone || '';
                                const cleanDigits = rawPhone.replace(/[^0-9]/g, '');
                                const waPhone = cleanDigits.startsWith('880') ? cleanDigits : (cleanDigits.startsWith('0') ? '88' + cleanDigits : '880' + cleanDigits);
                                const isGroupResolving = groupResolvingId === group.group_id;
                                const isGroupResolved = group.is_resolved;

                                return (
                                    <div
                                        key={group.group_id}
                                        className={`p-4 sm:p-5 rounded-2xl border-2 space-y-4 shadow-xl transition-all ${
                                            isGroupResolved
                                                ? 'border-emerald-500/40 bg-gradient-to-b from-emerald-950/20 via-slate-900/90 to-slate-950'
                                                : 'border-rose-500/40 bg-gradient-to-b from-rose-950/20 via-slate-900/90 to-slate-950'
                                        }`}
                                    >
                                        {/* Duplicate Group Header: Customer Info + ONE Top Resolve Button */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-500/20">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 font-bold ${
                                                    isGroupResolved
                                                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                                                        : 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                                                }`}>
                                                    {isGroupResolved ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5 animate-pulse" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-base font-extrabold text-white">
                                                            {group.customer_name || resolveCustomerName(group.orders?.[0])}
                                                        </span>
                                                        <span className="text-xs font-mono font-bold text-rose-300 bg-rose-950/80 px-2.5 py-0.5 rounded border border-rose-500/30">
                                                            {rawPhone || 'No Phone'}
                                                        </span>
                                                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                                                            isGroupResolved
                                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                                        }`}>
                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                            ডুপ্লিকেট সমস্যা ({group.orders.length}টি অর্ডার)
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                        <span>{group.customer_address || 'ঠিকানা দেওয়া নেই'}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Top Right Group Action Buttons: IP Call + WhatsApp + ONE Resolve Button */}
                                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                                {rawPhone && group.orders.length > 0 && !isGroupResolved && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleTriggerAiCall(group.orders[0])}
                                                        disabled={actionLoadingId === `ai-${group.orders[0].id}`}
                                                        className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                                        title="গ্রাহককে AI Verification কল পাঠান"
                                                    >
                                                        {actionLoadingId === `ai-${group.orders[0].id}` ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <Bot className="w-3.5 h-3.5" />
                                                        )}
                                                        <span>AI Call</span>
                                                    </button>
                                                )}

                                                {rawPhone && (
                                                    <Link
                                                        to={`/call-center/ip-call?phone=${encodeURIComponent(rawPhone)}`}
                                                        className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                                        title="গ্রাহককে IP কল দিন (ePBX Dialer)"
                                                    >
                                                        <PhoneCall className="w-3.5 h-3.5 animate-pulse" />
                                                        <span>কল দিন (IP Call)</span>
                                                    </Link>
                                                )}

                                                {rawPhone && (
                                                    <a
                                                        href={`https://wa.me/${waPhone}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all"
                                                        title="WhatsApp-এ মেসেজ দিন"
                                                    >
                                                        <MessageCircle className="w-4 h-4" />
                                                    </a>
                                                )}

                                                {/* RESOLUTION STATUS BADGE (AUTO-RESOLVED) */}
                                                {isGroupResolved ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-3 py-1.5 rounded-xl border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                            <span>সমাধানকৃত (Resolved)</span>
                                                            {group.resolved_by && (
                                                                <span className="text-[10px] text-emerald-200 font-semibold ml-1">
                                                                    • {group.resolved_by}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            disabled={isGroupResolving}
                                                            onClick={() => handleResolveGroup(group, true)}
                                                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
                                                            title="পুনরায় পেন্ডিং রিভিউতে ফেরত পাঠান"
                                                        >
                                                            <RotateCcw className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={isGroupResolving}
                                                        onClick={() => handleResolveGroup(group, false)}
                                                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer"
                                                        title="সম্পূর্ণ কেসটি সমাধান (Resolve) হিসেবে চিহ্নিত করুন"
                                                    >
                                                        {isGroupResolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                                        <span>Resolve (সমাধান হয়েছে)</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actionable Notice Banner */}
                                        <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                                            isGroupResolved
                                                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                                                : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
                                        }`}>
                                            <AlertTriangle className={`w-4 h-4 shrink-0 ${isGroupResolved ? 'text-emerald-400' : 'text-rose-400'}`} />
                                            <span>
                                                <strong>সমস্যা বিশ্লেষণ:</strong> গ্রাহক গত ১০ দিনে একই পণ্য <strong>{group.product_name}</strong> {group.orders.length} বার অর্ডার করেছেন। কাস্টমারের সাথে কথা বলে অপ্রয়োজনীয় অর্ডারটি <strong>বাতিল (Cancel)</strong> করুন এবং প্রয়োজনীয় অর্ডারে বা উপরে থাকা <strong>Resolve (সমাধান হয়েছে)</strong> বাটনে ক্লিক করুন।
                                            </span>
                                        </div>

                                        {/* Side-by-Side Sibling Orders Display */}
                                        <div className={`grid grid-cols-1 ${group.orders.length >= 2 ? 'lg:grid-cols-2' : ''} gap-4`}>
                                            {group.orders.map((order, idx) => (
                                                <OrderCard
                                                    key={order.id}
                                                    order={order}
                                                    isDuplicateSubCard={true}
                                                    orderIndex={idx + 1}
                                                    onEdit={openEditModal}
                                                    onCancel={openCancelModal}
                                                    onConfirm={(id) => handleQuickAction(id, 'confirm')}
                                                    onResolve={(id) => handleQuickAction(id, 'resolve')}
                                                    onSetQtyOne={(id) => handleQuickAction(id, 'set_qty_one')}
                                                    onDispatchSteadfast={handleDispatchSteadfast}
                                                    onTriggerAiCall={handleTriggerAiCall}
                                                    actionLoadingId={actionLoadingId}
                                                    dispatchingId={dispatchingId}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* SECTION 2: STANDALONE MULTI-QUANTITY ORDERS */}
                    {hasMultiQtyOrders && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-1.5 px-1">
                                <Package className="w-4 h-4 text-cyan-400" />
                                <span>একই পণ্য ও সাইজে একাধিক কোয়ান্টিটি (Same Product & Size Qty &ge; 2)</span>
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {cxData.multi_qty_orders.map((order) => (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        isDuplicateSubCard={false}
                                        onEdit={openEditModal}
                                        onCancel={openCancelModal}
                                        onConfirm={(id) => handleQuickAction(id, 'confirm')}
                                        onResolve={(id) => handleQuickAction(id, 'resolve')}
                                        onSetQtyOne={(id) => handleQuickAction(id, 'set_qty_one')}
                                        onDispatchSteadfast={handleDispatchSteadfast}
                                        onTriggerAiCall={handleTriggerAiCall}
                                        actionLoadingId={actionLoadingId}
                                        dispatchingId={dispatchingId}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SECTION 3: OTHER RESOLVED & CANCELLED ORDERS (when on resolved tab) */}
                    {hasOtherResolved && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-1.5 px-1">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span>অন্যান্য সমাধানকৃত ও বাতিলকৃত অর্ডারসমূহ</span>
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {cxData.other_resolved_orders.map((order) => (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        isDuplicateSubCard={false}
                                        onEdit={openEditModal}
                                        onCancel={openCancelModal}
                                        onConfirm={(id) => handleQuickAction(id, 'confirm')}
                                        onResolve={(id) => handleQuickAction(id, 'resolve')}
                                        onSetQtyOne={(id) => handleQuickAction(id, 'set_qty_one')}
                                        onDispatchSteadfast={handleDispatchSteadfast}
                                        onTriggerAiCall={handleTriggerAiCall}
                                        actionLoadingId={actionLoadingId}
                                        dispatchingId={dispatchingId}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Edit Order Modal */}
            {editModalOpen && editingOrder && (
                <Modal
                    isOpen={editModalOpen}
                    onClose={() => setEditModalOpen(false)}
                    title={`✏️ Edit Order #${String(editingOrder.order_number || '').replace(/^#+/, '')}`}
                >
                    <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
                        {/* Customer Information */}
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-indigo-400" /> গ্রাহকের তথ্য
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">গ্রাহকের নাম</label>
                                    <input
                                        type="text"
                                        value={editForm.customer_name}
                                        onChange={(e) => handleEditFormChange('customer_name', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">ফোন নম্বর</label>
                                    <input
                                        type="text"
                                        value={editForm.customer_phone}
                                        onChange={(e) => handleEditFormChange('customer_phone', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">ডেলিভারি ঠিকানা</label>
                                <textarea
                                    rows={2}
                                    value={editForm.customer_address}
                                    onChange={(e) => handleEditFormChange('customer_address', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
                                />
                            </div>
                        </div>

                        {/* Ordered Products Section */}
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                            <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                                <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                                    <Package className="w-4 h-4 text-cyan-400" />
                                    <span>অর্ডারকৃত পণ্যসমূহ ({editForm.items?.length || 1}টি আইটেম)</span>
                                </h4>
                                <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-bold">
                                    মোট কোয়ান্টিটি: {editForm.quantity} পিস
                                </span>
                            </div>

                            <div className="space-y-3">
                                {editForm.items && editForm.items.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 relative group hover:border-slate-700 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center text-[10px] font-black shrink-0">
                                                    #{idx + 1}
                                                </span>
                                                <span className="text-[11px] text-slate-300 font-bold">
                                                    আইটেম {idx + 1}
                                                </span>
                                            </div>
                                            {editForm.items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(idx)}
                                                    className="text-rose-400 hover:text-rose-300 text-[10px] font-semibold flex items-center gap-1 p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                                                    title="এই পণ্যটি অর্ডার থেকে মুছে ফেলুন"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                    <span>মুছুন</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Product Name Input */}
                                        <div>
                                            <label className="block text-[11px] text-slate-400 mb-1 font-medium">পণ্যের নাম (Product Name)</label>
                                            <input
                                                type="text"
                                                value={item.name}
                                                onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:border-cyan-500"
                                                placeholder="Product Name"
                                            />
                                        </div>

                                        {/* Attributes: Size, Color, Quantity, Unit Price */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <div>
                                                <label className="block text-[10px] text-slate-400 mb-1 font-medium">Size (সাইজ)</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. 8-9-year, M, L"
                                                    value={item.size}
                                                    onChange={(e) => handleItemChange(idx, 'size', e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-indigo-200 font-mono focus:border-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-slate-400 mb-1 font-medium">Color (কালার)</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Red, Blue"
                                                    value={item.color}
                                                    onChange={(e) => handleItemChange(idx, 'color', e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-purple-200 font-mono focus:border-purple-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-slate-400 mb-1 font-medium">Quantity (পিস)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-cyan-300 font-bold font-mono focus:border-cyan-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-slate-400 mb-1 font-medium">Unit Price (৳)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={item.price}
                                                    onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="text-right text-[11px] text-slate-400 font-mono pt-0.5">
                                            আইটেম সাবটোটাল: <strong className="text-slate-200">৳{((item.quantity || 1) * (item.price || 0)).toFixed(0)}</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Pricing & Calculations */}
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                                <ShoppingBag className="w-3.5 h-3.5 text-indigo-400" /> মূল্য ও ডেলিভারি হিসাব
                            </h4>
                            <div className="grid grid-cols-3 gap-2.5">
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">মোট আইটেম কোয়ান্টিটি</label>
                                    <div className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-bold font-mono">
                                        {editForm.quantity} পিস
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">Delivery Charge (৳)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editForm.delivery_charge}
                                        onChange={(e) => handleDeliveryChargeChange(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1 font-bold text-emerald-400">Total Amount (৳)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editForm.total_amount}
                                        onChange={(e) => setEditForm({ ...editForm, total_amount: parseFloat(e.target.value) || 0 })}
                                        className="w-full bg-slate-900 border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-bold font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Order Status & Notes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Order Status</label>
                                <select
                                    value={editForm.order_status}
                                    onChange={(e) => handleEditFormChange('order_status', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                >
                                    <option value="pending_confirmation">Pending Confirmation</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="processing">Processing</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Internal Notes</label>
                                <input
                                    type="text"
                                    placeholder="e.g. কাস্টমার ফোন করে কনফার্ম করেছেন"
                                    value={editForm.notes}
                                    onChange={(e) => handleEditFormChange('notes', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditModalOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                loading={savingEdit}
                                icon={Check}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Cancel Order Prompt Modal */}
            {cancelModalOpen && orderToCancel && (
                <Modal
                    isOpen={cancelModalOpen}
                    onClose={() => setCancelModalOpen(false)}
                    title={`❌ Cancel Order #${String(orderToCancel.order_number || '').replace(/^#+/, '')}`}
                >
                    <div className="space-y-4 text-xs">
                        <p className="text-slate-300">
                            আপনি কি নিশ্চিত যে আপনি অর্ডার <strong className="text-white font-mono">#{String(orderToCancel.order_number || '').replace(/^#+/, '')}</strong> বাতিল করতে চান?
                        </p>

                        <div>
                            <label className="block text-[11px] text-slate-400 mb-1">বাতিলের কারণ (Cancellation Reason)</label>
                            <select
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                            >
                                <option value="গ্রাহক ভুল করে একই পণ্য একাধিকবার অর্ডার করেছেন (Duplicate)">গ্রাহক ভুল করে একই পণ্য একাধিকবার অর্ডার করেছেন (Duplicate)</option>
                                <option value="গ্রাহক ফোন রিসিভ করছেন না">গ্রাহক ফোন রিসিভ করছেন না</option>
                                <option value="গ্রাহক নিতে অনিচ্ছুক / অর্ডার বাতিল চেয়েছেন">গ্রাহক নিতে অনিচ্ছুক / অর্ডার বাতিল চেয়েছেন</option>
                                <option value="ভুল ঠিকানা বা ফেইক অর্ডার">ভুল ঠিকানা বা ফেইক অর্ডার</option>
                            </select>
                        </div>

                        <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setCancelModalOpen(false)}
                            >
                                ফিরে যান
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                loading={cancelling}
                                onClick={handleConfirmCancel}
                                className="bg-rose-600 hover:bg-rose-500 text-white"
                            >
                                অর্ডার বাতিল নিশ্চিত করুন
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
