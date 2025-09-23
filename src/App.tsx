import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonRouterOutlet,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

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
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CameraScanner from './pages/CameraScanner';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import MemberManagement from './pages/MemberManagement';
import AttendanceLogs from './pages/AttendanceLogs';

/* Contexts */
import { OrganizationProvider } from './contexts/OrganizationContext';

setupIonicReact();

const App: React.FC = () => (
  <IonApp>
    <OrganizationProvider>
      <IonReactRouter>
        <IonRouterOutlet>
        {/* SaaS Landing and Auth Routes */}
        <Route exact path="/">
          <LandingPage />
        </Route>
        <Route exact path="/signup">
          <SignupPage />
        </Route>
        <Route exact path="/login">
          <LoginPage />
        </Route>
        <Route exact path="/dashboard">
          <DashboardPage />
        </Route>

        {/* Scanner Routes */}
        <Route exact path="/camera">
          <CameraScanner />
        </Route>
        <Route exact path="/scanner">
          <Redirect to="/camera" />
        </Route>

        {/* Legacy Admin Routes (kept for backwards compatibility) */}
        <Route exact path="/admin/login">
          <AdminLogin />
        </Route>
        <Route exact path="/admin/dashboard">
          <AdminDashboard />
        </Route>
        <Route exact path="/admin/members">
          <MemberManagement />
        </Route>
        <Route exact path="/admin/logs">
          <AttendanceLogs />
        </Route>
        <Route exact path="/admin">
          <Redirect to="/admin/dashboard" />
        </Route>
        </IonRouterOutlet>
      </IonReactRouter>
    </OrganizationProvider>
  </IonApp>
);

export default App;