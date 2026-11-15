import React, { useEffect, useState, useMemo } from 'react';
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
    Mail,
    Hash,
    CheckCircle2,
    RefreshCw,
    Sparkles,
    Tag,
    Palette,
    Check,
} from 'lucide-react';

export const CreateOrderModal = ({
    isOpen,
    onClose,
    onOrderCreated,
    initialData = {},
}) => {
    const [products, setProducts] = useState([]);
    const [globalAttributes, setGlobalAttributes] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [orderNumber, setOrderNumber] = useState('');
    const [productId, setProductId] = useState('');
    const [variantId, setVariantId] = useState('');
    const [selectedSize, setSelectedSize] = useState('');
    const [selectedColor, setSelectedColor] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [unitPrice, setUnitPrice] = useState(0);
    const [deliveryCharge, setDeliveryCharge] = useState(60);
    const [notes, setNotes] = useState('');

    const prevOpenRef = React.useRef(false);

    const generateOrderNumber = () => {
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `NF-${dateStr}-${randomNum}`;
    };

    // Initialize fields ONLY when modal transitions from closed to open
    useEffect(() => {
        if (isOpen && !prevOpenRef.current) {
            setCustomerName(initialData.customer_name || '');
            setCustomerPhone(initialData.customer_phone || '');
            setCustomerAddress(initialData.customer_address || '');
            setCustomerEmail(initialData.customer_email || initialData.email || '');
            setOrderNumber(generateOrderNumber());
            setQuantity(1);
            setDeliveryCharge(60);
            setNotes('');
            setSelectedSize(initialData.size || '');
            setSelectedColor(initialData.color || '');

            fetchProductsAndAttributes();
        }
        prevOpenRef.current = isOpen;
    }, [isOpen]);

    const fetchProductsAndAttributes = async () => {
        setLoadingProducts(true);
        try {
            const [prodRes, attrRes] = await Promise.all([
                api.get('/products', { params: { per_page: 250 } }),
                api.get('/product-attributes').catch(() => ({ data: { data: [] } })),
            ]);

            const prods = prodRes.data.data?.data || prodRes.data.data || [];
            setProducts(prods);
            setGlobalAttributes(attrRes.data?.data || []);

            if (prods.length > 0 && !productId) {
                const first = prods[0];
                setProductId(first.id);
                setUnitPrice(Number(first.selling_price || first.regular_price || 0));
                autoSelectProductAttributes(first);
            }
        } catch (err) {
            console.error('Failed to load products or attributes:', err);
        } finally {
            setLoadingProducts(false);
        }
    };

    const autoSelectProductAttributes = (prod) => {
        if (!prod) return;
        const defaultPrice = Number(prod.selling_price || prod.regular_price || 0);

        if (prod.variants?.length > 0) {
            const firstVar = prod.variants[0];
            setVariantId(firstVar.id);
            setSelectedSize(firstVar.size || '');
            setSelectedColor(firstVar.color || '');
            setUnitPrice(Number(firstVar.price || defaultPrice));
        } else {
            setVariantId('');
            setSelectedSize('');
            setSelectedColor('');
            setUnitPrice(defaultPrice);
        }
    };

    // When product changes
    const handleProductChange = (newProdId) => {
        setProductId(newProdId);
        const prod = products.find((p) => p.id === Number(newProdId));
        if (prod) {
            autoSelectProductAttributes(prod);
        }
    };

    const selectedProduct = products.find((p) => p.id === Number(productId));

    // Extract available sizes from product variants & attributes
    const availableSizes = useMemo(() => {
        if (!selectedProduct) return [];
        const set = new Set();
        if (selectedProduct.variants && selectedProduct.variants.length > 0) {
            selectedProduct.variants.forEach((v) => {
                if (v.size && v.size.trim()) set.add(v.size.trim());
            });
        }
        if (selectedProduct.attributes && Array.isArray(selectedProduct.attributes)) {
            selectedProduct.attributes.forEach((a) => {
                const nameLower = (a.name || '').toLowerCase();
                if (nameLower.includes('size') || nameLower.includes('সাইজ')) {
                    (a.options || []).forEach((opt) => opt && set.add(String(opt).trim()));
                }
            });
        }

        // If no product-specific sizes, fallback to global Size attribute values
        if (set.size === 0) {
            const sizeAttr = globalAttributes.find((a) => a.slug === 'size' || a.name.toLowerCase() === 'size');
            if (sizeAttr?.values) {
                sizeAttr.values.forEach((v) => v.name && set.add(v.name.trim()));
            }
        }

        return Array.from(set);
    }, [selectedProduct, globalAttributes]);

    // Extract available colors from product variants & attributes
    const availableColors = useMemo(() => {
        if (!selectedProduct) return [];
        const map = new Map(); // name -> color code

        if (selectedProduct.variants && selectedProduct.variants.length > 0) {
            selectedProduct.variants.forEach((v) => {
                if (v.color && v.color.trim()) {
                    map.set(v.color.trim(), null);
                }
            });
        }
        if (selectedProduct.attributes && Array.isArray(selectedProduct.attributes)) {
            selectedProduct.attributes.forEach((a) => {
                const nameLower = (a.name || '').toLowerCase();
                if (nameLower.includes('color') || nameLower.includes('colour') || nameLower.includes('কালার')) {
                    (a.options || []).forEach((opt) => opt && map.set(String(opt).trim(), null));
                }
            });
        }

        // If no product-specific colors, fallback to global Color attribute values
        if (map.size === 0) {
            const colorAttr = globalAttributes.find(
                (a) => a.slug === 'color' || a.name.toLowerCase() === 'color' || a.type === 'color'
            );
            if (colorAttr?.values) {
                colorAttr.values.forEach((v) => v.name && map.set(v.name.trim(), v.value || null));
            }
        }

        return Array.from(map.entries()).map(([name, code]) => ({ name, code }));
    }, [selectedProduct, globalAttributes]);

    // When size is chosen
    const handleSizeSelect = (newSize) => {
        setSelectedSize(newSize);
        findAndApplyVariant(newSize, selectedColor);
    };

    // When color is chosen
    const handleColorSelect = (newColor) => {
        setSelectedColor(newColor);
        findAndApplyVariant(selectedSize, newColor);
    };

    const findAndApplyVariant = (targetSize, targetColor) => {
        if (!selectedProduct?.variants || selectedProduct.variants.length === 0) return;

        // Try exact match on size & color
        let match = selectedProduct.variants.find(
            (v) => (v.size || '') === (targetSize || '') && (v.color || '') === (targetColor || '')
        );

        // Try partial match
        if (!match && targetSize) {
            match = selectedProduct.variants.find((v) => (v.size || '') === targetSize);
        }
        if (!match && targetColor) {
            match = selectedProduct.variants.find((v) => (v.color || '') === targetColor);
        }

        if (match) {
            setVariantId(match.id);
            if (match.price) {
                setUnitPrice(Number(match.price));
            }
        }
    };

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

        // Enforce required size & color if product has them
        if (availableSizes.length > 0 && !selectedSize) {
            alert('⚠️ দয়া করে প্রোডাক্টের সাইজ (Size) সিলেক্ট করুন।');
            return;
        }
        if (availableColors.length > 0 && !selectedColor) {
            alert('⚠️ দয়া করে প্রোডাক্টের কালার (Color) সিলেক্ট করুন।');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                customer_id: initialData.customer_id || null,
                customer_name: customerName.trim(),
                customer_phone: customerPhone.trim(),
                customer_address: customerAddress.trim(),
                customer_email: customerEmail.trim() || null,
                conversation_id: initialData.conversation_id || null,
                order_number: orderNumber.trim(),
                product_id: Number(productId),
                variant_id: variantId ? Number(variantId) : null,
                size: selectedSize || null,
                color: selectedColor || null,
                quantity: Number(quantity),
                unit_price: Number(unitPrice),
                delivery_charge: Number(deliveryCharge),
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        <div>
                            <label className="block text-[11px] text-slate-400 mb-1">
                                Email Address <span className="text-slate-500 font-normal">(ঐচ্ছিক / Optional)</span>
                            </label>
                            <div className="relative">
                                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="email"
                                    placeholder="customer@example.com (optional)"
                                    value={customerEmail}
                                    onChange={(e) => setCustomerEmail(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[11px] text-slate-400 mb-1">
                                Delivery Address (ডেলিভারি ঠিকানা) <span className="text-rose-400">*</span>
                            </label>
                            <textarea
                                rows={1}
                                required
                                placeholder="House, Road, Area, Thana, District..."
                                value={customerAddress}
                                onChange={(e) => setCustomerAddress(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Product & Attributes Selection */}
                <div className="space-y-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <h4 className="font-semibold text-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Product & Attributes (পণ্য, সাইজ ও কালার)</span>
                        </div>
                        {selectedProduct?.wc_product_id && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                🌐 Website Synced
                            </span>
                        )}
                    </h4>

                    {loadingProducts ? (
                        <div className="text-slate-400 text-xs py-2 text-center flex items-center justify-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Loading products catalog...</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Product Dropdown */}
                            <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Select Product</label>
                                <select
                                    value={productId}
                                    onChange={(e) => handleProductChange(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                                >
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} {p.sku ? `(${p.sku})` : ''} — ৳{p.selling_price || p.regular_price}
                                            {p.wc_product_id ? ' [WooCommerce]' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Size Selection */}
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <Tag className="w-3 h-3 text-indigo-400" />
                                        <span>Size (সাইজ) {availableSizes.length > 0 && <span className="text-rose-400">*</span>}</span>
                                    </div>
                                    {selectedSize && (
                                        <span className="text-indigo-400 font-bold font-mono text-[11px]">
                                            Selected: {selectedSize}
                                        </span>
                                    )}
                                </label>

                                {availableSizes.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {availableSizes.map((sz) => {
                                            const isSelected = selectedSize === sz;
                                            return (
                                                <button
                                                    key={sz}
                                                    type="button"
                                                    onClick={() => handleSizeSelect(sz)}
                                                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400'
                                                            : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                                                    }`}
                                                >
                                                    {sz}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="e.g. S, M, L, XL, 32 (optional custom size)"
                                        value={selectedSize}
                                        onChange={(e) => setSelectedSize(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                                    />
                                )}
                            </div>

                            {/* Color Selection */}
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <Palette className="w-3 h-3 text-purple-400" />
                                        <span>Color (কালার) {availableColors.length > 0 && <span className="text-rose-400">*</span>}</span>
                                    </div>
                                    {selectedColor && (
                                        <span className="text-purple-400 font-bold text-[11px]">
                                            Selected: {selectedColor}
                                        </span>
                                    )}
                                </label>

                                {availableColors.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                        {availableColors.map((col) => {
                                            const isSelected = selectedColor === col.name;
                                            return (
                                                <button
                                                    key={col.name}
                                                    type="button"
                                                    onClick={() => handleColorSelect(col.name)}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400'
                                                            : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                                                    }`}
                                                >
                                                    {col.code && (
                                                        <span
                                                            className="w-2.5 h-2.5 rounded-full border border-white/20 shrink-0"
                                                            style={{ backgroundColor: col.code }}
                                                        />
                                                    )}
                                                    <span>{col.name}</span>
                                                    {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <input
                                        type="text"
                                        placeholder="e.g. Black, Red, Olive, Navy (optional custom color)"
                                        value={selectedColor}
                                        onChange={(e) => setSelectedColor(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                                    />
                                )}
                            </div>

                            {/* Quantity & Unit Price */}
                            <div className="grid grid-cols-2 gap-2.5 pt-1">
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
                                className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                                    deliveryCharge === 60 ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-300'
                                }`}
                            >
                                Dhaka ৳60
                            </button>
                            <button
                                type="button"
                                onClick={() => setDeliveryCharge(120)}
                                className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                                    deliveryCharge === 120 ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-800 text-slate-300'
                                }`}
                            >
                                Outside ৳120
                            </button>
                            <button
                                type="button"
                                onClick={() => setDeliveryCharge(0)}
                                className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
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
                        placeholder="e.g. Call before delivery, urgent package..."
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
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                    >
                        Confirm & Place Order
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
