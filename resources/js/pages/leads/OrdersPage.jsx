import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { CreateOrderModal } from '../../components/orders/CreateOrderModal';
import {
    ShoppingBag,
    Search,
    Truck,
    CheckCircle2,
    Clock,
    DollarSign,
    FileText,
    Plus,
    User,
    MapPin,
    Phone,
    PhoneCall,
    Package,
    RefreshCw,
    Eye,
    CheckSquare,
    Square,
    AlertCircle,
    Send,
    Check,
} from 'lucide-react';

export const OrdersPage = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

    // Steadfast bulk and single dispatch state
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);
    const [sendingBulkSteadfast, setSendingBulkSteadfast] = useState(false);
    const [sendingOrderId, setSendingOrderId] = useState(null);
    const [courierResult, setCourierResult] = useState(null);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const params = {};
            if (statusFilter) params.order_status = statusFilter;
            if (search) params.search = search;

            const res = await api.get('/orders', { params });
            setOrders(res.data.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [statusFilter, search]);

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
            fetchOrders();
        }
    };

    // Bulk selection handlers
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

    // Send single order to Steadfast
    const handleSendSingleSteadfast = async (order) => {
        try {
            setSendingOrderId(order.id);
            const res = await api.post(`/courier/steadfast/send-order/${order.id}`);
            if (res.data.status === 'success') {
                const tracking = res.data.data?.tracking_code || '';
                alert(`✅ Order #${order.order_number} successfully sent to Steadfast!\nTracking Code: ${tracking}`);
                fetchOrders();
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

    // Send bulk orders to Steadfast
    const handleSendBulkSteadfast = async () => {
        if (selectedOrderIds.length === 0) return;

        try {
            setSendingBulkSteadfast(true);
            const res = await api.post('/courier/steadfast/send-bulk', {
                order_ids: selectedOrderIds,
            });

            setCourierResult(res.data.data);
            fetchOrders();
            setSelectedOrderIds([]);
        } catch (err) {
            alert(`❌ Error in bulk Steadfast dispatch: ${err.response?.data?.message || err.message}`);
        } finally {
            setSendingBulkSteadfast(false);
        }
    };

    // Calculate metrics
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    const confirmedCount = orders.filter((o) => o.order_status === 'confirmed').length;
    const deliveredCount = orders.filter((o) => o.order_status === 'delivered').length;

    const filterOptions = [
        { label: 'All Orders', value: '' },
        { label: 'Confirmed', value: 'confirmed' },
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
                        Customer Orders & Sales (অর্ডার ও বিক্রি)
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Manage confirmed customer orders, edit order status inline, and 1-click dispatch to Steadfast Courier.
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <Button
                        variant="primary"
                        size="sm"
                        icon={Plus}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        onClick={() => setCreateOrderModalOpen(true)}
                    >
                        Create New Order
                    </Button>
                </div>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 bg-slate-900/50 border-slate-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-medium">Total Orders</span>
                            <span className="text-2xl font-extrabold text-slate-100">{totalOrders}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                            <ShoppingBag className="w-5 h-5" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-slate-900/50 border-slate-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-medium">Total Revenue</span>
                            <span className="text-2xl font-extrabold text-emerald-400">৳{totalRevenue.toFixed(0)}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                            <DollarSign className="w-5 h-5" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-slate-900/50 border-slate-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-medium">Confirmed / Active</span>
                            <span className="text-2xl font-extrabold text-indigo-400">{confirmedCount}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                </Card>

                <Card className="p-4 bg-slate-900/50 border-slate-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-medium">Delivered</span>
                            <span className="text-2xl font-extrabold text-emerald-300">{deliveredCount}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-300">
                            <Truck className="w-5 h-5" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {filterOptions.map((f) => (
                        <button
                            key={f.value}
                            onClick={() => setStatusFilter(f.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                                statusFilter === f.value
                                    ? 'bg-indigo-600 text-white font-bold'
                                    : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search by order #, phone, customer, address..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedOrderIds.length > 0 && (
                <div className="p-3 bg-gradient-to-r from-cyan-950/80 via-slate-900 to-indigo-950/80 border border-cyan-500/40 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-cyan-950/30 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs border border-cyan-500/30">
                            {selectedOrderIds.length}
                        </span>
                        <span className="text-xs font-bold text-slate-200">
                            {selectedOrderIds.length} {selectedOrderIds.length === 1 ? 'order' : 'orders'} selected for bulk actions
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => setSelectedOrderIds([])}
                            className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                        >
                            Deselect All
                        </Button>

                        <button
                            type="button"
                            onClick={handleSendBulkSteadfast}
                            disabled={sendingBulkSteadfast}
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/30 transition-all cursor-pointer disabled:opacity-50"
                        >
                            {sendingBulkSteadfast ? (
                                <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Sending to Steadfast...</span>
                                </>
                            ) : (
                                <>
                                    <Truck className="w-3.5 h-3.5" />
                                    <span>Send to Steadfast ({selectedOrderIds.length} Orders)</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Orders Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-3 py-3 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={handleSelectAll}
                                        className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                                        title="Select / Deselect all orders"
                                    />
                                </th>
                                <th className="px-3 py-3">Order Number</th>
                                <th className="px-3 py-3">Customer & Phone</th>
                                <th className="px-3 py-3">Shipping Address</th>
                                <th className="px-3 py-3">Product & Variation</th>
                                <th className="px-3 py-3">Total Payable</th>
                                <th className="px-3 py-3">Moderator</th>
                                <th className="px-3 py-3">Status</th>
                                <th className="px-3 py-3">Courier (Steadfast)</th>
                                <th className="px-3 py-3">Date</th>
                                <th className="px-3 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                                        Loading customer orders...
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                                        No order records found.
                                    </td>
                                </tr>
                            ) : (
                                orders.map((o) => {
                                    const variantText = o.variant
                                        ? [o.variant.size && `Size: ${o.variant.size}`, o.variant.color && `Color: ${o.variant.color}`].filter(Boolean).join(', ')
                                        : null;

                                    const isSelected = selectedOrderIds.includes(o.id);

                                    return (
                                        <tr
                                            key={o.id}
                                            className={`transition-colors ${
                                                isSelected ? 'bg-cyan-950/20 hover:bg-cyan-950/30' : 'hover:bg-slate-800/40'
                                            }`}
                                        >
                                            {/* Row Checkbox */}
                                            <td className="px-3 py-3.5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleOrder(o.id)}
                                                    className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                                                />
                                            </td>

                                            {/* Order Number */}
                                            <td className="px-3 py-3.5 font-mono font-bold text-indigo-400 whitespace-nowrap">
                                                {o.order_number}
                                            </td>

                                            {/* Customer & Phone */}
                                            <td className="px-3 py-3.5">
                                                <span className="font-semibold text-slate-200 block">{o.customer?.name}</span>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-[11px] text-slate-400 font-mono">
                                                        {o.customer_phone || o.customer?.phone || 'No phone'}
                                                    </span>
                                                    {(o.customer_phone || o.customer?.phone) && (
                                                        <Link
                                                            to={`/call-center/ip-call?phone=${encodeURIComponent(o.customer_phone || o.customer?.phone)}`}
                                                            className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 transition-colors"
                                                            title="IP Call দিন (ePBX)"
                                                        >
                                                            <PhoneCall className="w-3 h-3" />
                                                        </Link>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Address */}
                                            <td className="px-3 py-3.5 max-w-xs">
                                                <span className="text-slate-300 text-xs block line-clamp-2" title={o.customer_address}>
                                                    {o.customer_address || '—'}
                                                </span>
                                            </td>

                                            {/* Product & Variant */}
                                            <td className="px-3 py-3.5">
                                                <span className="font-semibold text-slate-200 block">{o.product?.name}</span>
                                                {variantText && (
                                                    <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded font-medium inline-block mt-0.5">
                                                        {variantText}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-slate-400 block mt-0.5">
                                                    Qty: {o.quantity} × ৳{o.unit_price}
                                                </span>
                                            </td>

                                            {/* Amount */}
                                            <td className="px-3 py-3.5 whitespace-nowrap">
                                                <span className="font-extrabold text-emerald-400 text-sm">৳{o.total_amount}</span>
                                                <span className="text-[10px] text-slate-500 block">
                                                    (+৳{o.delivery_charge} delivery)
                                                </span>
                                            </td>

                                            {/* Moderator */}
                                            <td className="px-3 py-3.5 text-slate-300 whitespace-nowrap">
                                                {o.user?.name ? (
                                                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 font-medium">
                                                        {o.user.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500 text-[10px]">Direct/Web</span>
                                                )}
                                            </td>

                                            {/* Inline Editable Status */}
                                            <td className="px-3 py-3.5 whitespace-nowrap">
                                                <select
                                                    value={o.order_status}
                                                    onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                                                    className={`px-2 py-1 rounded-md text-[11px] font-bold border cursor-pointer outline-none transition-all ${
                                                        o.order_status === 'delivered'
                                                            ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300 focus:border-emerald-400'
                                                            : o.order_status === 'shipped'
                                                            ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300 focus:border-cyan-400'
                                                            : o.order_status === 'confirmed'
                                                            ? 'bg-indigo-950/70 border-indigo-500/50 text-indigo-300 focus:border-indigo-400'
                                                            : o.order_status === 'processing'
                                                            ? 'bg-amber-950/70 border-amber-500/50 text-amber-300 focus:border-amber-400'
                                                            : o.order_status === 'cancelled'
                                                            ? 'bg-rose-950/70 border-rose-500/50 text-rose-300 focus:border-rose-400'
                                                            : 'bg-slate-900 border-slate-700 text-slate-300'
                                                    }`}
                                                >
                                                    <option value="draft" className="bg-slate-900 text-slate-300 font-medium">Draft</option>
                                                    <option value="confirmed" className="bg-slate-900 text-indigo-300 font-bold">Confirmed</option>
                                                    <option value="processing" className="bg-slate-900 text-amber-300 font-bold">Processing</option>
                                                    <option value="shipped" className="bg-slate-900 text-cyan-300 font-bold">Shipped</option>
                                                    <option value="delivered" className="bg-slate-900 text-emerald-300 font-bold">Delivered</option>
                                                    <option value="cancelled" className="bg-slate-900 text-rose-300 font-bold">Cancelled</option>
                                                </select>
                                            </td>

                                            {/* Courier (Steadfast) Dispatch & Tracking */}
                                            <td className="px-3 py-3.5 whitespace-nowrap">
                                                {o.tracking_code ? (
                                                    <div className="space-y-0.5">
                                                        <div className="inline-flex items-center gap-1 font-mono text-[10px] text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-2 py-0.5 rounded">
                                                            <Truck className="w-3 h-3 text-cyan-400" />
                                                            <span>{o.tracking_code}</span>
                                                        </div>
                                                        {o.courier_status && (
                                                            <span className="text-[9px] text-slate-400 block font-medium capitalize">
                                                                {o.courier_status.replace('_', ' ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSendSingleSteadfast(o)}
                                                        disabled={sendingOrderId === o.id}
                                                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-400 hover:text-cyan-200 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/60 hover:border-cyan-500/70 px-2 py-1 rounded transition-colors cursor-pointer disabled:opacity-50"
                                                        title="Send this order directly to Steadfast Courier"
                                                    >
                                                        {sendingOrderId === o.id ? (
                                                            <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                                                        ) : (
                                                            <Truck className="w-3 h-3 text-cyan-400" />
                                                        )}
                                                        <span>Send to Steadfast</span>
                                                    </button>
                                                )}
                                            </td>

                                            {/* Date */}
                                            <td className="px-3 py-3.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                                {new Date(o.created_at).toLocaleDateString()}
                                            </td>

                                            {/* Action Column (Details only) */}
                                            <td className="px-3 py-3.5 text-right whitespace-nowrap">
                                                <Button
                                                    variant="secondary"
                                                    size="xs"
                                                    icon={Eye}
                                                    onClick={() => setSelectedOrder(o)}
                                                    className="text-indigo-400 hover:text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/10 cursor-pointer font-medium"
                                                >
                                                    Details
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Courier Dispatch Result Modal */}
            <Modal
                isOpen={Boolean(courierResult)}
                onClose={() => setCourierResult(null)}
                title="🚚 Steadfast Courier Dispatch Results"
            >
                {courierResult && (
                    <div className="space-y-4 text-xs">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Total Processed</span>
                                <span className="text-xl font-bold text-slate-100">{courierResult.total}</span>
                            </div>
                            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-center">
                                <span className="text-[10px] text-emerald-400 uppercase tracking-wider block">Successful</span>
                                <span className="text-xl font-bold text-emerald-400">{courierResult.success_count}</span>
                            </div>
                            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-center">
                                <span className="text-[10px] text-rose-400 uppercase tracking-wider block">Failed</span>
                                <span className="text-xl font-bold text-rose-400">{courierResult.failed_count}</span>
                            </div>
                        </div>

                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                            {courierResult.results?.map((r) => (
                                <div
                                    key={r.order_id}
                                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                                        r.success
                                            ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                                            : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                                    }`}
                                >
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-bold">{r.order_number}</span>
                                            {r.success && (
                                                <span className="font-mono text-[10px] bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.2 rounded text-emerald-300">
                                                    SF: {r.tracking_code}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] opacity-80">{r.message}</p>
                                    </div>
                                    <span className="font-bold text-xs">
                                        {r.success ? '✅ Sent' : '❌ Failed'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-2 border-t border-slate-800">
                            <Button variant="primary" size="sm" onClick={() => setCourierResult(null)}>
                                Close
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Order Details Modal Popup */}
            <Modal
                isOpen={Boolean(selectedOrder)}
                onClose={() => setSelectedOrder(null)}
                title={`📦 Order Details: ${selectedOrder?.order_number || ''}`}
            >
                {selectedOrder && (
                    <div className="space-y-4 text-xs">
                        {/* Header Banner */}
                        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Order ID</span>
                                <span className="text-base font-bold font-mono text-indigo-400">
                                    {selectedOrder.order_number}
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                    Placed: {new Date(selectedOrder.created_at).toLocaleString()}
                                </span>
                            </div>
                            <div className="text-right space-y-1">
                                <Badge
                                    variant={
                                        selectedOrder.order_status === 'delivered'
                                            ? 'success'
                                            : selectedOrder.order_status === 'shipped'
                                            ? 'info'
                                            : selectedOrder.order_status === 'confirmed'
                                            ? 'primary'
                                            : selectedOrder.order_status === 'processing'
                                            ? 'warning'
                                            : 'neutral'
                                    }
                                >
                                    {selectedOrder.order_status.replace('_', ' ').toUpperCase()}
                                </Badge>
                                <span className="text-[10px] text-slate-400 block">
                                    Moderator: <strong>{selectedOrder.user?.name || 'Direct / Web'}</strong>
                                </span>
                            </div>
                        </div>

                        {/* Customer Information Card */}
                        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 border-b border-slate-800/80 pb-1.5">
                                <User className="w-3.5 h-3.5 text-indigo-400" /> Customer Information (গ্রাহকের তথ্য)
                            </h4>
                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <div>
                                    <span className="text-[10px] text-slate-400 block">Customer Name:</span>
                                    <span className="text-xs font-semibold text-slate-100">
                                        {selectedOrder.customer?.name || '—'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] text-slate-400 block">Phone Number:</span>
                                    <a
                                        href={`tel:${selectedOrder.customer_phone || selectedOrder.customer?.phone}`}
                                        className="text-xs font-bold font-mono text-indigo-400 hover:underline flex items-center gap-1"
                                    >
                                        <Phone className="w-3 h-3" />
                                        {selectedOrder.customer_phone || selectedOrder.customer?.phone || 'No phone'}
                                    </a>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-800/60">
                                <span className="text-[10px] text-slate-400 block">Delivery Address (ঠিকানা):</span>
                                <span className="text-xs text-slate-200 font-medium leading-relaxed block mt-0.5">
                                    <MapPin className="w-3 h-3 text-rose-400 inline mr-1" />
                                    {selectedOrder.customer_address || 'No address provided'}
                                </span>
                            </div>

                            {selectedOrder.notes && (
                                <div className="pt-2 border-t border-slate-800/60">
                                    <span className="text-[10px] text-slate-400 block">Order Notes:</span>
                                    <span className="text-xs text-amber-300 italic block mt-0.5">
                                        "{selectedOrder.notes}"
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Steadfast Courier Status Card */}
                        <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 space-y-2">
                            <div className="flex items-center justify-between border-b border-cyan-800/30 pb-1.5">
                                <h4 className="font-semibold text-cyan-200 flex items-center gap-1.5">
                                    <Truck className="w-3.5 h-3.5 text-cyan-400" /> Steadfast Courier Integration
                                </h4>
                                {selectedOrder.tracking_code ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
                                        SF: {selectedOrder.tracking_code}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-slate-400">Not Sent Yet</span>
                                )}
                            </div>

                            {selectedOrder.tracking_code ? (
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <div>
                                        <span className="text-[10px] text-slate-400 block">Consignment ID:</span>
                                        <span className="text-xs font-mono font-bold text-slate-200">
                                            {selectedOrder.consignment_id || '—'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-400 block">Courier Status:</span>
                                        <span className="text-xs font-semibold text-cyan-300 capitalize">
                                            {selectedOrder.courier_status?.replace('_', ' ') || 'in review'}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between pt-1">
                                    <p className="text-[11px] text-slate-400">
                                        This order has not been dispatched to Steadfast Courier yet.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => handleSendSingleSteadfast(selectedOrder)}
                                        disabled={sendingOrderId === selectedOrder.id}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow cursor-pointer disabled:opacity-50"
                                    >
                                        {sendingOrderId === selectedOrder.id ? (
                                            <RefreshCw className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Truck className="w-3 h-3" />
                                        )}
                                        <span>Send to Steadfast Now</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Product & Pricing Card */}
                        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 border-b border-slate-800/80 pb-1.5">
                                <Package className="w-3.5 h-3.5 text-indigo-400" /> Product & Price Details (পণ্যের বিবরণ)
                            </h4>

                            <div className="flex items-start justify-between gap-3 pt-1">
                                <div>
                                    <span className="text-sm font-bold text-slate-100 block">
                                        {selectedOrder.product?.name || 'Product Item'}
                                    </span>
                                    {selectedOrder.variant && (
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30">
                                                {[
                                                    selectedOrder.variant.size && `Size: ${selectedOrder.variant.size}`,
                                                    selectedOrder.variant.color && `Color: ${selectedOrder.variant.color}`,
                                                ].filter(Boolean).join(' | ')}
                                            </span>
                                        </div>
                                    )}
                                    <span className="text-[11px] text-slate-400 block mt-1">
                                        Unit Price: ৳{selectedOrder.unit_price} × {selectedOrder.quantity} pcs
                                    </span>
                                </div>
                                <span className="text-sm font-bold font-mono text-slate-200">
                                    ৳{(selectedOrder.unit_price * selectedOrder.quantity).toFixed(2)}
                                </span>
                            </div>

                            {/* Pricing calculation */}
                            <div className="border-t border-slate-800 pt-2 space-y-1 text-slate-300">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Subtotal:</span>
                                    <span className="font-mono">৳{(selectedOrder.unit_price * selectedOrder.quantity).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Delivery Charge:</span>
                                    <span className="font-mono">৳{Number(selectedOrder.delivery_charge || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between pt-1 border-t border-slate-800 text-sm font-bold text-emerald-400">
                                    <span>Grand Total (সর্বমোট প্রদেয়):</span>
                                    <span className="text-base font-mono">৳{selectedOrder.total_amount}</span>
                                </div>
                                <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                                    <span>Payment Method:</span>
                                    <span className="capitalize text-slate-200 font-medium">
                                        Cash on Delivery (COD) — {selectedOrder.payment_status}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Status Updater & Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-400 text-xs font-medium">Change Status:</span>
                                <select
                                    value={selectedOrder.order_status}
                                    onChange={(e) => {
                                        const newStatus = e.target.value;
                                        handleUpdateStatus(selectedOrder.id, newStatus);
                                        setSelectedOrder((prev) => ({ ...prev, order_status: newStatus }));
                                    }}
                                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer font-medium"
                                >
                                    <option value="draft">Draft</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="processing">Processing</option>
                                    <option value="shipped">Shipped</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>

                            <Button variant="primary" size="sm" onClick={() => setSelectedOrder(null)}>
                                Close Details
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Create Order Modal */}
            <CreateOrderModal
                isOpen={createOrderModalOpen}
                onClose={() => setCreateOrderModalOpen(false)}
                onOrderCreated={() => fetchOrders()}
            />
        </div>
    );
};
