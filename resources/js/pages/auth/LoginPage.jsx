import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Sparkles, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/common/Button';

export const LoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid email or password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleQuickLogin = (quickEmail, quickPassword) => {
        setEmail(quickEmail);
        setPassword(quickPassword);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-16 sm:px-6 lg:px-8 selection:bg-indigo-500 selection:text-white relative">
            {/* Top Fixed Header for Unauthenticated Visitors */}
            <header className="fixed top-0 left-0 right-0 z-30 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <a href="/" className="flex items-center gap-2.5 hover:opacity-90 transition">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-extrabold text-white text-base tracking-tight">
                            NexFlow <span className="text-indigo-400">AI</span>
                        </span>
                    </a>

                    <nav className="flex items-center gap-3 sm:gap-6 text-xs font-medium">
                        <a
                            href="/privacy-policy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            Privacy Policy
                        </a>
                        <a
                            href="/terms-of-service"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            Terms of Service
                        </a>
                        <a
                            href="/data-deletion"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            Data Deletion
                        </a>
                    </nav>
                </div>
            </header>

            <div className="pt-8 sm:mx-auto sm:w-full sm:max-w-md text-center">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-xl shadow-indigo-500/25">
                    <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h2 className="mt-4 text-3xl font-extrabold text-white tracking-tight">
                    NexFlow <span className="text-indigo-400">AI</span>
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                    One Inbox. Every Conversation. Smarter Sales.
                </p>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
                <div className="bg-slate-900 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
                    {error && (
                        <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                            {error}
                        </div>
                    )}

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">Work Email Address</label>
                            <div className="relative">
                                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="e.g. admin@nexflow.ai"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1">
                            <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                                <input type="checkbox" defaultChecked className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0" />
                                Remember my session
                            </label>
                            <span className="text-slate-400 hover:text-indigo-400 cursor-pointer">
                                Security protected
                            </span>
                        </div>

                        <Button
                            type="submit"
                            variant="primary"
                            loading={loading}
                            className="w-full mt-2"
                        >
                            Sign In to Workspace
                        </Button>
                    </form>

                    {/* Quick Demo Logins */}
                    <div className="mt-6 pt-6 border-t border-slate-800/80">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
                            Instant Demo Logins
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => handleQuickLogin('admin@nexflow.ai', 'password123')}
                                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-200 hover:border-indigo-500/50 transition-all text-center cursor-pointer"
                            >
                                <span className="block text-indigo-400 font-semibold">Super Admin</span>
                                <span className="text-[10px] text-slate-400">Full Access</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleQuickLogin('manager@nexflow.ai', 'password123')}
                                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-200 hover:border-indigo-500/50 transition-all text-center cursor-pointer"
                            >
                                <span className="block text-cyan-400 font-semibold">Manager</span>
                                <span className="text-[10px] text-slate-400">Operations</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleQuickLogin('moderator@nexflow.ai', 'password123')}
                                className="p-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-200 hover:border-indigo-500/50 transition-all text-center cursor-pointer"
                            >
                                <span className="block text-emerald-400 font-semibold">Moderator</span>
                                <span className="text-[10px] text-slate-400">Inbox Agent</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Official Meta Cloud API & OpenAI Enterprise Architecture</span>
                </div>

                {/* Footer Legal Links */}
                <footer className="mt-8 text-center text-xs text-slate-500 flex flex-wrap items-center justify-center gap-3">
                    <span>&copy; 2026 NexFlow AI</span>
                    <span>·</span>
                    <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
                    <span>·</span>
                    <a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">Terms of Service</a>
                    <span>·</span>
                    <a href="/data-deletion" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">Data Deletion</a>
                </footer>
            </div>
        </div>
    );
};

