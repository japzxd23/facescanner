import React, { useEffect } from 'react';
import { Redirect, Route, useHistory } from 'react-router-dom';
import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { App as CapacitorApp } from '@capacitor/app';

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
    // Listen for deep link events from OAuth redirect
    const listener = CapacitorApp.addListener('appUrlOpen', (event: any) => {
      console.log('🔗 Deep link received:', event.url);

      // Parse deep link: com.FaceCheck.app://auth/callback#access_token=...
      const url = new URL(event.url);

      // Extract hash parameters from deep link
      const hash = url.hash;

      if (url.pathname === '//auth/callback' || url.pathname === '/auth/callback') {
        // Navigate to auth callback page with hash params
        history.push(`/auth/callback${hash}`);
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