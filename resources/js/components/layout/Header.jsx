import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/client';
import {
    Search,
    Bell,
    CheckCircle,
    AlertCircle,
    AlertTriangle,
    User,
    LogOut,
    Shield,
    Menu,
    MessageCircle,
    Check,
    Trash2,
    Volume2,
    Sliders,
    X,
    ExternalLink,
} from 'lucide-react';
import { Facebook, Instagram } from '../common/SocialIcons';
import { Badge } from '../common/Badge';

export const Header = ({ onMenuClick }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loadingNotifications, setLoadingNotifications] = useState(false);

    const timeAgo = (dateStr) => {
        if (!dateStr) return '';
        const diffMs = Date.now() - new Date(dateStr).getTime();
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 60) return 'Just now';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHrs = Math.floor(diffMin / 60);
        if (diffHrs < 24) return `${diffHrs}h ago`;
        const diffDays = Math.floor(diffHrs / 24);
        return `${diffDays}d ago`;
    };

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/notifications');
            if (res.data?.status === 'success') {
                setNotifications(res.data.data?.notifications || []);
                setUnreadCount(res.data.data?.unread_count || 0);
            }
        } catch (err) {
            // silent fail on notification poll
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Poll notifications every 35 seconds
        const timer = setInterval(fetchNotifications, 35000);
        return () => clearInterval(timer);
    }, []);

    const handleMarkAllAsRead = async () => {
        try {
            await api.post('/notifications/mark-all-read');
            setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all notifications as read', err);
        }
    };

    const handleNotificationClick = async (n) => {
        try {
            if (!n.is_read) {
                await api.put(`/notifications/${n.id}/read`);
                setNotifications((prev) =>
                    prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
                );
                setUnreadCount((c) => Math.max(0, c - 1));
            }
        } catch (err) {
            // silent
        }
        setShowNotifications(false);
        if (n.link) {
            navigate(n.link);
        }
    };

    const handleDeleteNotification = async (e, id) => {
        e.stopPropagation();
        try {
            await api.delete(`/notifications/${id}`);
            setNotifications((prev) => {
                const item = prev.find((n) => n.id === id);
                if (item && !item.is_read) {
                    setUnreadCount((c) => Math.max(0, c - 1));
                }
                return prev.filter((n) => n.id !== id);
            });
        } catch (err) {
            console.error('Failed to delete notification', err);
        }
    };

    return (
        <header className="h-14 md:h-16 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-3 md:px-6 flex items-center justify-between sticky top-0 z-30">
            {/* Left Section: Mobile toggle & Global search */}
            <div className="flex items-center gap-2 md:gap-3 flex-1 max-w-md min-w-0">
                <button
                    onClick={onMenuClick}
                    className="md:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 shrink-0 cursor-pointer"
                    title="Open Menu"
                >
                    <Menu className="w-5 h-5" />
                </button>

                <div className="relative w-full min-w-0">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search conversations, customers, SKUs..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                    />
                </div>
            </div>

            {/* Right Section: Channels status, notifications, profile */}
            <div className="flex items-center gap-3 md:gap-4">
                {/* Active Channels Quick Status */}
                <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800/80 rounded-full text-xs">
                    <span className="text-[11px] font-medium text-slate-400 mr-1">Live Channels:</span>
                    <span className="flex items-center gap-1 text-[11px] text-blue-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> FB Page
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="flex items-center gap-1 text-[11px] text-pink-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Instagram
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> WhatsApp
                    </span>
                </div>

                {/* Notifications Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => {
                            setShowNotifications(!showNotifications);
                            setShowProfileMenu(false);
                            if (!showNotifications) fetchNotifications();
                        }}
                        className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Notifications"
                    >
                        <Bell className="w-4 h-4" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-slate-950 animate-pulse">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <>
                            <div
                                className="fixed inset-0 z-40 cursor-default"
                                onClick={() => setShowNotifications(false)}
                            />
                            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
                                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
                                    <div className="flex items-center gap-2">
                                        <Bell className="w-4 h-4 text-indigo-400" />
                                        <span className="text-xs font-semibold text-slate-200">System Notifications</span>
                                        {unreadCount > 0 && (
                                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-rose-500/20 text-rose-300 rounded border border-rose-500/30">
                                                {unreadCount} new
                                            </span>
                                        )}
                                    </div>
                                    {unreadCount > 0 && (
                                        <button
                                            onClick={handleMarkAllAsRead}
                                            className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                                        >
                                            Mark all read
                                        </button>
                                    )}
                                </div>

                                <div className="divide-y divide-slate-800/60 max-h-80 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                                            <p className="text-xs text-slate-400 font-medium">কোনো নোটিফিকেশন নেই</p>
                                            <p className="text-[11px] text-slate-500 mt-0.5">সব আপডেট ক্লিয়ার আছে</p>
                                        </div>
                                    ) : (
                                        notifications.map((n) => {
                                            const isUrgent = n.type === 'urgent' || n.type === 'danger';
                                            const isWarning = n.type === 'warning';
                                            const isSuccess = n.type === 'success';

                                            return (
                                                <div
                                                    key={n.id}
                                                    onClick={() => handleNotificationClick(n)}
                                                    className={`p-3 transition-colors cursor-pointer group flex items-start gap-2.5 ${
                                                        !n.is_read
                                                            ? isUrgent
                                                                ? 'bg-rose-950/20 hover:bg-rose-950/30 border-l-2 border-rose-500'
                                                                : isWarning
                                                                ? 'bg-amber-950/20 hover:bg-amber-950/30 border-l-2 border-amber-500'
                                                                : 'bg-indigo-950/20 hover:bg-indigo-950/30 border-l-2 border-indigo-500'
                                                            : 'hover:bg-slate-800/50'
                                                    }`}
                                                >
                                                    <div className="shrink-0 mt-0.5">
                                                        {isUrgent && <AlertCircle className="w-4 h-4 text-rose-400" />}
                                                        {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                                                        {isSuccess && <CheckCircle className="w-4 h-4 text-emerald-400" />}
                                                        {!isUrgent && !isWarning && !isSuccess && (
                                                            <MessageCircle className="w-4 h-4 text-cyan-400" />
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-1">
                                                            <p className={`text-xs font-semibold truncate ${!n.is_read ? 'text-slate-100' : 'text-slate-300'}`}>
                                                                {n.title}
                                                            </p>
                                                            <span className="text-[10px] text-slate-500 shrink-0">
                                                                {timeAgo(n.created_at)}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                                                            {n.message}
                                                        </p>
                                                        {n.link && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400 group-hover:underline mt-1 font-medium">
                                                                View details &rarr;
                                                            </span>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={(e) => handleDeleteNotification(e, n.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-opacity cursor-pointer shrink-0"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="p-2 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px]">
                                    <Link
                                        to="/settings/notifications"
                                        onClick={() => setShowNotifications(false)}
                                        className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 rounded hover:bg-slate-850 transition-colors"
                                    >
                                        <Volume2 className="w-3.5 h-3.5" />
                                        Sound & Alert Settings
                                    </Link>
                                    <span className="text-[10px] text-slate-500">NexFlow System</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* User Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => {
                            setShowProfileMenu(!showProfileMenu);
                            setShowNotifications(false);
                        }}
                        className="flex items-center gap-2.5 p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                        <img
                            src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                            alt={user?.name}
                            className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-700"
                        />
                        <div className="hidden sm:block text-left">
                            <span className="text-xs font-semibold text-slate-200 block -mb-0.5">{user?.name}</span>
                            <Badge
                                variant={user?.role === 'super_admin' ? 'primary' : user?.role === 'admin' ? 'info' : 'neutral'}
                                size="xs"
                            >
                                {user?.role?.replace('_', ' ')}
                            </Badge>
                        </div>
                    </button>

                    {showProfileMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-40 cursor-default"
                                onClick={() => setShowProfileMenu(false)}
                            />
                            <div className="absolute right-0 mt-2 w-52 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 animate-fade-in">
                                <div className="px-4 py-2 border-b border-slate-800">
                                    <p className="text-xs font-medium text-slate-200">{user?.name}</p>
                                    <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                                </div>
                                <Link
                                    to="/profile"
                                    onClick={() => setShowProfileMenu(false)}
                                    className="flex items-center gap-2 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                                >
                                    <User className="w-3.5 h-3.5" /> My Profile
                                </Link>
                                <Link
                                    to="/settings/notifications"
                                    onClick={() => setShowProfileMenu(false)}
                                    className="flex items-center gap-2 px-4 py-2 text-xs text-indigo-400 hover:text-indigo-300 hover:bg-slate-800/80 transition-colors"
                                >
                                    <Volume2 className="w-3.5 h-3.5" /> Sound & Notification Settings
                                </Link>
                                <div className="border-t border-slate-800/80 my-1"></div>
                                <a
                                    href="/privacy-policy"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block px-4 py-1.5 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                                >
                                    Privacy Policy
                                </a>
                                <a
                                    href="/terms-of-service"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block px-4 py-1.5 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                                >
                                    Terms of Service
                                </a>
                                <a
                                    href="/data-deletion"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block px-4 py-1.5 text-[11px] text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                                >
                                    Data Deletion
                                </a>
                                <div className="border-t border-slate-800/80 my-1"></div>
                                <button
                                    onClick={logout}
                                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                                >
                                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};
