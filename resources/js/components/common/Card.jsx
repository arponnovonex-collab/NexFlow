import React from 'react';

export const Card = ({ children, className = '', title, subtitle, action, footer }) => {
    return (
        <div className={`bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden ${className}`}>
            {(title || action) && (
                <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
                    <div>
                        {title && <h3 className="text-sm font-semibold text-slate-100">{title}</h3>}
                        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
                    </div>
                    {action && <div>{action}</div>}
                </div>
            )}
            <div className="p-5">{children}</div>
            {footer && (
                <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-900/40 text-xs text-slate-400">
                    {footer}
                </div>
            )}
        </div>
    );
};

