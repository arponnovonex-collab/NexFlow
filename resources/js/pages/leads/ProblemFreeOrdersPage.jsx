import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useSipPhone } from '../../context/SipPhoneContext';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import {
    ShieldCheck,
    Globe,
    ShoppingBag,
    Search,
    Truck,
    CheckCircle2,
    Clock,
    RefreshCw,
    Eye,
    CheckSquare,
    Square,
    AlertCircle,
    User,
    MapPin,
    PhoneCall,
    PhoneOff,
    Edit,
    Trash2,
    Check,
    XCircle,
    Plus,
    Minus,
    ExternalLink,
    Filter,
    PackageCheck,
    Layers,
    DollarSign,
    Send,
} from 'lucide-react';

/**
 * Helper to robustly extract order items with Name, Size, Color, Quantity, and Price.
 */
const extractOrderItems = (order) => {
    let rawItems = order?.items_data;
    if ((!rawItems || rawItems.length === 0) && order?.wc_raw_data?.line_items) {
        rawItems = order.wc_raw_data.line_items;
    }

    if (Array.isArray(rawItems) && rawItems.length > 0) {
        return rawItems.map((item, idx) => {
            let name = item.name || item.product_name || order.product?.name || `Product #${idx + 1}`;
            let size = item.size || '';
            let color = item.color || '';
            let qty = parseInt(item.quantity || item.qty, 10) || 1;
            let price = parseFloat(item.price || item.unit_price) || 0;

            if ((!size || !color) && Array.isArray(item.meta_data)) {
                for (const m of item.meta_data) {
                    const k = String(m.key || m.display_key || '').toLowerCase();
                    const v = String(m.value || m.display_value || '').trim();
                    if (!v || typeof m.value === 'object') continue;
                    if (!size && (k.includes('size') || k.includes('সাইজ'))) size = v;
                    if (!color && (k.includes('color') || k.includes('colour') || k.includes('কালার'))) color = v;
                }
            }

            if ((!size || !color) && item.variation) {
                const varStr = String(item.variation);
                const sizeMatch = varStr.match(/size:\s*([^,;]+)/i);
                if (!size && sizeMatch) size = sizeMatch[1].trim();
                const colorMatch = varStr.match(/colou?r:\s*([^,;]+)/i);
                if (!color && colorMatch) color = colorMatch[1].trim();
            }

            if (!size && rawItems.length === 1 && order.size) size = order.size;
            if (!color && rawItems.length === 1 && order.color) color = order.color;

            return {
                id: item.id || idx,
                product_id: item.product_id || null,
                name,
                size,
                color,
                quantity: qty,
                price,
            };
        });
    }

    return [
        {
            id: 1,
            name: order?.product?.name || 'Product',
            size: order?.size || '',
            color: order?.color || '',
            quantity: order?.quantity || 1,
            price: parseFloat(order?.unit_price) || 0,
        },
    ];
};

