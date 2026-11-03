import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export const MetricCard = ({
    title,
    value,
    subtitle,
    change,
    isPositive,
    icon: Icon,
    iconColor = 'text-indigo-400',
    iconBg = 'bg-indigo-500/10',
    onClick,
}) => {
    return (
        <div
            onClick={onClick}
            className={`bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700/80 transition-all shadow-sm ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</p>
                {Icon && (
                    <div className={`p-2.5 rounded-lg ${iconBg} ${iconColor}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                )}
            </div>
            <div className="mt-3 flex items-baseline justify-between">
                <h3 className="text-2xl font-bold text-slate-100">{value}</h3>
                {change !== undefined && (
                    <div className={`flex items-center text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                        {change}
                    </div>
                )}
            </div>
            {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
    );
};

