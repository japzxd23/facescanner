import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonGrid,
  IonRow,
  IonCol,
  IonItem,
  IonLabel,
  IonBadge,
  IonText,
  IonAlert,
  IonRefresher,
  IonRefresherContent,
  IonFab,
  IonFabButton,
  IonActionSheet
} from '@ionic/react';
import {
  logOut,
  people,
  analytics,
  key,
  copy,
  scan,
  refresh,
  settings,
  add,
  download,
  qrCode
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

interface SessionData {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: string;
  };
  organization: {
    id: string;
    name: string;
    subdomain: string;
    api_key: string;
    plan_type: string;
    member_limit: number;
    is_active: boolean;
  };
}

interface Stats {
  totalMembers: number;
  totalScans: number;
  todayScans: number;
  activeDays: number;
}

const DashboardPage: React.FC = () => {
  const history = useHistory();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [stats, setStats] = useState<Stats>({ totalMembers: 0, totalScans: 0, todayScans: 0, activeDays: 0 });
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertHeader, setAlertHeader] = useState('');
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [recentMembers, setRecentMembers] = useState<any[]>([]);

  useEffect(() => {
    // Check for session data
    const sessionJson = localStorage.getItem('membershipScanSession');
    if (!sessionJson) {
      history.push('/login');
      return;
    }

    try {
      const session = JSON.parse(sessionJson);
      setSessionData(session);
      loadDashboardData(session.organization.id);
    } catch (error) {
      console.error('Invalid session data:', error);
      history.push('/login');
    }
  }, [history]);

  const loadDashboardData = async (organizationId: string) => {
    try {
      // Load organization statistics
      const { data: orgStats } = await supabase
        .from('organization_statistics')
        .select('*')
        .eq('id', organizationId)
        .single();

      if (orgStats) {
        setStats({
          totalMembers: orgStats.current_members || 0,
          totalScans: orgStats.total_scans || 0,
          todayScans: 0, // Will be calculated from today's attendance
          activeDays: orgStats.active_days || 0
        });
      }

      // Load today's scans
      const today = new Date().toISOString().split('T')[0];
      const { data: todayAttendance } = await supabase
        .from('attendance_logs')
        .select('id')
        .eq('organization_id', organizationId)
        .gte('timestamp', today + 'T00:00:00.000Z')
        .lt('timestamp', today + 'T23:59:59.999Z');

      if (todayAttendance) {
        setStats(prev => ({ ...prev, todayScans: todayAttendance.length }));
      }

      // Load recent members
      const { data: members } = await supabase
        .from('members')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (members) {
        setRecentMembers(members);
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('membershipScanSession');
    history.push('/');
  };

  const copyApiKey = () => {
    if (sessionData) {
      navigator.clipboard.writeText(sessionData.organization.api_key);
      setAlertMessage('API key copied to clipboard!');
      setAlertHeader('Copied');
      setShowAlert(true);
    }
  };

  const refreshData = async (event?: any) => {
    if (sessionData) {
      await loadDashboardData(sessionData.organization.id);
    }
    if (event) {
      event.detail.complete();
    }
  };

  const goToScanner = () => {
    history.push('/camera');
  };

  const getPlanColor = (planType: string) => {
    switch (planType) {
      case 'free': return 'medium';
      case 'pro': return 'primary';
      case 'enterprise': return 'tertiary';
      default: return 'medium';
    }
  };

  const getPlanName = (planType: string) => {
    return planType.charAt(0).toUpperCase() + planType.slice(1);
  };

  if (!sessionData) {
    return <IonPage><IonContent></IonContent></IonPage>;
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': '#1a1d29' }}>
          <IonTitle style={{ color: '#e2e8f0' }}>
            {sessionData.organization.name}
          </IonTitle>
          <IonButton
            fill="clear"
            slot="end"
            onClick={handleLogout}
            color="medium"
          >
            <IonIcon icon={logOut} />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen style={{ '--background': '#0f1419' }}>
        <IonRefresher slot="fixed" onIonRefresh={refreshData}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <div style={{ padding: '20px' }}>
          {/* Welcome Section */}
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ color: '#e2e8f0', margin: '0 0 8px 0', fontSize: '28px' }}>
              Welcome back, {sessionData.user.full_name}
            </h1>
            <p style={{ color: '#9ca3af', margin: '0 0 20px 0' }}>
              Here's your organization overview
            </p>

            {/* Prominent Start Scanning Button */}
            <IonButton
              expand="block"
              size="large"
              color="primary"
              onClick={goToScanner}
              style={{
                '--padding-top': '16px',
                '--padding-bottom': '16px',
                '--border-radius': '12px',
                fontSize: '18px',
                fontWeight: '600',
                marginBottom: '20px'
              }}
            >
              <IonIcon icon={scan} slot="start" style={{ fontSize: '24px' }} />
              Start Face Scanning
            </IonButton>
          </div>

          {/* Stats Grid */}
          <IonGrid style={{ padding: 0 }}>
            <IonRow>
              <IonCol size="6">
                <IonCard className="clean-card" style={{ margin: '8px' }}>
                  <IonCardContent style={{ textAlign: 'center', padding: '20px' }}>
                    <IonIcon icon={people} style={{ fontSize: '32px', color: '#3b82f6', marginBottom: '12px' }} />
                    <h2 style={{ color: '#e2e8f0', margin: '0 0 4px 0', fontSize: '24px' }}>
                      {stats.totalMembers}
                    </h2>
                    <p style={{ color: '#9ca3af', margin: 0, fontSize: '14px' }}>
                      Total Members
                    </p>
                    <p style={{ color: '#6b7280', margin: '4px 0 0 0', fontSize: '12px' }}>
                      Limit: {sessionData.organization.member_limit}
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>

              <IonCol size="6">
                <IonCard className="clean-card" style={{ margin: '8px' }}>
                  <IonCardContent style={{ textAlign: 'center', padding: '20px' }}>
                    <IonIcon icon={analytics} style={{ fontSize: '32px', color: '#059669', marginBottom: '12px' }} />
                    <h2 style={{ color: '#e2e8f0', margin: '0 0 4px 0', fontSize: '24px' }}>
                      {stats.todayScans}
                    </h2>
                    <p style={{ color: '#9ca3af', margin: 0, fontSize: '14px' }}>
                      Today's Scans
                    </p>
                    <p style={{ color: '#6b7280', margin: '4px 0 0 0', fontSize: '12px' }}>
                      Total: {stats.totalScans}
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
          </IonGrid>

          {/* Organization Info */}
          <IonCard className="clean-card">
            <IonCardHeader>
              <IonCardTitle style={{ color: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                Organization Details
                <IonBadge color={getPlanColor(sessionData.organization.plan_type)}>
                  {getPlanName(sessionData.organization.plan_type)}
                </IonBadge>
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonItem style={{ '--background': 'transparent' }} lines="none">
                <IonLabel>
                  <h3 style={{ color: '#e2e8f0' }}>Subdomain</h3>
                  <p style={{ color: '#9ca3af' }}>{sessionData.organization.subdomain}.membershipscan.com</p>
                </IonLabel>
              </IonItem>

              <IonItem style={{ '--background': 'transparent' }} lines="none">
                <IonLabel>
                  <h3 style={{ color: '#e2e8f0' }}>API Key</h3>
                  <p style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>
                    {sessionData.organization.api_key}
                  </p>
                </IonLabel>
                <IonButton fill="clear" slot="end" onClick={copyApiKey}>
                  <IonIcon icon={copy} color="primary" />
                </IonButton>
              </IonItem>
            </IonCardContent>
          </IonCard>

          {/* Recent Members */}
          {recentMembers.length > 0 && (
            <IonCard className="clean-card">
              <IonCardHeader>
                <IonCardTitle style={{ color: '#e2e8f0' }}>Recent Members</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                {recentMembers.map((member, index) => (
                  <IonItem key={index} style={{ '--background': 'transparent' }} lines={index < recentMembers.length - 1 ? 'inset' : 'none'}>
                    <IonLabel>
                      <h3 style={{ color: '#e2e8f0' }}>{member.name}</h3>
                      <p style={{ color: '#9ca3af' }}>
                        Status: <span className={`status-${member.status}`}>{member.status}</span>
                      </p>
                    </IonLabel>
                    <IonText slot="end" style={{ color: '#6b7280', fontSize: '12px' }}>
                      {new Date(member.created_at).toLocaleDateString()}
                    </IonText>
                  </IonItem>
                ))}
              </IonCardContent>
            </IonCard>
          )}

          {/* Quick Actions */}
          <IonCard className="clean-card">
            <IonCardHeader>
              <IonCardTitle style={{ color: '#e2e8f0' }}>Quick Actions</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <IonGrid style={{ padding: 0 }}>
                <IonRow>
                  <IonCol size="6">
                    <IonButton
                      expand="block"
                      fill="outline"
                      color="primary"
                      onClick={goToScanner}
                    >
                      <IonIcon icon={scan} slot="start" />
                      Open Scanner
                    </IonButton>
                  </IonCol>
                  <IonCol size="6">
                    <IonButton
                      expand="block"
                      fill="outline"
                      color="secondary"
                      onClick={() => history.push('/admin')}
                    >
                      <IonIcon icon={settings} slot="start" />
                      Manage
                    </IonButton>
                  </IonCol>
                </IonRow>
              </IonGrid>
            </IonCardContent>
          </IonCard>

          {/* Usage Progress */}
          <IonCard className="clean-card">
            <IonCardHeader>
              <IonCardTitle style={{ color: '#e2e8f0' }}>Usage</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#9ca3af', fontSize: '14px' }}>Members</span>
                  <span style={{ color: '#e2e8f0', fontSize: '14px' }}>
                    {stats.totalMembers} / {sessionData.organization.member_limit}
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(107, 114, 128, 0.3)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${(stats.totalMembers / sessionData.organization.member_limit) * 100}%`,
                    height: '100%',
                    background: stats.totalMembers >= sessionData.organization.member_limit ? '#dc2626' : '#3b82f6',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {stats.totalMembers >= sessionData.organization.member_limit && (
                <div style={{
                  background: 'rgba(220, 38, 38, 0.1)',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginTop: '12px'
                }}>
                  <p style={{ color: '#fca5a5', fontSize: '14px', margin: 0 }}>
                    <strong>Member limit reached!</strong> Upgrade your plan to add more members.
                  </p>
                </div>
              )}
            </IonCardContent>
          </IonCard>
        </div>

        {/* Floating Action Button */}
        <IonFab vertical="bottom" horizontal="end" slot="fixed">
          <IonFabButton color="primary" onClick={() => setShowActionSheet(true)}>
            <IonIcon icon={add} />
          </IonFabButton>
        </IonFab>

        <IonActionSheet
          isOpen={showActionSheet}
          onDidDismiss={() => setShowActionSheet(false)}
          buttons={[
            {
              text: 'Add Member',
              icon: people,
              handler: () => {
                history.push('/admin');
              }
            },
            {
              text: 'Open Scanner',
              icon: scan,
              handler: () => {
                history.push('/camera');
              }
            },
            {
              text: 'Generate QR Code',
              icon: qrCode,
              handler: () => {
                // TODO: Implement QR code generation for API key
              }
            },
            {
              text: 'Download API Guide',
              icon: download,
              handler: () => {
                // TODO: Implement API documentation download
              }
            },
            {
              text: 'Cancel',
              role: 'cancel'
            }
          ]}
        />

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

export default DashboardPage;