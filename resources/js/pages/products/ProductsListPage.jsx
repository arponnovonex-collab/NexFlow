import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import {
    ShoppingBag,
    Plus,
    Search,
    Edit,
    Trash2,
    CheckCircle2,
    Package,
    Layers,
    Share2,
} from 'lucide-react';

export const ProductsListPage = () => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [addModal, setAddModal] = useState(false);
    const [form, setForm] = useState({
        name: '',
        sku: '',
        category_id: '',
        selling_price: '',
        regular_price: '',
        short_description: '',
        availability: 'in_stock',
        delivery_charge_inside_dhaka: 70,
        delivery_charge_outside_dhaka: 130,
        return_policy: '7 days easy return',
    });

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const [prodRes, catRes] = await Promise.all([
                api.get('/products', { params: { search } }),
                api.get('/product-categories'),
            ]);
            setProducts(prodRes.data.data.data || []);
            setCategories(catRes.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, [search]);

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await api.post('/products', form);
            setAddModal(false);
            setForm({
                name: '',
                sku: '',
                category_id: '',
                selling_price: '',
                regular_price: '',
                short_description: '',
                availability: 'in_stock',
                delivery_charge_inside_dhaka: 70,
                delivery_charge_outside_dhaka: 130,
                return_policy: '7 days easy return',
            });
            fetchProducts();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to create product');
        }
    };

    const handleDelete = async (p) => {
        if (!confirm(`Delete product ${p.name}?`)) return;
        try {
            await api.delete(`/products/${p.id}`);
            fetchProducts();
        } catch (err) {
            alert('Failed to delete product');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        Product Catalog & Stock Engine
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Verified knowledge base for AI automation. AI only quotes prices and stock levels configured here.
                    </p>
                </div>
                <Button variant="primary" size="sm" icon={Plus} onClick={() => setAddModal(true)}>
                    Add New Product
                </Button>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search product name, SKU..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                </div>
            </div>

            {/* Products Table */}
            <Card>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                            <tr>
                                <th className="px-4 py-3">Product Name & SKU</th>
                                <th className="px-4 py-3">Category</th>
                                <th className="px-4 py-3">Selling Price</th>
                                <th className="px-4 py-3">Stock & Variants</th>
                                <th className="px-4 py-3">Delivery (Dhaka/Out)</th>
                                <th className="px-4 py-3">Mapped Channels</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                        No products found.
                                    </td>
                                </tr>
                            ) : (
                                products.map((p) => (
                                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                                                    <ShoppingBag className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-slate-200 block">{p.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">SKU: {p.sku}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="text-slate-300">{p.category?.name || 'General'}</span>
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <span className="font-bold text-emerald-400">{p.selling_price} BDT</span>
                                            {p.regular_price > p.selling_price && (
                                                <span className="text-[10px] text-slate-500 line-through block">
                                                    {p.regular_price} BDT
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex flex-wrap gap-1">
                                                {p.variants?.length > 0 ? (
                                                    p.variants.map((v) => (
                                                        <span
                                                            key={v.id}
                                                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono"
                                                        >
                                                            {v.size || v.color}: <strong className="text-white">{v.stock}</strong>
                                                        </span>
                                                    ))
                                                ) : (
                                                    <Badge variant={p.availability === 'in_stock' ? 'success' : 'danger'} size="xs">
                                                        {p.availability}
                                                    </Badge>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-slate-400">
                                            {p.delivery_charge_inside_dhaka} / {p.delivery_charge_outside_dhaka} BDT
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-1">
                                                {p.social_accounts?.map((acc) => (
                                                    <span
                                                        key={acc.id}
                                                        className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300"
                                                    >
                                                        {acc.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-right">
                                            <Button
                                                variant="ghost"
                                                size="xs"
                                                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                                icon={Trash2}
                                                onClick={() => handleDelete(p)}
                                            >
                                                Delete
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Add Product Modal */}
            <Modal isOpen={addModal} onClose={() => setAddModal(false)} title="Add Product to Verified Catalog">
                <form onSubmit={handleCreate} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Product Name</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. Ruby Twinkle Kurti Set"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">SKU Code</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. NF-DRS-005"
                                value={form.sku}
                                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 uppercase font-mono"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                            <select
                                value={form.category_id}
                                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            >
                                <option value="">Select Category</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Selling Price (BDT)</label>
                            <input
                                type="number"
                                required
                                placeholder="1250"
                                value={form.selling_price}
                                onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Regular Price</label>
                            <input
                                type="number"
                                required
                                placeholder="1450"
                                value={form.regular_price}
                                onChange={(e) => setForm({ ...form, regular_price: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Inside Dhaka Charge (BDT)</label>
                            <input
                                type="number"
                                value={form.delivery_charge_inside_dhaka}
                                onChange={(e) => setForm({ ...form, delivery_charge_inside_dhaka: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Outside Dhaka Charge (BDT)</label>
                            <input
                                type="number"
                                value={form.delivery_charge_outside_dhaka}
                                onChange={(e) => setForm({ ...form, delivery_charge_outside_dhaka: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Description / AI Knowledge</label>
                        <textarea
                            rows={3}
                            placeholder="Material details, fabric quality, styling notes..."
                            value={form.short_description}
                            onChange={(e) => setForm({ ...form, short_description: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                        ></textarea>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={() => setAddModal(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" size="sm" type="submit">
                            Save Product
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

