import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    Search,
    Bell,
    CheckCircle,
    AlertCircle,
    User,
    LogOut,
    Shield,
    Menu,
    MessageCircle,
} from 'lucide-react';
import { Facebook, Instagram } from '../common/SocialIcons';
import { Badge } from '../common/Badge';

export const Header = ({ onMenuClick }) => {
    const { user, logout } = useAuth();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    const mockNotifications = [
        {
            id: 1,
            title: 'High Priority Follow-up Due',
            desc: 'Ayesha Siddiqua (Ruby Twinkle M size) requires phone confirmation.',
            time: '10m ago',
            type: 'urgent',
        },
        {
            id: 2,
            title: 'Automated Comment Replied',
            desc: 'NexFlow AI replied to Farhana Akter on Post #1001 with verified price.',
            time: '35m ago',
            type: 'success',
        },
        {
            id: 3,
            title: 'New WhatsApp Inbound',
            desc: 'Incoming message from Mahmudul Hasan regarding Kids romper.',
            time: '1h ago',
            type: 'info',
        },
    ];

    return (
        <header className="h-16 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30">
            {/* Left Section: Mobile toggle & Global search */}
            <div className="flex items-center gap-3 flex-1 max-w-md">
                <button
                    onClick={onMenuClick}
                    className="md:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
                >
                    <Menu className="w-5 h-5" />
                </button>

                <div className="relative w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search conversations, customers, SKUs (e.g. Ruby Twinkle)..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                </div>
            </div>

            {/* Right Section: Channels status, notifications, profile */}
            <div className="flex items-center gap-4">
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
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                        <Bell className="w-4 h-4" />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full"></span>
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-in">
                            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-200">System Notifications</span>
                                <span className="text-[10px] text-indigo-400 font-medium">3 Unread</span>
                            </div>
                            <div className="divide-y divide-slate-800/60 max-h-72 overflow-y-auto">
                                {mockNotifications.map((n) => (
                                    <div key={n.id} className="p-3 hover:bg-slate-800/50 transition-colors cursor-pointer">
                                        <div className="flex items-start gap-2">
                                            {n.type === 'urgent' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
                                            {n.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
                                            {n.type === 'info' && <MessageCircle className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />}
                                            <div className="flex-1">
                                                <p className="text-xs font-medium text-slate-200">{n.title}</p>
                                                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.desc}</p>
                                                <span className="text-[10px] text-slate-400 mt-1 block">{n.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* User Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
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
                        <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 z-50 animate-fade-in">
                            <div className="px-4 py-2 border-b border-slate-800">
                                <p className="text-xs font-medium text-slate-200">{user?.name}</p>
                                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                            </div>
                            <a
                                href="/profile"
                                className="flex items-center gap-2 px-4 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                            >
                                <User className="w-3.5 h-3.5" /> My Profile
                            </a>
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
                    )}
                </div>
            </div>
        </header>
    );
};
