import React, { useState } from 'react';

// Generates a deterministic pleasant gradient based on customer name
const getGradientByName = (name = '') => {
    const gradients = [
        'from-indigo-500 to-purple-600',
        'from-blue-500 to-indigo-600',
        'from-emerald-500 to-teal-600',
        'from-violet-500 to-fuchsia-600',
        'from-pink-500 to-rose-600',
        'from-amber-500 to-orange-600',
        'from-cyan-500 to-blue-600',
        'from-teal-500 to-emerald-600',
    ];
    let hash = 0;
    const str = String(name || 'Customer');
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
};

const getInitials = (name = '') => {
    if (!name) return 'C';
    const clean = name.replace(/[^a-zA-Z0-9\s\u0980-\u09FF]/g, '').trim();
    if (!clean) return 'C';
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
};

export const CustomerAvatar = ({
    name = '',
    avatarUrl = null,
    size = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
    className = '',
}) => {
    const [imgFailed, setImgFailed] = useState(false);

    // If avatarUrl is an unsplash stock photo, treat as absent so we don't display a fake persona
    const isUnsplash = avatarUrl && typeof avatarUrl === 'string' && avatarUrl.includes('unsplash.com');
    const hasValidAvatar = Boolean(avatarUrl) && !isUnsplash && !imgFailed;

    const sizeClasses = {
        xs: 'w-6 h-6 text-[10px]',
        sm: 'w-8 h-8 text-xs',
        md: 'w-9 h-9 text-xs',
        lg: 'w-12 h-12 text-sm',
        xl: 'w-14 h-14 md:w-16 md:h-16 text-base font-bold',
    }[size] || 'w-8 h-8 text-xs';

    if (hasValidAvatar) {
        return (
            <img
                src={avatarUrl}
                alt={name || 'Customer'}
                referrerPolicy="no-referrer"
                onError={() => {
                    setImgFailed(true);
                }}
                className={`${sizeClasses} rounded-full object-cover shrink-0 ring-1 ring-slate-800 ${className}`}
            />
        );
    }

    const gradient = getGradientByName(name);
    const initials = getInitials(name);

    return (
        <div
            className={`${sizeClasses} rounded-full bg-gradient-to-br ${gradient} text-white font-bold flex items-center justify-center shrink-0 ring-1 ring-white/10 shadow-sm uppercase select-none ${className}`}
            title={name || 'Customer'}
        >
            <span>{initials}</span>
        </div>
    );
};

