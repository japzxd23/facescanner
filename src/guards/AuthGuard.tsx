import React, { useEffect, useState } from 'react';
import { Redirect } from 'react-router-dom';
import { IonSpinner } from '@ionic/react';
import { isAuthenticated, logSecurityEvent } from '../services/authService';
import { initializeSessionManager } from '../services/sessionManager';

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * AuthGuard component - Protects routes that require authentication
 *
 * Usage:
 * <Route path="/protected">
 *   <AuthGuard>
 *     <ProtectedComponent />
 *   </AuthGuard>
 * </Route>
 */
const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuth = await isAuthenticated();

      if (isAuth) {
        // Initialize session manager for authenticated users
        initializeSessionManager({
          idleTimeout: 30 * 60 * 1000, // 30 minutes
          maxSessionDuration: 8 * 60 * 60 * 1000, // 8 hours
          checkInterval: 60 * 1000 // 1 minute
        });

        setAuthenticated(true);
      } else {
        // Log unauthorized access attempt
        await logSecurityEvent('unauthorized_access', 'medium', {
          attempted_path: window.location.pathname,
          timestamp: new Date().toISOString()
        });

        setAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setAuthenticated(false);
    } finally {
      setChecking(false);
    }
  };

  // Show loading spinner while checking authentication
  if (checking) {
    return (
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
            Verifying authentication...
          </p>
        </div>
      </div>
    );
  }

  // Redirect to auth page if not authenticated
  if (!authenticated) {
    return <Redirect to="/auth" />;
  }

  // Render protected content
  return <>{children}</>;
};

export default AuthGuard;