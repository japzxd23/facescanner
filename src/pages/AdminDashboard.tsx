import React, { useEffect, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonButton,
  IonIcon,
  IonText,
  IonGrid,
  IonRow,
  IonCol,
  IonBadge,
  IonAlert
} from '@ionic/react';
import { people, analytics, personAdd, logOut, arrowBack, key, copy, scan } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { getMembers, getAttendanceLogs, setOrganizationContext } from '../services/supabaseClient';
import { useOrganization } from '../contexts/OrganizationContext';

const AdminDashboard: React.FC = () => {
  const history = useHistory();
  const { organization, user, isAuthenticated, isLegacyMode, clearSession } = useOrganization();
  const [stats, setStats] = useState({
    totalMembers: 0,
    vipMembers: 0,
    bannedMembers: 0,
    todayLogs: 0
  });
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertHeader, setAlertHeader] = useState('');

  useEffect(() => {
    // Check authentication and redirect if needed
    if (!isAuthenticated && !isLegacyMode) {
      history.push('/login');
      return;
    }

    // Set organization context if in SaaS mode
    if (!isLegacyMode && organization) {
      setOrganizationContext(organization.id);
    }

    loadStats();
  }, [isAuthenticated, isLegacyMode, organization, history]);

  const loadStats = async () => {
    try {
      const members = await getMembers();
      const logs = await getAttendanceLogs(100);

      const today = new Date().toDateString();
      const todayLogs = logs.filter(log =>
        new Date(log.timestamp).toDateString() === today
      );

      setStats({
        totalMembers: members.length,
        vipMembers: members.filter(m => m.status === 'VIP').length,
        bannedMembers: members.filter(m => m.status === 'Banned').length,
        todayLogs: todayLogs.length
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleLogout = () => {
    clearSession();
    if (isLegacyMode) {
      history.push('/admin/login');
    } else {
      history.push('/');
    }
  };

  const copyApiKey = () => {
    if (organization?.api_key) {
      navigator.clipboard.writeText(organization.api_key);
      setAlertHeader('Copied');
      setAlertMessage('API key copied to clipboard!');
      setShowAlert(true);
    }
  };

  const navigateToMembers = () => {
    history.push('/admin/members');
  };

  const navigateToLogs = () => {
    history.push('/admin/logs');
  };

  const navigateToCamera = () => {
    history.push('/camera');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{
          '--background': 'var(--enterprise-surface-primary)',
          '--color': 'var(--ion-text-color)',
          '--border-color': 'var(--enterprise-border-subtle)',
          borderBottom: '1px solid var(--enterprise-border-subtle)'
        }}>
          {!isLegacyMode && (
            <IonButton
              fill="clear"
              slot="start"
              onClick={() => history.push('/dashboard')}
              style={{ '--color': 'var(--ion-color-primary)' }}
            >
              <IonIcon icon={arrowBack} />
            </IonButton>
          )}
          <IonTitle style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: '600',
            color: 'var(--ion-text-color)'
          }}>
            {isLegacyMode ? 'Admin Dashboard' : `${organization?.name} - Admin`}
          </IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            onClick={handleLogout}
            style={{ '--color': 'var(--ion-color-medium)' }}
          >
            <IonIcon icon={logOut} />
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen style={{ '--background': 'var(--enterprise-surface-secondary)' }}>
        <div style={{ padding: '24px' }}>
          {/* Welcome section */}
          <IonCard className="enterprise-card">
            <IonCardContent style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h1 style={{
                    margin: '0 0 8px 0',
                    color: 'var(--ion-text-color)',
                    fontSize: '28px',
                    fontWeight: '800',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}>
                    {isLegacyMode ? 'Admin Dashboard' : `${organization?.name}`}
                  </h1>
                  <p style={{
                    margin: 0,
                    color: 'var(--ion-color-medium)',
                    fontSize: '16px',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}>
                    {user?.full_name || user?.email}
                  </p>
                </div>
                {!isLegacyMode && organization && (
                  <IonBadge
                    color="primary"
                    style={{
                      '--background': 'var(--ion-color-primary)',
                      '--color': 'white',
                      padding: '8px 16px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}
                  >
                    {organization.plan_type.charAt(0).toUpperCase() + organization.plan_type.slice(1)}
                  </IonBadge>
                )}
              </div>

              {!isLegacyMode && organization && (
                <div style={{
                  background: 'var(--enterprise-surface-tertiary)',
                  border: '1px solid var(--enterprise-border-medium)',
                  borderRadius: 'var(--enterprise-radius-lg)',
                  padding: '24px',
                  marginTop: '24px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{
                        color: 'var(--ion-color-primary)',
                        margin: '0 0 12px 0',
                        fontSize: '16px',
                        fontWeight: '700',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        🔑 API Key
                      </h3>
                      <code style={{
                        color: 'var(--ion-text-color)',
                        fontSize: '14px',
                        fontFamily: 'Monaco, monospace',
                        wordBreak: 'break-all',
                        background: 'var(--enterprise-surface-primary)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        display: 'block'
                      }}>
                        {organization.api_key}
                      </code>
                    </div>
                    <IonButton
                      fill="outline"
                      onClick={copyApiKey}
                      style={{
                        '--border-radius': 'var(--enterprise-radius-md)',
                        marginLeft: '16px'
                      }}
                    >
                      <IonIcon icon={copy} slot="start" />
                      Copy
                    </IonButton>
                  </div>
                  <p style={{
                    color: 'var(--ion-color-medium)',
                    fontSize: '14px',
                    margin: '12px 0 0 0',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}>
                    Use this key to configure your mobile scanner app
                  </p>
                </div>
              )}
            </IonCardContent>
          </IonCard>

          {/* Stats cards */}
          <IonGrid>
            <IonRow>
              <IonCol size="6">
                <IonCard className="enterprise-card">
                  <IonCardContent style={{ textAlign: 'center', padding: '24px' }}>
                    <IonIcon
                      icon={people}
                      style={{ fontSize: '40px', color: 'var(--ion-color-success)', marginBottom: '12px' }}
                    />
                    <h2 style={{
                      margin: '0 0 4px 0',
                      fontSize: '32px',
                      fontWeight: '800',
                      color: 'var(--ion-text-color)',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      {stats.totalMembers}
                    </h2>
                    <p style={{
                      margin: 0,
                      color: 'var(--ion-color-medium)',
                      fontSize: '14px',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      Total Members
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
              <IonCol size="6">
                <IonCard className="enterprise-card">
                  <IonCardContent style={{ textAlign: 'center', padding: '24px' }}>
                    <IonIcon
                      icon={analytics}
                      style={{ fontSize: '40px', color: 'var(--ion-color-primary)', marginBottom: '12px' }}
                    />
                    <h2 style={{
                      margin: '0 0 4px 0',
                      fontSize: '32px',
                      fontWeight: '800',
                      color: 'var(--ion-text-color)',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      {stats.todayLogs}
                    </h2>
                    <p style={{
                      margin: 0,
                      color: 'var(--ion-color-medium)',
                      fontSize: '14px',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      Today's Scans
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
            <IonRow>
              <IonCol size="6">
                <IonCard className="enterprise-card">
                  <IonCardContent style={{ textAlign: 'center', padding: '24px' }}>
                    <h2 style={{
                      margin: '0 0 4px 0',
                      fontSize: '32px',
                      fontWeight: '800',
                      color: 'var(--ion-color-tertiary)',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      {stats.vipMembers}
                    </h2>
                    <p style={{
                      margin: 0,
                      color: 'var(--ion-color-medium)',
                      fontSize: '14px',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      VIP Members
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
              <IonCol size="6">
                <IonCard className="enterprise-card">
                  <IonCardContent style={{ textAlign: 'center', padding: '24px' }}>
                    <h2 style={{
                      margin: '0 0 4px 0',
                      fontSize: '32px',
                      fontWeight: '800',
                      color: 'var(--ion-color-danger)',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      {stats.bannedMembers}
                    </h2>
                    <p style={{
                      margin: 0,
                      color: 'var(--ion-color-medium)',
                      fontSize: '14px',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      Banned Members
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
          </IonGrid>

          {/* Quick actions */}
          <IonCard className="enterprise-card">
            <IonCardHeader>
              <IonCardTitle style={{
                color: 'var(--ion-text-color)',
                fontSize: '20px',
                fontWeight: '700',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>
                Quick Actions
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <IonButton
                  expand="block"
                  color="primary"
                  onClick={navigateToCamera}
                  style={{
                    '--padding-top': '16px',
                    '--padding-bottom': '16px',
                    '--border-radius': 'var(--enterprise-radius-md)',
                    fontSize: '16px',
                    fontWeight: '600',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    textTransform: 'none'
                  }}
                >
                  <IonIcon icon={scan} slot="start" />
                  Start Face Scanner
                </IonButton>

                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={navigateToMembers}
                  style={{
                    '--border-radius': 'var(--enterprise-radius-md)',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontWeight: '600',
                    textTransform: 'none'
                  }}
                >
                  <IonIcon icon={people} slot="start" />
                  Manage Members
                </IonButton>

                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={navigateToLogs}
                  style={{
                    '--border-radius': 'var(--enterprise-radius-md)',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontWeight: '600',
                    textTransform: 'none'
                  }}
                >
                  <IonIcon icon={analytics} slot="start" />
                  View Attendance Logs
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>

          {/* System info */}
          <IonCard className="enterprise-card">
            <IonCardHeader>
              <IonCardTitle style={{
                color: 'var(--ion-text-color)',
                fontSize: '20px',
                fontWeight: '700',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>
                System Information
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent style={{ padding: '24px' }}>
              <div style={{
                fontSize: '15px',
                color: 'var(--ion-color-medium)',
                fontFamily: 'Inter, system-ui, sans-serif',
                lineHeight: '1.6'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span>Face Recognition:</span>
                  <span style={{ color: 'var(--ion-color-success)', fontWeight: '600' }}>Active</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span>Database:</span>
                  <span style={{ color: 'var(--ion-color-success)', fontWeight: '600' }}>Connected</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span>Mode:</span>
                  <span style={{ color: 'var(--ion-text-color)', fontWeight: '600' }}>
                    {isLegacyMode ? 'Legacy' : 'SaaS Multi-Tenant'}
                  </span>
                </div>
                {!isLegacyMode && organization && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span>Member Limit:</span>
                    <span style={{ color: 'var(--ion-text-color)', fontWeight: '600' }}>
                      {stats.totalMembers}/{organization.member_limit}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Last Updated:</span>
                  <span style={{ color: 'var(--ion-text-color)', fontWeight: '600' }}>
                    {new Date().toLocaleString()}
                  </span>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        </div>

        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header={alertHeader}
          message={alertMessage}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  );
};

export default AdminDashboard;