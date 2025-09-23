import React from 'react';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonMenu,
  IonMenuButton,
  IonList,
  IonItem,
  IonLabel,
  IonAvatar,
  IonNote
} from '@ionic/react';
import {
  homeOutline,
  peopleOutline,
  analyticsOutline,
  settingsOutline,
  logOutOutline,
  personCircleOutline,
  notificationsOutline
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';

interface EnterpriseLayoutProps {
  children: React.ReactNode;
  title: string;
  menuId?: string;
  showHeader?: boolean;
  showMenu?: boolean;
}

const EnterpriseLayout: React.FC<EnterpriseLayoutProps> = ({
  children,
  title,
  menuId = 'main-menu',
  showHeader = true,
  showMenu = true
}) => {
  const history = useHistory();

  const menuItems = [
    { title: 'Dashboard', icon: homeOutline, path: '/admin', color: 'primary' },
    { title: 'Members', icon: peopleOutline, path: '/members', color: 'primary' },
    { title: 'Scanner', icon: analyticsOutline, path: '/camera', color: 'primary' },
    { title: 'Attendance', icon: analyticsOutline, path: '/attendance', color: 'primary' },
    { title: 'Settings', icon: settingsOutline, path: '/settings', color: 'medium' }
  ];

  const handleLogout = () => {
    localStorage.removeItem('membershipScanSession');
    history.push('/');
  };

  const getUserSession = () => {
    try {
      const session = localStorage.getItem('membershipScanSession');
      return session ? JSON.parse(session) : null;
    } catch {
      return null;
    }
  };

  const session = getUserSession();

  return (
    <>
      {showMenu && (
        <IonMenu contentId="main-content" menuId={menuId} type="overlay">
          <IonHeader>
            <IonToolbar style={{
              '--background': 'var(--enterprise-surface-primary)',
              '--border-color': 'var(--enterprise-border-subtle)'
            }}>
              <IonTitle style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: '600',
                fontSize: '18px',
                color: 'var(--ion-color-primary)'
              }}>
                MembershipScan
              </IonTitle>
            </IonToolbar>
          </IonHeader>

          <IonContent style={{ '--background': 'var(--enterprise-surface-secondary)' }}>
            {/* User Profile Section */}
            {session && (
              <div style={{
                padding: 'var(--enterprise-spacing-lg)',
                background: 'var(--enterprise-surface-primary)',
                borderBottom: '1px solid var(--enterprise-border-subtle)',
                margin: 'var(--enterprise-spacing-md)',
                borderRadius: 'var(--enterprise-radius-lg)',
                boxShadow: 'var(--enterprise-shadow-sm)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--enterprise-spacing-md)' }}>
                  <IonAvatar style={{ width: '48px', height: '48px' }}>
                    <IonIcon
                      icon={personCircleOutline}
                      style={{
                        fontSize: '48px',
                        color: 'var(--ion-color-primary)'
                      }}
                    />
                  </IonAvatar>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '16px',
                      fontWeight: '600',
                      color: 'var(--ion-text-color)',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      {session.user?.full_name || 'User'}
                    </h3>
                    <p style={{
                      margin: 0,
                      fontSize: '14px',
                      color: 'var(--ion-color-medium)',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      {session.organization?.name || 'Organization'}
                    </p>
                  </div>
                  <IonButton fill="clear" size="small">
                    <IonIcon icon={notificationsOutline} />
                  </IonButton>
                </div>
              </div>
            )}

            {/* Navigation Menu */}
            <IonList style={{ background: 'transparent', padding: 'var(--enterprise-spacing-md)' }}>
              {menuItems.map((item, index) => (
                <IonItem
                  key={index}
                  button
                  onClick={() => history.push(item.path)}
                  style={{
                    '--background': 'var(--enterprise-surface-primary)',
                    '--color': 'var(--ion-text-color)',
                    '--border-radius': 'var(--enterprise-radius-md)',
                    '--padding-start': 'var(--enterprise-spacing-md)',
                    '--padding-end': 'var(--enterprise-spacing-md)',
                    '--min-height': '48px',
                    marginBottom: 'var(--enterprise-spacing-xs)',
                    boxShadow: 'var(--enterprise-shadow-sm)',
                    border: '1px solid var(--enterprise-border-subtle)',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  className="enterprise-menu-item"
                >
                  <IonIcon
                    icon={item.icon}
                    slot="start"
                    style={{
                      fontSize: '20px',
                      color: 'var(--ion-color-primary)',
                      marginRight: 'var(--enterprise-spacing-sm)'
                    }}
                  />
                  <IonLabel style={{
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontWeight: '500',
                    fontSize: '15px'
                  }}>
                    {item.title}
                  </IonLabel>
                </IonItem>
              ))}

              {/* Logout Item */}
              <IonItem
                button
                onClick={handleLogout}
                style={{
                  '--background': 'transparent',
                  '--color': 'var(--ion-color-danger)',
                  '--border-radius': 'var(--enterprise-radius-md)',
                  '--padding-start': 'var(--enterprise-spacing-md)',
                  '--padding-end': 'var(--enterprise-spacing-md)',
                  '--min-height': '48px',
                  marginTop: 'var(--enterprise-spacing-lg)',
                  border: '1px solid var(--ion-color-danger)',
                  borderStyle: 'dashed'
                }}
              >
                <IonIcon
                  icon={logOutOutline}
                  slot="start"
                  style={{
                    fontSize: '20px',
                    color: 'var(--ion-color-danger)',
                    marginRight: 'var(--enterprise-spacing-sm)'
                  }}
                />
                <IonLabel style={{
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: '500',
                  fontSize: '15px',
                  color: 'var(--ion-color-danger)'
                }}>
                  Sign Out
                </IonLabel>
              </IonItem>
            </IonList>
          </IonContent>
        </IonMenu>
      )}

      <div id="main-content">
        {showHeader && (
          <IonHeader>
            <IonToolbar style={{
              '--background': 'var(--enterprise-surface-primary)',
              '--border-color': 'var(--enterprise-border-subtle)',
              '--color': 'var(--ion-text-color)',
              borderBottom: '1px solid var(--enterprise-border-subtle)',
              boxShadow: 'var(--enterprise-shadow-sm)'
            }}>
              {showMenu && (
                <IonMenuButton slot="start" style={{ color: 'var(--ion-color-primary)' }} />
              )}
              <IonTitle style={{
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: '600',
                fontSize: '18px',
                color: 'var(--ion-text-color)'
              }}>
                {title}
              </IonTitle>
            </IonToolbar>
          </IonHeader>
        )}

        <IonContent style={{ '--background': 'var(--enterprise-surface-secondary)' }}>
          {children}
        </IonContent>
      </div>
    </>
  );
};

export default EnterpriseLayout;