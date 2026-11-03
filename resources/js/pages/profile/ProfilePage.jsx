import React, { useState } from 'react';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { User, Lock, Phone, Mail, Shield, CheckCircle2 } from 'lucide-react';

export const ProfilePage = () => {
    const { user, updateUser } = useAuth();
    const [profileForm, setProfileForm] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
        avatar_url: user?.avatar_url || '',
    });
    const [passwordForm, setPasswordForm] = useState({
        current_password: '',
        new_password: '',
        new_password_confirmation: '',
    });
    const [profileSaving, setProfileSaving] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [message, setMessage] = useState('');

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setProfileSaving(true);
        setMessage('');
        try {
            const res = await api.put('/auth/profile', profileForm);
            updateUser(res.data.user);
            setMessage('Profile updated successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (err) {
            alert('Failed to update profile');
        } finally {
            setProfileSaving(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setPasswordSaving(true);
        try {
            await api.post('/auth/change-password', passwordForm);
            alert('Password changed successfully!');
            setPasswordForm({ current_password: '', new_password: '', new_password_confirmation: '' });
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to change password');
        } finally {
            setPasswordSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    My Profile & Credentials
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                    Manage your personal account details, role permissions, and workspace password.
                </p>
            </div>

            {message && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{message}</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Profile Form */}
                <Card title="Personal Information">
                    <form onSubmit={handleProfileSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                            <input
                                type="text"
                                required
                                value={profileForm.name}
                                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                            <input
                                type="email"
                                disabled
                                value={user?.email || ''}
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400 cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                            <input
                                type="text"
                                placeholder="+8801..."
                                value={profileForm.phone}
                                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Avatar Image URL</label>
                            <input
                                type="text"
                                value={profileForm.avatar_url}
                                onChange={(e) => setProfileForm({ ...profileForm, avatar_url: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>

                        <div className="pt-2">
                            <Button type="submit" variant="primary" size="sm" loading={profileSaving}>
                                Save Profile
                            </Button>
                        </div>
                    </form>
                </Card>

                {/* Password Change */}
                <Card title="Change Password">
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Current Password</label>
                            <input
                                type="password"
                                required
                                value={passwordForm.current_password}
                                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">New Password</label>
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={passwordForm.new_password}
                                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Confirm New Password</label>
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={passwordForm.new_password_confirmation}
                                onChange={(e) => setPasswordForm({ ...passwordForm, new_password_confirmation: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200"
                            />
                        </div>

                        <div className="pt-2">
                            <Button type="submit" variant="primary" size="sm" loading={passwordSaving}>
                                Update Password
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
};

