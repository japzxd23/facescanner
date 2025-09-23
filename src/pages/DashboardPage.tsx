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
        <IonToolbar style={{
          '--background': 'var(--enterprise-surface-primary)',
          '--color': 'var(--ion-text-color)',
          '--border-color': 'var(--enterprise-border-subtle)',
          borderBottom: '1px solid var(--enterprise-border-subtle)'
        }}>
          <IonTitle style={{
            color: 'var(--ion-text-color)',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontWeight: '600'
          }}>
            {sessionData.organization.name}
          </IonTitle>
          <IonButton
            fill="clear"
            slot="end"
            onClick={handleLogout}
            style={{ '--color': 'var(--ion-color-medium)' }}
          >
            <IonIcon icon={logOut} />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen style={{ '--background': 'var(--enterprise-surface-secondary)' }}>
        <IonRefresher slot="fixed" onIonRefresh={refreshData}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <div style={{ padding: '24px' }}>
          {/* Welcome Section */}
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{
              color: 'var(--ion-text-color)',
              margin: '0 0 8px 0',
              fontSize: '32px',
              fontWeight: '800',
              fontFamily: 'Inter, system-ui, sans-serif',
              letterSpacing: '-0.02em'
            }}>
              Welcome back, {sessionData.user.full_name}
            </h1>
            <p style={{
              color: 'var(--ion-color-medium)',
              margin: '0 0 24px 0',
              fontSize: '16px',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              Here's your organization overview
            </p>

            {/* Prominent Start Scanning Button */}
            <IonButton
              expand="block"
              size="large"
              color="primary"
              onClick={goToScanner}
              style={{
                '--padding-top': '20px',
                '--padding-bottom': '20px',
                '--border-radius': 'var(--enterprise-radius-lg)',
                fontSize: '18px',
                fontWeight: '700',
                fontFamily: 'Inter, system-ui, sans-serif',
                textTransform: 'none',
                marginBottom: '24px',
                boxShadow: 'var(--enterprise-shadow-lg)'
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
                <IonCard className="enterprise-card" style={{ margin: '8px' }}>
                  <IonCardContent style={{ textAlign: 'center', padding: '24px' }}>
                    <IonIcon icon={people} style={{
                      fontSize: '40px',
                      color: 'var(--ion-color-primary)',
                      marginBottom: '16px'
                    }} />
                    <h2 style={{
                      color: 'var(--ion-text-color)',
                      margin: '0 0 4px 0',
                      fontSize: '28px',
                      fontWeight: '800',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      {stats.totalMembers}
                    </h2>
                    <p style={{
                      color: 'var(--ion-color-medium)',
                      margin: 0,
                      fontSize: '14px',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      Total Members
                    </p>
                    <p style={{
                      color: 'var(--ion-color-medium)',
                      margin: '4px 0 0 0',
                      fontSize: '12px',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      Limit: {sessionData.organization.member_limit}
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>

              <IonCol size="6">
                <IonCard className="enterprise-card" style={{ margin: '8px' }}>
                  <IonCardContent style={{ textAlign: 'center', padding: '24px' }}>
                    <IonIcon icon={analytics} style={{
                      fontSize: '40px',
                      color: 'var(--ion-color-success)',
                      marginBottom: '16px'
                    }} />
                    <h2 style={{
                      color: 'var(--ion-text-color)',
                      margin: '0 0 4px 0',
                      fontSize: '28px',
                      fontWeight: '800',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      {stats.todayScans}
                    </h2>
                    <p style={{
                      color: 'var(--ion-color-medium)',
                      margin: 0,
                      fontSize: '14px',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      Today's Scans
                    </p>
                    <p style={{
                      color: 'var(--ion-color-medium)',
                      margin: '4px 0 0 0',
                      fontSize: '12px',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      Total: {stats.totalScans}
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
          </IonGrid>

          {/* Organization Info */}
          <IonCard className="enterprise-card">
            <IonCardHeader>
              <IonCardTitle style={{
                color: 'var(--ion-text-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: '700'
              }}>
                Organization Details
                <IonBadge
                  color={getPlanColor(sessionData.organization.plan_type)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '600',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}
                >
                  {getPlanName(sessionData.organization.plan_type)}
                </IonBadge>
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{
                  color: 'var(--ion-text-color)',
                  fontSize: '16px',
                  fontWeight: '600',
                  margin: '0 0 8px 0',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}>
                  Subdomain
                </h3>
                <p style={{
                  color: 'var(--ion-color-medium)',
                  margin: 0,
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}>
                  {sessionData.organization.subdomain}.membershipscan.com
                </p>
              </div>

              <div style={{
                background: 'var(--enterprise-surface-tertiary)',
                borderRadius: 'var(--enterprise-radius-lg)',
                padding: '20px',
                border: '1px solid var(--enterprise-border-subtle)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      color: 'var(--ion-text-color)',
                      fontSize: '16px',
                      fontWeight: '600',
                      margin: '0 0 8px 0',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      API Key
                    </h3>
                    <code style={{
                      color: 'var(--ion-color-medium)',
                      fontFamily: 'Monaco, monospace',
                      fontSize: '13px',
                      wordBreak: 'break-all',
                      lineHeight: '1.4'
                    }}>
                      {sessionData.organization.api_key}
                    </code>
                  </div>
                  <IonButton
                    fill="clear"
                    onClick={copyApiKey}
                    style={{
                      '--color': 'var(--ion-color-primary)',
                      marginLeft: '16px'
                    }}
                  >
                    <IonIcon icon={copy} />
                  </IonButton>
                </div>
              </div>
            </IonCardContent>
          </IonCard>

          {/* Recent Members */}
          {recentMembers.length > 0 && (
            <IonCard className="enterprise-card">
              <IonCardHeader>
                <IonCardTitle style={{
                  color: 'var(--ion-text-color)',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: '700'
                }}>
                  Recent Members
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent style={{ padding: '0' }}>
                {recentMembers.map((member, index) => (
                  <IonItem
                    key={index}
                    style={{ '--background': 'transparent' }}
                    lines={index < recentMembers.length - 1 ? 'inset' : 'none'}
                  >
                    <IonLabel>
                      <h3 style={{
                        color: 'var(--ion-text-color)',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontWeight: '600'
                      }}>
                        {member.name}
                      </h3>
                      <p style={{
                        color: 'var(--ion-color-medium)',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        Status: <span className={`status-${member.status.toLowerCase()}`}>{member.status}</span>
                      </p>
                    </IonLabel>
                    <IonText slot="end" style={{
                      color: 'var(--ion-color-medium)',
                      fontSize: '12px',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      {new Date(member.created_at).toLocaleDateString()}
                    </IonText>
                  </IonItem>
                ))}
              </IonCardContent>
            </IonCard>
          )}

          {/* Quick Actions */}
          <IonCard className="enterprise-card">
            <IonCardHeader>
              <IonCardTitle style={{
                color: 'var(--ion-text-color)',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: '700'
              }}>
                Quick Actions
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent style={{ padding: '24px' }}>
              <IonGrid style={{ padding: 0 }}>
                <IonRow>
                  <IonCol size="6">
                    <IonButton
                      expand="block"
                      fill="outline"
                      color="primary"
                      onClick={goToScanner}
                      style={{
                        '--border-radius': 'var(--enterprise-radius-md)',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontWeight: '600',
                        textTransform: 'none'
                      }}
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
                      style={{
                        '--border-radius': 'var(--enterprise-radius-md)',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontWeight: '600',
                        textTransform: 'none'
                      }}
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
          <IonCard className="enterprise-card">
            <IonCardHeader>
              <IonCardTitle style={{
                color: 'var(--ion-text-color)',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: '700'
              }}>
                Usage
              </IonCardTitle>
            </IonCardHeader>
            <IonCardContent style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}>
                  <span style={{
                    color: 'var(--ion-color-medium)',
                    fontSize: '14px',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}>
                    Members
                  </span>
                  <span style={{
                    color: 'var(--ion-text-color)',
                    fontSize: '14px',
                    fontWeight: '600',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}>
                    {stats.totalMembers} / {sessionData.organization.member_limit}
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: 'var(--enterprise-border-medium)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${Math.min((stats.totalMembers / sessionData.organization.member_limit) * 100, 100)}%`,
                    height: '100%',
                    background: stats.totalMembers >= sessionData.organization.member_limit
                      ? 'var(--ion-color-danger)'
                      : 'var(--ion-color-primary)',
                    borderRadius: '4px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>

              {stats.totalMembers >= sessionData.organization.member_limit && (
                <div style={{
                  background: 'rgba(220, 38, 38, 0.1)',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  borderRadius: 'var(--enterprise-radius-md)',
                  padding: '16px',
                  marginTop: '16px'
                }}>
                  <p style={{
                    color: 'var(--ion-color-danger)',
                    fontSize: '14px',
                    margin: 0,
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}>
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