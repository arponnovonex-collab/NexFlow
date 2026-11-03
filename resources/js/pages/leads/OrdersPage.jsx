import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
    ShoppingBag,
    Search,
    Truck,
    CheckCircle2,
    Clock,
    DollarSign,
    FileText,
} from 'lucide-react';

export const OrdersPage = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

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

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Verified Orders & Conversions
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Track confirmed orders generated directly from Facebook, Instagram, and WhatsApp customer chats.
                    </p>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search by order #, phone, customer..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                </div>
            </div>

            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Order Number</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Product Item</th>
                                <th className="px-4 py-3">Total Payable</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Payment</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3 text-right">Update Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                                        No order records found.
                                    </td>
                                </tr>
                            ) : (
                                orders.map((o) => (
                                    <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3.5 font-mono font-semibold text-indigo-400">
                                            {o.order_number}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="font-semibold text-slate-200 block">{o.customer?.name}</span>
                                            <span className="text-[10px] text-slate-400">{o.customer_phone || o.customer?.phone}</span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="font-medium text-slate-200 block">{o.product?.name}</span>
                                            <span className="text-[10px] text-slate-400">
                                                Qty: {o.quantity} × {o.unit_price} BDT
                                            </span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="font-bold text-emerald-400">{o.total_amount} BDT</span>
                                            <span className="text-[10px] text-slate-500 block">
                                                (+{o.delivery_charge} delivery)
                                            </span>
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
                                                        : 'warning'
                                                }
                                                size="xs"
                                            >
                                                {o.order_status.replace('_', ' ')}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3.5 capitalize text-slate-300">
                                            {o.payment_status} (COD)
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-400">
                                            {new Date(o.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <select
                                                value={o.order_status}
                                                onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                                                className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200"
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

