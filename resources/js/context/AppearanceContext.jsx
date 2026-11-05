import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AppearanceContext = createContext();

export const AppearanceProvider = ({ children }) => {
    const [appearance, setAppearance] = useState({
        app_name: 'NexFlow AI',
        app_tagline: 'One Inbox. Every Conversation. Smarter Sales.',
        app_logo_url: null,
        app_favicon_url: null,
        primary_color: '#6366f1',
        secondary_color: '#8b5cf6',
    });
    const [loading, setLoading] = useState(true);

    const applyBranding = (data) => {
        if (!data) return;
        if (data.app_name) {
            document.title = `${data.app_name} - ${data.app_tagline || 'Smarter Sales CRM'}`;
        }
        if (data.app_favicon_url) {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = data.app_favicon_url;
        }
        if (data.primary_color) {
            document.documentElement.style.setProperty('--brand-primary', data.primary_color);
        }
        if (data.secondary_color) {
            document.documentElement.style.setProperty('--brand-secondary', data.secondary_color);
        }
    };

    const fetchAppearance = async () => {
        try {
            const res = await api.get('/appearance');
            if (res.data?.status === 'success' && res.data.data) {
                setAppearance(res.data.data);
                applyBranding(res.data.data);
            }
        } catch (e) {
            // Fallback gracefully to defaults
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAppearance();
    }, []);

    const updateAppearanceState = (newData) => {
        setAppearance((prev) => {
            const updated = { ...prev, ...newData };
            applyBranding(updated);
            return updated;
        });
    };

    return (
        <AppearanceContext.Provider
            value={{
                appearance,
                loading,
                fetchAppearance,
                updateAppearanceState,
                appName: appearance.app_name || 'NexFlow AI',
                appTagline: appearance.app_tagline || 'Smarter Sales CRM',
                appLogoUrl: appearance.app_logo_url,
                primaryColor: appearance.primary_color || '#6366f1',
                secondaryColor: appearance.secondary_color || '#8b5cf6',
            }}
        >
            {children}
        </AppearanceContext.Provider>
    );
};

export const useAppearance = () => {
    const context = useContext(AppearanceContext);
    if (!context) {
        throw new Error('useAppearance must be used within an AppearanceProvider');
    }
    return context;
};

