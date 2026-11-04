import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
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
} from 'lucide-react';

export const OrdersPage = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false);

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
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Create Order Modal */}
            <CreateOrderModal
                isOpen={createOrderModalOpen}
                onClose={() => setCreateOrderModalOpen(false)}
                onOrderCreated={() => fetchOrders()}
            />
        </div>
    );
};
