import React, { useEffect } from 'react';
import { Redirect, Route, useHistory } from 'react-router-dom';
import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Theme variables */
import './theme/variables.css';
import './theme/dark-theme-fixes.css';

/* Pages */
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';



import SimpleFaceScanner from './pages/SimpleFaceScanner';

import PerformanceComparison from './pages/PerformanceComparison';
import SystemTest from './pages/SystemTest';

import AdminDashboard from './pages/AdminDashboard';
import MemberManagement from './pages/MemberManagement';
import AttendanceLogs from './pages/AttendanceLogs';
import AdminSettings from './pages/AdminSettings';

/* Guards */
import AuthGuard from './guards/AuthGuard';
import AdminGuard from './guards/AdminGuard';

/* Contexts */
import { OrganizationProvider } from './contexts/OrganizationContext';

setupIonicReact({
  rippleEffect: true,
  mode: 'md',
  innerHTMLTemplatesEnabled: true
});

const AppContent: React.FC = () => {
  const history = useHistory();

  useEffect(() => {
    // Listen for deep link from Custom Tabs OAuth callback
    const listener = CapacitorApp.addListener('appUrlOpen', async (event: any) => {
      console.log('🔗 Deep link received:', event.url);

      try {
        // Close Custom Tabs browser
        await Browser.close();
        console.log('✅ Browser closed');
      } catch (error) {
        console.log('ℹ️ Browser already closed');
      }

      // Parse deep link: com.facecheck.app://auth/callback#access_token=...
      const urlString = event.url;

      // Check if this is an OAuth callback URL
      if (urlString.includes('auth/callback') || urlString.includes('auth#')) {
        console.log('✅ OAuth callback detected');

        // Extract hash manually (URL parser may not work properly with custom schemes)
        const hashIndex = urlString.indexOf('#');
        const hash = hashIndex !== -1 ? urlString.substring(hashIndex) : '';

        console.log('📦 Hash from deep link:', hash);

        if (hash && hash.length > 1) {
          // Store hash in sessionStorage
          console.log('💾 Storing tokens in sessionStorage');
          sessionStorage.setItem('oauth_callback_hash', hash);

          // Dispatch custom event to trigger AuthPage processing
          console.log('📢 Dispatching oauth_callback event');
          window.dispatchEvent(new CustomEvent('oauth_callback', { detail: { hash } }));

          // Navigate to auth page if not already there
          console.log('🔄 Checking current path...');
          const currentPath = window.location.pathname;
          if (currentPath !== '/auth') {
            console.log('🔄 Navigating to /auth');
            history.replace('/auth');
          } else {
            console.log('✅ Already on /auth, event listener will handle processing');
          }
        } else {
          console.warn('⚠️ No hash found in deep link URL');
        }
      }
    });

    return () => {
      listener.remove();
    };
  }, [history]);

  return null;
};

const App: React.FC = () => (
  <IonApp>
    <OrganizationProvider>
      <IonReactRouter>
        <AppContent />
        <IonRouterOutlet>
        {/* Public Routes */}
        <Route exact path="/">
          <LandingPage />
        </Route>
        <Route exact path="/auth">
          <AuthPage />
        </Route>
        <Route exact path="/auth/callback">
          <AuthPage />
        </Route>

        {/* Protected Scanner Routes */}
        <Route exact path="/camera">
          <AuthGuard>
            <SimpleFaceScanner />
          </AuthGuard>
        </Route>

     

     

        <Route exact path="/simple-scanner">
          <AuthGuard>
            <SimpleFaceScanner />
          </AuthGuard>
        </Route>

      

        <Route exact path="/performance-test">
          <AuthGuard>
            <PerformanceComparison />
          </AuthGuard>
        </Route>

        <Route exact path="/system-test">
          <AuthGuard>
            <SystemTest />
          </AuthGuard>
        </Route>

        <Route exact path="/scanner">
          <Redirect to="/camera" />
        </Route>

        <Route exact path="/dashboard">
          <AuthGuard>
            <DashboardPage />
          </AuthGuard>
        </Route>

        {/* Protected Admin Routes */}
        <Route exact path="/admin/dashboard">
          <AuthGuard>
            <AdminGuard>
              <AdminDashboard />
            </AdminGuard>
          </AuthGuard>
        </Route>
        <Route exact path="/admin/members">
          <AuthGuard>
            <AdminGuard>
              <MemberManagement />
            </AdminGuard>
          </AuthGuard>
        </Route>
        <Route exact path="/admin/logs">
          <AuthGuard>
            <AdminGuard>
              <AttendanceLogs />
            </AdminGuard>
          </AuthGuard>
        </Route>
        <Route exact path="/admin/settings">
          <AuthGuard>
            <AdminGuard>
              <AdminSettings />
            </AdminGuard>
          </AuthGuard>
        </Route>
        <Route exact path="/admin">
          <Redirect to="/admin/dashboard" />
        </Route>

        {/* Fallback - redirect to auth */}
        <Route>
          <Redirect to="/auth" />
        </Route>
        </IonRouterOutlet>
      </IonReactRouter>
    </OrganizationProvider>
  </IonApp>
);

export default App;