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
        <IonToolbar style={{ '--background': '#1a1d29', '--color': '#e2e8f0' }}>
          {!isLegacyMode && (
            <IonButton
              fill="clear"
              slot="start"
              onClick={() => history.push('/dashboard')}
              style={{ '--color': '#3b82f6' }}
            >
              <IonIcon icon={arrowBack} />
            </IonButton>
          )}
          <IonTitle>
            {isLegacyMode ? 'Admin Dashboard' : `${organization?.name} - Admin`}
          </IonTitle>
          <IonButton
            slot="end"
            fill="clear"
            onClick={handleLogout}
            style={{ '--color': '#e2e8f0' }}
          >
            <IonIcon icon={logOut} />
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen style={{ '--background': '#0f1419' }}>
        <div style={{ padding: '20px' }}>
          {/* Welcome section */}
          <IonCard className="clean-card">
            <IonCardContent>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h1 style={{ margin: '0 0 8px 0', color: '#e2e8f0' }}>
                    {isLegacyMode ? 'Admin Dashboard' : `${organization?.name}`}
                  </h1>
                  <p style={{ margin: 0, color: '#9ca3af' }}>
                    {user?.full_name || user?.email}
                  </p>
                </div>
                {!isLegacyMode && organization && (
                  <IonBadge color="primary">
                    {organization.plan_type.charAt(0).toUpperCase() + organization.plan_type.slice(1)}
                  </IonBadge>
                )}
              </div>

              {!isLegacyMode && organization && (
                <div style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginTop: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ color: '#3b82f6', margin: '0 0 8px 0', fontSize: '14px' }}>
                        API Key
                      </h3>
                      <code style={{
                        color: '#e2e8f0',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        wordBreak: 'break-all'
                      }}>
                        {organization.api_key}
                      </code>
                    </div>
                    <IonButton fill="clear" onClick={copyApiKey}>
                      <IonIcon icon={copy} color="primary" />
                    </IonButton>
                  </div>
                  <p style={{ color: '#9ca3af', fontSize: '12px', margin: '8px 0 0 0' }}>
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
                <IonCard className="admin-card">
                  <IonCardContent style={{ textAlign: 'center' }}>
                    <IonIcon 
                      icon={people} 
                      style={{ fontSize: '2em', color: '#10b981' }}
                    />
                    <h2 style={{ margin: '10px 0 5px 0' }}>
                      {stats.totalMembers}
                    </h2>
                    <p style={{ margin: 0, color: '#666' }}>Total Members</p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
              <IonCol size="6">
                <IonCard className="admin-card">
                  <IonCardContent style={{ textAlign: 'center' }}>
                    <IonIcon 
                      icon={analytics} 
                      style={{ fontSize: '2em', color: '#3b82f6' }}
                    />
                    <h2 style={{ margin: '10px 0 5px 0' }}>
                      {stats.todayLogs}
                    </h2>
                    <p style={{ margin: 0, color: '#666' }}>Today's Scans</p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
            <IonRow>
              <IonCol size="6">
                <IonCard className="admin-card">
                  <IonCardContent style={{ textAlign: 'center' }}>
                    <IonText color="tertiary">
                      <h2 style={{ margin: '10px 0 5px 0' }}>
                        {stats.vipMembers}
                      </h2>
                    </IonText>
                    <p style={{ margin: 0, color: '#666' }}>VIP Members</p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
              <IonCol size="6">
                <IonCard className="admin-card">
                  <IonCardContent style={{ textAlign: 'center' }}>
                    <IonText color="danger">
                      <h2 style={{ margin: '10px 0 5px 0' }}>
                        {stats.bannedMembers}
                      </h2>
                    </IonText>
                    <p style={{ margin: 0, color: '#666' }}>Banned Members</p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
          </IonGrid>

          {/* Quick actions */}
          <IonCard className="clean-card">
            <IonCardHeader>
              <IonCardTitle>Quick Actions</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <IonButton
                  expand="block"
                  color="primary"
                  onClick={navigateToCamera}
                  style={{
                    '--padding-top': '16px',
                    '--padding-bottom': '16px',
                    fontSize: '16px',
                    fontWeight: '600'
                  }}
                >
                  <IonIcon icon={scan} slot="start" />
                  Start Face Scanner
                </IonButton>

                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={navigateToMembers}
                >
                  <IonIcon icon={people} slot="start" />
                  Manage Members
                </IonButton>

                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={navigateToLogs}
                >
                  <IonIcon icon={analytics} slot="start" />
                  View Attendance Logs
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>

          {/* System info */}
          <IonCard className="clean-card">
            <IonCardHeader>
              <IonCardTitle style={{ color: '#e2e8f0' }}>System Information</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <div style={{ fontSize: '0.9em', color: '#9ca3af' }}>
                <p>Face Recognition: Active</p>
                <p>Database: Connected</p>
                <p>Mode: {isLegacyMode ? 'Legacy' : 'SaaS Multi-Tenant'}</p>
                {!isLegacyMode && organization && (
                  <p>Member Limit: {stats.totalMembers}/{organization.member_limit}</p>
                )}
                <p>Last Updated: {new Date().toLocaleString()}</p>
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