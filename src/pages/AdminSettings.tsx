import React, { useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButton,
  IonIcon
} from '@ionic/react';
import { arrowBack } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useOrganization } from '../contexts/OrganizationContext';
import { AdminSettingsPanel } from '../components/AdminSettingsPanel';
import { settingsService } from '../services/settingsService';
import { LEGACY_ORGANIZATION_ID } from '../services/scannerSettings';

const AdminSettings: React.FC = () => {
  const history = useHistory();
  const { organization, user, isAuthenticated, isLegacyMode } = useOrganization();

  useEffect(() => {
    checkAuthAndInitialize();
  }, []);

  const checkAuthAndInitialize = async () => {
    try {
      // Check for unified session
      const sessionData = localStorage.getItem('FaceCheckSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.user && (session.organization || session.isLegacyMode)) {
          // Initialize settings table for organization
          if (session.organization?.id) {
            await settingsService.initializeSettingsTable();
          }
          return;
        }
      }

      // Check for legacy admin session
      const adminSession = localStorage.getItem('adminSession');
      if (adminSession) {
        const session = JSON.parse(adminSession);
        if (session.user) {
          // Initialize settings table for legacy mode
          await settingsService.initializeSettingsTable();
          return;
        }
      }

      // No valid session found, redirect to login
      history.push('/admin/login');
    } catch (error) {
      console.error('Error checking session:', error);
      history.push('/admin/login');
    }
  };

  const handleSettingsChange = (updatedSettings: any) => {
    console.log('Settings updated:', updatedSettings);
    // Optional: Trigger any additional actions when settings change
  };

  const getOrganizationId = () => {
    if (organization?.id) {
      return organization.id;
    }
    // For legacy mode, use the predefined legacy organization UUID
    return LEGACY_ORGANIZATION_ID;
  };

  const getCurrentUser = () => {
    return user?.email || user?.full_name || 'admin';
  };

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{
          '--background': 'var(--enterprise-surface-primary)',
          '--color': 'var(--ion-text-color)',
          '--border-color': 'var(--enterprise-border-subtle)',
          borderBottom: '1px solid var(--enterprise-border-subtle)'
        }}>
          <IonButton
            fill="clear"
            slot="start"
            onClick={() => history.push('/admin/dashboard')}
            style={{ '--color': 'var(--ion-color-primary)' }}
          >
            <IonIcon icon={arrowBack} />
          </IonButton>
  
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen style={{ '--background': 'var(--enterprise-surface-secondary)' }}>
        <div style={{ padding: '24px' }}>
          <AdminSettingsPanel
            organizationId={getOrganizationId()}
            currentUser={getCurrentUser()}
            onSettingsChange={handleSettingsChange}
          />
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AdminSettings;