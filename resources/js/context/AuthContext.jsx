import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('nexflow_user');
        return saved ? JSON.parse(saved) : null;
    });
    const [token, setToken] = useState(() => localStorage.getItem('nexflow_token'));
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const verifyAuth = async () => {
            const savedToken = localStorage.getItem('nexflow_token');
            if (!savedToken) {
                setIsLoading(false);
                return;
            }

            try {
                const res = await api.get('/auth/me');
                if (res.data?.user) {
                    setUser(res.data.user);
                    localStorage.setItem('nexflow_user', JSON.stringify(res.data.user));
                }
            } catch (err) {
                localStorage.removeItem('nexflow_token');
                localStorage.removeItem('nexflow_user');
                setUser(null);
                setToken(null);
            } finally {
                setIsLoading(false);
            }
        };

        verifyAuth();
    }, []);

    const login = async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        const { token: newToken, user: newUser } = res.data;
        localStorage.setItem('nexflow_token', newToken);
        localStorage.setItem('nexflow_user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
        return newUser;
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (e) {
            // ignore network error on logout
        } finally {
            localStorage.removeItem('nexflow_token');
            localStorage.removeItem('nexflow_user');
            setToken(null);
            setUser(null);
            window.location.href = '/login';
        }
    };

    const updateUser = (updatedData) => {
        const merged = { ...user, ...updatedData };
        setUser(merged);
        localStorage.setItem('nexflow_user', JSON.stringify(merged));
    };

    const value = {
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        updateUser,
        isSuperAdmin: user?.role === 'super_admin',
        isAdmin: user?.role === 'super_admin' || user?.role === 'admin',
        isModerator: user?.role === 'moderator',
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

