import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard,
    Inbox,
    Share2,
    Bot,
    ShoppingBag,
    Users,
    UserCheck,
    BarChart3,
    Settings,
    ChevronDown,
    ChevronRight,
    Sparkles,
    Calendar,
    MessageSquare,
    Layers,
    Sliders,
    Zap,
    HelpCircle,
    LogOut,
    Menu,
    X,
    FileText,
    ShieldAlert,
    Activity,
    Radio,
    Send,
    Truck,
    Volume2,
    Palette,
} from 'lucide-react';

export const Sidebar = ({ isCollapsed, setIsCollapsed, mobileOpen, setMobileOpen }) => {
    const { user, isSuperAdmin, isAdmin, logout } = useAuth();
    const location = useLocation();

    const [openSections, setOpenSections] = useState({
        connections: true,
        inbox: true,
        automation: true,
        products: true,
        leads: true,
        sms: true,
        steadfast: true,
        team: true,
        analytics: false,
        system: false,
    });

    const toggleSection = (section) => {
        setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    const linkClasses = ({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
            isActive
                ? 'bg-indigo-600/15 text-indigo-400 font-semibold border-l-2 border-indigo-500 rounded-l-none'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`;

    return (
        <aside
            className={`fixed inset-y-0 left-0 z-40 bg-slate-950 border-r border-slate-800/80 transition-all duration-200 flex flex-col ${
                isCollapsed ? 'w-20' : 'w-64'
            } ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        >
            {/* Logo / Header */}
            <div className="h-16 px-4 border-b border-slate-800/80 flex items-center justify-between">
                {!isCollapsed && (
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                                NexFlow <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30">AI</span>
                            </span>
                            <p className="text-[10px] text-slate-400 -mt-0.5">Smarter Sales CRM</p>
                        </div>
                    </div>
                )}
                {isCollapsed && (
                    <div className="mx-auto w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="hidden md:flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/70"
                >
                    <Menu className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setMobileOpen && setMobileOpen(false)}
                    className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/70"
                    title="Close Menu"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Navigation links */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
                {/* Overview */}
                <div>
                    {!isCollapsed && (
                        <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Overview
                        </p>
                    )}
                    <NavLink to="/dashboard" className={linkClasses}>
                        <LayoutDashboard className="w-4 h-4 shrink-0" />
                        {!isCollapsed && <span>Dashboard</span>}
                    </NavLink>
                </div>

                {/* Unified Inbox */}
                <div>
                    {!isCollapsed && (
                        <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Conversations
                        </p>
                    )}
                    <NavLink to="/inbox" className={linkClasses}>
                        <Inbox className="w-4 h-4 shrink-0 text-indigo-400" />
                        {!isCollapsed && (
                            <div className="flex items-center justify-between w-full">
                                <span>Unified Inbox</span>
                                <span className="bg-indigo-500/20 text-indigo-400 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                                    Live
                                </span>
                            </div>
                        )}
                    </NavLink>
                </div>

                {/* Customer Orders */}
                <div>
                    {!isCollapsed && (
                        <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Sales & Orders
                        </p>
                    )}
                    <NavLink to="/orders" className={linkClasses}>
                        <ShoppingBag className="w-4 h-4 shrink-0 text-emerald-400" />
                        {!isCollapsed && (
                            <div className="flex items-center justify-between w-full">
                                <span>Customer Orders</span>
                                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                                    Active
                                </span>
                            </div>
                        )}
                    </NavLink>
                </div>

                {/* Social Channels (Admin / Super Admin) */}
                {isAdmin && (
                    <div>
                        {!isCollapsed ? (
                            <button
                                onClick={() => toggleSection('connections')}
                                className="w-full flex items-center justify-between px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1"
                            >
                                <span>Social Accounts</span>
                                {openSections.connections ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                        ) : null}
                        {(openSections.connections || isCollapsed) && (
                            <div className="space-y-1">
                                <NavLink to="/connections" className={linkClasses}>
                                    <Share2 className="w-4 h-4 shrink-0" />
                                    {!isCollapsed && <span>Connected Channels</span>}
                                </NavLink>
                                <NavLink to="/connections/diagnostics" className={linkClasses}>
                                    <Activity className="w-4 h-4 shrink-0" />
                                    {!isCollapsed && <span>Health & Diagnostics</span>}
                                </NavLink>
                            </div>
                        )}
                    </div>
                )}

                {/* AI Automation */}
                {isAdmin && (
                    <div>
                        {!isCollapsed ? (
                            <button
                                onClick={() => toggleSection('automation')}
                                className="w-full flex items-center justify-between px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1"
                            >
                                <span>AI Automation</span>
                                {openSections.automation ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                        ) : null}
                        {(openSections.automation || isCollapsed) && (
                            <div className="space-y-1">
                                <NavLink to="/automation/comments" className={linkClasses}>
                                    <MessageSquare className="w-4 h-4 shrink-0" />
                                    {!isCollapsed && <span>FB Comment Auto-Reply</span>}
                                </NavLink>
                                <NavLink to="/automation/rules" className={linkClasses}>
                                    <Zap className="w-4 h-4 shrink-0" />
                                    {!isCollapsed && <span>Rules & Triggers</span>}
                                </NavLink>
                                <NavLink to="/automation/ai-control" className={linkClasses}>
                                    <Sliders className="w-4 h-4 shrink-0" />
                                    {!isCollapsed && <span>AI Control Center</span>}
                                </NavLink>
                                <NavLink to="/automation/playground" className={linkClasses}>
                                    <Bot className="w-4 h-4 shrink-0 text-violet-400" />
                                    {!isCollapsed && <span>AI Test Playground</span>}
                                </NavLink>
                            </div>
                        )}
                    </div>
                )}

                {/* Product Catalog */}
                <div>
                    {!isCollapsed ? (
                        <button
                            onClick={() => toggleSection('products')}
                            className="w-full flex items-center justify-between px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1"
                        >
                            <span>Product Catalog</span>
                            {openSections.products ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                    ) : null}
                    {(openSections.products || isCollapsed) && (
                        <div className="space-y-1">
                            <NavLink to="/products" className={linkClasses}>
                                <ShoppingBag className="w-4 h-4 shrink-0" />
                                {!isCollapsed && <span>Products & Stock</span>}
                            </NavLink>
                            <NavLink to="/products/mappings" className={linkClasses}>
                                <Layers className="w-4 h-4 shrink-0" />
                                {!isCollapsed && <span>Post-Product Mapping</span>}
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* Lead CRM */}
                <div>
                    {!isCollapsed ? (
                        <button
                            onClick={() => toggleSection('leads')}
                            className="w-full flex items-center justify-between px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1"
                        >
                            <span>Lead CRM</span>
                            {openSections.leads ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                    ) : null}
                    {(openSections.leads || isCollapsed) && (
                        <div className="space-y-1">
                            <NavLink to="/leads" className={linkClasses}>
                                <Users className="w-4 h-4 shrink-0" />
                                {!isCollapsed && <span>All Leads Funnel</span>}
                            </NavLink>
                            <NavLink to="/leads/followups" className={linkClasses}>
                                <Calendar className="w-4 h-4 shrink-0" />
                                {!isCollapsed && <span>Follow-up Calendar</span>}
                            </NavLink>
                            <NavLink to="/customers" className={linkClasses}>
                                <UserCheck className="w-4 h-4 shrink-0" />
                                {!isCollapsed && <span>Customers Directory</span>}
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* SMS Gateway & Marketing */}
                {isAdmin && (
                    <div>
                        {!isCollapsed ? (
                            <button
                                onClick={() => toggleSection('sms')}
                                className="w-full flex items-center justify-between px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1"
                            >
                                <span>SMS (BulkSMS BD)</span>
                                {openSections.sms ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                        ) : null}
                        {(openSections.sms || isCollapsed) && (
                            <div className="space-y-1">
                                <NavLink to="/sms/gateway" className={linkClasses}>
                                    <Radio className="w-4 h-4 shrink-0 text-cyan-400" />
                                    {!isCollapsed && <span>Configure SMS Gateway</span>}
                                </NavLink>
                                <NavLink to="/sms/marketing" className={linkClasses}>
                                    <Send className="w-4 h-4 shrink-0 text-indigo-400" />
                                    {!isCollapsed && <span>SMS Marketing</span>}
                                </NavLink>
                                <NavLink to="/sms/auto-sms" className={linkClasses}>
                                    <Zap className="w-4 h-4 shrink-0 text-emerald-400" />
                                    {!isCollapsed && <span>Auto SMS (Order)</span>}
                                </NavLink>
                            </div>
                        )}
                    </div>
                )}

                {/* Steadfast Courier */}
                {isAdmin && (
                    <div>
                        {!isCollapsed ? (
                            <button
                                onClick={() => toggleSection('steadfast')}
                                className="w-full flex items-center justify-between px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1"
                            >
                                <span>Steadfast</span>
                                {openSections.steadfast ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                        ) : null}
                        {(openSections.steadfast || isCollapsed) && (
                            <div className="space-y-1">
                                <NavLink to="/courier/steadfast" className={linkClasses}>
                                    <Truck className="w-4 h-4 shrink-0 text-cyan-400" />
                                    {!isCollapsed && <span>Steadfast Configuration</span>}
                                </NavLink>
                            </div>
                        )}
                    </div>
                )}

                {/* Team Management (Admins) */}
                {isAdmin && (
                    <div>
                        {!isCollapsed ? (
                            <button
                                onClick={() => toggleSection('team')}
                                className="w-full flex items-center justify-between px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1"
                            >
                                <span>Team & Performance</span>
                                {openSections.team ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                        ) : null}
                        {(openSections.team || isCollapsed) && (
                            <div className="space-y-1">
                                <NavLink to="/team" className={linkClasses}>
                                    <Users className="w-4 h-4 shrink-0" />
                                    {!isCollapsed && <span>Moderators</span>}
                                </NavLink>
                                <NavLink to="/team/performance" className={linkClasses}>
                                    <BarChart3 className="w-4 h-4 shrink-0" />
                                    {!isCollapsed && <span>Performance Metrics</span>}
                                </NavLink>
                            </div>
                        )}
                    </div>
                )}

                {/* Analytics */}
                <div>
                    {!isCollapsed && (
                        <p className="px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            Intelligence
                        </p>
                    )}
                    <NavLink to="/analytics" className={linkClasses}>
                        <BarChart3 className="w-4 h-4 shrink-0 text-cyan-400" />
                        {!isCollapsed && <span>Analytics & Reports</span>}
                    </NavLink>
                </div>

                {/* System */}
                {isSuperAdmin && (
                    <div>
                        {!isCollapsed ? (
                            <button
                                onClick={() => toggleSection('system')}
                                className="w-full flex items-center justify-between px-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1"
                            >
                                <span>System</span>
                                {openSections.system ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                        ) : null}
                        {(openSections.system || isCollapsed) && (
                            <div className="space-y-1">
                                <NavLink to="/system/activity-logs" className={linkClasses}>
                                    <Activity className="w-4 h-4 shrink-0" />
                                    {!isCollapsed && <span>Audit Trail</span>}
                                </NavLink>
                                <NavLink to="/system/webhooks" className={linkClasses}>
                                    <ShieldAlert className="w-4 h-4 shrink-0" />
                                    {!isCollapsed && <span>Webhook Logs</span>}
                                </NavLink>
                                <NavLink to="/system/security" className={linkClasses}>
                                    <Settings className="w-4 h-4 shrink-0" />
                                    {!isCollapsed && <span>Security & API</span>}
                                </NavLink>
                                <NavLink to="/system/display" className={linkClasses}>
                                    <Palette className="w-4 h-4 shrink-0 text-amber-400" />
                                    {!isCollapsed && <span>Display & Accessibility</span>}
                                </NavLink>
                                <NavLink to="/settings/notifications" className={linkClasses}>
                                    <Volume2 className="w-4 h-4 shrink-0 text-indigo-400" />
                                    {!isCollapsed && <span>Sound & Alerts</span>}
                                </NavLink>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* User Profile Card & Logout */}
            <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
                <div className="flex items-center justify-between">
                    <NavLink to="/profile" className="flex items-center gap-3 overflow-hidden">
                        <img
                            src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                            alt={user?.name}
                            className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-500/30"
                        />
                        {!isCollapsed && (
                            <div className="overflow-hidden">
                                <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
                                <p className="text-[10px] text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
                            </div>
                        )}
                    </NavLink>
                    {!isCollapsed && (
                        <button
                            onClick={logout}
                            title="Sign Out"
                            className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800/80 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </aside>
    );
};

