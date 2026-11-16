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
} from 'lucide-react';

/**
 * Reusable Individual Order Card (used both inside Duplicate Groups and Standalone).
 */
const OrderCard = ({
    order,
    isDuplicateSubCard = false,
    orderIndex = 1,
    onEdit,
    onCancel,
    onResolve,
    onSetQtyOne,
    onDispatchSteadfast,
    actionLoadingId,
    dispatchingId,
}) => {
    const isCancelled = order.order_status === 'cancelled';
    const isResolved = order.is_cx_resolved;
    const isActionLoading = actionLoadingId === order.id;
    const isDispatching = dispatchingId === order.id;

    const rawPhone = order.customer_phone || order.customer?.phone || '';
    const cleanDigits = rawPhone.replace(/[^0-9]/g, '');
    const waPhone = cleanDigits.startsWith('880') ? cleanDigits : (cleanDigits.startsWith('0') ? '88' + cleanDigits : '880' + cleanDigits);

    return (
        <div
            className={`rounded-xl border transition-all p-3.5 space-y-3 flex flex-col justify-between ${
                isCancelled
                    ? 'border-rose-900/40 bg-slate-950/60 opacity-80'
                    : isResolved
                    ? 'border-emerald-500/40 bg-gradient-to-b from-slate-900/90 to-emerald-950/20'
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

                    <div className="shrink-0 flex items-center gap-1.5">
                        {isCancelled ? (
                            <Badge variant="danger" size="xs">
                                ❌ বাতিলকৃত (Cancelled)
                            </Badge>
                        ) : isResolved ? (
                            <Badge variant="success" size="xs">
                                ✅ সমাধান হয়েছে (Resolved)
                            </Badge>
                        ) : (
                            <Badge
                                variant={order.order_status === 'confirmed' ? 'success' : 'warning'}
                                size="xs"
                            >
                                {order.order_status}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Standalone Customer Row (If not in duplicate group) */}
                {!isDuplicateSubCard && (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                        <div className="min-w-0">
                            <span className="text-xs font-bold text-white truncate block">
                                {order.customer?.name || 'Customer'}
                            </span>
                            <span className="text-[11px] font-mono text-indigo-300">
                                {rawPhone || 'No Phone'}
                            </span>
                        </div>
                        {rawPhone && (
                            <div className="flex items-center gap-1.5 shrink-0">
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
                )}

                {/* Product & Attribute Specs */}
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                        {order.product?.primary_image_url ? (
                            <img
                                src={order.product.primary_image_url}
                                alt=""
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <ShoppingBag className="w-5 h-5 text-indigo-400" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">
                            {order.product?.name || order.items_data?.[0]?.name || 'Product'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {order.size ? (
                                <span className="text-[11px] px-2 py-0.5 rounded font-mono font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-500/40">
                                    Size: {order.size}
                                </span>
                            ) : (
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-800 text-slate-400">
                                    No Size
                                </span>
                            )}
                            {order.color ? (
                                <span className="text-[11px] px-2 py-0.5 rounded font-mono font-bold bg-purple-500/20 text-purple-200 border border-purple-500/40">
                                    Color: {order.color}
                                </span>
                            ) : null}
                            <span className={`text-[11px] px-2 py-0.5 rounded font-mono font-bold ${order.quantity > 1 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-300'}`}>
                                Qty: {order.quantity}
                            </span>
                        </div>
                    </div>
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
                            title="কোয়ান্টিটি ১ পিস করে টোটাল রিক্যালকুলেট ও সমাধান করুন"
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
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Cancel Order Button */}
                    {!isCancelled && (
                        <button
                            type="button"
                            onClick={() => onCancel(order)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                            title="এই অর্ডারটি বাতিল করুন"
                        >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>বাতিল (Cancel)</span>
                        </button>
                    )}

                    {/* Resolve Button: Replaces the old Confirm button! */}
                    {!isCancelled && !isResolved && (
                        <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => onResolve(order.id)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer"
                            title="অর্ডারটি সমাধান হয়েছে হিসেবে চিহ্নিত করুন"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Resolve (সমাধান হয়েছে)</span>
                        </button>
                    )}

                    {/* If already resolved */}
                    {isResolved && !isCancelled && (
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                            <Check className="w-3 h-3" /> সমাধানকৃত
                        </span>
                    )}

                    {/* Steadfast Dispatch button if confirmed and no tracking */}
                    {order.order_status === 'confirmed' && !isCancelled && !order.tracking_code && (
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

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchCxOrders();
    };

    // Quick Action: Resolve, Set Qty to 1, or Cancel
    const handleQuickAction = async (orderId, action, extra = {}) => {
        try {
            setActionLoadingId(orderId);
            const payload = { action, ...extra };
            const res = await api.post(`/orders/${orderId}/cx-action`, payload);

            if (res.data.status === 'success') {
                // Refresh list to update groupings and resolved state immediately
                await fetchCxOrders();
            }
        } catch (err) {
            alert('Action failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setActionLoadingId(null);
        }
    };

    // Open Edit Order Modal
    const openEditModal = (order) => {
        setEditingOrder(order);
        setEditForm({
            quantity: order.quantity || 1,
            size: order.size || '',
            color: order.color || '',
            unit_price: parseFloat(order.unit_price) || 0,
            delivery_charge: parseFloat(order.delivery_charge) || 0,
            total_amount: parseFloat(order.total_amount) || 0,
            customer_name: order.customer?.name || '',
            customer_phone: order.customer_phone || order.customer?.phone || '',
            customer_address: order.customer_address || '',
            customer_email: order.customer_email || order.customer?.email || '',
            notes: order.notes || '',
            order_status: order.order_status || 'confirmed',
        });
        setEditModalOpen(true);
    };

    // Handle Edit Form Change with live total recalculation
    const handleEditFormChange = (field, value) => {
        setEditForm((prev) => {
            const next = { ...prev, [field]: value };
            if (field === 'quantity' || field === 'unit_price' || field === 'delivery_charge') {
                const qty = parseInt(field === 'quantity' ? value : next.quantity, 10) || 1;
                const price = parseFloat(field === 'unit_price' ? value : next.unit_price) || 0;
                const delivery = parseFloat(field === 'delivery_charge' ? value : next.delivery_charge) || 0;
                next.total_amount = (qty * price) + delivery;
            }
            return next;
        });
    };

    // Save Edit Form
    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editingOrder) return;

        try {
            setSavingEdit(true);
            const res = await api.put(`/orders/${editingOrder.id}`, editForm);
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
    const hasCancelledOrders = cxData.cancelled_orders.length > 0;
    const hasOtherResolved = cxData.other_resolved_orders.length > 0;
    const isFeedEmpty = !hasDuplicateGroups && !hasMultiQtyOrders && !hasCancelledOrders && !hasOtherResolved;

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <Headphones className="w-3.5 h-3.5" /> CX Operations Desk
                        </span>
                        <span className="text-xs text-slate-400">· অর্ডার ভেরিফিকেশন ও ডুপ্লিকেট সমাধান</span>
                    </div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2 mt-1">
                        Customer Experience (CX) Verification
                    </h1>
                    <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                        একই গ্রাহকের ডুপ্লিকেট অর্ডারসমূহ পাশাপাশি প্রদর্শন করা হয়েছে। কাস্টমারকে কল দিয়ে কোনটি রাখবেন নিশ্চিত হন, অতিরিক্তটি বাতিল (Cancel) করুন এবং সঠিক অর্ডারে Resolve (সমাধান হয়েছে) ক্লিক করুন।
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                <Card
                    onClick={() => setActiveTab('all')}
                    className={`cursor-pointer transition-all ${
                        activeTab === 'all'
                            ? 'bg-indigo-950/40 border-indigo-500/60 ring-2 ring-indigo-500/30'
                            : 'hover:border-slate-700'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">রিভিউ প্রয়োজন</span>
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
                        <span className="text-[11px] font-semibold text-slate-400">ডুপ্লিকেট গ্রুপ</span>
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
                        <span className="text-[11px] font-semibold text-slate-400">সমাধানকৃত (Resolved)</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-2xl font-black text-emerald-300 mt-1">{meta.resolved_count || 0}</p>
                    <p className="text-[10px] text-emerald-400 mt-0.5 font-medium">Resolved by CX</p>
                </Card>

                <Card
                    onClick={() => setActiveTab('cancelled')}
                    className={`cursor-pointer transition-all ${
                        activeTab === 'cancelled'
                            ? 'bg-slate-900 border-slate-700 ring-2 ring-slate-600'
                            : 'hover:border-slate-700'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">বাতিলকৃত</span>
                        <XCircle className="w-4 h-4 text-slate-500" />
                    </div>
                    <p className="text-2xl font-black text-slate-300 mt-1">{meta.cancelled_count || 0}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Duplicate Cancelled</p>
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
                        🔁 ডুপ্লিকেট অর্ডার ({meta.duplicate_groups_count || 0})
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'resolved'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-900'
                        }`}
                    >
                        ✅ সমাধানকৃত ({meta.resolved_count || 0})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('cancelled')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'cancelled'
                                ? 'bg-slate-700 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-900'
                        }`}
                    >
                        ❌ বাতিলকৃত ({meta.cancelled_count || 0})
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
                    <p className="text-xs text-slate-400">ডুপ্লিকেট অর্ডার ও মাল্টি-কোয়ান্টিটি বিশ্লেষণ করা হচ্ছে...</p>
                </div>
            ) : isFeedEmpty ? (
                <div className="py-20 text-center bg-slate-950/40 rounded-3xl border border-slate-800 p-8">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-80" />
                    <h3 className="text-base font-bold text-white">সব অর্ডার ভেরিফাই ও সমাধান সম্পন্ন!</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        {activeTab === 'duplicates'
                            ? 'গত ১০ দিনে কোনো আনভেরিফাইড ডুপ্লিকেট অর্ডারের রেকর্ড পাওয়া যায়নি।'
                            : activeTab === 'multi_qty'
                            ? 'একাধিক কোয়ান্টিটির কোনো আনভেরিফাইড অর্ডার নেই।'
                            : activeTab === 'resolved'
                            ? 'এখনো কোনো অর্ডার সমাধান করা হয়নি।'
                            : 'এই মুহূর্তে কোনো ডুপ্লিকেট বা অস্বাভাবিক অর্ডারের রিভিউ বাকি নেই।'}
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* SECTION 1: DUPLICATE GROUPS (Showing both/all orders side-by-side) */}
                    {hasDuplicateGroups && (
                        <div className="space-y-4">
                            {cxData.duplicate_groups.map((group) => {
                                const rawPhone = group.customer_phone || group.normalized_phone || '';
                                const cleanDigits = rawPhone.replace(/[^0-9]/g, '');
                                const waPhone = cleanDigits.startsWith('880') ? cleanDigits : (cleanDigits.startsWith('0') ? '88' + cleanDigits : '880' + cleanDigits);

                                return (
                                    <div
                                        key={group.group_id}
                                        className="p-4 sm:p-5 rounded-2xl border-2 border-rose-500/40 bg-gradient-to-b from-rose-950/20 via-slate-900/90 to-slate-950 space-y-4 shadow-xl"
                                    >
                                        {/* Duplicate Group Header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-rose-500/20">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 font-bold">
                                                    <Copy className="w-5 h-5 animate-pulse" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-base font-extrabold text-white">
                                                            {group.customer_name}
                                                        </span>
                                                        <span className="text-xs font-mono font-bold text-rose-300 bg-rose-950/80 px-2.5 py-0.5 rounded border border-rose-500/30">
                                                            {rawPhone || 'No Phone'}
                                                        </span>
                                                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                                            ডুপ্লিকেট গ্রুপ ({group.orders.length}টি অর্ডার)
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                                        <span>{group.customer_address || 'ঠিকানা দেওয়া নেই'}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* IP Call & WhatsApp CTAs */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                {rawPhone && (
                                                    <Link
                                                        to={`/call-center/ip-call?phone=${encodeURIComponent(rawPhone)}`}
                                                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer"
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
                                                        className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all"
                                                        title="WhatsApp-এ মেসেজ দিন"
                                                    >
                                                        <MessageCircle className="w-4 h-4" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actionable Banner */}
                                        <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                                            <span>
                                                <strong>ডুপ্লিকেট নোটিশ:</strong> এই গ্রাহক গত ১০ দিনে একই পণ্য <strong>{group.product_name}</strong> {group.orders.length} বার অর্ডার করেছেন। নিচে উভয় অর্ডারই প্রদর্শিত হয়েছে। কাস্টমারকে কল দিয়ে নিশ্চিত হয়ে অপ্রয়োজনীয় অর্ডারটি <strong>বাতিল (Cancel)</strong> করুন এবং কাঙ্ক্ষিত অর্ডারে <strong>Resolve (সমাধান হয়েছে)</strong> ক্লিক করুন।
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
                                                    onResolve={(id) => handleQuickAction(id, 'resolve')}
                                                    onSetQtyOne={(id) => handleQuickAction(id, 'set_qty_one')}
                                                    onDispatchSteadfast={handleDispatchSteadfast}
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
                                <span>বাল্ক কোয়ান্টিটি অর্ডারসমূহ (Cart Quantity &gt; 1)</span>
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {cxData.multi_qty_orders.map((order) => (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        isDuplicateSubCard={false}
                                        onEdit={openEditModal}
                                        onCancel={openCancelModal}
                                        onResolve={(id) => handleQuickAction(id, 'resolve')}
                                        onSetQtyOne={(id) => handleQuickAction(id, 'set_qty_one')}
                                        onDispatchSteadfast={handleDispatchSteadfast}
                                        actionLoadingId={actionLoadingId}
                                        dispatchingId={dispatchingId}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SECTION 3: OTHER RESOLVED ORDERS (when on resolved tab) */}
                    {hasOtherResolved && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-emerald-300 flex items-center gap-1.5 px-1">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span>অন্যান্য সমাধানকৃত অর্ডারসমূহ</span>
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {cxData.other_resolved_orders.map((order) => (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        isDuplicateSubCard={false}
                                        onEdit={openEditModal}
                                        onCancel={openCancelModal}
                                        onResolve={(id) => handleQuickAction(id, 'resolve')}
                                        onSetQtyOne={(id) => handleQuickAction(id, 'set_qty_one')}
                                        onDispatchSteadfast={handleDispatchSteadfast}
                                        actionLoadingId={actionLoadingId}
                                        dispatchingId={dispatchingId}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SECTION 4: CANCELLED ORDERS (when on cancelled tab) */}
                    {hasCancelledOrders && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-400 flex items-center gap-1.5 px-1">
                                <XCircle className="w-4 h-4 text-slate-500" />
                                <span>বাতিলকৃত অর্ডারসমূহ</span>
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {cxData.cancelled_orders.map((order) => (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        isDuplicateSubCard={false}
                                        onEdit={openEditModal}
                                        onCancel={openCancelModal}
                                        onResolve={(id) => handleQuickAction(id, 'resolve')}
                                        onSetQtyOne={(id) => handleQuickAction(id, 'set_qty_one')}
                                        onDispatchSteadfast={handleDispatchSteadfast}
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
                    title={`✏️ Edit Order #${editingOrder.order_number}`}
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

                        {/* Product & Attribute Information */}
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-indigo-400" /> সাইজ, কালার ও কোয়ান্টিটি
                            </h4>
                            <div className="grid grid-cols-3 gap-2.5">
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">Size (সাইজ)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. M, L, XL"
                                        value={editForm.size}
                                        onChange={(e) => handleEditFormChange('size', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">Color (কালার)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Black, Blue"
                                        value={editForm.color}
                                        onChange={(e) => handleEditFormChange('color', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">Quantity (পিস)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={editForm.quantity}
                                        onChange={(e) => handleEditFormChange('quantity', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Pricing & Calculations */}
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                                <ShoppingBag className="w-3.5 h-3.5 text-indigo-400" /> মূল্য ও ডেলিভারি হিসাব
                            </h4>
                            <div className="grid grid-cols-3 gap-2.5">
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">Unit Price (৳)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editForm.unit_price}
                                        onChange={(e) => handleEditFormChange('unit_price', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">Delivery Charge (৳)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editForm.delivery_charge}
                                        onChange={(e) => handleEditFormChange('delivery_charge', e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1 font-bold text-emerald-400">Total Amount (৳)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editForm.total_amount}
                                        onChange={(e) => handleEditFormChange('total_amount', e.target.value)}
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
                    title={`❌ Cancel Order #${orderToCancel.order_number}`}
                >
                    <div className="space-y-4 text-xs">
                        <p className="text-slate-300">
                            আপনি কি নিশ্চিত যে আপনি অর্ডার <strong className="text-white font-mono">#{orderToCancel.order_number}</strong> বাতিল করতে চান?
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
