import React, { useEffect, useState } from 'react';
import { Redirect } from 'react-router-dom';
import { IonContent, IonPage, IonSpinner, IonButton, IonIcon } from '@ionic/react';
import { lockClosedOutline, arrowBack } from 'ionicons/icons';
import { isAdmin, getCurrentSession, logSecurityEvent } from '../services/authService';

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * AdminGuard component - Protects routes that require admin/owner role
 *
 * Usage:
 * <Route path="/admin">
 *   <AdminGuard>
 *     <AdminComponent />
 *   </AdminGuard>
 * </Route>
 */
const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const session = getCurrentSession();

      if (!session) {
        setHasAccess(false);
        setChecking(false);
        return;
      }

      setUserRole(session.user.role);

      const hasAdminRole = isAdmin();

      if (!hasAdminRole) {
        // Log unauthorized admin access attempt
        await logSecurityEvent('unauthorized_admin_access', 'high', {
          user_email: session.user.email,
          user_role: session.user.role,
          attempted_path: window.location.pathname,
          timestamp: new Date().toISOString()
        });
      }

      setHasAccess(hasAdminRole);
    } catch (error) {
      console.error('Admin access check error:', error);
      setHasAccess(false);
    } finally {
      setChecking(false);
    }
  };

  // Show loading spinner while checking
  if (checking) {
    return (
      <IonPage>
        <IonContent>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <IonSpinner
                name="crescent"
                style={{
                  width: '48px',
                  height: '48px',
                  color: '#3b82f6'
                }}
              />
              <p style={{ color: '#e5e7eb', marginTop: '16px', fontSize: '14px' }}>
                Verifying admin access...
              </p>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // Show access denied page if user doesn't have admin role
  if (!hasAccess) {
    return (
      <IonPage>
        <IonContent>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            padding: '32px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)'
          }}>
            <div style={{
              maxWidth: '500px',
              width: '100%',
              background: 'white',
              borderRadius: '24px',
              padding: '48px',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
              {/* Lock Icon */}
              <div style={{
                width: '80px',
                height: '80px',
                margin: '0 auto 24px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(239, 68, 68, 0.3)'
              }}>
                <IonIcon
                  icon={lockClosedOutline}
                  style={{
                    fontSize: '40px',
                    color: 'white'
                  }}
                />
              </div>

              {/* Title */}
              <h1 style={{
                fontSize: '28px',
                fontWeight: '800',
                color: '#1f2937',
                marginBottom: '12px'
              }}>
                Access Denied
              </h1>

              {/* Message */}
              <p style={{
                color: '#6b7280',
                fontSize: '16px',
                lineHeight: '1.6',
                marginBottom: '24px'
              }}>
                You don't have permission to access this area. Admin or Owner role is required.
              </p>

              {/* User Info */}
              <div style={{
                background: '#f3f4f6',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '32px',
                textAlign: 'left'
              }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#6b7280',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Current Role
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#1f2937',
                  textTransform: 'capitalize'
                }}>
                  {userRole || 'Unknown'}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <IonButton
                  expand="block"
                  color="primary"
                  onClick={() => window.history.back()}
                  style={{
                    '--border-radius': '12px',
                    '--padding-top': '16px',
                    '--padding-bottom': '16px',
                    fontSize: '16px',
                    fontWeight: '600'
                  }}
                >
                  <IonIcon icon={arrowBack} slot="start" />
                  Go Back
                </IonButton>

                <IonButton
                  expand="block"
                  fill="outline"
                  color="medium"
                  onClick={() => window.location.href = '/camera'}
                  style={{
                    '--border-radius': '12px',
                    '--padding-top': '16px',
                    '--padding-bottom': '16px',
                    fontSize: '16px',
                    fontWeight: '600'
                  }}
                >
                  Go to Scanner
                </IonButton>
              </div>

              {/* Support Link */}
              <p style={{
                marginTop: '32px',
                paddingTop: '24px',
                borderTop: '1px solid #e5e7eb',
                color: '#6b7280',
                fontSize: '13px'
              }}>
                Need admin access?{' '}
                <span style={{ color: '#2563eb', fontWeight: '600' }}>
                  Contact your administrator
                </span>
              </p>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // Render protected admin content
  return <>{children}</>;
};

export default AdminGuard;