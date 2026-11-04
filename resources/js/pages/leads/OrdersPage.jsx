import React, { useEffect, useState } from 'react';
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
    Package,
    RefreshCw,
    Eye,
} from 'lucide-react';

export const OrdersPage = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);

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
        try {
            await api.put(`/orders/${orderId}/status`, { order_status: newStatus });
            fetchOrders();
        } catch (err) {
            alert('Failed to update order status');
        }
    };

    // Calculate metrics
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
    const confirmedCount = orders.filter((o) => o.order_status === 'confirmed').length;
    const deliveredCount = orders.filter((o) => o.order_status === 'delivered').length;
    const shippedCount = orders.filter((o) => o.order_status === 'shipped').length;

    const filterOptions = [
        { label: 'All Orders', value: '' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Processing', value: 'processing' },
        { label: 'Shipped', value: 'shipped' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Cancelled', value: 'cancelled' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Customer Orders & Sales (অর্ডার ও বিক্রি)
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Manage confirmed customer orders from Messenger, Instagram, and WhatsApp chats with dynamic order tracking.
                    </p>
                </div>
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

            {/* Orders Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Order Number</th>
                                <th className="px-4 py-3">Customer & Phone</th>
                                <th className="px-4 py-3">Shipping Address</th>
                                <th className="px-4 py-3">Product & Variation</th>
                                <th className="px-4 py-3">Total Payable</th>
                                <th className="px-4 py-3">Moderator</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {loading ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                                        Loading customer orders...
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                                        No order records found.
                                    </td>
                                </tr>
                            ) : (
                                orders.map((o) => {
                                    const variantText = o.variant
                                        ? [o.variant.size && `Size: ${o.variant.size}`, o.variant.color && `Color: ${o.variant.color}`].filter(Boolean).join(', ')
                                        : null;

                                    return (
                                        <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                                            <td className="px-4 py-3.5 font-mono font-bold text-indigo-400">
                                                {o.order_number}
                                            </td>

                                            <td className="px-4 py-3.5">
                                                <span className="font-semibold text-slate-200 block">{o.customer?.name}</span>
                                                <span className="text-[11px] text-slate-400 font-mono block">
                                                    {o.customer_phone || o.customer?.phone || 'No phone'}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3.5 max-w-xs">
                                                <span className="text-slate-300 text-xs block line-clamp-2" title={o.customer_address}>
                                                    {o.customer_address || '—'}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3.5">
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

                                            <td className="px-4 py-3.5">
                                                <span className="font-extrabold text-emerald-400 text-sm">৳{o.total_amount}</span>
                                                <span className="text-[10px] text-slate-500 block">
                                                    (+৳{o.delivery_charge} delivery)
                                                </span>
                                            </td>

                                            <td className="px-4 py-3.5 text-slate-300">
                                                {o.user?.name ? (
                                                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 font-medium">
                                                        {o.user.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500 text-[10px]">Direct/Web</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3.5">
                                                <Badge
                                                    variant={
                                                        o.order_status === 'delivered'
                                                            ? 'success'
                                                            : o.order_status === 'shipped'
                                                            ? 'info'
                                                            : o.order_status === 'confirmed'
                                                            ? 'primary'
                                                            : o.order_status === 'processing'
                                                            ? 'warning'
                                                            : 'neutral'
                                                    }
                                                    size="xs"
                                                >
                                                    {o.order_status.replace('_', ' ')}
                                                </Badge>
                                            </td>

                                            <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                                                {new Date(o.created_at).toLocaleDateString()}
                                            </td>

                                            <td className="px-4 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="secondary"
                                                        size="xs"
                                                        icon={Eye}
                                                        onClick={() => setSelectedOrder(o)}
                                                        className="text-indigo-400 hover:text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/10 cursor-pointer font-medium"
                                                    >
                                                        Details
                                                    </Button>
                                                    <select
                                                        value={o.order_status}
                                                        onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                                                        className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                                                    >
                                                        <option value="draft">Draft</option>
                                                        <option value="confirmed">Confirmed</option>
                                                        <option value="processing">Processing</option>
                                                        <option value="shipped">Shipped</option>
                                                        <option value="delivered">Delivered</option>
                                                        <option value="cancelled">Cancelled</option>
                                                    </select>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

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
                                <span className="text-slate-400 text-xs">Change Status:</span>
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
