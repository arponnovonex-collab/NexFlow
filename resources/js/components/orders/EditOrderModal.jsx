import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/client';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
    Package,
    Trash2,
    Plus,
    ShoppingBag,
    Check,
    Truck,
    MapPin,
    User,
    Phone,
    Mail,
    FileText,
    RefreshCw,
} from 'lucide-react';

export const extractOrderItems = (order) => {
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
                    if (!size && (k.includes('size') || k.includes('সাইজ'))) {
                        size = v;
                    }
                    if (!color && (k.includes('color') || k.includes('colour') || k.includes('কালার'))) {
                        color = v;
                    }
                }
            }

            if ((!size || !color) && item.variation) {
                const varStr = String(item.variation);
                const sizeMatch = varStr.match(/size:\s*([^,;]+)/i);
                if (!size && sizeMatch) size = sizeMatch[1].trim();
                const colorMatch = varStr.match(/colou?r:\s*([^,;]+)/i);
                if (!color && colorMatch) color = colorMatch[1].trim();
            }

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
            name: order?.product?.name || 'Product',
            size: order?.size || '',
            color: order?.color || '',
            quantity: parseInt(order?.quantity, 10) || 1,
            price: parseFloat(order?.unit_price) || 0,
        },
    ];
};

export const EditOrderModal = ({
    isOpen,
    onClose,
    order,
    onOrderUpdated,
}) => {
    const [saving, setSaving] = useState(false);
    const manualDeliveryRef = useRef(false);

    const [form, setForm] = useState({
        customer_name: '',
        customer_phone: '',
        customer_address: '',
        customer_email: '',
        items: [],
        quantity: 1,
        delivery_charge: 80,
        total_amount: 0,
        notes: '',
        order_status: 'confirmed',
    });

    const detectDeliveryCharge = (addr) => {
        if (!addr || !addr.trim()) return 80;
        const lower = addr.toLowerCase();
        if (lower.includes('dhaka') || lower.includes('ঢাকা')) {
            return 80;
        }
        return 130;
    };

    useEffect(() => {
        if (isOpen && order) {
            manualDeliveryRef.current = false;
            const parsedItems = extractOrderItems(order);
            const totalQty = parsedItems.reduce(
                (acc, it) => acc + (parseInt(it.quantity, 10) || 0),
                0
            );
            const itemsTotal = parsedItems.reduce(
                (acc, it) => acc + ((parseInt(it.quantity, 10) || 0) * (parseFloat(it.price) || 0)),
                0
            );

            const delivery = order.delivery_charge !== undefined && order.delivery_charge !== null
                ? parseFloat(order.delivery_charge)
                : 80;

            const totalAmount = parseFloat(order.total_amount) || (itemsTotal + delivery);

            setForm({
                customer_name: order.customer?.name || order.customer_name || '',
                customer_phone: order.customer_phone || order.customer?.phone || '',
                customer_address: order.customer_address || '',
                customer_email: order.customer_email || order.customer?.email || '',
                items: parsedItems,
                quantity: totalQty || order.quantity || 1,
                delivery_charge: delivery,
                total_amount: totalAmount,
                notes: order.notes || '',
                order_status: order.order_status || 'confirmed',
            });
        }
    }, [isOpen, order]);

    const handleFormChange = (field, value) => {
        setForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleAddressChange = (e) => {
        const val = e.target.value;
        let newDelivery = form.delivery_charge;

        if (!manualDeliveryRef.current) {
            if (val.trim()) {
                newDelivery = detectDeliveryCharge(val);
            } else {
                newDelivery = 80;
            }
        }

        setForm((prev) => {
            const itemsTotal = prev.items.reduce(
                (acc, it) => acc + ((parseInt(it.quantity, 10) || 0) * (parseFloat(it.price) || 0)),
                0
            );
            return {
                ...prev,
                customer_address: val,
                delivery_charge: newDelivery,
                total_amount: itemsTotal + newDelivery,
            };
        });
    };

    const handleSetDelivery = (amount, isManual = true) => {
        manualDeliveryRef.current = isManual;
        const delivery = Math.max(0, parseFloat(amount) || 0);

        setForm((prev) => {
            const itemsTotal = prev.items.reduce(
                (acc, it) => acc + ((parseInt(it.quantity, 10) || 0) * (parseFloat(it.price) || 0)),
                0
            );
            return {
                ...prev,
                delivery_charge: delivery,
                total_amount: itemsTotal + delivery,
            };
        });
    };

    const handleItemChange = (idx, field, value) => {
        setForm((prev) => {
            const updatedItems = [...prev.items];
            updatedItems[idx] = { ...updatedItems[idx], [field]: value };

            const totalQty = updatedItems.reduce(
                (acc, it) => acc + (parseInt(it.quantity, 10) || 0),
                0
            );
            const itemsTotal = updatedItems.reduce(
                (acc, it) => acc + ((parseInt(it.quantity, 10) || 0) * (parseFloat(it.price) || 0)),
                0
            );
            const delivery = parseFloat(prev.delivery_charge) || 0;

            return {
                ...prev,
                items: updatedItems,
                quantity: totalQty,
                total_amount: itemsTotal + delivery,
            };
        });
    };

    const handleAddItem = () => {
        setForm((prev) => {
            const newItem = {
                id: Date.now(),
                name: '',
                size: '',
                color: '',
                quantity: 1,
                price: 0,
            };
            const updatedItems = [...prev.items, newItem];
            const totalQty = updatedItems.reduce(
                (acc, it) => acc + (parseInt(it.quantity, 10) || 0),
                0
            );
            const itemsTotal = updatedItems.reduce(
                (acc, it) => acc + ((parseInt(it.quantity, 10) || 0) * (parseFloat(it.price) || 0)),
                0
            );
            const delivery = parseFloat(prev.delivery_charge) || 0;

            return {
                ...prev,
                items: updatedItems,
                quantity: totalQty,
                total_amount: itemsTotal + delivery,
            };
        });
    };

    const handleRemoveItem = (idx) => {
        setForm((prev) => {
            if (prev.items.length <= 1) {
                alert('অন্তত একটি পণ্য অর্ডারে থাকতে হবে।');
                return prev;
            }
            const updatedItems = prev.items.filter((_, i) => i !== idx);
            const totalQty = updatedItems.reduce(
                (acc, it) => acc + (parseInt(it.quantity, 10) || 0),
                0
            );
            const itemsTotal = updatedItems.reduce(
                (acc, it) => acc + ((parseInt(it.quantity, 10) || 0) * (parseFloat(it.price) || 0)),
                0
            );
            const delivery = parseFloat(prev.delivery_charge) || 0;

            return {
                ...prev,
                items: updatedItems,
                quantity: totalQty,
                total_amount: itemsTotal + delivery,
            };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!order) return;

        if (!form.customer_phone || !form.customer_phone.trim()) {
            alert('গ্রাহকের ফোন নম্বর আবশ্যক!');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                items_data: form.items,
                quantity: form.quantity,
                size: form.items[0]?.size || '',
                color: form.items[0]?.color || '',
                unit_price: form.items[0]?.price || 0,
                delivery_charge: form.delivery_charge,
                total_amount: form.total_amount,
                customer_name: form.customer_name,
                customer_phone: form.customer_phone,
                customer_address: form.customer_address,
                customer_email: form.customer_email,
                notes: form.notes,
                order_status: form.order_status,
            };

            const res = await api.put(`/orders/${order.id}`, payload);
            if (res.data.status === 'success') {
                alert(`✅ Order #${order.order_number} সফলভাবে আপডেট করা হয়েছে!`);
                if (onOrderUpdated) {
                    onOrderUpdated(res.data.data);
                }
                onClose();
            }
        } catch (err) {
            alert('Failed to update order: ' + (err.response?.data?.message || err.message));
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !order) return null;

    const itemsSubtotal = form.items.reduce(
        (sum, it) => sum + ((parseInt(it.quantity, 10) || 0) * (parseFloat(it.price) || 0)),
        0
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`অর্ডার এডিট করুন: #${order.order_number}`}
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-200">
                {/* Customer Information Card */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-400" />
                        <span>গ্রাহকের তথ্য (Customer Details)</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] text-slate-400 mb-1">
                                Customer Name (গ্রাহকের নাম)
                            </label>
                            <input
                                type="text"
                                value={form.customer_name}
                                onChange={(e) => handleFormChange('customer_name', e.target.value)}
                                placeholder="Customer Name"
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] text-slate-400 mb-1">
                                Phone Number (ফোন নম্বর) <span className="text-rose-400">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={form.customer_phone}
                                onChange={(e) => handleFormChange('customer_phone', e.target.value)}
                                placeholder="01XXXXXXXXX"
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] text-slate-400 mb-1">
                                Email Address (ইমেইল - ঐচ্ছিক)
                            </label>
                            <input
                                type="email"
                                value={form.customer_email}
                                onChange={(e) => handleFormChange('customer_email', e.target.value)}
                                placeholder="customer@example.com"
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] text-slate-400">
                                    Delivery Address (ডেলিভারি ঠিকানা)
                                </label>
                                {form.customer_address.trim() && (
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                        detectDeliveryCharge(form.customer_address) === 80
                                            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                    }`}>
                                        {detectDeliveryCharge(form.customer_address) === 80 ? 'ঢাকার ভেতরে (৳৮০)' : 'ঢাকার বাইরে (৳১৩০)'}
                                    </span>
                                )}
                            </div>
                            <textarea
                                rows={2}
                                value={form.customer_address}
                                onChange={handleAddressChange}
                                placeholder="House, Road, Thana, District..."
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Ordered Products Section */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <Package className="w-4 h-4 text-cyan-400" />
                            <span>অর্ডারকৃত পণ্যসমূহ ({form.items?.length || 1}টি আইটেম)</span>
                        </h4>
                        <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 font-bold">
                            মোট কোয়ান্টিটি: {form.quantity} পিস
                        </span>
                    </div>

                    <div className="space-y-3">
                        {form.items.map((item, idx) => (
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
                                    {form.items.length > 1 && (
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

                                {/* Product Name */}
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                                        পণ্যের নাম (Product Name)
                                    </label>
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
                                            placeholder="e.g. 40, 42, M, XL"
                                            value={item.size}
                                            onChange={(e) => handleItemChange(idx, 'size', e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-indigo-200 font-mono focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1 font-medium">Color (কালার)</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Red, Blue, Black"
                                            value={item.color}
                                            onChange={(e) => handleItemChange(idx, 'color', e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-purple-200 font-mono focus:border-purple-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-400 mb-1 font-medium">Quantity (কোয়ান্টিটি)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(idx, 'quantity', Math.max(1, parseInt(e.target.value, 10) || 1))}
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
                                            onChange={(e) => handleItemChange(idx, 'price', Math.max(0, parseFloat(e.target.value) || 0))}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono focus:border-cyan-500"
                                        />
                                    </div>
                                </div>

                                <div className="text-right text-[11px] text-slate-400 font-mono pt-0.5">
                                    আইটেম সাবটোটাল: <strong className="text-slate-200">৳{((item.quantity || 1) * (item.price || 0)).toFixed(2)}</strong>
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={handleAddItem}
                            className="w-full py-2 px-3 border border-dashed border-indigo-500/40 hover:border-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-300 hover:text-white rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5 text-indigo-400" />
                            <span>+ আরেকটি পণ্য যোগ করুন (Add Another Item)</span>
                        </button>
                    </div>
                </div>

                {/* Pricing & Calculations */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-indigo-400" /> মূল্য ও ডেলিভারি হিসাব (Pricing & Delivery)
                    </h4>

                    {/* Delivery Charge Controls */}
                    <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <label className="text-[11px] text-slate-300 font-semibold">Delivery Charge (ডেলিভারি চার্জ):</label>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                    form.delivery_charge === 80
                                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                        : form.delivery_charge === 130
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                            : form.delivery_charge === 0
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                }`}>
                                    {form.delivery_charge === 80
                                        ? 'ঢাকার ভেতরে (৳80)'
                                        : form.delivery_charge === 130
                                            ? 'ঢাকার বাইরে (৳130)'
                                            : form.delivery_charge === 0
                                                ? 'ফ্রি ডেলিভারি (৳0)'
                                                : `কাস্টম চার্জ (৳${form.delivery_charge})`}
                                </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => handleSetDelivery(80)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        form.delivery_charge === 80
                                            ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                                    }`}
                                >
                                    ঢাকা ৳৮০
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSetDelivery(130)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        form.delivery_charge === 130
                                            ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400'
                                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                                    }`}
                                >
                                    ঢাকার বাইরে ৳১৩০
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSetDelivery(0)}
                                    className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                        form.delivery_charge === 0
                                            ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400 font-bold'
                                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700'
                                    }`}
                                >
                                    ফ্রি ৳০
                                </button>
                                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5" title="প্রয়োজনে কাস্টম ডেলিভারি চার্জ লিখুন">
                                    <span className="text-slate-400 text-xs font-mono">৳</span>
                                    <input
                                        type="number"
                                        min="0"
                                        value={form.delivery_charge}
                                        onChange={(e) => handleSetDelivery(e.target.value)}
                                        className="w-14 bg-transparent text-xs font-mono font-bold text-cyan-300 text-right focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-800">
                        <div>
                            <label className="block text-[11px] text-slate-400 mb-1">মোট আইটেম</label>
                            <div className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-bold font-mono">
                                {form.quantity} পিস
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] text-slate-400 mb-1">পণ্য সাবটোটাল</label>
                            <div className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono">
                                ৳{itemsSubtotal.toFixed(2)}
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] text-slate-400 mb-1 font-bold text-emerald-400">সর্বমোট (Total Amount ৳)</label>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                value={form.total_amount}
                                onChange={(e) => handleFormChange('total_amount', parseFloat(e.target.value) || 0)}
                                className="w-full bg-slate-900 border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-bold font-mono focus:border-emerald-400"
                            />
                        </div>
                    </div>
                </div>

                {/* Order Status & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Order Status (অর্ডার স্ট্যাটাস)</label>
                        <select
                            value={form.order_status}
                            onChange={(e) => handleFormChange('order_status', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                            <option value="draft">Draft</option>
                            <option value="pending_confirmation">Pending Confirmation</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Internal Notes (অর্ডারের নোট)</label>
                        <input
                            type="text"
                            placeholder="e.g. কাস্টমার ডেলিভারির আগে কল দিতে বলেছেন"
                            value={form.notes}
                            onChange={(e) => handleFormChange('notes', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        disabled={saving}
                        className="text-slate-400 hover:text-white"
                    >
                        বাতিল
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        loading={saving}
                        className="bg-indigo-600 hover:bg-indigo-500 font-bold flex items-center gap-1.5 shadow-lg"
                    >
                        <Check className="w-4 h-4" />
                        <span>সংরক্ষণ করুন (Save Changes)</span>
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
