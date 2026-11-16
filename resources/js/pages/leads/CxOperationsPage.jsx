import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import {
    Headphones,
    ShieldAlert,
    Copy,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Phone,
    PhoneCall,
    MessageCircle,
    Edit3,
    Check,
    Truck,
    RefreshCw,
    Search,
    Calendar,
    Layers,
    ShoppingBag,
    Package,
    User,
    MapPin,
    Hash,
    ExternalLink,
    Loader2,
} from 'lucide-react';

export const CxOperationsPage = () => {
    const [orders, setOrders] = useState([]);
    const [meta, setMeta] = useState({
        total_review_needed: 0,
        duplicate_count: 0,
        multi_qty_count: 0,
        confirmed_count: 0,
        cancelled_count: 0,
        days: 10,
    });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all'); // all, duplicates, multi_qty, confirmed, cancelled
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
    const [cancelReason, setCancelReason] = useState('Duplicate order / customer only wanted 1');
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
                setOrders(res.data.data || []);
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

    // Quick Action: Confirm, Set Qty to 1, or Cancel
    const handleQuickAction = async (orderId, action, extra = {}) => {
        try {
            setActionLoadingId(orderId);
            const payload = { action, ...extra };
            const res = await api.post(`/orders/${orderId}/cx-action`, payload);

            if (res.data.status === 'success') {
                // Update local list
                const updated = res.data.data;
                setOrders((prev) =>
                    prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o))
                );
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
                        একই গ্রাহকের ডুপ্লিকেট অর্ডার (একই দিনে বা গত ১০ দিনে একাধিকবার অর্ডার) এবং একক অর্ডারে একাধিক পিস (Qty &gt; 1) স্বয়ংক্রিয়ভাবে ফিল্টার করা হয়েছে। গ্রাহককে ফোন কল দিয়ে ভেরিফাই করুন, কোয়ান্টিটি ১-এ ঠিক করুন, এডিট করুন বা অতিরিক্ত অর্ডার বাতিল করুন।
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
                        <span className="text-[11px] font-semibold text-slate-400">ডুপ্লিকেট অর্ডার</span>
                        <Copy className="w-4 h-4 text-rose-400" />
                    </div>
                    <p className="text-2xl font-black text-rose-300 mt-1">{meta.duplicate_count || 0}</p>
                    <p className="text-[10px] text-rose-400 mt-0.5 font-medium">Same Phone & Product</p>
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
                    onClick={() => setActiveTab('confirmed')}
                    className={`cursor-pointer transition-all ${
                        activeTab === 'confirmed'
                            ? 'bg-emerald-950/40 border-emerald-500/60 ring-2 ring-emerald-500/30'
                            : 'hover:border-slate-700'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400">কনফার্মকৃত</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-2xl font-black text-emerald-300 mt-1">{meta.confirmed_count || 0}</p>
                    <p className="text-[10px] text-emerald-400 mt-0.5 font-medium">Ready for Courier</p>
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
                        🔁 ডুপ্লিকেট অর্ডার ({meta.duplicate_count || 0})
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
                        onClick={() => setActiveTab('confirmed')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'confirmed'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-900'
                        }`}
                    >
                        ✅ কনফার্মকৃত ({meta.confirmed_count || 0})
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
                    <p className="text-xs text-slate-400">অর্ডার ও ডুপ্লিকেট রেকর্ড বিশ্লেষণ করা হচ্ছে...</p>
                </div>
            ) : orders.length === 0 ? (
                <div className="py-20 text-center bg-slate-950/40 rounded-3xl border border-slate-800 p-8">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-80" />
                    <h3 className="text-base font-bold text-white">সব অর্ডার ভেরিফাই সম্পন্ন!</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                        {activeTab === 'duplicates'
                            ? 'গত ১০ দিনে কোনো ডুপ্লিকেট অর্ডারের রেকর্ড পাওয়া যায়নি।'
                            : activeTab === 'multi_qty'
                            ? 'একাধিক কোয়ান্টিটির কোনো আনভেরিফাইড অর্ডার নেই।'
                            : 'এই মুহূর্তে কোনো ডুপ্লিকেট বা অস্বাভাবিক অর্ডারের রিভিউ বাকি নেই।'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map((order) => {
                        const rawPhone = order.customer_phone || order.customer?.phone || '';
                        const cleanDigits = rawPhone.replace(/[^0-9]/g, '');
                        const waPhone = cleanDigits.startsWith('880') ? cleanDigits : (cleanDigits.startsWith('0') ? '88' + cleanDigits : '880' + cleanDigits);
                        const isActionLoading = actionLoadingId === order.id;
                        const isDispatching = dispatchingId === order.id;

                        return (
                            <Card
                                key={order.id}
                                className={`relative border transition-all ${
                                    order.is_duplicate
                                        ? 'border-rose-500/40 bg-gradient-to-r from-slate-900 via-rose-950/10 to-slate-900'
                                        : order.is_multi_qty
                                        ? 'border-cyan-500/40 bg-gradient-to-r from-slate-900 via-cyan-950/10 to-slate-900'
                                        : 'border-slate-800'
                                }`}
                            >
                                <div className="space-y-3.5">
                                    {/* Top Row: Customer Info + Calling CTA + Status */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 font-bold text-sm">
                                                {order.customer?.name ? order.customer.name.charAt(0).toUpperCase() : 'C'}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-bold text-white truncate">
                                                        {order.customer?.name || 'Customer'}
                                                    </span>
                                                    <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                                        {rawPhone || 'No Phone'}
                                                    </span>
                                                    {order.order_source === 'woocommerce' ? (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                                            🌐 WooCommerce #{order.wc_order_id || order.order_number}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                            🛍️ CRM Order #{order.order_number}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                                                    <span className="truncate">{order.customer_address || 'No address provided'}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Direct Phone Call & WhatsApp Button Group */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {rawPhone && (
                                                <Link
                                                    to={`/call-center/ip-call?phone=${encodeURIComponent(rawPhone)}`}
                                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer"
                                                    title="IP কল দিন (ePBX Dialer)"
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

                                            <Badge
                                                variant={
                                                    order.order_status === 'confirmed'
                                                        ? 'success'
                                                        : order.order_status === 'cancelled'
                                                        ? 'danger'
                                                        : 'warning'
                                                }
                                                size="sm"
                                            >
                                                {order.order_status}
                                            </Badge>
                                        </div>
                                    </div>

                                    {/* Alert Notice Banner */}
                                    {order.is_duplicate && (
                                        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                                                <span className="font-semibold truncate">
                                                    ⚠️ সতর্কবার্তা: এই গ্রাহক গত ১০ দিনে একই পণ্য {order.duplicate_siblings?.length ? order.duplicate_siblings.length + 1 : 2} বার অর্ডার করেছেন!
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-rose-400 font-mono bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/40 shrink-0 font-bold">
                                                Duplicate Detected
                                            </span>
                                        </div>
                                    )}

                                    {order.is_multi_qty && (
                                        <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Package className="w-4 h-4 text-cyan-400 shrink-0" />
                                                <span className="font-semibold truncate">
                                                    📦 বাল্ক কোয়ান্টিটি: গ্রাহক একই পণ্য {order.quantity} পিস অর্ডার করেছেন। কল দিয়ে নিশ্চিত হন।
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/40 shrink-0 font-bold">
                                                Qty: {order.quantity}
                                            </span>
                                        </div>
                                    )}

                                    {/* Middle Row: Product Specs, Size, Color, Price Calculation */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                                        {/* Product info */}
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
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
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-white truncate">
                                                    {order.product?.name || order.items_data?.[0]?.name || 'Product'}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                    {order.size && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                                            Size: {order.size}
                                                        </span>
                                                    )}
                                                    {order.color && (
                                                        <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                                            Color: {order.color}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-800 text-slate-300">
                                                        Qty: {order.quantity}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Financial Breakdown */}
                                        <div className="flex flex-col justify-center text-xs space-y-1">
                                            <div className="flex items-center justify-between text-slate-400">
                                                <span>Unit Price:</span>
                                                <span className="font-mono text-slate-300">৳{order.unit_price}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-slate-400">
                                                <span>Delivery Fee:</span>
                                                <span className="font-mono text-slate-300">৳{order.delivery_charge}</span>
                                            </div>
                                            <div className="flex items-center justify-between font-bold text-emerald-400 pt-1 border-t border-slate-800">
                                                <span>Total Payable:</span>
                                                <span className="font-mono text-sm">৳{order.total_amount}</span>
                                            </div>
                                        </div>

                                        {/* Date, Notes & Tracking */}
                                        <div className="flex flex-col justify-center text-xs space-y-1">
                                            <div className="flex items-center justify-between text-slate-400">
                                                <span>Order Date:</span>
                                                <span className="font-mono text-slate-300">
                                                    {new Date(order.created_at).toLocaleDateString([], {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                            {order.tracking_code ? (
                                                <div className="flex items-center justify-between text-emerald-400 font-semibold text-[11px]">
                                                    <span>Steadfast Tracking:</span>
                                                    <span className="font-mono">{order.tracking_code}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                                                    <span>Courier Status:</span>
                                                    <span>Not dispatched</span>
                                                </div>
                                            )}
                                            {order.notes && (
                                                <p className="text-[10px] text-amber-300/80 italic truncate mt-1 bg-amber-950/20 p-1 rounded border border-amber-500/20">
                                                    {order.notes}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sibling Duplicate Orders Box (If duplicates exist) */}
                                    {order.duplicate_siblings && order.duplicate_siblings.length > 0 && (
                                        <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 space-y-2">
                                            <p className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                                                <Copy className="w-3.5 h-3.5 text-rose-400" />
                                                <span>এই গ্রাহকের অন্যান্য একই পণ্য অর্ডারসমূহ (ডুপ্লিকেট গ্রুপ):</span>
                                            </p>
                                            <div className="space-y-1.5">
                                                {order.duplicate_siblings.map((sib) => (
                                                    <div
                                                        key={sib.id}
                                                        className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="font-mono font-bold text-indigo-300">
                                                                #{sib.order_number}
                                                            </span>
                                                            <span className="text-slate-500">·</span>
                                                            <span className="text-slate-400 text-[11px]">
                                                                {new Date(sib.created_at).toLocaleDateString([], {
                                                                    month: 'short',
                                                                    day: 'numeric',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                })}
                                                            </span>
                                                            {sib.size && (
                                                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                                                    Size: {sib.size}
                                                                </span>
                                                            )}
                                                            <span className="font-mono font-bold text-emerald-400">
                                                                ৳{sib.total_amount}
                                                            </span>
                                                            <Badge
                                                                variant={sib.order_status === 'confirmed' ? 'success' : sib.order_status === 'cancelled' ? 'danger' : 'neutral'}
                                                                size="xs"
                                                            >
                                                                {sib.order_status}
                                                            </Badge>
                                                        </div>

                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {sib.order_status !== 'cancelled' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openCancelModal(sib)}
                                                                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition-all cursor-pointer"
                                                                    title="এই ডুপ্লিকেট অর্ডারটি বাতিল করুন"
                                                                >
                                                                    Cancel Duplicate
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons Row */}
                                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                                        <div className="flex items-center gap-2">
                                            {/* Quick 1-Click Set Quantity to 1 button */}
                                            {order.quantity > 1 && order.order_status !== 'cancelled' && (
                                                <button
                                                    type="button"
                                                    disabled={isActionLoading}
                                                    onClick={() => handleQuickAction(order.id, 'set_qty_one')}
                                                    className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-950/50 transition-all active:scale-95 cursor-pointer"
                                                    title="কোয়ান্টিটি ১ পিস করে টোটাল রিক্যালকুলেট ও কনফার্ম করুন"
                                                >
                                                    <Package className="w-3.5 h-3.5" />
                                                    <span>Qty ১ করুন ও কনফার্ম (৳{((parseFloat(order.unit_price) || 0) + (parseFloat(order.delivery_charge) || 0))})</span>
                                                </button>
                                            )}

                                            {/* Edit Button */}
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                icon={Edit3}
                                                onClick={() => openEditModal(order)}
                                                className="text-slate-200 hover:text-white"
                                            >
                                                Edit Order (এডিট)
                                            </Button>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {/* Cancel Order */}
                                            {order.order_status !== 'cancelled' && (
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    icon={XCircle}
                                                    onClick={() => openCancelModal(order)}
                                                    className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
                                                >
                                                    অর্ডার বাতিল (Cancel)
                                                </Button>
                                            )}

                                            {/* Confirm Order */}
                                            {order.order_status !== 'confirmed' && order.order_status !== 'cancelled' && (
                                                <Button
                                                    type="button"
                                                    variant="primary"
                                                    size="sm"
                                                    icon={Check}
                                                    loading={isActionLoading}
                                                    onClick={() => handleQuickAction(order.id, 'confirm')}
                                                    className="bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-950/50"
                                                >
                                                    কনফার্ম করুন (Confirm)
                                                </Button>
                                            )}

                                            {/* Dispatch to Steadfast if confirmed and not dispatched */}
                                            {order.order_status === 'confirmed' && !order.tracking_code && (
                                                <Button
                                                    type="button"
                                                    variant="primary"
                                                    size="sm"
                                                    icon={Truck}
                                                    loading={isDispatching}
                                                    onClick={() => handleDispatchSteadfast(order)}
                                                    className="bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-950/50"
                                                >
                                                    Steadfast-এ পাঠান
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
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
