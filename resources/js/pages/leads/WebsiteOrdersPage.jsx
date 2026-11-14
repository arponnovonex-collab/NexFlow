import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import {
    Globe,
    ShoppingBag,
    Search,
    Truck,
    CheckCircle2,
    Clock,
    Settings,
    RefreshCw,
    Eye,
    CheckSquare,
    Square,
    AlertCircle,
    User,
    MapPin,
    Phone,
    PhoneCall,
    Package,
    Check,
    ExternalLink,
    Copy,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';

export const WebsiteOrdersPage = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);

    // Pagination State
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(50);
    const [pagination, setPagination] = useState({
        total: 0,
        from: 0,
        to: 0,
        last_page: 1,
        current_page: 1,
    });

    // WooCommerce Store Settings State
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    const [wcSettings, setWcSettings] = useState({
        store_url: '',
        consumer_key: '',
        consumer_secret: '',
        is_enabled: true,
        auto_sync_orders: true,
        webhook_url: '',
        sync_status: 'idle',
        last_synced_at: null,
        last_error: null,
    });
    const [savingSettings, setSavingSettings] = useState(false);
    const [syncingOrders, setSyncingOrders] = useState(false);
    const [syncMessage, setSyncMessage] = useState(null);
    const [copiedWebhook, setCopiedWebhook] = useState(false);

    // Steadfast Courier State
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);
    const [sendingBulkSteadfast, setSendingBulkSteadfast] = useState(false);
    const [sendingOrderId, setSendingOrderId] = useState(null);

    const fetchOrders = async (targetPage = page, targetPerPage = perPage) => {
        try {
            setLoading(true);
            const params = {
                source: 'website',
                page: targetPage,
                per_page: targetPerPage,
            };
            if (statusFilter) params.order_status = statusFilter;
            if (search.trim()) params.search = search.trim();

            const res = await api.get('/orders', { params });
            const pageData = res.data.data;
            setOrders(pageData.data || []);
            setPagination({
                total: pageData.total || 0,
                from: pageData.from || 0,
                to: pageData.to || 0,
                last_page: pageData.last_page || 1,
                current_page: pageData.current_page || 1,
            });
        } catch (err) {
            console.error('Failed to fetch website orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await api.get('/woocommerce/settings');
            if (res.data.status === 'success') {
                setWcSettings(res.data.data);
            }
        } catch (err) {
            console.error('Failed to load WC settings:', err);
        }
    };

    useEffect(() => {
        fetchOrders(1, perPage);
        setPage(1);
    }, [statusFilter, search, perPage]);

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        try {
            setSavingSettings(true);
            const res = await api.post('/woocommerce/settings', wcSettings);
            if (res.data.status === 'success') {
                alert('✅ WooCommerce settings saved & connected successfully!');
                setSettingsModalOpen(false);
                fetchSettings();
                fetchOrders(1, perPage);
            }
        } catch (err) {
            alert(`❌ Error saving settings: ${err.response?.data?.message || err.message}`);
        } finally {
            setSavingSettings(false);
        }
    };

    const handleSyncNow = async () => {
        try {
            setSyncingOrders(true);
            setSyncMessage(null);
            const res = await api.post('/woocommerce/sync');
            if (res.data.status === 'success') {
                setSyncMessage(`✅ ${res.data.message}`);
                fetchOrders(1, perPage);
                fetchSettings();
            }
        } catch (err) {
            setSyncMessage(`❌ ${err.response?.data?.message || err.message}`);
        } finally {
            setSyncingOrders(false);
            setTimeout(() => setSyncMessage(null), 8000);
        }
    };

    const handleUpdateStatus = async (orderId, newStatus) => {
        // Optimistic UI update
        setOrders((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, order_status: newStatus } : o))
        );
        if (selectedOrder && selectedOrder.id === orderId) {
            setSelectedOrder((prev) => ({ ...prev, order_status: newStatus }));
        }

        try {
            await api.put(`/orders/${orderId}/status`, { order_status: newStatus });
        } catch (err) {
            alert('Failed to update order status');
            fetchOrders(page, perPage);
        }
    };

    // Bulk selection
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedOrderIds(orders.map((o) => o.id));
        } else {
            setSelectedOrderIds([]);
        }
    };

    const handleToggleOrder = (orderId) => {
        setSelectedOrderIds((prev) =>
            prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
        );
    };

    // Steadfast Courier Dispatch
    const handleSendSingleSteadfast = async (order) => {
        try {
            setSendingOrderId(order.id);
            const res = await api.post(`/courier/steadfast/send-order/${order.id}`);
            if (res.data.status === 'success') {
                const tracking = res.data.data?.tracking_code || '';
                alert(`✅ Website Order #${order.order_number} successfully dispatched to Steadfast!\nTracking: ${tracking}`);
                fetchOrders(page, perPage);
                if (selectedOrder && selectedOrder.id === order.id) {
                    setSelectedOrder((prev) => ({
                        ...prev,
                        courier_name: 'steadfast',
                        tracking_code: tracking,
                        consignment_id: res.data.data?.consignment_id,
                        courier_status: 'in_review',
                        order_status: 'processing',
                    }));
                }
            } else {
                alert(`❌ Failed: ${res.data.message || 'Error occurred'}`);
            }
        } catch (err) {
            alert(`❌ Error sending to Steadfast: ${err.response?.data?.message || err.message}`);
        } finally {
            setSendingOrderId(null);
        }
    };

    const handleSendBulkSteadfast = async () => {
        if (selectedOrderIds.length === 0) return;
        try {
            setSendingBulkSteadfast(true);
            const res = await api.post('/courier/steadfast/send-bulk', {
                order_ids: selectedOrderIds,
            });
            alert(`✅ Bulk Dispatch Complete! Sent: ${res.data.data?.successful?.length || 0}, Failed: ${res.data.data?.failed?.length || 0}`);
            fetchOrders(page, perPage);
            setSelectedOrderIds([]);
        } catch (err) {
            alert(`❌ Error in bulk dispatch: ${err.response?.data?.message || err.message}`);
        } finally {
            setSendingBulkSteadfast(false);
        }
    };

    // Status Counts for Metrics
    const totalOrdersCount = pagination.total;
    const pendingOrdersCount = orders.filter((o) => ['pending_confirmation', 'draft'].includes(o.order_status)).length;
    const processingOrdersCount = orders.filter((o) => ['confirmed', 'processing', 'shipped'].includes(o.order_status)).length;
    const deliveredOrdersCount = orders.filter((o) => o.order_status === 'delivered').length;

    const filterOptions = [
        { label: 'All Website Orders', value: '' },
        { label: 'Pending / New', value: 'pending_confirmation' },
        { label: 'Processing', value: 'processing' },
        { label: 'Shipped', value: 'shipped' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Cancelled', value: 'cancelled' },
    ];

    const isAllSelected = orders.length > 0 && selectedOrderIds.length === orders.length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        <Globe className="w-6 h-6 text-cyan-400" />
                        Website Orders (ওয়েবসাইট অর্ডার - WooCommerce)
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        WordPress / WooCommerce ওয়েবসাইট থেকে সিঙ্ক করা সকল অর্ডার, কাস্টমার নম্বর/অর্ডার আইডি দিয়ে সার্চ ও কুরিয়ার ডিসপ্যাচ।
                    </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={Settings}
                        className="border border-slate-700 hover:bg-slate-800 text-slate-200"
                        onClick={() => setSettingsModalOpen(true)}
                    >
                        Store Settings
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        icon={RefreshCw}
                        loading={syncingOrders}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                        onClick={handleSyncNow}
                    >
                        Sync All Orders
                    </Button>
                </div>
            </div>

            {/* Sync Feedback Alert */}
            {syncMessage && (
                <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/30 text-xs text-cyan-300 flex items-center justify-between animate-fade-in shadow-lg">
                    <span>{syncMessage}</span>
                    <button onClick={() => setSyncMessage(null)} className="text-slate-400 hover:text-white">✕</button>
                </div>
            )}

            {/* Metrics Cards (Order Counts Only - No Revenue) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 bg-slate-900/50 border-slate-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-medium">Total Orders (মোট অর্ডার)</span>
                            <span className="text-2xl font-extrabold text-cyan-400">{totalOrdersCount}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
                            <Globe className="w-5 h-5" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-slate-900/50 border-slate-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-medium">Pending / New (পেন্ডিং)</span>
                            <span className="text-2xl font-extrabold text-amber-400">{pendingOrdersCount}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-slate-900/50 border-slate-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-medium">Processing / Shipped</span>
                            <span className="text-2xl font-extrabold text-indigo-400">{processingOrdersCount}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                            <ShoppingBag className="w-5 h-5" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-slate-900/50 border-slate-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-medium">Delivered (কমপ্লিট)</span>
                            <span className="text-2xl font-extrabold text-emerald-300">{deliveredOrdersCount}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-300">
                            <Truck className="w-5 h-5" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filter & Powerful Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {filterOptions.map((f) => (
                        <button
                            key={f.value}
                            onClick={() => {
                                setStatusFilter(f.value);
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                                statusFilter === f.value
                                    ? 'bg-cyan-600 text-white font-bold'
                                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Instant Search input by phone or order id */}
                <div className="relative min-w-[280px] sm:min-w-[340px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="কাস্টমার ফোন নম্বর (018...) বা অর্ডার ID (#1042)..."
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors shadow-inner"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('');
                                setPage(1);
                            }}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                            title="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Active Search Result Tag */}
            {search.trim() && (
                <div className="text-xs text-slate-300 bg-slate-800/60 border border-slate-700/80 px-3 py-1.5 rounded-lg flex items-center justify-between">
                    <span>
                        🔍 Searching for: <strong>"{search}"</strong> — {pagination.total} orders matched
                    </span>
                    <button
                        onClick={() => setSearch('')}
                        className="text-cyan-400 hover:underline text-[11px] font-medium ml-2 cursor-pointer"
                    >
                        Reset search
                    </button>
                </div>
            )}

            {/* Bulk Action Bar */}
            {selectedOrderIds.length > 0 && (
                <div className="bg-slate-800/95 border border-cyan-500/30 rounded-xl p-3 flex items-center justify-between shadow-xl animate-fade-in">
                    <div className="flex items-center gap-2 text-xs text-slate-200">
                        <CheckSquare className="w-4 h-4 text-cyan-400" />
                        <span><strong>{selectedOrderIds.length}</strong> orders selected</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="primary"
                            size="sm"
                            loading={sendingBulkSteadfast}
                            onClick={handleSendBulkSteadfast}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md"
                        >
                            Send Selected to Steadfast ({selectedOrderIds.length})
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedOrderIds([])}
                            className="text-slate-400 hover:text-white"
                        >
                            Deselect All
                        </Button>
                    </div>
                </div>
            )}

            {/* Orders Table */}
            <Card className="overflow-hidden border-slate-800 bg-slate-900/40">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="p-3 w-8">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={handleSelectAll}
                                        className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500"
                                    />
                                </th>
                                <th className="p-3">Order Info</th>
                                <th className="p-3">Customer Details</th>
                                <th className="p-3">Products & Items</th>
                                <th className="p-3">Amount & Payment</th>
                                <th className="p-3">Order Status</th>
                                <th className="p-3">Courier Dispatch</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="p-8 text-center text-slate-500">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-500" />
                                        Loading website orders...
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="p-12 text-center text-slate-500">
                                        <Globe className="w-8 h-8 mx-auto mb-2 opacity-40 text-cyan-400" />
                                        <p className="font-semibold text-slate-300">
                                            {search ? `No orders found for "${search}"` : 'No website orders found'}
                                        </p>
                                        <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                                            {search
                                                ? 'Check the phone number or order ID and try again.'
                                                : 'Connect your WordPress store in Store Settings, then click Sync All Orders.'}
                                        </p>
                                        {!search && (
                                            <Button
                                                variant="primary"
                                                size="sm"
                                                onClick={() => setSettingsModalOpen(true)}
                                                className="mt-3 bg-cyan-600 hover:bg-cyan-500"
                                            >
                                                Configure WooCommerce Store
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => {
                                    const items = order.items_data || [];
                                    const isSelected = selectedOrderIds.includes(order.id);

                                    return (
                                        <tr
                                            key={order.id}
                                            className={`hover:bg-slate-800/40 transition-colors ${
                                                isSelected ? 'bg-cyan-950/20' : ''
                                            }`}
                                        >
                                            <td className="p-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleOrder(order.id)}
                                                    className="rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500"
                                                />
                                            </td>

                                            {/* Order Info */}
                                            <td className="p-3">
                                                <div className="font-mono font-bold text-cyan-400 flex items-center gap-1.5">
                                                    <span>{order.order_number}</span>
                                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-sans">
                                                        WooCommerce
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-0.5">
                                                    {new Date(order.created_at).toLocaleDateString([], {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </div>
                                            </td>

                                            {/* Customer */}
                                            <td className="p-3 max-w-[200px]">
                                                <div className="font-medium text-slate-200 truncate">
                                                    {order.customer?.name || 'Guest Customer'}
                                                </div>
                                                <div className="text-slate-400 font-mono text-[11px] flex items-center gap-1 mt-0.5 font-semibold text-emerald-400">
                                                    <Phone className="w-3 h-3 shrink-0" />
                                                    <span>{order.customer_phone || 'N/A'}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 truncate mt-0.5" title={order.customer_address}>
                                                    {order.customer_address || 'No Address Provided'}
                                                </div>
                                            </td>

                                            {/* Products & Items */}
                                            <td className="p-3 max-w-[220px]">
                                                {items.length > 0 ? (
                                                    <div className="space-y-1">
                                                        <div className="font-medium text-slate-200 truncate" title={items[0]?.name}>
                                                            {items[0]?.name}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 flex items-center gap-2">
                                                            <span>Qty: {items[0]?.quantity}</span>
                                                            <span>৳{items[0]?.price}</span>
                                                            {items.length > 1 && (
                                                                <span className="text-cyan-400 font-bold bg-cyan-500/10 px-1 rounded">
                                                                    +{items.length - 1} more items
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-slate-400">
                                                        <span>Product Qty: {order.quantity}</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Amount & Payment */}
                                            <td className="p-3">
                                                <div className="font-bold text-slate-100 font-mono text-sm">
                                                    ৳{parseFloat(order.total_amount).toFixed(0)}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                                        order.payment_status === 'paid'
                                                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                    }`}>
                                                        {order.payment_status?.toUpperCase() || 'UNPAID'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 truncate max-w-[90px]" title={order.payment_method_title}>
                                                        {order.payment_method_title || 'COD'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Status Selector */}
                                            <td className="p-3">
                                                <select
                                                    value={order.order_status}
                                                    onChange={(e) => handleUpdateStatus(order.id, e.target.value)}
                                                    className={`px-2 py-1 rounded text-[11px] font-semibold border transition-all cursor-pointer ${
                                                        order.order_status === 'delivered'
                                                            ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                                                            : order.order_status === 'processing'
                                                            ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300'
                                                            : order.order_status === 'shipped'
                                                            ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                                                            : order.order_status === 'cancelled'
                                                            ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                                                            : 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                                                    }`}
                                                >
                                                    <option value="pending_confirmation">Pending Confirmation</option>
                                                    <option value="confirmed">Confirmed</option>
                                                    <option value="processing">Processing</option>
                                                    <option value="shipped">Shipped</option>
                                                    <option value="delivered">Delivered (Completed)</option>
                                                    <option value="cancelled">Cancelled</option>
                                                    <option value="returned">Returned / Refunded</option>
                                                </select>
                                            </td>

                                            {/* Courier Dispatch */}
                                            <td className="p-3">
                                                {order.tracking_code ? (
                                                    <div className="space-y-0.5">
                                                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                                            <Truck className="w-3 h-3" /> {order.tracking_code}
                                                        </span>
                                                        <div className="text-[10px] text-slate-400 capitalize">
                                                            Status: {order.courier_status || 'in_review'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSendSingleSteadfast(order)}
                                                        disabled={sendingOrderId === order.id}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
                                                    >
                                                        <Truck className="w-3 h-3" />
                                                        {sendingOrderId === order.id ? 'Sending...' : 'Send Steadfast'}
                                                    </button>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="p-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                                    title="View Full Order Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {pagination.total > 0 && (
                    <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
                        <div className="flex items-center gap-3">
                            <span>
                                Showing <strong>{pagination.from || 1}</strong> to <strong>{pagination.to || orders.length}</strong> of <strong>{pagination.total}</strong> orders
                            </span>
                            <div className="flex items-center gap-1.5 ml-2">
                                <span>Per page:</span>
                                <select
                                    value={perPage}
                                    onChange={(e) => {
                                        const newPerPage = parseInt(e.target.value);
                                        setPerPage(newPerPage);
                                        fetchOrders(1, newPerPage);
                                    }}
                                    className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-slate-200 text-xs"
                                >
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                    <option value="200">200</option>
                                </select>
                            </div>
                        </div>

                        {pagination.last_page > 1 && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={pagination.current_page <= 1}
                                    onClick={() => {
                                        const p = pagination.current_page - 1;
                                        setPage(p);
                                        fetchOrders(p, perPage);
                                    }}
                                    className="border border-slate-800 text-slate-300 disabled:opacity-40"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
                                </Button>
                                <span className="px-2 text-slate-300 font-medium">
                                    Page {pagination.current_page} of {pagination.last_page}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={pagination.current_page >= pagination.last_page}
                                    onClick={() => {
                                        const p = pagination.current_page + 1;
                                        setPage(p);
                                        fetchOrders(p, perPage);
                                    }}
                                    className="border border-slate-800 text-slate-300 disabled:opacity-40"
                                >
                                    Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Store Connection Settings Modal */}
            <Modal
                isOpen={settingsModalOpen}
                onClose={() => setSettingsModalOpen(false)}
                title="Connect WordPress / WooCommerce Store"
            >
                <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                    <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-cyan-200/90 space-y-1">
                        <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                            <Globe className="w-4 h-4" /> ওয়ার্ডপ্রেস এপিআই পাওয়ার নিয়ম:
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-[11px] text-cyan-100/80">
                            <li>আপনার ওয়ার্ডপ্রেস ড্যাশবোর্ড ➔ <strong>WooCommerce ➔ Settings ➔ Advanced ➔ REST API</strong>-তে যান।</li>
                            <li><strong>Add key</strong> বাটনে ক্লিক করে Description দিন (যেমন: <code>NexFlow</code>), Permissions দিন: <strong>Read/Write</strong>।</li>
                            <li><strong>Generate API key</strong> ক্লিক করে Consumer key ও Consumer secret কপি করে নিচে বসান।</li>
                        </ol>
                    </div>

                    <div>
                        <label className="block font-medium text-slate-300 mb-1">WordPress Store URL (ডোমেইন লিংক)</label>
                        <input
                            type="url"
                            required
                            placeholder="https://yourstore.com"
                            value={wcSettings.store_url || ''}
                            onChange={(e) => setWcSettings({ ...wcSettings, store_url: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 text-xs"
                        />
                    </div>

                    <div>
                        <label className="block font-medium text-slate-300 mb-1">Consumer Key (ck_...)</label>
                        <input
                            type="text"
                            required
                            placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            value={wcSettings.consumer_key || ''}
                            onChange={(e) => setWcSettings({ ...wcSettings, consumer_key: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs"
                        />
                    </div>

                    <div>
                        <label className="block font-medium text-slate-300 mb-1">Consumer Secret (cs_...)</label>
                        <input
                            type="password"
                            required
                            placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                            value={wcSettings.consumer_secret || ''}
                            onChange={(e) => setWcSettings({ ...wcSettings, consumer_secret: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs"
                        />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
                        <div>
                            <span className="font-semibold text-slate-200 block">Enable WooCommerce Integration</span>
                            <span className="text-[11px] text-slate-400">Enable automatic and manual syncing of orders</span>
                        </div>
                        <input
                            type="checkbox"
                            checked={wcSettings.is_enabled}
                            onChange={(e) => setWcSettings({ ...wcSettings, is_enabled: e.target.checked })}
                            className="w-4 h-4 rounded text-cyan-600 focus:ring-cyan-500 bg-slate-900 border-slate-700"
                        />
                    </div>

                    {/* Real-time Webhook URL */}
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                        <span className="font-semibold text-slate-200 block text-[11px]">Real-time Auto Webhook URL:</span>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                readOnly
                                value="https://nexflow.auliro.xyz/api/webhooks/woocommerce"
                                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-cyan-300 font-mono"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText('https://nexflow.auliro.xyz/api/webhooks/woocommerce');
                                    setCopiedWebhook(true);
                                    setTimeout(() => setCopiedWebhook(false), 2000);
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded shrink-0 cursor-pointer"
                                title="Copy Webhook URL"
                            >
                                {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-1">
                            WooCommerce ➔ Settings ➔ Advanced ➔ Webhooks-এ গিয়ে Topic: <strong>Order created</strong> দিয়ে এই URL বসালে ওয়েবসাইটে নতুন অর্ডার হওয়ামাত্রই তা NexFlow-এ রিয়েল-টাইমে চলে আসবে!
                        </span>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => setSettingsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" type="submit" loading={savingSettings} className="bg-cyan-600 hover:bg-cyan-500">
                            Save & Connect Store
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* View Full Order Details Modal */}
            <Modal
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                title={`Order Details: ${selectedOrder?.order_number || ''}`}
            >
                {selectedOrder && (
                    <div className="space-y-4 text-xs">
                        {/* Summary Header */}
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <div>
                                <span className="text-slate-400 text-[11px]">Total Amount</span>
                                <div className="text-xl font-extrabold text-slate-100 font-mono">
                                    ৳{parseFloat(selectedOrder.total_amount).toFixed(0)}
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-slate-400 text-[11px] block">Order Status</span>
                                <span className="text-xs font-bold text-cyan-300 capitalize">
                                    {selectedOrder.order_status?.replace('_', ' ')}
                                </span>
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1.5">
                            <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-cyan-400" /> Customer Information
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
                                <div>Name: <strong className="text-white">{selectedOrder.customer?.name}</strong></div>
                                <div>Phone: <strong className="text-emerald-400 font-mono font-bold text-xs">{selectedOrder.customer_phone}</strong></div>
                                <div className="col-span-2">
                                    Address: <span className="text-slate-300">{selectedOrder.customer_address}</span>
                                </div>
                                {selectedOrder.notes && (
                                    <div className="col-span-2 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px]">
                                        <strong>Customer Note:</strong> {selectedOrder.notes}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Line Items List */}
                        <div className="space-y-2">
                            <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-cyan-400" /> Ordered Items ({selectedOrder.items_data?.length || 1})
                            </h4>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {(selectedOrder.items_data && selectedOrder.items_data.length > 0) ? (
                                    selectedOrder.items_data.map((item, idx) => (
                                        <div key={idx} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                                            <div>
                                                <span className="font-semibold text-slate-200 block text-xs">{item.name}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    Qty: {item.quantity} × ৳{item.price} {item.sku ? `· SKU: ${item.sku}` : ''}
                                                </span>
                                            </div>
                                            <span className="font-bold text-slate-100 font-mono text-xs">
                                                ৳{(item.quantity * item.price).toFixed(0)}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-2 rounded bg-slate-950 text-slate-300">
                                        Quantity: {selectedOrder.quantity} · Price: ৳{selectedOrder.unit_price}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Charges breakdown */}
                        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1 text-[11px]">
                            <div className="flex justify-between text-slate-400">
                                <span>Delivery / Shipping Charge:</span>
                                <span className="font-mono text-slate-200">৳{parseFloat(selectedOrder.delivery_charge || 0).toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Payment Method:</span>
                                <span className="text-slate-200">{selectedOrder.payment_method_title || 'Cash on Delivery'}</span>
                            </div>
                            {selectedOrder.shipping_method_title && (
                                <div className="flex justify-between text-slate-400">
                                    <span>Shipping Method:</span>
                                    <span className="text-slate-200">{selectedOrder.shipping_method_title}</span>
                                </div>
                            )}
                        </div>

                        {/* Courier Details */}
                        {selectedOrder.tracking_code && (
                            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 text-xs flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Truck className="w-4 h-4 text-emerald-400" />
                                    <div>
                                        <span className="font-bold block">Steadfast Consignment</span>
                                        <span className="text-[10px] font-mono text-emerald-300">Tracking: {selectedOrder.tracking_code}</span>
                                    </div>
                                </div>
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                                    {selectedOrder.courier_status || 'In Review'}
                                </span>
                            </div>
                        )}

                        <div className="flex justify-end pt-2">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)}>
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default WebsiteOrdersPage;