/**
 * Resolve display customer name
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

export const ProblemFreeOrdersPage = () => {
    const {
        makeCall,
        hangupCall,
        callState,
        callNumber,
        sipStatus,
        serverOriginateCall,
    } = useSipPhone();

    const lastCallInitiatedAtRef = useRef(0);

    const [orders, setOrders] = useState([]);
    const [stats, setStats] = useState({
        total: 0,
        website: 0,
        engagement: 0,
        confirmed: 0,
        processing: 0,
    });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('all'); // 'all', 'website', 'engagement'
    const [selectedOrder, setSelectedOrder] = useState(null);

    // Pagination
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({
        current_page: 1,
        last_page: 1,
        total: 0,
        from: 0,
        to: 0,
    });

    // Bulk selection & Steadfast Courier dispatch
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);
    const [dispatchingId, setDispatchingId] = useState(null);
    const [dispatchingBulk, setDispatchingBulk] = useState(false);
    const [courierResult, setCourierResult] = useState(null);

    // Edit Order Modal State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [editForm, setEditForm] = useState({
        customer_name: '',
        customer_phone: '',
        customer_address: '',
        customer_city: '',
        order_status: '',
        total_amount: '',
        notes: '',
        items: [],
    });
    const [savingEdit, setSavingEdit] = useState(false);

    // Single action loader
    const [actionLoadingId, setActionLoadingId] = useState(null);

    // Auto refresh toggle
    const [autoRefresh, setAutoRefresh] = useState(true);

    const fetchOrders = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const params = {
                problem_free: 1,
                page,
            };
            if (sourceFilter !== 'all') params.source = sourceFilter;
            if (statusFilter) params.order_status = statusFilter;
            if (search) params.search = search;

            const res = await api.get('/orders', { params });
            if (res.data?.data) {
                const paginated = res.data.data;
                setOrders(paginated.data || []);
                setPagination({
                    current_page: paginated.current_page || 1,
                    last_page: paginated.last_page || 1,
                    total: paginated.total || 0,
                    from: paginated.from || 0,
                    to: paginated.to || 0,
                });
                if (res.data.stats) {
                    setStats(res.data.stats);
                }
            }
        } catch (err) {
            console.error('Failed to fetch problem-free orders:', err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [page, statusFilter, sourceFilter]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchOrders();
        }, 350);
        return () => clearTimeout(timer);
    }, [search]);

    // Silent background refresh every 30 seconds
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(() => {
            fetchOrders(true);
        }, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, page, statusFilter, sourceFilter, search]);

    // Status change
    const handleUpdateStatus = async (orderId, newStatus) => {
        setOrders((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, order_status: newStatus } : o))
        );
        if (selectedOrder && selectedOrder.id === orderId) {
            setSelectedOrder((prev) => ({ ...prev, order_status: newStatus }));
        }

        try {
            setActionLoadingId(orderId);
            await api.put(`/orders/${orderId}/status`, { order_status: newStatus });
        } catch (err) {
            alert('অর্ডারের স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে');
            fetchOrders(true);
        } finally {
            setActionLoadingId(null);
        }
    };

    // Quick Confirm
    const handleQuickConfirm = async (orderId) => {
        await handleUpdateStatus(orderId, 'confirmed');
    };

    // In-app IP Call with debounce and mic pre-check
    const handleStartManualCall = (order) => {
        if (!order) return;
        const rawPhone = order.customer_phone || order.customer?.phone || '';
        const cleanDigits = rawPhone.replace(/[^0-9]/g, '');
        if (!cleanDigits) {
            alert('গ্রাহকের কোনো ফোন নম্বর নেই!');
            return;
        }

        const now = Date.now();
        if (now - lastCallInitiatedAtRef.current < 2000) {
            console.log('[Call] Debounce active');
            return;
        }

        if (callState !== 'idle' && (callNumber === cleanDigits || (cleanDigits.length >= 10 && callNumber.endsWith(cleanDigits.slice(-10))))) {
            if (now - lastCallInitiatedAtRef.current > 2500) {
                hangupCall();
            }
            return;
        }

        if (callState !== 'idle') {
            const proceed = window.confirm(
                `অন্য একটি নম্বরে (${callNumber}) কল চলছে। আপনি কি বর্তমান কলটি কেটে এই গ্রাহককে কল দিতে চান?`
            );
            if (!proceed) return;
            hangupCall();
        }

        lastCallInitiatedAtRef.current = now;
        const customerName = resolveCustomerName(order);

        if (sipStatus === 'registered') {
            makeCall(cleanDigits, {
                customerName,
                orderId: order.id,
                orderNumber: order.order_number,
            });
        } else {
            const proceed = window.confirm(
                `ইন-ব্রাউজার ফোন স্ট্যাটাস: ${sipStatus === 'connecting' ? 'কানেক্ট হচ্ছে...' : 'অফলাইন'}।\n\nআপনি কি সার্ভার থেকে সরাসরি গ্রাহককে কল (Click-to-Call) দিতে চান? (OK চাপলে সার্ভার কল শুরু হবে, Cancel চাপলে ফুল ডায়লার ট্যাবে খুলবে)`
            );
            if (proceed) {
                serverOriginateCall(cleanDigits)
                    .then((res) => alert(res.message || 'সার্ভার কল শুরু হয়েছে!'))
                    .catch(() => alert('সার্ভার কল ব্যর্থ হয়েছে'));
            } else {
                window.open(`/call-center/ip-call?phone=${encodeURIComponent(cleanDigits)}&autocall=true`, '_blank');
            }
        }
    };

    // Single Steadfast Dispatch
    const handleDispatchSteadfast = async (order) => {
        try {
            setDispatchingId(order.id);
            const res = await api.post(`/orders/${order.id}/steadfast-dispatch`);
            setCourierResult({
                success: true,
                message: res.data?.message || 'Steadfast Courier-এ অর্ডার পাঠানো সম্পন্ন হয়েছে!',
                tracking_code: res.data?.tracking_code,
                consignment_id: res.data?.consignment_id,
            });
            fetchOrders(true);
        } catch (err) {
            setCourierResult({
                success: false,
                message: err.response?.data?.message || 'Steadfast-এ পাঠাতে সমস্যা হয়েছে।',
            });
        } finally {
            setDispatchingId(null);
        }
    };

    // Bulk Steadfast Dispatch
    const handleBulkDispatchSteadfast = async () => {
        if (selectedOrderIds.length === 0) return;
        const proceed = window.confirm(`আপনি কি নিশ্চিত যে নির্বাচিত ${selectedOrderIds.length}টি অর্ডার Steadfast Courier-এ পাঠাতে চান?`);
        if (!proceed) return;

        try {
            setDispatchingBulk(true);
            const res = await api.post('/orders/bulk-steadfast-dispatch', {
                order_ids: selectedOrderIds,
            });
            const data = res.data?.data || {};
            setCourierResult({
                success: true,
                message: `Steadfast বাল্ক ডিসপ্যাচ সম্পন্ন! সফল: ${data.success_count || 0}, ব্যর্থ: ${data.failed_count || 0}`,
            });
            setSelectedOrderIds([]);
            fetchOrders(true);
        } catch (err) {
            setCourierResult({
                success: false,
                message: err.response?.data?.message || 'বাল্ক ডিসপ্যাচ ব্যর্থ হয়েছে।',
            });
        } finally {
            setDispatchingBulk(false);
        }
    };

    // Edit Order Handlers
    const handleOpenEdit = (order) => {
        setEditingOrder(order);
        const items = extractOrderItems(order);
        setEditForm({
            customer_name: resolveCustomerName(order),
            customer_phone: order.customer_phone || order.customer?.phone || '',
            customer_address: order.customer_address || order.customer?.address || '',
            customer_city: order.customer_city || '',
            order_status: order.order_status || 'processing',
            total_amount: order.total_amount || 0,
            notes: order.notes || '',
            items: items.map((it) => ({
                id: it.id,
                name: it.name,
                size: it.size || '',
                color: it.color || '',
                quantity: it.quantity || 1,
                price: it.price || 0,
            })),
        });
        setEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingOrder) return;
        try {
            setSavingEdit(true);
            const res = await api.put(`/orders/${editingOrder.id}`, editForm);
            alert('অর্ডার সফলভাবে আপডেট করা হয়েছে!');
            setEditModalOpen(false);
            setEditingOrder(null);
            fetchOrders(true);
        } catch (err) {
            alert(err.response?.data?.message || 'অর্ডার আপডেট করতে সমস্যা হয়েছে');
        } finally {
            setSavingEdit(false);
        }
    };

    // Selection handlers
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedOrderIds(orders.map((o) => o.id));
        } else {
            setSelectedOrderIds([]);
        }
    };

    const handleToggleSelect = (orderId) => {
        setSelectedOrderIds((prev) =>
            prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
        );
    };

    const isAllSelected = orders.length > 0 && selectedOrderIds.length === orders.length;

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-teal-400" />
                        <span>Problem Free All Orders</span>
                        <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30">
                            সমস্যারহিত সকল অর্ডার
                        </span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        যে সকল অর্ডারে কোনো সমস্যা বা অস্বাভাবিক ডুপ্লিকেট পাওয়া যায়নি — ওয়েবসাইট ও এনগেজমেন্ট সকল ভেরিফাইড অর্ডার।
                    </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => fetchOrders()}
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="রিফ্রেশ করুন"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>রিফ্রেশ</span>
                    </button>
                    {selectedOrderIds.length > 0 && (
                        <button
                            type="button"
                            onClick={handleBulkDispatchSteadfast}
                            disabled={dispatchingBulk}
                            className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-950/40 transition-all cursor-pointer disabled:opacity-50"
                        >
                            {dispatchingBulk ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Truck className="w-3.5 h-3.5" />
                            )}
                            <span>নির্বাচিত {selectedOrderIds.length}টি Steadfast-এ পাঠান</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card className="p-4 bg-gradient-to-br from-teal-950/40 via-slate-900 to-slate-950 border border-teal-500/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-teal-400">মোট সমস্যারহিত অর্ডার</p>
                            <h3 className="text-2xl font-black text-white mt-1">
                                {stats.total?.toLocaleString() || pagination.total}
                            </h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-cyan-950/40 via-slate-900 to-slate-950 border border-cyan-500/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-cyan-400">ওয়েবসাইট অর্ডার</p>
                            <h3 className="text-2xl font-black text-white mt-1">
                                {stats.website?.toLocaleString() || 0}
                            </h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                            <Globe className="w-5 h-5" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-emerald-400">এনগেজমেন্ট অর্ডার</p>
                            <h3 className="text-2xl font-black text-white mt-1">
                                {stats.engagement?.toLocaleString() || 0}
                            </h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                            <ShoppingBag className="w-5 h-5" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/30">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-indigo-400">কনফার্মড (রেডি টু ডিসপ্যাচ)</p>
                            <h3 className="text-2xl font-black text-white mt-1">
                                {stats.confirmed?.toLocaleString() || 0}
                            </h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                            <PackageCheck className="w-5 h-5" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filter Toolbar */}
            <Card className="p-4 bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="অর্ডার নং, নাম, ফোন নম্বর, ঠিকানা বা প্রোডাক্ট খুঁজুন..."
                            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                        />
                    </div>

                    {/* Source Filter Tabs */}
                    <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold">
                        <button
                            type="button"
                            onClick={() => { setSourceFilter('all'); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                sourceFilter === 'all'
                                    ? 'bg-teal-600 text-white shadow'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            সকল অর্ডার ({stats.total || pagination.total})
                        </button>
                        <button
                            type="button"
                            onClick={() => { setSourceFilter('website'); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                                sourceFilter === 'website'
                                    ? 'bg-cyan-600 text-white shadow'
                                    : 'text-slate-400 hover:text-cyan-300'
                            }`}
                        >
                            <Globe className="w-3.5 h-3.5" />
                            <span>ওয়েবসাইট ({stats.website || 0})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => { setSourceFilter('engagement'); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                                sourceFilter === 'engagement'
                                    ? 'bg-emerald-600 text-white shadow'
                                    : 'text-slate-400 hover:text-emerald-300'
                            }`}
                        >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>এনগেজমেন্ট ({stats.engagement || 0})</span>
                        </button>
                    </div>

                    {/* Status Filter Dropdown */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-teal-500 cursor-pointer"
                        >
                            <option value="">সকল স্ট্যাটাস</option>
                            <option value="processing">প্রসেসিং (Processing)</option>
                            <option value="confirmed">কনফার্মড (Confirmed)</option>
                            <option value="pending">পেন্ডিং (Pending)</option>
                            <option value="shipped">কুরিয়ারে পাঠানো (Shipped)</option>
                            <option value="delivered">ডেলিভারড (Delivered)</option>
                        </select>
                    </div>
                </div>
            </Card>

            {/* Courier Dispatch Alert */}
            {courierResult && (
                <div
                    className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                        courierResult.success
                            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                            : 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        {courierResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span>{courierResult.message}</span>
                        {courierResult.tracking_code && (
                            <span className="font-mono font-bold bg-black/40 px-2 py-0.5 rounded border border-emerald-500/40">
                                Tracking: {courierResult.tracking_code}
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setCourierResult(null)}
                        className="text-slate-400 hover:text-white"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Orders Table Card */}
            <Card className="p-0 bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800 font-bold select-none">
                            <tr>
                                <th className="p-3.5 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={handleSelectAll}
                                        className="rounded border-slate-700 bg-slate-900 text-teal-600 focus:ring-0 cursor-pointer"
                                    />
                                </th>
                                <th className="p-3.5">অর্ডার / সোর্স</th>
                                <th className="p-3.5">গ্রাহক ও ফোন</th>
                                <th className="p-3.5">আইটেম ও ভ্যারিয়েন্ট</th>
                                <th className="p-3.5">মোট মূল্য</th>
                                <th className="p-3.5">অর্ডার স্ট্যাটাস</th>
                                <th className="p-3.5">কুরিয়ার স্ট্যাটাস</th>
                                <th className="p-3.5 text-right pr-4">অ্যাকশন</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {loading && orders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-slate-400">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-teal-400 mb-2" />
                                        <span>সমস্যারহিত অর্ডার লোড হচ্ছে...</span>
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-slate-400">
                                        <ShieldCheck className="w-8 h-8 mx-auto text-teal-400/50 mb-2" />
                                        <p className="font-semibold text-slate-300">কোনো সমস্যারহিত অর্ডার পাওয়া যায়নি।</p>
                                        <p className="text-xs text-slate-500 mt-1">ফিল্টার পরিবর্তন করে আবার চেষ্টা করুন।</p>
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => {
                                    const items = extractOrderItems(order);
                                    const isWebsite = order.order_source === 'woocommerce' || order.order_source === 'web';
                                    const customerName = resolveCustomerName(order);
                                    const rawPhone = order.customer_phone || order.customer?.phone || '';
                                    const cleanDigits = rawPhone.replace(/[^0-9]/g, '');
                                    const isSelected = selectedOrderIds.includes(order.id);
                                    const isDispatching = dispatchingId === order.id;

                                    const isOrderInCall =
                                        callState !== 'idle' &&
                                        callNumber &&
                                        (callNumber === cleanDigits ||
                                            (cleanDigits.length >= 10 && callNumber.endsWith(cleanDigits.slice(-10))));

                                    return (
                                        <tr
                                            key={order.id}
                                            className={`hover:bg-slate-800/40 transition-colors ${
                                                isSelected ? 'bg-teal-950/20' : ''
                                            }`}
                                        >
                                            {/* Select Checkbox */}
                                            <td className="p-3.5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleSelect(order.id)}
                                                    className="rounded border-slate-700 bg-slate-900 text-teal-600 focus:ring-0 cursor-pointer"
                                                />
                                            </td>

                                            {/* Order # and Source Badge */}
                                            <td className="p-3.5">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-mono font-bold text-white text-xs">
                                                            #{order.order_number || (order.wc_order_id ? order.wc_order_id : order.id)}
                                                        </span>
                                                        {isWebsite ? (
                                                            <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded text-[10px] font-bold inline-flex items-center gap-1">
                                                                <Globe className="w-3 h-3" /> Website
                                                            </span>
                                                        ) : (
                                                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded text-[10px] font-bold inline-flex items-center gap-1">
                                                                <ShoppingBag className="w-3 h-3" /> Engagement
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-slate-400">
                                                        {new Date(order.created_at).toLocaleString([], {
                                                            dateStyle: 'medium',
                                                            timeStyle: 'short',
                                                        })}
                                                    </p>
                                                    {/* Verified Clean Badge */}
                                                    <div>
                                                        {order.duplicate_status === 'resolved' ? (
                                                            <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-0.5">
                                                                <CheckCircle2 className="w-2.5 h-2.5" /> CX Verified
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30 inline-flex items-center gap-0.5">
                                                                <ShieldCheck className="w-2.5 h-2.5" /> Problem Free
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Customer Info & Direct Call */}
                                            <td className="p-3.5">
                                                <div className="space-y-1 max-w-[200px]">
                                                    <p className="font-bold text-white truncate" title={customerName}>
                                                        {customerName}
                                                    </p>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono text-[11px] text-slate-300">
                                                            {rawPhone || 'No Phone'}
                                                        </span>
                                                        {cleanDigits && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleStartManualCall(order)}
                                                                className={`p-1 rounded-md transition-all cursor-pointer ${
                                                                    callState !== 'idle' && (callNumber === cleanDigits || (cleanDigits.length >= 10 && callNumber.endsWith(cleanDigits.slice(-10))))
                                                                        ? 'bg-rose-600 text-white animate-pulse'
                                                                        : 'bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white'
                                                                }`}
                                                                title="সরাসরি ইন-ব্রাউজার কল দিন"
                                                            >
                                                                <PhoneCall className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {order.customer_address && (
                                                        <p className="text-[10px] text-slate-400 line-clamp-1 flex items-center gap-1" title={order.customer_address}>
                                                            <MapPin className="w-2.5 h-2.5 shrink-0 text-slate-500" />
                                                            <span className="truncate">{order.customer_address}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Products & Items */}
                                            <td className="p-3.5">
                                                <div className="space-y-1.5 max-w-xs">
                                                    {items.map((it, idx) => (
                                                        <div key={idx} className="flex items-center gap-1.5 flex-wrap text-xs">
                                                            <span className="font-semibold text-slate-200">
                                                                {it.name}
                                                            </span>
                                                            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700">
                                                                x{it.quantity}
                                                            </span>
                                                            {it.size && (
                                                                <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-[10px] font-bold text-indigo-300 border border-indigo-500/30">
                                                                    Size: {it.size}
                                                                </span>
                                                            )}
                                                            {it.color && (
                                                                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                                                                    {it.color}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>

                                            {/* Total Amount */}
                                            <td className="p-3.5">
                                                <div className="font-mono font-bold text-emerald-400 text-xs">
                                                    ৳{parseFloat(order.total_amount || 0).toLocaleString()}
                                                </div>
                                                <p className="text-[10px] text-slate-400 capitalize">
                                                    {order.payment_method || 'COD'}
                                                </p>
                                            </td>

                                            {/* Order Status with Quick Change */}
                                            <td className="p-3.5">
                                                <select
                                                    value={order.order_status}
                                                    onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                                                    className={`px-2 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                                        order.order_status === 'confirmed'
                                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                            : order.order_status === 'processing'
                                                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                                            : order.order_status === 'shipped'
                                                            ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                                                            : order.order_status === 'delivered'
                                                            ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                                                            : 'bg-slate-800 text-slate-300 border-slate-700'
                                                    }`}
                                                >
                                                    <option value="processing">প্রসেসিং</option>
                                                    <option value="confirmed">কনফার্মড</option>
                                                    <option value="pending">পেন্ডিং</option>
                                                    <option value="shipped">কুরিয়ারে পাঠানো</option>
                                                    <option value="delivered">ডেলিভারড</option>
                                                    <option value="cancelled">বাতিল</option>
                                                </select>
                                            </td>

                                            {/* Steadfast Courier Tracking Status */}
                                            <td className="p-3.5">
                                                {order.steadfast_consignment_id || order.courier_tracking_code ? (
                                                    <div className="space-y-0.5">
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                                                            <Truck className="w-3 h-3 text-emerald-400" />
                                                            <span>{order.courier_status || 'Dispatched'}</span>
                                                        </span>
                                                        {order.courier_tracking_code && (
                                                            <p className="font-mono text-[9.5px] text-slate-400">
                                                                {order.courier_tracking_code}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDispatchSteadfast(order)}
                                                        disabled={isDispatching}
                                                        className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white border border-indigo-500/40 text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                                                        title="Steadfast Courier-এ পার্সেল পাঠান"
                                                    >
                                                        {isDispatching ? (
                                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <Truck className="w-3 h-3" />
                                                        )}
                                                        <span>Send Steadfast</span>
                                                    </button>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="p-3.5 text-right pr-4">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {order.order_status !== 'confirmed' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleQuickConfirm(order.id)}
                                                            className="p-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white transition-colors cursor-pointer"
                                                            title="অর্ডার নিশ্চিত (Confirm) করুন"
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedOrder(order)}
                                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                                        title="বিস্তারিত দেখুন"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(order)}
                                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                                        title="অর্ডার এডিট করুন"
                                                    >
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Toolbar */}
                {pagination.last_page > 1 && (
                    <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                        <div>
                            <span>দেখাচ্ছে {pagination.from} থেকে {pagination.to} (মোট {pagination.total}টি অর্ডার)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={pagination.current_page === 1}
                                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors"
                            >
                                পূর্ববর্তী
                            </button>
                            <span className="px-3 py-1.5 font-bold text-white bg-slate-800 rounded-lg">
                                {pagination.current_page} / {pagination.last_page}
                            </span>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(pagination.last_page, p + 1))}
                                disabled={pagination.current_page === pagination.last_page}
                                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 transition-colors"
                            >
                                পরবর্তী
                            </button>
                        </div>
                    </div>
                )}
            </Card>

            {/* View Order Modal */}
            {selectedOrder && (
                <Modal
                    isOpen={!!selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    title={`অর্ডার বিস্তারিত (#${selectedOrder.order_number || selectedOrder.id})`}
                >
                    <div className="space-y-4 text-xs text-slate-200">
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">গ্রাহকের নাম:</span>
                                <span className="font-bold text-white">{resolveCustomerName(selectedOrder)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">ফোন নম্বর:</span>
                                <span className="font-mono font-bold text-emerald-400">{selectedOrder.customer_phone || selectedOrder.customer?.phone || 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">ঠিকানা:</span>
                                <span>{selectedOrder.customer_address || 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">সোর্স:</span>
                                <span className="capitalize">{selectedOrder.order_source || 'website'}</span>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-slate-300 mb-2">অর্ডার আইটেম:</h4>
                            <div className="space-y-1.5">
                                {extractOrderItems(selectedOrder).map((it, idx) => (
                                    <div key={idx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-white">{it.name}</p>
                                            <p className="text-[11px] text-slate-400">
                                                {it.size ? `Size: ${it.size}` : ''} {it.color ? `· Color: ${it.color}` : ''}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-emerald-400">৳{it.price}</p>
                                            <p className="text-[10px] text-slate-400">Qty: {it.quantity}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-800 font-bold text-sm">
                            <span>মোট পরিমাণ:</span>
                            <span className="font-mono text-emerald-400">৳{parseFloat(selectedOrder.total_amount || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Edit Order Modal */}
            {editModalOpen && editingOrder && (
                <Modal
                    isOpen={editModalOpen}
                    onClose={() => { setEditModalOpen(false); setEditingOrder(null); }}
                    title={`অর্ডার সম্পাদনা (#${editingOrder.order_number || editingOrder.id})`}
                >
                    <div className="space-y-3.5 text-xs">
                        <div>
                            <label className="block text-slate-400 font-medium mb-1">গ্রাহকের নাম</label>
                            <input
                                type="text"
                                value={editForm.customer_name}
                                onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-400 font-medium mb-1">ফোন নম্বর</label>
                            <input
                                type="text"
                                value={editForm.customer_phone}
                                onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-400 font-medium mb-1">ঠিকানা</label>
                            <textarea
                                rows={2}
                                value={editForm.customer_address}
                                onChange={(e) => setEditForm({ ...editForm, customer_address: e.target.value })}
                                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-slate-400 font-medium mb-1">মোট মূল্য (৳)</label>
                                <input
                                    type="number"
                                    value={editForm.total_amount}
                                    onChange={(e) => setEditForm({ ...editForm, total_amount: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-400 font-medium mb-1">স্ট্যাটাস</label>
                                <select
                                    value={editForm.order_status}
                                    onChange={(e) => setEditForm({ ...editForm, order_status: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200"
                                >
                                    <option value="processing">প্রসেসিং</option>
                                    <option value="confirmed">কনফার্মড</option>
                                    <option value="pending">পেন্ডিং</option>
                                    <option value="shipped">কুরিয়ারে পাঠানো</option>
                                    <option value="delivered">ডেলিভারড</option>
                                    <option value="cancelled">বাতিল</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                            <Button
                                variant="secondary"
                                onClick={() => { setEditModalOpen(false); setEditingOrder(null); }}
                            >
                                বাতিল
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleSaveEdit}
                                disabled={savingEdit}
                            >
                                {savingEdit ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
