import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppLayout = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();
    const isInbox = location.pathname.startsWith('/inbox');

    // Automatically close mobile drawer when navigating
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    return (
        <div className="h-screen min-h-screen bg-slate-950 text-slate-100 flex overflow-hidden">
            {/* Mobile backdrop */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-30 md:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <Sidebar
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
                mobileOpen={mobileOpen}
                setMobileOpen={setMobileOpen}
            />

            {/* Main Content Area */}
            <div
                className={`flex-1 flex flex-col min-w-0 h-full transition-all duration-200 overflow-hidden ${
                    isCollapsed ? 'md:ml-20' : 'md:ml-64'
                }`}
            >
                <Header onMenuClick={() => setMobileOpen(true)} />
                <main className={`flex-1 min-w-0 w-full mx-auto flex flex-col min-h-0 ${
                    isInbox
                        ? 'p-0 md:p-6 lg:p-8 max-w-7xl overflow-hidden h-[calc(100dvh-4rem)]'
                        : 'p-4 md:p-6 lg:p-8 max-w-7xl overflow-y-auto'
                }`}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

