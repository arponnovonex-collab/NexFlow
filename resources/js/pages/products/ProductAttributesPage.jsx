import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import {
    Sliders,
    Plus,
    Trash2,
    Palette,
    Tag,
    Layers,
    Check,
    X,
    Sparkles,
    RefreshCw,
    AlertCircle,
} from 'lucide-react';

export const ProductAttributesPage = () => {
    const [attributes, setAttributes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // New Attribute Form
    const [attrName, setAttrName] = useState('');
    const [attrType, setAttrType] = useState('button');
    const [initialValues, setInitialValues] = useState('');

    // Inline Add Value state per attribute: { [attrId]: { name: '', value: '#000000', loading: false } }
    const [newValueInputs, setNewValueInputs] = useState({});

    const fetchAttributes = async () => {
        try {
            setLoading(true);
            const res = await api.get('/product-attributes');
            setAttributes(res.data.data || []);
        } catch (err) {
            console.error('Failed to load product attributes:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttributes();
    }, []);

    const handleCreateAttribute = async (e) => {
        e.preventDefault();
        if (!attrName.trim()) return;

        setSaving(true);
        try {
            // Parse comma-separated initial values
            const valuesArr = initialValues
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean)
                .map((val) => ({
                    name: val,
                    value: attrType === 'color' ? '#6366F1' : val,
                }));

            await api.post('/product-attributes', {
                name: attrName.trim(),
                type: attrType,
                values: valuesArr,
            });

            setShowAddModal(false);
            setAttrName('');
            setAttrType('button');
            setInitialValues('');
            fetchAttributes();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to create attribute.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAttribute = async (attr) => {
        if (!confirm(`Are you sure you want to delete "${attr.name}" and all its values?`)) return;

        try {
            await api.delete(`/product-attributes/${attr.id}`);
            setAttributes((prev) => prev.filter((a) => a.id !== attr.id));
        } catch (err) {
            alert('Failed to delete attribute.');
        }
    };

    const handleAddValue = async (attrId, type) => {
        const inputState = newValueInputs[attrId] || { name: '', value: '#000000' };
        if (!inputState.name || !inputState.name.trim()) return;

        const valName = inputState.name.trim();
        const valCode = type === 'color' ? (inputState.value || '#000000') : valName;

        try {
            const res = await api.post(`/product-attributes/${attrId}/values`, {
                name: valName,
                value: valCode,
            });

            // Update local state
            setAttributes((prev) =>
                prev.map((a) => {
                    if (a.id === attrId) {
                        return {
                            ...a,
                            values: [...(a.values || []), res.data.data],
                        };
                    }
                    return a;
                })
            );

            // Clear input
            setNewValueInputs((prev) => ({
                ...prev,
                [attrId]: { name: '', value: '#000000' },
            }));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to add value.');
        }
    };

    const handleDeleteValue = async (attrId, valId) => {
        try {
            await api.delete(`/product-attributes/${attrId}/values/${valId}`);
            setAttributes((prev) =>
                prev.map((a) => {
                    if (a.id === attrId) {
                        return {
                            ...a,
                            values: a.values.filter((v) => v.id !== valId),
                        };
                    }
                    return a;
                })
            );
        } catch (err) {
            alert('Failed to delete value.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        <Sliders className="w-6 h-6 text-indigo-400" /> Product Attributes (প্রোডাক্ট অ্যাট্রিবিউট)
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                        সাইজ (Size), কালার (Color) বা যেকোনো কাস্টম অপশন তৈরি ও পরিচালনা করুন। এগুলো প্রোডাক্ট তৈরি এবং অর্ডার গ্রহণের সময় সরাসরি সিলেক্ট করা যাবে।
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchAttributes}
                        disabled={loading}
                        className="text-slate-400 hover:text-white text-xs"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </Button>

                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setShowAddModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add New Attribute (নতুন অ্যাট্রিবিউট)</span>
                    </Button>
                </div>
            </div>

            {/* Attributes Grid */}
            {loading ? (
                <div className="flex items-center justify-center p-12 text-slate-400 text-xs gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Loading attributes catalog...</span>
                </div>
            ) : attributes.length === 0 ? (
                <Card className="p-8 text-center border-dashed border-slate-800">
                    <Sliders className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <h3 className="text-sm font-bold text-slate-300">No Attributes Created Yet</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Create attributes like Size (S, M, L, XL) or Color (Red, Blue, Black) to customize your products.
                    </p>
                    <Button
                        variant="primary"
                        size="xs"
                        onClick={() => setShowAddModal(true)}
                        className="mt-4 bg-indigo-600 hover:bg-indigo-500 font-bold"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Create First Attribute
                    </Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {attributes.map((attr) => {
                        const inputState = newValueInputs[attr.id] || { name: '', value: '#000000' };
                        const isColorType = attr.type === 'color';

                        return (
                            <Card
                                key={attr.id}
                                className="p-4 border border-slate-800 bg-slate-900/70 hover:border-slate-700 transition-colors flex flex-col justify-between"
                            >
                                <div>
                                    {/* Card Header */}
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
                                        <div className="flex items-center gap-2">
                                            {isColorType ? (
                                                <Palette className="w-4 h-4 text-purple-400" />
                                            ) : (
                                                <Tag className="w-4 h-4 text-indigo-400" />
                                            )}
                                            <h3 className="font-bold text-slate-100 text-sm">{attr.name}</h3>
                                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-400 uppercase">
                                                {attr.type}
                                            </span>
                                            <span className="text-[11px] text-slate-500">
                                                ({(attr.values || []).length} values)
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleDeleteAttribute(attr)}
                                            className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors"
                                            title="Delete Attribute"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>

                                    {/* Values Chip List */}
                                    <div className="min-h-[60px] mb-4">
                                        <label className="block text-[11px] font-semibold text-slate-400 mb-2">
                                            Available Values (ভ্যালুসমূহ):
                                        </label>

                                        {(attr.values || []).length === 0 ? (
                                            <p className="text-[11px] text-slate-500 italic">
                                                No values added yet. Add one below.
                                            </p>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {attr.values.map((v) => (
                                                    <span
                                                        key={v.id}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs group hover:border-slate-700 transition-colors shadow-sm"
                                                    >
                                                        {isColorType && (
                                                            <span
                                                                className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                                                                style={{ backgroundColor: v.value || '#000000' }}
                                                            />
                                                        )}
                                                        <span className="font-medium">{v.name}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteValue(attr.id, v.id)}
                                                            className="text-slate-500 hover:text-rose-400 transition-colors ml-0.5"
                                                            title={`Remove ${v.name}`}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Quick Add Value Row */}
                                <div className="pt-3 border-t border-slate-800/80">
                                    <div className="flex items-center gap-2">
                                        {isColorType && (
                                            <input
                                                type="color"
                                                value={inputState.value || '#000000'}
                                                onChange={(e) =>
                                                    setNewValueInputs((prev) => ({
                                                        ...prev,
                                                        [attr.id]: {
                                                            ...inputState,
                                                            value: e.target.value,
                                                        },
                                                    }))
                                                }
                                                className="w-8 h-8 rounded border border-slate-700 bg-slate-950 cursor-pointer p-0.5 shrink-0"
                                                title="Pick Color"
                                            />
                                        )}

                                        <input
                                            type="text"
                                            placeholder={
                                                isColorType
                                                    ? 'Color name (e.g. Navy Blue)...'
                                                    : 'Value name (e.g. XL, 32, Cotton)...'
                                            }
                                            value={inputState.name || ''}
                                            onChange={(e) =>
                                                setNewValueInputs((prev) => ({
                                                    ...prev,
                                                    [attr.id]: {
                                                        ...inputState,
                                                        name: e.target.value,
                                                    },
                                                }))
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddValue(attr.id, attr.type);
                                                }
                                            }}
                                            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                                        />

                                        <button
                                            type="button"
                                            onClick={() => handleAddValue(attr.id, attr.type)}
                                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 transition-colors shrink-0 shadow"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Add</span>
                                        </button>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Modal: Create New Attribute */}
            <Modal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                title="✨ Create New Custom Attribute (নতুন অ্যাট্রিবিউট)"
            >
                <form onSubmit={handleCreateAttribute} className="space-y-4 text-xs">
                    <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Attribute Name <span className="text-rose-400">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Size, Color, Fabric, Collar, Material..."
                            value={attrName}
                            onChange={(e) => setAttrName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Display Type (ধরণ)
                        </label>
                        <select
                            value={attrType}
                            onChange={(e) => setAttrType(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="button">Button / Badge (e.g. Size: S, M, L, XL)</option>
                            <option value="color">Color Swatch (e.g. Red, Blue, Black with color code)</option>
                            <option value="select">Dropdown Select (e.g. Material, Fabric)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Initial Values (কমা দিয়ে একাধিক লিখতে পারেন)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g. S, M, L, XL, XXL (comma separated)"
                            value={initialValues}
                            onChange={(e) => setInitialValues(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-[10px] text-slate-500 mt-1 block">
                            (ভ্যালুগুলো পরে যেকোনো সময় যোগ বা মুছে ফেলা যাবে)
                        </span>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => setShowAddModal(false)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            size="sm"
                            type="submit"
                            loading={saving}
                            className="bg-indigo-600 hover:bg-indigo-500 font-bold text-white"
                        >
                            Create Attribute
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
