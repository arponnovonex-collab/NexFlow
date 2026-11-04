import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppLayout = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex">
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
                className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
                    isCollapsed ? 'md:ml-20' : 'md:ml-64'
                }`}
            >
                <Header onMenuClick={() => setMobileOpen(true)} />
                <main className="flex-1 p-2 sm:p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

