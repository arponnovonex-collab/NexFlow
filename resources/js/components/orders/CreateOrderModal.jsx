import React, { useEffect, useState, useMemo, useRef } from 'react';
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
    Plus,
    Trash2,
    Layers,
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

    // Customer form state
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [orderNumber, setOrderNumber] = useState('');
    const [deliveryCharge, setDeliveryCharge] = useState(80);
    const manualDeliveryRef = useRef(false);
    const [notes, setNotes] = useState('');

    // Helper to detect inside Dhaka (80) vs outside Dhaka (130)
    const detectDeliveryCharge = (addr) => {
        if (!addr || !addr.trim()) return 80;
        const lower = addr.toLowerCase();
        if (lower.includes('dhaka') || lower.includes('ঢাকা')) {
            return 80;
        }
        return 130;
    };

    // Items list state (multi-product support)
    const [items, setItems] = useState([
        {
            id: 'item-1',
            productId: '',
            variantId: '',
            size: '',
            color: '',
            quantity: 1,
            unitPrice: 0,
        },
    ]);

    const prevOpenRef = useRef(false);

    const generateOrderNumber = () => {
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        return `NF-${dateStr}-${randomNum}`;
    };

    // Helper to check whether a product specifically defines sizes (from variants or attributes)
    const getProductSizeInfo = (prod) => {
        if (!prod) return { hasSizes: false, sizes: [] };
        const set = new Set();

        if (prod.variants && Array.isArray(prod.variants)) {
            prod.variants.forEach((v) => {
                if (v.size && String(v.size).trim()) {
                    set.add(String(v.size).trim());
                }
            });
        }

        if (prod.attributes && Array.isArray(prod.attributes)) {
            prod.attributes.forEach((a) => {
                const nameLower = (a.name || '').toLowerCase();
                if (nameLower.includes('size') || nameLower.includes('সাইজ')) {
                    (a.options || []).forEach((opt) => {
                        if (opt && String(opt).trim()) {
                            set.add(String(opt).trim());
                        }
                    });
                }
            });
        }

        const sizes = Array.from(set);
        return {
            hasSizes: sizes.length > 0,
            sizes,
        };
    };

    // Helper to check whether a product specifically defines colors (from variants or attributes)
    const getProductColorInfo = (prod) => {
        if (!prod) return { hasColors: false, colors: [] };
        const map = new Map();

        if (prod.variants && Array.isArray(prod.variants)) {
            prod.variants.forEach((v) => {
                if (v.color && String(v.color).trim()) {
                    map.set(String(v.color).trim(), null);
                }
            });
        }

        if (prod.attributes && Array.isArray(prod.attributes)) {
            prod.attributes.forEach((a) => {
                const nameLower = (a.name || '').toLowerCase();
                if (
                    nameLower.includes('color') ||
                    nameLower.includes('colour') ||
                    nameLower.includes('কালার') ||
                    nameLower.includes('রং')
                ) {
                    (a.options || []).forEach((opt) => {
                        if (opt && String(opt).trim()) {
                            map.set(String(opt).trim(), null);
                        }
                    });
                }
            });
        }

        const colors = Array.from(map.entries()).map(([name, code]) => ({ name, code }));
        return {
            hasColors: colors.length > 0,
            colors,
        };
    };

    // Construct an item initialized for a product
    const createItemForProduct = (prod, existingItem = {}) => {
        if (!prod) {
            return {
                id: existingItem.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                productId: '',
                variantId: '',
                size: '',
                color: '',
                quantity: existingItem.quantity || 1,
                unitPrice: 0,
            };
        }

        const defaultPrice = Number(prod.selling_price || prod.regular_price || 0);
        let varId = '';
        let sz = existingItem.size || '';
        let col = existingItem.color || '';
        let price = defaultPrice;

        if (prod.variants?.length > 0) {
            // If user supplied initial size or color, try to match it
            let match = null;
            if (sz || col) {
                match = prod.variants.find(
                    (v) => (!sz || v.size === sz) && (!col || v.color === col)
                );
            }
            if (!match) {
                match = prod.variants[0];
            }
            varId = match.id;
            sz = match.size || sz || '';
            col = match.color || col || '';
            price = Number(match.price || defaultPrice);
        }

        return {
            id: existingItem.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            productId: prod.id,
            variantId: varId,
            size: sz,
            color: col,
            quantity: existingItem.quantity || 1,
            unitPrice: price,
        };
    };

    // Variant matcher on size or color selection
    const findAndApplyVariant = (item, targetSize, targetColor, prod) => {
        if (!prod?.variants || prod.variants.length === 0) {
            return {
                ...item,
                size: targetSize,
                color: targetColor,
            };
        }

        let match = prod.variants.find(
            (v) => (v.size || '') === (targetSize || '') && (v.color || '') === (targetColor || '')
        );

        if (!match && targetSize) {
            match = prod.variants.find((v) => (v.size || '') === targetSize);
        }
        if (!match && targetColor) {
            match = prod.variants.find((v) => (v.color || '') === targetColor);
        }

        const defaultPrice = Number(prod.selling_price || prod.regular_price || 0);

        return {
            ...item,
            size: targetSize,
            color: targetColor,
            variantId: match ? match.id : item.variantId,
            unitPrice: match?.price ? Number(match.price) : (item.unitPrice || defaultPrice),
        };
    };

    // Initialize fields ONLY when modal transitions from closed to open
    useEffect(() => {
        if (isOpen && !prevOpenRef.current) {
            setCustomerName(initialData.customer_name || '');
            setCustomerPhone(initialData.customer_phone || '');
            const initAddr = initialData.customer_address || '';
            setCustomerAddress(initAddr);
            setCustomerEmail(initialData.customer_email || initialData.email || '');
            setOrderNumber(generateOrderNumber());

            manualDeliveryRef.current = false;
            if (initialData.delivery_charge !== undefined && initialData.delivery_charge !== null && initialData.delivery_charge !== '') {
                setDeliveryCharge(Number(initialData.delivery_charge));
                manualDeliveryRef.current = true;
            } else if (initAddr.trim()) {
                setDeliveryCharge(detectDeliveryCharge(initAddr));
            } else {
                setDeliveryCharge(80); // Default Inside Dhaka ৳80
            }

            setNotes('');

            fetchProducts();
        }
        prevOpenRef.current = isOpen;
    }, [isOpen]);

    const handleAddressChange = (e) => {
        const val = e.target.value;
        setCustomerAddress(val);
        if (!manualDeliveryRef.current) {
            if (val.trim()) {
                setDeliveryCharge(detectDeliveryCharge(val));
            } else {
                setDeliveryCharge(80);
            }
        }
    };

    const handleSetDelivery = (amount, isManual = true) => {
        manualDeliveryRef.current = isManual;
        setDeliveryCharge(amount);
    };

    const fetchProducts = async () => {
        setLoadingProducts(true);
        try {
            const res = await api.get('/products', { params: { per_page: 250 } });
            const prods = res.data.data?.data || res.data.data || [];
            setProducts(prods);

            if (prods.length > 0) {
                setItems((prev) => {
                    const first = prods[0];
                    return [
                        createItemForProduct(first, {
                            size: initialData.size || '',
                            color: initialData.color || '',
                        }),
                    ];
                });
            }
        } catch (err) {
            console.error('Failed to load products:', err);
        } finally {
            setLoadingProducts(false);
        }
    };

    // Product change for a specific item
    const handleProductChange = (index, newProdId) => {
        const prod = products.find((p) => p.id === Number(newProdId));
        setItems((prev) => {
            const next = [...prev];
            next[index] = createItemForProduct(prod, {
                ...next[index],
                productId: Number(newProdId),
            });
            return next;
        });
    };

    // Size select for a specific item
    const handleSizeSelect = (index, newSize) => {
        setItems((prev) => {
            const next = [...prev];
            const item = next[index];
            const prod = products.find((p) => p.id === Number(item.productId));
            next[index] = findAndApplyVariant(item, newSize, item.color, prod);
            return next;
        });
    };

    // Custom size text change
    const handleCustomSizeChange = (index, val) => {
        setItems((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], size: val };
            return next;
        });
    };

    // Color select for a specific item
    const handleColorSelect = (index, newColor) => {
        setItems((prev) => {
            const next = [...prev];
            const item = next[index];
            const prod = products.find((p) => p.id === Number(item.productId));
            next[index] = findAndApplyVariant(item, item.size, newColor, prod);
            return next;
        });
    };

    // Custom color text change
    const handleCustomColorChange = (index, val) => {
        setItems((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], color: val };
            return next;
        });
    };

    // Quantity change
    const handleQuantityChange = (index, val) => {
        const q = Math.max(1, parseInt(val, 10) || 1);
        setItems((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], quantity: q };
            return next;
        });
    };

    // Price change
    const handlePriceChange = (index, val) => {
        const p = Math.max(0, parseFloat(val) || 0);
        setItems((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], unitPrice: p };
            return next;
        });
    };

    // Add another item
    const handleAddItem = () => {
        if (products.length === 0) return;
        const defaultProd = products[0];
        setItems((prev) => [...prev, createItemForProduct(defaultProd)]);
    };

    // Remove item
    const handleRemoveItem = (index) => {
        if (items.length <= 1) {
            alert('কমপক্ষে একটি পণ্য অর্ডারে থাকতে হবে।');
            return;
        }
        setItems((prev) => prev.filter((_, idx) => idx !== index));
    };

    // Pricing calculations
    const itemsSubtotal = useMemo(() => {
        return items.reduce(
            (sum, it) => sum + (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1),
            0
        );
    }, [items]);

    const totalQuantity = useMemo(() => {
        return items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
    }, [items]);

    const totalPayable = itemsSubtotal + (Number(deliveryCharge) || 0);

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
        if (items.length === 0) {
            alert('দয়া করে অন্তত একটি প্রোডাক্ট যোগ করুন।');
            return;
        }

        // Validate each item for mandatory size / color ONLY if the product specifically defines them
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (!it.productId) {
                alert(`দয়া করে #${i + 1} নম্বর আইটেমের জন্য একটি প্রোডাক্ট সিলেক্ট করুন।`);
                return;
            }
            const prod = products.find((p) => p.id === Number(it.productId));
            const prodName = prod?.name || `আইটেম #${i + 1}`;

            const sizeInfo = getProductSizeInfo(prod);
            if (sizeInfo.hasSizes && !it.size) {
                alert(`⚠️ "${prodName}"-এর জন্য সাইজ (Size) সিলেক্ট করা আবশ্যক।`);
                return;
            }

            const colorInfo = getProductColorInfo(prod);
            if (colorInfo.hasColors && !it.color) {
                alert(`⚠️ "${prodName}"-এর জন্য কালার (Color) সিলেক্ট করা আবশ্যক।`);
                return;
            }
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
                delivery_charge: Number(deliveryCharge),
                notes: notes.trim(),

                // Backward compatibility columns (first item values)
                product_id: Number(items[0].productId),
                variant_id: items[0].variantId ? Number(items[0].variantId) : null,
                size: items[0].size || null,
                color: items[0].color || null,
                quantity: totalQuantity,
                unit_price: Number(items[0].unitPrice),

                // Multi-item payload
                items_data: items.map((it) => {
                    const p = products.find((prod) => prod.id === Number(it.productId));
                    return {
                        product_id: Number(it.productId),
                        variant_id: it.variantId ? Number(it.variantId) : null,
                        name: p?.name || 'Product',
                        sku: p?.sku || null,
                        size: it.size || null,
                        color: it.color || null,
                        quantity: Number(it.quantity),
                        price: Number(it.unitPrice),
                        subtotal: Number(it.quantity) * Number(it.unitPrice),
                    };
                }),
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
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="🛍️ Create Customer Order (নতুন অর্ডার তৈরি করুন)"
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {/* Order ID banner */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-indigo-400" />
                        <span className="text-slate-400 font-medium">Order ID:</span>
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
                        className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Customer Information Section */}
                <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
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
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] text-slate-400">
                                    Delivery Address (ডেলিভারি ঠিকানা) <span className="text-rose-400">*</span>
                                </label>
                                {customerAddress.trim() && (
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                        detectDeliveryCharge(customerAddress) === 80
                                            ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                    }`}>
                                        {detectDeliveryCharge(customerAddress) === 80 ? 'ঢাকার ভেতরে (৳৮০)' : 'ঢাকার বাইরে (৳১৩০)'}
                                    </span>
                                )}
                            </div>
                            <textarea
                                rows={2}
                                required
                                placeholder="House, Road, Area, Thana, District..."
                                value={customerAddress}
                                onChange={handleAddressChange}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Ordered Items Section */}
                <div className="space-y-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Ordered Items (অর্ডারের পণ্যসমূহ)</span>
                        </h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {items.length} {items.length > 1 ? 'Items' : 'Item'} ({totalQuantity} pcs)
                        </span>
                    </div>

                    {loadingProducts ? (
                        <div className="text-slate-400 text-xs py-4 text-center flex items-center justify-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Loading products catalog...</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item, index) => {
                                const prod = products.find((p) => p.id === Number(item.productId));
                                const sizeInfo = getProductSizeInfo(prod);
                                const colorInfo = getProductColorInfo(prod);
                                const lineSubtotal =
                                    (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0);

                                return (
                                    <div
                                        key={item.id}
                                        className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 relative transition-all"
                                    >
                                        {/* Item card header */}
                                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                                    Item #{index + 1}
                                                </span>
                                                {prod?.wc_product_id && (
                                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        🌐 Website Synced
                                                    </span>
                                                )}
                                            </div>

                                            {items.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(index)}
                                                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 py-0.5 rounded text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                                    title="Remove this item"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    <span>মুছে ফেলুন</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Product Dropdown */}
                                        <div>
                                            <label className="block text-[11px] text-slate-400 mb-1">
                                                Select Product (পণ্য নির্বাচন করুন)
                                            </label>
                                            <select
                                                value={item.productId}
                                                onChange={(e) => handleProductChange(index, e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                                            >
                                                {products.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name} {p.sku ? `(${p.sku})` : ''} — ৳
                                                        {p.selling_price || p.regular_price}
                                                        {p.wc_product_id ? ' [WooCommerce]' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Size Selection: Mandatory if product defines size, else Optional */}
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <Tag className="w-3 h-3 text-indigo-400" />
                                                    <span>Size (সাইজ)</span>
                                                    {sizeInfo.hasSizes ? (
                                                        <span className="text-rose-400 font-bold">*</span>
                                                    ) : (
                                                        <span className="text-slate-500 font-normal text-[10px]">
                                                            (ঐচ্ছিক / Optional)
                                                        </span>
                                                    )}
                                                </div>
                                                {item.size && (
                                                    <span className="text-indigo-400 font-bold font-mono text-[11px]">
                                                        Selected: {item.size}
                                                    </span>
                                                )}
                                            </label>

                                            {sizeInfo.hasSizes ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {sizeInfo.sizes.map((sz) => {
                                                        const isSelected = item.size === sz;
                                                        return (
                                                            <button
                                                                key={sz}
                                                                type="button"
                                                                onClick={() => handleSizeSelect(index, sz)}
                                                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                                                    isSelected
                                                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400'
                                                                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
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
                                                    placeholder="e.g. S, M, L, XL, 32 (প্রয়োজনে সাইজ লিখুন, ঐচ্ছিক)"
                                                    value={item.size || ''}
                                                    onChange={(e) => handleCustomSizeChange(index, e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                                                />
                                            )}
                                        </div>

                                        {/* Color Selection: Mandatory if product defines color, else Optional */}
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <Palette className="w-3 h-3 text-purple-400" />
                                                    <span>Color (কালার)</span>
                                                    {colorInfo.hasColors ? (
                                                        <span className="text-rose-400 font-bold">*</span>
                                                    ) : (
                                                        <span className="text-slate-500 font-normal text-[10px]">
                                                            (ঐচ্ছিক / Optional)
                                                        </span>
                                                    )}
                                                </div>
                                                {item.color && (
                                                    <span className="text-purple-400 font-bold text-[11px]">
                                                        Selected: {item.color}
                                                    </span>
                                                )}
                                            </label>

                                            {colorInfo.hasColors ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {colorInfo.colors.map((col) => {
                                                        const isSelected = item.color === col.name;
                                                        return (
                                                            <button
                                                                key={col.name}
                                                                type="button"
                                                                onClick={() => handleColorSelect(index, col.name)}
                                                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                                                    isSelected
                                                                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400'
                                                                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
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
                                                    placeholder="e.g. Black, Red, Olive, Navy (প্রয়োজনে কালার লিখুন, ঐচ্ছিক)"
                                                    value={item.color || ''}
                                                    onChange={(e) => handleCustomColorChange(index, e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                                                />
                                            )}
                                        </div>

                                        {/* Quantity & Unit Price */}
                                        <div className="grid grid-cols-3 gap-2.5 pt-1 items-end">
                                            <div>
                                                <label className="block text-[11px] text-slate-400 mb-1">
                                                    Quantity (পরিমাণ)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => handleQuantityChange(index, e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none font-bold"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] text-slate-400 mb-1">
                                                    Unit Price (৳)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.unitPrice}
                                                    onChange={(e) => handlePriceChange(index, e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none font-bold text-emerald-400"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[11px] text-slate-400 mb-1">
                                                    Item Total
                                                </label>
                                                <div className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-emerald-400">
                                                    ৳{lineSubtotal.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* + Add Another Item Button */}
                            <button
                                type="button"
                                onClick={handleAddItem}
                                className="w-full py-2.5 px-3 border border-dashed border-indigo-500/40 hover:border-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-300 hover:text-white rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition-all cursor-pointer shadow-sm"
                            >
                                <Plus className="w-4 h-4 text-indigo-400" />
                                <span>+ আরেকটি পণ্য যোগ করুন (Add Another Item)</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Delivery & Pricing Summary */}
                <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Products Subtotal ({items.length} items, {totalQuantity} pcs):</span>
                        <span className="font-mono font-semibold text-slate-200">
                            ৳{itemsSubtotal.toFixed(2)}
                        </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-xs font-semibold">Delivery Charge:</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                deliveryCharge === 80
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : deliveryCharge === 130
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        : deliveryCharge === 0
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                            : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            }`}>
                                {deliveryCharge === 80
                                    ? 'ঢাকার ভেতরে (৳80)'
                                    : deliveryCharge === 130
                                        ? 'ঢাকার বাইরে (৳130)'
                                        : deliveryCharge === 0
                                            ? 'ফ্রি ডেলিভারি (৳0)'
                                            : `কাস্টম চার্জ (৳${deliveryCharge})`}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                type="button"
                                onClick={() => handleSetDelivery(80)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    deliveryCharge === 80
                                        ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                }`}
                                title="ঢাকার ভেতরে ডেলিভারি চার্জ ৮০ টাকা"
                            >
                                ঢাকা ৳৮০
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetDelivery(130)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    deliveryCharge === 130
                                        ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400'
                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                }`}
                                title="ঢাকার বাইরে ডেলিভারি চার্জ ১৩০ টাকা"
                            >
                                ঢাকার বাইরে ৳১৩০
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetDelivery(0)}
                                className={`px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    deliveryCharge === 0
                                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400 font-bold'
                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                }`}
                                title="ফ্রি ডেলিভারি"
                            >
                                ফ্রি ৳০
                            </button>
                            <div className="flex items-center gap-1 ml-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5" title="প্রয়োজনে কাস্টম ডেলিভারি চার্জ লিখুন">
                                <span className="text-slate-400 text-xs font-mono">৳</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={deliveryCharge}
                                    onChange={(e) => handleSetDelivery(Math.max(0, Number(e.target.value) || 0))}
                                    className="w-14 bg-transparent text-xs font-mono font-bold text-cyan-300 text-right focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between font-bold">
                        <span className="text-slate-300 text-xs">Total Payable (সর্বমোট):</span>
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
                    <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        type="submit"
                        loading={submitting}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                    >
                        Confirm & Place Order (৳{totalPayable.toFixed(2)})
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
