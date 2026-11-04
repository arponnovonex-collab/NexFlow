import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
    ShoppingBag,
    Package,
    Truck,
    User,
    Phone,
    MapPin,
    Hash,
    CheckCircle2,
    RefreshCw,
    Sparkles,
} from 'lucide-react';

export const CreateOrderModal = ({
    isOpen,
    onClose,
    onOrderCreated,
    initialData = {},
}) => {
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [orderNumber, setOrderNumber] = useState('');
    const [productId, setProductId] = useState('');
    const [variantId, setVariantId] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [unitPrice, setUnitPrice] = useState(0);
    const [deliveryCharge, setDeliveryCharge] = useState(60);
    const [notes, setNotes] = useState('');

    const generateOrderNumber = () => {
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `NF-${dateStr}-${randomNum}`;
    };

    // Load products on modal open
    useEffect(() => {
        if (isOpen) {
            setCustomerName(initialData.customer_name || '');
            setCustomerPhone(initialData.customer_phone || '');
            setCustomerAddress(initialData.customer_address || '');
            setOrderNumber(generateOrderNumber());
            setQuantity(1);
            setDeliveryCharge(60);
            setNotes('');

            fetchProducts();
        }
    }, [isOpen, initialData]);

    const fetchProducts = async () => {
        setLoadingProducts(true);
        try {
            const res = await api.get('/products');
            const prods = res.data.data?.data || res.data.data || [];
            setProducts(prods);

            if (prods.length > 0 && !productId) {
                const first = prods[0];
                setProductId(first.id);
                setUnitPrice(Number(first.selling_price || first.regular_price || 0));
                if (first.variants?.length > 0) {
                    setVariantId(first.variants[0].id);
                    if (first.variants[0].price) {
                        setUnitPrice(Number(first.variants[0].price));
                    }
                } else {
                    setVariantId('');
                }
            }
        } catch (err) {
            console.error('Failed to load products:', err);
        } finally {
            setLoadingProducts(false);
        }
    };

    // When product changes
    const handleProductChange = (newProdId) => {
        setProductId(newProdId);
        const prod = products.find((p) => p.id === Number(newProdId));
        if (prod) {
            const defaultPrice = Number(prod.selling_price || prod.regular_price || 0);
            if (prod.variants?.length > 0) {
                const firstVar = prod.variants[0];
                setVariantId(firstVar.id);
                setUnitPrice(Number(firstVar.price || defaultPrice));
            } else {
                setVariantId('');
                setUnitPrice(defaultPrice);
            }
        }
    };

    // When variant changes
    const handleVariantChange = (newVarId) => {
        setVariantId(newVarId);
        const prod = products.find((p) => p.id === Number(productId));
        if (prod && prod.variants) {
            const variant = prod.variants.find((v) => v.id === Number(newVarId));
            if (variant && variant.price) {
                setUnitPrice(Number(variant.price));
            }
        }
    };

    const selectedProduct = products.find((p) => p.id === Number(productId));
    const subtotal = Number(unitPrice || 0) * Number(quantity || 1);
    const totalPayable = subtotal + Number(deliveryCharge || 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!customerPhone.trim()) {
            alert('দয়া করে গ্রাহকের মোবাইল নম্বর লিখুন।');
            return;
        }
        if (!customerAddress.trim()) {
            alert('দয়া করে ডেলিভারি ঠিকানা লিখুন।');
            return;
        }
        if (!productId) {
            alert('দয়া করে একটি প্রোডাক্ট সিলেক্ট করুন।');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                customer_id: initialData.customer_id || null,
                customer_name: customerName.trim(),
                conversation_id: initialData.conversation_id || null,
                order_number: orderNumber.trim(),
                product_id: Number(productId),
                variant_id: variantId ? Number(variantId) : null,
                quantity: Number(quantity),
                unit_price: Number(unitPrice),
                delivery_charge: Number(deliveryCharge),
                customer_address: customerAddress.trim(),
                customer_phone: customerPhone.trim(),
                notes: notes.trim(),
            };

            const res = await api.post('/orders', payload);
            const createdOrder = res.data.data;
            const smsInfo = res.data.auto_sms;

            let successMsg = `✅ Order #${createdOrder.order_number} successfully placed!\nTotal Payable: ৳${createdOrder.total_amount}`;
            if (smsInfo?.success) {
                successMsg += '\n📲 Customer received order confirmation SMS!';
            }

            alert(successMsg);

            if (onOrderCreated) {
                onOrderCreated(createdOrder);
            }
            onClose();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to create order.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="🛍️ Create Customer Order (নতুন অর্ডার)">
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {/* Order ID banner */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-indigo-400" />
                        <span className="text-slate-400">Order ID:</span>
                        <input
                            type="text"
                            value={orderNumber}
                            onChange={(e) => setOrderNumber(e.target.value)}
                            required
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 font-mono text-indigo-300 font-bold text-xs"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setOrderNumber(generateOrderNumber())}
                        title="Generate New ID"
                        className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Customer Information Section */}
                <div className="space-y-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-400" /> Customer Details (গ্রাহকের তথ্য)
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Customer Name</label>
                            <input
                                type="text"
                                placeholder="Customer Name"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] text-slate-400 mb-1">
                                Mobile Number <span className="text-rose-400">*</span>
                            </label>
                            <div className="relative">
                                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    required
                                    placeholder="01XXXXXXXXX"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] text-slate-400 mb-1">
                            Delivery Address (ডেলিভারি ঠিকানা) <span className="text-rose-400">*</span>
                        </label>
                        <textarea
                            rows={2}
                            required
                            placeholder="House, Road, Area, Thana, District / City..."
                            value={customerAddress}
                            onChange={(e) => setCustomerAddress(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>

                {/* Product & Variant Selection */}
                <div className="space-y-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-indigo-400" /> Product & Variation (পণ্য ও ভ্যারিয়েশন)
                    </h4>

                    {loadingProducts ? (
                        <div className="text-slate-400 text-xs py-2 text-center">Loading products catalog...</div>
                    ) : (
                        <div className="space-y-2.5">
                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Select Product</label>
                                <select
                                    value={productId}
                                    onChange={(e) => handleProductChange(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                                >
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} — ৳{p.selling_price || p.regular_price}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Variations dropdown if product has variants */}
                            {selectedProduct?.variants && selectedProduct.variants.length > 0 && (
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">
                                        Select Variation (Size / Color)
                                    </label>
                                    <select
                                        value={variantId}
                                        onChange={(e) => handleVariantChange(e.target.value)}
                                        className="w-full bg-slate-950 border border-indigo-500/40 rounded-lg px-2.5 py-1.5 text-xs text-indigo-300 font-medium focus:outline-none"
                                    >
                                        {selectedProduct.variants.map((v) => (
                                            <option key={v.id} value={v.id}>
                                                {v.size ? `Size: ${v.size} ` : ''}
                                                {v.color ? `Color: ${v.color} ` : ''}
                                                (Stock: {v.stock ?? 'In Stock'})
                                                {v.price ? ` — ৳${v.price}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Quantity & Unit Price */}
                            <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">Quantity (পরিমাণ)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={quantity}
                                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none font-bold"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] text-slate-400 mb-1">Unit Price (৳)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={unitPrice}
                                        onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none font-bold text-emerald-400"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Delivery & Pricing */}
                <div className="space-y-2.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-xs">Delivery Charge:</span>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setDeliveryCharge(60)}
                                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                                    deliveryCharge === 60 ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-300'
                                }`}
                            >
                                Dhaka ৳60
                            </button>
                            <button
                                type="button"
                                onClick={() => setDeliveryCharge(120)}
                                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                                    deliveryCharge === 120 ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-300'
                                }`}
                            >
                                Outside ৳120
                            </button>
                            <button
                                type="button"
                                onClick={() => setDeliveryCharge(0)}
                                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                                    deliveryCharge === 0 ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-800 text-slate-300'
                                }`}
                            >
                                Free ৳0
                            </button>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between font-bold">
                        <span className="text-slate-300">Total Payable (সর্বমোট):</span>
                        <span className="text-base text-emerald-400 font-extrabold font-mono">
                            ৳{totalPayable.toFixed(2)}
                        </span>
                    </div>
                </div>

                {/* Internal / Delivery Notes */}
                <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Order Notes (ঐচ্ছিক)</label>
                    <input
                        type="text"
                        placeholder="e.g. Call before delivery, red color preferred..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        type="submit"
                        loading={submitting}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    >
                        Confirm & Place Order
                    </Button>
                </div>
            </form>
        </Modal>
    );
};

