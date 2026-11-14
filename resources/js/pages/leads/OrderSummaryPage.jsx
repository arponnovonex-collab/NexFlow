import React, { useEffect, useState } from 'react';
import api from '../../api/client';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import {
    BarChart3,
    Calendar,
    Filter,
    RefreshCw,
    ShoppingBag,
    Globe,
    Truck,
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    Search,
    Phone,
    PhoneCall,
    MessageCircle,
    User,
    MapPin,
    Package,
    ChevronLeft,
    ChevronRight,
    Edit3,
    Check,
    ExternalLink,
    TrendingUp,
    TrendingDown,
    SlidersHorizontal,
    FileSpreadsheet,
    HelpCircle,
} from 'lucide-react';

export const OrderSummaryPage = () => {
    // Filter State
    const [period, setPeriod] = useState('today'); // today, yesterday, this_week, last_week, this_month, last_month, all, custom
    const [source, setSource] = useState('all'); // all, website, engagement
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeTab, setActiveTab] = useState('returns'); // returns, analytics

    // Data State
    const [loadingSummary, setLoadingSummary] = useState(true);
    const [summaryData, setSummaryData] = useState({
        kpis: {
            total_orders: 0,
            delivered_orders: 0,
            returned_orders: 0,
            processing_orders: 0,
            pending_orders: 0,
            delivery_rate: 0,
            return_rate: 0,
            website_count: 0,
            engagement_count: 0,
        },
        daily_trends: [],
        top_return_reasons: [],
    });

    // Returns List State
    const [returnsLoading, setReturnsLoading] = useState(true);
    const [returnsOrders, setReturnsOrders] = useState([]);
    const [returnsSearch, setReturnsSearch] = useState('');
    const [returnsPagination, setReturnsPagination] = useState({
        current_page: 1,
        last_page: 1,
        total: 0,
        from: 0,
        to: 0,
    });

    // Edit Return Reason Modal State
    const [selectedOrderForReason, setSelectedOrderForReason] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [reasonText, setReasonText] = useState('');
    const [riderNoteText, setRiderNoteText] = useState('');
    const [savingReason, setSavingReason] = useState(false);

    // Syncing state
    const [syncingCouriers, setSyncingCouriers] = useState(false);
    const [checkingOrderId, setCheckingOrderId] = useState(null);
    const [statusToast, setStatusToast] = useState(null);

    // Common e-commerce Bangladesh return reasons for 1-click selection
    const commonReturnReasons = [
        'কাস্টমার ফোন ধরে না / বন্ধ',
        'পার্সেল রিসিভ করতে অস্বীকৃতি ( refused )',
        'কুরিয়ার ডেলিভারিতে দেরি হয়েছে',
        'কাস্টমার অন্য জায়গা থেকে নিয়ে নিয়েছে',
        'পার্সেল খুলতে দেয়নি তাই নেয়নি',
        'ডুপ্লিকেট অর্ডার ছিল',
        'টাকা শর্ট ছিল / ক্যাশ প্রবলেম',
        'ভুল সাইজ / পছন্দ হয়নি',
        'ভুল ঠিকানা / এরিয়া কভারেজের বাইরে',
    ];

    // Fetch Summary Metrics
    const fetchSummary = async () => {
        try {
            setLoadingSummary(true);
            const params = { period, source };
            if (period === 'custom' && startDate && endDate) {
                params.start_date = startDate;
                params.end_date = endDate;
            }

            const res = await api.get('/orders/summary', { params });
            if (res.data.status === 'success') {
                setSummaryData(res.data.data);
            }
        } catch (err) {
            console.error('Failed to load order summary:', err);
        } finally {
            setLoadingSummary(false);
        }
    };

    // Fetch Returned / Cancelled Orders List
    const fetchReturns = async (page = 1) => {
        try {
            setReturnsLoading(true);
            const params = {
                period,
                source,
                page,
                per_page: 25,
            };
            if (returnsSearch.trim()) {
                params.search = returnsSearch.trim();
            }
            if (period === 'custom' && startDate && endDate) {
                params.start_date = startDate;
                params.end_date = endDate;
            }

            const res = await api.get('/orders/returns', { params });
            if (res.data.status === 'success') {
                const pData = res.data.data;
                setReturnsOrders(pData.data || []);
                setReturnsPagination({
                    current_page: pData.current_page || 1,
                    last_page: pData.last_page || 1,
                    total: pData.total || 0,
                    from: pData.from || 0,
                    to: pData.to || 0,
                });
            }
        } catch (err) {
            console.error('Failed to load return orders:', err);
        } finally {
            setReturnsLoading(false);
        }
    };

    useEffect(() => {
        fetchSummary();
        fetchReturns(1);
    }, [period, source]);

    // Handle Search with debounce / instant on Enter
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchReturns(1);
    };

    // Open Edit Reason Modal
    const handleOpenReasonModal = (order) => {
        setSelectedOrderForReason(order);
        setReasonText(order.return_reason || '');
        setRiderNoteText(order.rider_note || '');
        setModalOpen(true);
    };

    // Save Return Reason
    const handleSaveReturnReason = async (e) => {
        e.preventDefault();
        if (!selectedOrderForReason || !reasonText.trim()) {
            alert('অনুগ্রহ করে রিটার্নের কারণ লিখুন বা সিলেক্ট করুন।');
            return;
        }

        try {
            setSavingReason(true);
            const res = await api.post(`/orders/${selectedOrderForReason.id}/return-reason`, {
                return_reason: reasonText.trim(),
                rider_note: riderNoteText.trim(),
                order_status: 'returned',
            });

            if (res.data.status === 'success') {
                setModalOpen(false);
                setSelectedOrderForReason(null);
                fetchReturns(returnsPagination.current_page);
                fetchSummary();
                showToast('✅ রিটার্নের কারণ সফলভাবে আপডেট করা হয়েছে!');
            }
        } catch (err) {
            alert('Failed to update return reason: ' + (err.response?.data?.message || err.message));
        } finally {
            setSavingReason(false);
        }
    };

    // Single order live check with Steadfast
    const handleCheckSingleCourierStatus = async (order) => {
        try {
            setCheckingOrderId(order.id);
            const res = await api.post(`/orders/${order.id}/sync-courier-status`);
            if (res.data.status === 'success') {
                showToast(`✅ Order #${order.order_number}: ${res.data.message}`);
                fetchReturns(returnsPagination.current_page);
                fetchSummary();
            } else {
                showToast(`ℹ️ ${res.data.message}`);
            }
        } catch (err) {
            showToast(`❌ Courier status check failed: ${err.response?.data?.message || err.message}`);
        } finally {
            setCheckingOrderId(null);
        }
    };

    // Bulk sync all active courier orders with Steadfast
    const handleSyncAllCourierStatus = async () => {
        try {
            setSyncingCouriers(true);
            const res = await api.post('/orders/sync-courier-status');
            if (res.data.status === 'success') {
                showToast(`✅ ${res.data.message}`);
                fetchReturns(returnsPagination.current_page);
                fetchSummary();
            }
        } catch (err) {
            showToast(`❌ Sync failed: ${err.response?.data?.message || err.message}`);
        } finally {
            setSyncingCouriers(false);
        }
    };

    const showToast = (msg) => {
        setStatusToast(msg);
        setTimeout(() => setStatusToast(null), 5000);
    };

    const formatBdtPhone = (phone) => {
        if (!phone) return '';
        const clean = phone.replace(/[^0-9]/g, '');
        if (clean.length === 11 && clean.startsWith('01')) {
            return `+88${clean}`;
        }
        return phone;
    };

    const kpis = summaryData.kpis || {};

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-violet-400" />
                        Order Summary & Return Analysis (অর্ডার সামারি ও রিটার্ন)
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        আজকের, সাপ্তাহিক ও মাসিক অর্ডারের হিসাব, ডেলিভারি রেট এবং রিটার্ন কাস্টমারদের বিস্তারিত তালিকা
                    </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleSyncAllCourierStatus}
                        disabled={syncingCouriers}
                        className="bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncingCouriers ? 'animate-spin text-emerald-400' : ''}`} />
                        {syncingCouriers ? 'কুরিয়ার স্ট্যাটাস সিঙ্ক হচ্ছে...' : 'Sync Steadfast Status'}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            fetchSummary();
                            fetchReturns(returnsPagination.current_page);
                        }}
                        className="border border-slate-800 text-slate-300"
                    >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        রিফ্রেশ
                    </Button>
                </div>
            </div>

            {/* Notification Toast */}
            {statusToast && (
                <div className="p-3 bg-indigo-950/80 border border-indigo-700/60 rounded-xl text-indigo-200 text-xs flex items-center justify-between shadow-lg">
                    <span>{statusToast}</span>
                    <button onClick={() => setStatusToast(null)} className="text-indigo-400 hover:text-white font-bold ml-3">✕</button>
                </div>
            )}

            {/* Filter Section (Date Presets + Channel Selector) */}
            <Card className="p-4 bg-slate-900/90 border-slate-800">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Period Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 mr-1">
                            <Calendar className="w-3.5 h-3.5 text-violet-400" /> সময়কাল:
                        </span>
                        {[
                            { id: 'today', label: 'Today (আজকে)' },
                            { id: 'yesterday', label: 'Yesterday (গতকাল)' },
                            { id: 'this_week', label: 'This Week (এই সপ্তাহে)' },
                            { id: 'last_week', label: 'Last Week (গত সপ্তাহে)' },
                            { id: 'this_month', label: 'This Month (এই মাসে)' },
                            { id: 'last_month', label: 'Last Month (গত মাসে)' },
                            { id: 'all', label: 'All Time (সব সময়)' },
                            { id: 'custom', label: 'Custom Range' },
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                onClick={() => setPeriod(btn.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    period === btn.id
                                        ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                                }`}
                            >
                                {btn.label}
                            </button>
                        ))}
                    </div>

                    {/* Source Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                            <Filter className="w-3.5 h-3.5 text-cyan-400" /> চ্যানেল:
                        </span>
                        <div className="bg-slate-950 p-0.5 rounded-lg border border-slate-800 flex items-center">
                            <button
                                onClick={() => setSource('all')}
                                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                                    source === 'all'
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                All ({kpis.total_orders || 0})
                            </button>
                            <button
                                onClick={() => setSource('website')}
                                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors flex items-center gap-1 ${
                                    source === 'website'
                                        ? 'bg-cyan-600 text-white'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Globe className="w-3 h-3" /> Website ({kpis.website_count || 0})
                            </button>
                            <button
                                onClick={() => setSource('engagement')}
                                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors flex items-center gap-1 ${
                                    source === 'engagement'
                                        ? 'bg-emerald-600 text-white'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <ShoppingBag className="w-3 h-3" /> Inbox ({kpis.engagement_count || 0})
                            </button>
                        </div>
                    </div>
                </div>

                {/* Custom Date Pickers */}
                {period === 'custom' && (
                    <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-3 flex-wrap">
                        <span className="text-xs text-slate-400">তারিখ নির্বাচন:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                        />
                        <span className="text-xs text-slate-500">থেকে</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                        />
                        <Button
                            size="sm"
                            onClick={() => {
                                fetchSummary();
                                fetchReturns(1);
                            }}
                            className="bg-violet-600 text-white text-xs h-7 px-3"
                        >
                            ফিল্টার করুন
                        </Button>
                    </div>
                )}
            </Card>

            {/* KPI Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {/* Total Orders */}
                <Card className="p-4 bg-slate-900 border-slate-800 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                            মোট অর্ডার (Total)
                        </span>
                        <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            <ShoppingBag className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-white font-mono">
                            {kpis.total_orders || 0}
                        </span>
                        <span className="text-[10px] text-slate-400">অর্ডার আসছে</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Web: <strong className="text-cyan-400">{kpis.website_count || 0}</strong></span>
                        <span>Inbox: <strong className="text-emerald-400">{kpis.engagement_count || 0}</strong></span>
                    </div>
                </Card>

                {/* Delivered */}
                <Card className="p-4 bg-emerald-950/20 border-emerald-900/40 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                            ডেলিভারি সম্পন্ন
                        </span>
                        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-emerald-300 font-mono">
                            {kpis.delivered_orders || 0}
                        </span>
                        <span className="text-[10px] text-emerald-400/80">Delivered</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-emerald-900/30 flex items-center justify-between text-[10px] text-emerald-400/90 font-medium">
                        <span>সাকসেস রেট:</span>
                        <span className="font-bold">{kpis.delivery_rate || 0}%</span>
                    </div>
                </Card>

                {/* Returned / Cancelled */}
                <Card className="p-4 bg-rose-950/25 border-rose-900/40 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">
                            রিটার্ন / বাতিল
                        </span>
                        <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-rose-300 font-mono">
                            {kpis.returned_orders || 0}
                        </span>
                        <span className="text-[10px] text-rose-400/80">Returned</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-rose-900/30 flex items-center justify-between text-[10px] text-rose-400/90 font-medium">
                        <span>রিটার্ন রেট:</span>
                        <span className="font-bold text-rose-300">{kpis.return_rate || 0}%</span>
                    </div>
                </Card>

                {/* In Transit / Processing */}
                <Card className="p-4 bg-blue-950/20 border-blue-900/40 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
                            চলমান / কুরিয়ারে
                        </span>
                        <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            <Truck className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-blue-300 font-mono">
                            {kpis.processing_orders || 0}
                        </span>
                        <span className="text-[10px] text-blue-400/80">In-Transit</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-900/30 text-[10px] text-blue-400/80">
                        কুরিয়ারে ডেলিভারির পথে
                    </div>
                </Card>

                {/* Pending */}
                <Card className="p-4 bg-amber-950/20 border-amber-900/40 relative overflow-hidden col-span-2 md:col-span-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                            নতুন / পেন্ডিং
                        </span>
                        <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-2xl font-black text-amber-300 font-mono">
                            {kpis.pending_orders || 0}
                        </span>
                        <span className="text-[10px] text-amber-400/80">New/Hold</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-amber-900/30 text-[10px] text-amber-400/80">
                        কনফার্মেশন বা প্রসেসিং বাকি
                    </div>
                </Card>
            </div>

            {/* Navigation Tabs (Returned Orders Table vs Daily Analytics) */}
            <div className="border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setActiveTab('returns')}
                        className={`pb-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                            activeTab === 'returns'
                                ? 'border-rose-500 text-rose-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <AlertTriangle className="w-4 h-4" />
                        রিটার্ন কাস্টমারদের তালিকা ও কারণ
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            {returnsPagination.total || 0}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`pb-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                            activeTab === 'analytics'
                                ? 'border-violet-500 text-violet-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <TrendingUp className="w-4 h-4" />
                        দৈনিক পরিসংখ্যান ও কারণ চার্ট
                    </button>
                </div>
            </div>

            {/* TAB 1: Returned Customers & Delivery Man Reason List */}
            {activeTab === 'returns' && (
                <Card className="bg-slate-900 border-slate-800 overflow-hidden">
                    {/* Search & Actions Bar */}
                    <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={returnsSearch}
                                onChange={(e) => setReturnsSearch(e.target.value)}
                                placeholder="কাস্টমারের ফোন নম্বর, নাম, অর্ডার নং বা কারণ লিখে খুঁজুন..."
                                className="w-full pl-9 pr-10 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                            />
                            {returnsSearch && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setReturnsSearch('');
                                        setTimeout(() => fetchReturns(1), 50);
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                                >
                                    ✕
                                </button>
                            )}
                        </form>

                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">
                                মোট <strong>{returnsPagination.total}</strong> টি রিটার্ন পাওয়া গেছে
                            </span>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold">
                                    <th className="py-3 px-3.5">অর্ডার ও তারিখ</th>
                                    <th className="py-3 px-3.5">কাস্টমারের তথ্য ও নম্বর</th>
                                    <th className="py-3 px-3.5">কুরিয়ার ও ট্র্যাকিং</th>
                                    <th className="py-3 px-3.5">ডেলিভারিম্যানের কারণ (কেন নেয়নি)</th>
                                    <th className="py-3 px-3.5 text-center">কাস্টমার হিস্টোরি / রিস্ক</th>
                                    <th className="py-3 px-3.5 text-right">অ্যাকশন</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {returnsLoading ? (
                                    <tr>
                                        <td colSpan="6" className="py-12 text-center text-slate-400">
                                            <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                            রিটার্ন ডেটা লোড হচ্ছে...
                                        </td>
                                    </tr>
                                ) : returnsOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="py-12 text-center text-slate-400">
                                            <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mx-auto mb-2" />
                                            <p className="font-semibold text-slate-300">কোনো রিটার্ন বা বাতিল অর্ডার পাওয়া যায়নি!</p>
                                            <p className="text-[11px] text-slate-500 mt-1">নির্বাচিত সময়কালে সব অর্ডার সফলভাবে ডেলিভারি হয়েছে অথবা কোনো রিটার্ন রেকর্ড নেই।</p>
                                        </td>
                                    </tr>
                                ) : (
                                    returnsOrders.map((ord) => {
                                        const isWeb = ord.order_source === 'woocommerce' || ord.order_source === 'web';
                                        const customerName = ord.customer?.name || 'Customer';
                                        const customerPhone = ord.customer_phone || ord.customer?.phone || '';
                                        const bdtPhone = formatBdtPhone(customerPhone);
                                        const totalCustOrders = ord.customer_total_orders || 1;
                                        const totalCustReturns = ord.customer_total_returns || 1;
                                        const isHighRisk = totalCustReturns >= 2;

                                        return (
                                            <tr key={ord.id} className="hover:bg-slate-800/30 transition-colors">
                                                {/* Order & Date */}
                                                <td className="py-3 px-3.5 align-top">
                                                    <div className="flex items-center gap-1.5 font-bold text-white font-mono">
                                                        <span>#{ord.order_number}</span>
                                                    </div>
                                                    <div className="mt-1 flex items-center gap-1">
                                                        {isWeb ? (
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                                                <Globe className="w-2.5 h-2.5" /> Website
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                <ShoppingBag className="w-2.5 h-2.5" /> Inbox
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] font-mono font-bold text-slate-200">
                                                            ৳{parseFloat(ord.total_amount).toFixed(0)}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 mt-1">
                                                        {new Date(ord.created_at).toLocaleDateString('en-GB', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </div>
                                                </td>

                                                {/* Customer Info */}
                                                <td className="py-3 px-3.5 align-top max-w-[200px]">
                                                    <div className="font-semibold text-slate-200 truncate flex items-center gap-1">
                                                        <User className="w-3 h-3 text-slate-400 shrink-0" />
                                                        {customerName}
                                                    </div>
                                                    <div className="mt-0.5 flex items-center gap-1.5">
                                                        <span className="font-mono text-emerald-400 font-bold text-[11px]">
                                                            {customerPhone}
                                                        </span>
                                                    </div>
                                                    {ord.customer_address && (
                                                        <p className="text-[10px] text-slate-400 line-clamp-2 mt-1 flex items-start gap-1">
                                                            <MapPin className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
                                                            {ord.customer_address}
                                                        </p>
                                                    )}
                                                </td>

                                                {/* Courier & Tracking */}
                                                <td className="py-3 px-3.5 align-top">
                                                    {ord.tracking_code ? (
                                                        <div>
                                                            <div className="flex items-center gap-1">
                                                                <Truck className="w-3 h-3 text-indigo-400" />
                                                                <span className="font-mono text-indigo-300 font-semibold text-[11px]">
                                                                    {ord.tracking_code}
                                                                </span>
                                                            </div>
                                                            <div className="mt-1 flex items-center gap-1">
                                                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30 uppercase font-mono">
                                                                    {ord.courier_status || 'cancelled'}
                                                                </span>
                                                                <button
                                                                    onClick={() => handleCheckSingleCourierStatus(ord)}
                                                                    disabled={checkingOrderId === ord.id}
                                                                    title="Steadfast থেকে লাইভ স্ট্যাটাস চেক করুন"
                                                                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                                                                >
                                                                    <RefreshCw className={`w-3 h-3 ${checkingOrderId === ord.id ? 'animate-spin text-emerald-400' : ''}`} />
                                                                </button>
                                                            </div>
                                                            {ord.consignment_id && (
                                                                <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                                                                    CID: {ord.consignment_id}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-500 italic">
                                                            কুরিয়ারে পাঠানো হয়নি / ম্যানুয়াল
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Return Reason / Delivery Man Note */}
                                                <td className="py-3 px-3.5 align-top max-w-[260px]">
                                                    {ord.return_reason ? (
                                                        <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-900/50">
                                                            <div className="font-medium text-rose-200 text-xs flex items-center gap-1">
                                                                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                                                <span>{ord.return_reason}</span>
                                                            </div>
                                                            {ord.rider_note && (
                                                                <div className="text-[10px] text-rose-300/80 mt-1 pt-1 border-t border-rose-900/30">
                                                                    রিমার্কস: {ord.rider_note}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="p-2 rounded-lg bg-slate-950 border border-dashed border-slate-800 text-slate-400 text-[11px] flex items-center justify-between">
                                                            <span>কোনো কারণ উল্লেখ নেই</span>
                                                            <button
                                                                onClick={() => handleOpenReasonModal(ord)}
                                                                className="text-violet-400 hover:text-violet-300 font-semibold text-[10px] ml-2"
                                                            >
                                                                + কারণ যোগ করুন
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Customer Risk & Return History */}
                                                <td className="py-3 px-3.5 align-top text-center">
                                                    {isHighRisk ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                                            <AlertTriangle className="w-3 h-3 text-rose-400" />
                                                            High Risk ({totalCustReturns} রিটার্ন)
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                                            ১ম রিটার্ন (মোট {totalCustOrders} অর্ডার)
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3 px-3.5 align-top text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => handleOpenReasonModal(ord)}
                                                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
                                                            title="রিটার্নের কারণ এডিট করুন"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                        {customerPhone && (
                                                            <a
                                                                href={`tel:${customerPhone}`}
                                                                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                                title="কাস্টমারকে কল করুন"
                                                            >
                                                                <PhoneCall className="w-3.5 h-3.5" />
                                                            </a>
                                                        )}
                                                        {bdtPhone && (
                                                            <a
                                                                href={`https://wa.me/${bdtPhone.replace('+', '')}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30"
                                                                title="WhatsApp এ মেসেজ পাঠান"
                                                            >
                                                                <MessageCircle className="w-3.5 h-3.5" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {returnsPagination.last_page > 1 && (
                        <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                            <div>
                                দেখাচ্ছে <strong>{returnsPagination.from}</strong> - <strong>{returnsPagination.to}</strong> এর মধ্যে <strong>{returnsPagination.total}</strong> টি রিটার্ন
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={returnsPagination.current_page <= 1}
                                    onClick={() => fetchReturns(returnsPagination.current_page - 1)}
                                    className="border border-slate-800 text-slate-300 disabled:opacity-40"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Prev
                                </Button>
                                <span className="px-2 text-slate-300 font-medium">
                                    Page {returnsPagination.current_page} of {returnsPagination.last_page}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={returnsPagination.current_page >= returnsPagination.last_page}
                                    onClick={() => fetchReturns(returnsPagination.current_page + 1)}
                                    className="border border-slate-800 text-slate-300 disabled:opacity-40"
                                >
                                    Next <ChevronRight className="w-3.5 h-3.5 ml-1" />
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* TAB 2: Daily Trends & Return Reason Chart */}
            {activeTab === 'analytics' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Daily Breakdown */}
                    <Card className="lg:col-span-2 p-4 bg-slate-900 border-slate-800">
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-violet-400" />
                            দৈনিক অর্ডারের অগ্রগতি ও রিটার্ন প্রবণতা
                        </h3>

                        {summaryData.daily_trends && summaryData.daily_trends.length > 0 ? (
                            <div className="space-y-3">
                                {summaryData.daily_trends.map((item, idx) => {
                                    const total = parseInt(item.total) || 0;
                                    const del = parseInt(item.delivered) || 0;
                                    const ret = parseInt(item.returned) || 0;
                                    const other = total - del - ret;

                                    const delPercent = total > 0 ? Math.round((del / total) * 100) : 0;
                                    const retPercent = total > 0 ? Math.round((ret / total) * 100) : 0;

                                    return (
                                        <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                                            <div className="flex items-center justify-between text-xs mb-2">
                                                <span className="font-bold text-slate-200">
                                                    {new Date(item.date).toLocaleDateString('en-GB', {
                                                        weekday: 'short',
                                                        day: 'numeric',
                                                        month: 'short',
                                                    })}
                                                </span>
                                                <div className="flex items-center gap-3 text-[11px]">
                                                    <span className="text-slate-400">মোট: <strong className="text-white">{total}</strong></span>
                                                    <span className="text-emerald-400 font-medium">ডেলিভারি: {del} ({delPercent}%)</span>
                                                    <span className="text-rose-400 font-medium">রিটার্ন: {ret} ({retPercent}%)</span>
                                                </div>
                                            </div>

                                            {/* Stacked Progress Bar */}
                                            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden flex">
                                                <div
                                                    style={{ width: `${delPercent}%` }}
                                                    className="bg-emerald-500 h-full transition-all"
                                                    title={`Delivered: ${del}`}
                                                />
                                                <div
                                                    style={{ width: `${retPercent}%` }}
                                                    className="bg-rose-500 h-full transition-all"
                                                    title={`Returned: ${ret}`}
                                                />
                                                <div
                                                    style={{ width: `${100 - delPercent - retPercent}%` }}
                                                    className="bg-blue-500/60 h-full transition-all"
                                                    title={`In-Transit/Pending: ${other}`}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-slate-500 text-xs">
                                এই ফিল্টারে কোনো ট্রেন্ড ডেটা নেই।
                            </div>
                        )}
                    </Card>

                    {/* Top Return Reasons Breakdown */}
                    <Card className="p-4 bg-slate-900 border-slate-800">
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                            সর্বাধিক ঘন ঘন রিটার্নের কারণ
                        </h3>
                        <p className="text-[11px] text-slate-400 mb-3">
                            কাস্টমার ও ডেলিভারিম্যানের দেওয়া সবচেয়ে বেশি কারণগুলোর তালিকা
                        </p>

                        {summaryData.top_return_reasons && summaryData.top_return_reasons.length > 0 ? (
                            <div className="space-y-3">
                                {summaryData.top_return_reasons.map((r, i) => {
                                    return (
                                        <div key={i} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                                            <div className="flex items-center justify-between text-xs font-medium text-slate-200">
                                                <span className="truncate pr-2">{r.return_reason}</span>
                                                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold font-mono text-[11px] shrink-0">
                                                    {r.count} বার
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-12 text-center text-slate-500 text-xs">
                                এখনো কোনো নির্দিষ্ট রিটার্ন কারণ রেকর্ড করা হয়নি।
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* Modal: Edit Return Reason & Rider Note */}
            <Modal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                title={`রিটার্নের কারণ এডিট করুন (Order #${selectedOrderForReason?.order_number})`}
                size="md"
            >
                <form onSubmit={handleSaveReturnReason} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            এক ক্লিকে সাধারণ কারণ সিলেক্ট করুন:
                        </label>
                        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-1 bg-slate-950 rounded-lg border border-slate-800">
                            {commonReturnReasons.map((reason, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setReasonText(reason)}
                                    className={`p-2 text-left rounded text-[11px] transition-colors leading-tight ${
                                        reasonText === reason
                                            ? 'bg-rose-600 text-white font-bold'
                                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                                    }`}
                                >
                                    {reason}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                            রিটার্নের প্রধান কারণ (Return Reason) *
                        </label>
                        <input
                            type="text"
                            value={reasonText}
                            onChange={(e) => setReasonText(e.target.value)}
                            placeholder="যেমন: কাস্টমার ফোন ধরে না / মত পরিবর্তন করেছে..."
                            required
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                            ডেলিভারিম্যানের মন্তব্য বা অতিরিক্ত নোট (Rider Note / Remarks)
                        </label>
                        <textarea
                            rows={3}
                            value={riderNoteText}
                            onChange={(e) => setRiderNoteText(e.target.value)}
                            placeholder="ডেলিভারিম্যান কী বলেছে বা কাস্টমার কী বলেছে বিস্তারিত লিখুন..."
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-rose-500"
                        />
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setModalOpen(false)}
                            className="text-slate-400"
                        >
                            বাতিল
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={savingReason}
                            className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
                        >
                            {savingReason ? 'সেভ হচ্ছে...' : 'রিটার্ন কারণ সেভ করুন'}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
export default OrderSummaryPage;
