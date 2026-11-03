import React from 'react';

export const Facebook = ({ className = 'w-4 h-4', ...props }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
);

export const Instagram = ({ className = 'w-4 h-4', ...props }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
);

export const WhatsApp = ({ className = 'w-4 h-4', ...props }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12.031 0C5.397 0 0 5.397 0 12.031c0 2.119.55 4.183 1.594 6.002L0 24l6.136-1.564a11.968 11.968 0 005.895 1.595h.005c6.634 0 12.031-5.397 12.031-12.031 0-3.214-1.251-6.236-3.524-8.509C18.269 1.251 15.247 0 12.031 0zm0 22.029h-.004a9.98 9.98 0 01-5.09-1.39l-.365-.217-3.784.965.992-3.69-.238-.378a9.974 9.974 0 01-1.536-5.288c0-5.518 4.49-10.008 10.01-10.008 2.673 0 5.186 1.042 7.076 2.932a9.948 9.948 0 012.93 7.075c0 5.519-4.49 10.009-10.005 10.009z"/>
    </svg>
);

