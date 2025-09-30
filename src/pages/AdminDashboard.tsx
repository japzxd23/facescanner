import React, { useEffect, useState, useCallback } from 'react';
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
import { people, analytics, personAdd, logOut, arrowBack, key, copy, scan, settings, shield } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { getMembers, getAttendanceLogs, setOrganizationContext, clearOrganizationContext } from '../services/supabaseClient';
import { useOrganization } from '../contexts/OrganizationContext';
import { hasPermission, Permission, getUserRole, getRoleDisplayName } from '../services/rbac';
import { logSecurityEvent } from '../services/authService';
import { getScanStatistics } from '../services/anomalyDetector';
import { getUsageStats } from '../services/rateLimiter';

const AdminDashboard: React.FC = () => {
  const history = useHistory();
  const { organization, user, isAuthenticated, isLegacyMode, clearSession } = useOrganization();
  const [stats, setStats] = useState({
    totalMembers: 0,
    vipMembers: 0,
    bannedMembers: 0,
    todayLogs: 0
  });
  const [securityStats, setSecurityStats] = useState({
    scanStats: { totalScans: 0, successfulScans: 0, failedScans: 0, successRate: 0 },
    rateLimitStats: { requestsLastMinute: 0, requestsLastHour: 0, limitPerMinute: 0, limitPerHour: 0, isLocked: false }
  });
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertHeader, setAlertHeader] = useState('');
  const [componentKey, setComponentKey] = useState(Date.now());

  useEffect(() => {
    checkAuthAndLoadData();
    // Force component refresh after navigation
    setComponentKey(Date.now());
  }, [history]);

  // Set organization context when component mounts or organization changes
  useEffect(() => {
    if (!isLegacyMode && organization) {
      console.log('🏢 Setting organization context for AdminDashboard on mount:', organization.name, 'ID:', organization.id);
      setOrganizationContext(organization.id);
      // Reload stats after setting organization context
      loadStats();
    } else if (isLegacyMode) {
      console.log('🔧 AdminDashboard in legacy mode - clearing organization context');
      clearOrganizationContext();
      // Reload stats for legacy mode
      loadStats();
    }
  }, [organization, isLegacyMode]);

  const checkAuthAndLoadData = () => {
    try {
      // Check for unified session first
      const sessionData = localStorage.getItem('FaceCheckSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.user && (session.organization || session.isLegacyMode)) {
          // Valid session found
          loadStats();
          return;
        }
      }

      // Check for legacy admin session
      const adminSession = localStorage.getItem('adminSession');
      if (adminSession) {
        const session = JSON.parse(adminSession);
        if (session.user) {
          loadStats();
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

  const loadStats = async () => {
    try {
      console.log('📊 Loading members and attendance logs with organization context...');
      const members = await getMembers();
      const logs = await getAttendanceLogs(100);

      console.log(`📈 Loaded stats: ${members.length} members, ${logs.length} logs`);

      const today = new Date().toDateString();
      const todayLogs = logs.filter(log =>
        new Date(log.timestamp).toDateString() === today
      );

      const newStats = {
        totalMembers: members.length,
        vipMembers: members.filter(m => m.status === 'VIP').length,
        bannedMembers: members.filter(m => m.status === 'Banned').length,
        todayLogs: todayLogs.length
      };

      console.log('📊 Setting dashboard stats:', newStats);
      setStats(newStats);

      // 🔒 Load security statistics
      loadSecurityStats();

      // 🔒 Get user role
      const role = getUserRole();
      if (role) {
        setUserRole(getRoleDisplayName(role));
      }

      // Debug: Log member sample for verification
      if (members.length > 0) {
        console.log('👥 Sample members:', members.slice(0, 3).map(m => ({
          id: m.id.substring(0, 8),
          name: m.name,
          status: m.status,
          hasPhoto: !!m.photo_url
        })));
      }

      // Debug: Log today's logs sample
      if (todayLogs.length > 0) {
        console.log('📅 Today\'s logs sample:', todayLogs.slice(0, 3).map(log => ({
          id: log.id.substring(0, 8),
          member_id: log.member_id?.substring(0, 8),
          timestamp: log.timestamp,
          confidence: log.confidence
        })));
      }

      // 🔒 Log dashboard access
      await logSecurityEvent('admin_dashboard_access', 'info', {
        userId: user?.id,
        organizationId: organization?.id,
        role: role
      });
    } catch (error) {
      console.error('❌ Error loading AdminDashboard stats:', error);
      console.error('Organization context:', { organization: organization?.id, isLegacyMode });
    }
  };

  // 🔒 Load security statistics
  const loadSecurityStats = () => {
    try {
      const scanStats = getScanStatistics();
      const rateLimitStats = getUsageStats();

      setSecurityStats({
        scanStats,
        rateLimitStats
      });

      console.log('🔒 Security stats loaded:', { scanStats, rateLimitStats });
    } catch (error) {
      console.error('❌ Error loading security stats:', error);
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

  const navigateToMembers = useCallback(() => {
    console.log('Navigating to members...');
    try {
      history.push('/admin/members');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [history]);

  const navigateToLogs = useCallback(() => {
    console.log('Navigating to logs...');
    try {
      history.push('/admin/logs');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [history]);

  const navigateToCamera = useCallback(() => {
    console.log('Navigating to camera...');
    try {
      history.push('/camera');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [history]);

  const navigateToSettings = useCallback(() => {
    console.log('Navigating to settings...');
    try {
      history.push('/admin/settings');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [history]);

  return (
    <IonPage key={componentKey}>
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
              onClick={() => history.push('/admin/dashboard')}
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
        <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Welcome section */}
          <IonCard className="enterprise-card">
            <IonCardContent style={{ padding: 'clamp(16px, 4vw, 32px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
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
              <IonCol size="12" sizeSm="6" sizeMd="3">
                <IonCard className="enterprise-card">
                  <IonCardContent style={{ textAlign: 'center', padding: 'clamp(16px, 3vw, 24px)' }}>
                    <IonIcon
                      icon={people}
                      style={{ fontSize: 'clamp(32px, 6vw, 40px)', color: 'var(--ion-color-success)', marginBottom: '12px' }}
                    />
                    <h2 style={{
                      margin: '0 0 4px 0',
                      fontSize: 'clamp(24px, 5vw, 32px)',
                      fontWeight: '800',
                      color: 'var(--ion-text-color)',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      {stats.totalMembers}
                    </h2>
                    <p style={{
                      margin: 0,
                      color: 'var(--ion-color-medium)',
                      fontSize: 'clamp(12px, 2.5vw, 14px)',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      Total Members
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
              <IonCol size="12" sizeSm="6" sizeMd="3">
                <IonCard className="enterprise-card">
                  <IonCardContent style={{ textAlign: 'center', padding: 'clamp(16px, 3vw, 24px)' }}>
                    <IonIcon
                      icon={analytics}
                      style={{ fontSize: 'clamp(32px, 6vw, 40px)', color: 'var(--ion-color-primary)', marginBottom: '12px' }}
                    />
                    <h2 style={{
                      margin: '0 0 4px 0',
                      fontSize: 'clamp(24px, 5vw, 32px)',
                      fontWeight: '800',
                      color: 'var(--ion-text-color)',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      {stats.todayLogs}
                    </h2>
                    <p style={{
                      margin: 0,
                      color: 'var(--ion-color-medium)',
                      fontSize: 'clamp(12px, 2.5vw, 14px)',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      Today's Scans
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
              <IonCol size="12" sizeSm="6" sizeMd="3">
                <IonCard className="enterprise-card">
                  <IonCardContent style={{ textAlign: 'center', padding: 'clamp(16px, 3vw, 24px)' }}>
                    <h2 style={{
                      margin: '0 0 4px 0',
                      fontSize: 'clamp(24px, 5vw, 32px)',
                      fontWeight: '800',
                      color: 'var(--ion-color-tertiary)',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      {stats.vipMembers}
                    </h2>
                    <p style={{
                      margin: 0,
                      color: 'var(--ion-color-medium)',
                      fontSize: 'clamp(12px, 2.5vw, 14px)',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      VIP Members
                    </p>
                  </IonCardContent>
                </IonCard>
              </IonCol>
              <IonCol size="12" sizeSm="6" sizeMd="3">
                <IonCard className="enterprise-card">
                  <IonCardContent style={{ textAlign: 'center', padding: 'clamp(16px, 3vw, 24px)' }}>
                    <h2 style={{
                      margin: '0 0 4px 0',
                      fontSize: 'clamp(24px, 5vw, 32px)',
                      fontWeight: '800',
                      color: 'var(--ion-color-danger)',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      {stats.bannedMembers}
                    </h2>
                    <p style={{
                      margin: 0,
                      color: 'var(--ion-color-medium)',
                      fontSize: 'clamp(12px, 2.5vw, 14px)',
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
            <IonCardContent style={{ padding: 'clamp(16px, 4vw, 24px)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <IonButton
                  expand="block"
                  color="primary"
                  onClick={navigateToCamera}
                  style={{
                    '--padding-top': 'clamp(12px, 3vw, 16px)',
                    '--padding-bottom': 'clamp(12px, 3vw, 16px)',
                    '--border-radius': 'var(--enterprise-radius-md)',
                    fontSize: 'clamp(14px, 3.5vw, 16px)',
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

          {/* 🔒 Security Overview - Only visible to admins */}
          {hasPermission(Permission.VIEW_SECURITY_EVENTS) && (
            <IonCard className="enterprise-card" style={{ border: '2px solid var(--ion-color-warning)' }}>
              <IonCardHeader>
                <IonCardTitle style={{
                  color: 'var(--ion-text-color)',
                  fontSize: '20px',
                  fontWeight: '700',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <IonIcon icon={shield} style={{ fontSize: '24px', color: 'var(--ion-color-warning)' }} />
                  Security Overview
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent style={{ padding: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  {/* Scan Statistics */}
                  <div style={{ padding: '16px', background: 'var(--ion-color-light)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>
                      Scan Success Rate
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--ion-color-success)' }}>
                      {securityStats.scanStats.successRate.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ion-color-medium)', marginTop: '4px' }}>
                      {securityStats.scanStats.successfulScans}/{securityStats.scanStats.totalScans} scans
                    </div>
                  </div>

                  {/* Rate Limit Status */}
                  <div style={{ padding: '16px', background: 'var(--ion-color-light)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>
                      Rate Limit (per min)
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: securityStats.rateLimitStats.isLocked ? 'var(--ion-color-danger)' : 'var(--ion-color-primary)' }}>
                      {securityStats.rateLimitStats.requestsLastMinute}/{securityStats.rateLimitStats.limitPerMinute}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ion-color-medium)', marginTop: '4px' }}>
                      {securityStats.rateLimitStats.isLocked ? '🚫 Locked' : '✅ Active'}
                    </div>
                  </div>

                  {/* Failed Scans */}
                  <div style={{ padding: '16px', background: 'var(--ion-color-light)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>
                      Failed Scans (24h)
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: securityStats.scanStats.failedScans > 10 ? 'var(--ion-color-danger)' : 'var(--ion-color-medium)' }}>
                      {securityStats.scanStats.failedScans}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ion-color-medium)', marginTop: '4px' }}>
                      {securityStats.scanStats.failedScans > 10 ? '⚠️ High' : '✓ Normal'}
                    </div>
                  </div>

                  {/* User Role */}
                  <div style={{ padding: '16px', background: 'var(--ion-color-light)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>
                      Your Role
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--ion-color-primary)' }}>
                      {userRole || 'Unknown'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--ion-color-medium)', marginTop: '4px' }}>
                      Access level
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '16px', padding: '12px', background: 'var(--ion-color-warning-tint)', borderRadius: '8px', fontSize: '13px', color: 'var(--ion-color-warning-shade)' }}>
                  🔒 Security features active: Rate limiting, anomaly detection, and session monitoring
                </div>
              </IonCardContent>
            </IonCard>
          )}

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