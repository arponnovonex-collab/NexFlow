import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export const ThemeToggle = ({ className = '', showLabel = false, size = 'md' }) => {
    const { isDark, toggleTheme } = useTheme();

    if (showLabel) {
        return (
            <button
                type="button"
                onClick={toggleTheme}
                title={isDark ? 'Switch to Light Mode (লাইট মোড অন করুন)' : 'Switch to Dark Mode (ডার্ক মোড অন করুন)'}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200 border cursor-pointer ${
                    isDark
                        ? 'bg-slate-900/80 hover:bg-slate-850 text-slate-300 border-slate-800 hover:border-slate-700'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-sm hover:border-slate-300'
                } ${className}`}
            >
                <div className="flex items-center gap-2">
                    {isDark ? (
                        <Moon className="w-4 h-4 text-indigo-400" />
                    ) : (
                        <Sun className="w-4 h-4 text-amber-500" />
                    )}
                    <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                </div>
                <div
                    className={`w-8 h-4.5 rounded-full p-0.5 transition-colors relative flex items-center ${
                        isDark ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                >
                    <div className="w-3.5 h-3.5 rounded-full bg-white shadow-sm" />
                </div>
            </button>
        );
    }

    const sizeClasses = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-10 h-10' : 'w-9 h-9';
    const iconSizeClasses = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';

    return (
        <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode (লাইট মোড অন করুন)' : 'Switch to Dark Mode (ডার্ক মোড অন করুন)'}
            className={`flex items-center justify-center rounded-xl transition-all duration-200 border cursor-pointer shrink-0 ${sizeClasses} ${
                isDark
                    ? 'bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-amber-300 border-slate-800 hover:border-slate-700 shadow-sm'
                    : 'bg-white hover:bg-slate-100 text-indigo-600 hover:text-indigo-700 border-slate-200 hover:border-slate-300 shadow-sm'
            } ${className}`}
        >
            {isDark ? (
                <Sun className={`${iconSizeClasses} transition-transform duration-300 hover:rotate-45`} />
            ) : (
                <Moon className={`${iconSizeClasses} transition-transform duration-300 hover:-rotate-12`} />
            )}
        </button>
    );
};

