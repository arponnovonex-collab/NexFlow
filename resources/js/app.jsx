import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/layout/AppLayout';

import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { UnifiedInboxPage } from './pages/inbox/UnifiedInboxPage';
import { SocialConnectionsPage } from './pages/connections/SocialConnectionsPage';
import { CommentAutomationPage } from './pages/automation/CommentAutomationPage';
import { AutomationRulesPage } from './pages/automation/AutomationRulesPage';
import { AiControlCenterPage } from './pages/automation/AiControlCenterPage';
import { AiPlaygroundPage } from './pages/automation/AiPlaygroundPage';
import { ProductsListPage } from './pages/products/ProductsListPage';
import { PostProductMappingPage } from './pages/products/PostProductMappingPage';
import { LeadsListPage } from './pages/leads/LeadsListPage';
import { FollowupsPage } from './pages/leads/FollowupsPage';
import { CustomersPage } from './pages/leads/CustomersPage';
import { OrdersPage } from './pages/leads/OrdersPage';
import { TeamManagementPage } from './pages/team/TeamManagementPage';
import { ModeratorPerformancePage } from './pages/team/ModeratorPerformancePage';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';
import { ActivityLogsPage } from './pages/system/ActivityLogsPage';
import { WebhookDiagnosticsPage } from './pages/system/WebhookDiagnosticsPage';
import { SecuritySettingsPage } from './pages/system/SecuritySettingsPage';
import { NotificationSoundSettingsPage } from './pages/settings/NotificationSoundSettingsPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { SmsGatewayPage } from './pages/sms/SmsGatewayPage';
import { SmsMarketingPage } from './pages/sms/SmsMarketingPage';
import { AutoSmsPage } from './pages/sms/AutoSmsPage';
import { SteadfastPage } from './pages/courier/SteadfastPage';

// Protected Route Guard
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export const App = () => {
    return (
        <ThemeProvider>
            <AuthProvider>
                <BrowserRouter>
                    <Routes>
                    <Route path="/login" element={<LoginPage />} />

                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <AppLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<Navigate to="/dashboard" replace />} />
                        <Route path="dashboard" element={<DashboardPage />} />
                        <Route path="inbox" element={<UnifiedInboxPage />} />
                        <Route path="connections" element={<SocialConnectionsPage />} />
                        <Route path="connections/diagnostics" element={<SocialConnectionsPage />} />

                        {/* AI Automation */}
                        <Route path="automation/comments" element={<CommentAutomationPage />} />
                        <Route path="automation/rules" element={<AutomationRulesPage />} />
                        <Route path="automation/ai-control" element={<AiControlCenterPage />} />
                        <Route path="automation/playground" element={<AiPlaygroundPage />} />

                        {/* Products */}
                        <Route path="products" element={<ProductsListPage />} />
                        <Route path="products/mappings" element={<PostProductMappingPage />} />

                        {/* Lead CRM */}
                        <Route path="leads" element={<LeadsListPage />} />
                        <Route path="leads/followups" element={<FollowupsPage />} />
                        <Route path="customers" element={<CustomersPage />} />
                        <Route path="orders" element={<OrdersPage />} />

                        {/* SMS Gateway & Marketing */}
                        <Route path="sms/gateway" element={<SmsGatewayPage />} />
                        <Route path="sms/marketing" element={<SmsMarketingPage />} />
                        <Route path="sms/auto-sms" element={<AutoSmsPage />} />

                        {/* Steadfast Courier */}
                        <Route path="courier/steadfast" element={<SteadfastPage />} />

                        {/* Team */}
                        <Route path="team" element={<TeamManagementPage />} />
                        <Route path="team/performance" element={<ModeratorPerformancePage />} />

                        {/* Analytics & System */}
                        <Route path="analytics" element={<AnalyticsPage />} />
                        <Route path="system/activity-logs" element={<ActivityLogsPage />} />
                        <Route path="system/webhooks" element={<WebhookDiagnosticsPage />} />
                        <Route path="system/security" element={<SecuritySettingsPage />} />
                        <Route path="settings/notifications" element={<NotificationSoundSettingsPage />} />
                        <Route path="profile" element={<ProfilePage />} />

                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    </ThemeProvider>
);
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}

