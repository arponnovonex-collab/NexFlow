import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppearanceProvider } from './context/AppearanceContext';
import { SipPhoneProvider } from './context/SipPhoneContext';
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
import { ProductAttributesPage } from './pages/products/ProductAttributesPage';
import { PostProductMappingPage } from './pages/products/PostProductMappingPage';
import { LeadsListPage } from './pages/leads/LeadsListPage';
import { FollowupsPage } from './pages/leads/FollowupsPage';
import { CustomersPage } from './pages/leads/CustomersPage';
import { OrdersPage } from './pages/leads/OrdersPage';
import { WebsiteOrdersPage } from './pages/leads/WebsiteOrdersPage';
import { ProblemFreeOrdersPage } from './pages/leads/ProblemFreeOrdersPage';
import { CxOperationsPage } from './pages/leads/CxOperationsPage';
import { OrderSummaryPage } from './pages/leads/OrderSummaryPage';
import { TeamManagementPage } from './pages/team/TeamManagementPage';
import { ModeratorPerformancePage } from './pages/team/ModeratorPerformancePage';
import { AnalyticsPage } from './pages/analytics/AnalyticsPage';
import { ActivityLogsPage } from './pages/system/ActivityLogsPage';
import { WebhookDiagnosticsPage } from './pages/system/WebhookDiagnosticsPage';
import { SecuritySettingsPage } from './pages/system/SecuritySettingsPage';
import { DisplayAccessibilityPage } from './pages/system/DisplayAccessibilityPage';
import { AppearancePage } from './pages/system/AppearancePage';
import { MediaLibraryPage } from './pages/media/MediaLibraryPage';
import { MediaUploadPage } from './pages/media/MediaUploadPage';
import { SavedMessagesPage } from './pages/shortcuts/SavedMessagesPage';
import { NotificationSoundSettingsPage } from './pages/settings/NotificationSoundSettingsPage';
import { ProfilePage } from './pages/profile/ProfilePage';
import { SmsGatewayPage } from './pages/sms/SmsGatewayPage';
import { SmsMarketingPage } from './pages/sms/SmsMarketingPage';
import { AutoSmsPage } from './pages/sms/AutoSmsPage';
import { SteadfastPage } from './pages/courier/SteadfastPage';
import { CallCenterConfigPage } from './pages/call-center/CallCenterConfigPage';
import { IpCallPage } from './pages/call-center/IpCallPage';
import { CallRecordingsPage } from './pages/call-center/CallRecordingsPage';
import { AiOrderConfirmationPage } from './pages/call-center/AiOrderConfirmationPage';

// Smart Index Route Handler that retains Inbox or active page on browser refresh
const IndexRouteHandler = () => {
    const savedPath = typeof window !== 'undefined' ? sessionStorage.getItem('nexflow_current_path') : null;
    if (savedPath && savedPath !== '/' && savedPath !== '/dashboard') {
        return <Navigate to={savedPath} replace />;
    }
    return <Navigate to="/dashboard" replace />;
};

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
            <AppearanceProvider>
                <AuthProvider>
                    <SipPhoneProvider>
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
                            <Route index element={<IndexRouteHandler />} />
                            <Route path="dashboard" element={<DashboardPage />} />
                            <Route path="inbox" element={<UnifiedInboxPage />} />
                            <Route path="shortcuts/saved-sms" element={<SavedMessagesPage />} />
                            <Route path="shortcuts/saved-messages" element={<SavedMessagesPage />} />
                            <Route path="connections" element={<SocialConnectionsPage />} />
                            <Route path="connections/diagnostics" element={<SocialConnectionsPage />} />

                            {/* Media Library (WordPress Style) */}
                            <Route path="media" element={<MediaLibraryPage />} />
                            <Route path="media/upload" element={<MediaUploadPage />} />

                            {/* Appearance & Branding */}
                            <Route path="appearance" element={<AppearancePage />} />

                            {/* AI Automation */}
                            <Route path="automation/comments" element={<CommentAutomationPage />} />
                            <Route path="automation/rules" element={<AutomationRulesPage />} />
                            <Route path="automation/ai-control" element={<AiControlCenterPage />} />
                            <Route path="automation/playground" element={<AiPlaygroundPage />} />

                            {/* Products */}
                            <Route path="products" element={<ProductsListPage />} />
                            <Route path="products/attributes" element={<ProductAttributesPage />} />
                            <Route path="products/mappings" element={<PostProductMappingPage />} />

                            {/* Lead CRM */}
                            <Route path="leads" element={<LeadsListPage />} />
                            <Route path="leads/followups" element={<FollowupsPage />} />
                            {/* Customer Orders */}
                            <Route path="customers" element={<CustomersPage />} />
                            <Route path="orders" element={<Navigate to="/orders/engagement" replace />} />
                            <Route path="orders/engagement" element={<OrdersPage />} />
                            <Route path="orders/website" element={<WebsiteOrdersPage />} />
                            <Route path="orders/problem-free" element={<ProblemFreeOrdersPage />} />
                            <Route path="orders/ai-confirmation" element={<AiOrderConfirmationPage />} />
                            <Route path="orders/cx-operations" element={<CxOperationsPage />} />
                            <Route path="orders/summary" element={<OrderSummaryPage />} />

                            {/* SMS Gateway & Marketing */}
                            <Route path="sms/gateway" element={<SmsGatewayPage />} />
                            <Route path="sms/marketing" element={<SmsMarketingPage />} />
                            <Route path="sms/auto-sms" element={<AutoSmsPage />} />

                            {/* Steadfast Courier */}
                            <Route path="courier/steadfast" element={<SteadfastPage />} />

                            {/* Call Center (ePBX.bd) */}
                            <Route path="call-center/configuration" element={<CallCenterConfigPage />} />
                            <Route path="call-center/ai-confirmation" element={<AiOrderConfirmationPage />} />
                            <Route path="ai-order-confirmation" element={<AiOrderConfirmationPage />} />
                            <Route path="call-center/ip-call" element={<IpCallPage />} />
                            <Route path="call-center/recordings" element={<CallRecordingsPage />} />

                            {/* Team */}
                            <Route path="team" element={<TeamManagementPage />} />
                            <Route path="team/performance" element={<ModeratorPerformancePage />} />

                            {/* Analytics & System */}
                            <Route path="analytics" element={<AnalyticsPage />} />
                            <Route path="system/activity-logs" element={<ActivityLogsPage />} />
                            <Route path="system/webhooks" element={<WebhookDiagnosticsPage />} />
                            <Route path="system/security" element={<SecuritySettingsPage />} />
                            <Route path="system/display" element={<DisplayAccessibilityPage />} />
                            <Route path="settings/notifications" element={<NotificationSoundSettingsPage />} />
                            <Route path="profile" element={<ProfilePage />} />

                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Route>
                    </Routes>
                </BrowserRouter>
            </SipPhoneProvider>
        </AuthProvider>
    </AppearanceProvider>
</ThemeProvider>
);
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}

