import React from 'react';

const variantClasses = {
    primary: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
    success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
    info: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
    neutral: 'bg-slate-800 text-slate-300 border border-slate-700',
    facebook: 'bg-blue-600/10 text-blue-400 border border-blue-500/30',
    instagram: 'bg-pink-600/10 text-pink-400 border border-pink-500/30',
    whatsapp: 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/30',
    cold: 'bg-slate-700 text-slate-300',
    warm: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
    hot: 'bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse',
    converted: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold',
    lost: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

export const Badge = ({ children, variant = 'neutral', size = 'sm', className = '' }) => {
    const sizeClasses = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
    const cls = variantClasses[variant] || variantClasses.neutral;

    return (
        <span className={`inline-flex items-center font-medium rounded-full ${sizeClasses} ${cls} ${className}`}>
            {children}
        </span>
    );
};

