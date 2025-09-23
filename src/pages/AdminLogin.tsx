import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonItem,
  IonInput,
  IonButton,
  IonText,
  IonSpinner,
  IonIcon,
  IonAlert,
  IonLoading
} from '@ionic/react';
import {
  mail,
  lockClosed,
  arrowBack,
  eye,
  eyeOff
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import bcrypt from 'bcryptjs';

const AdminLogin: React.FC = () => {
  const history = useHistory();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertHeader, setAlertHeader] = useState('');

  useEffect(() => {
    checkCurrentSession();
  }, []);

  const checkCurrentSession = () => {
    try {
      // Check for existing session
      const sessionData = localStorage.getItem('membershipScanSession');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        if (session.user && session.organization) {
          // User is already logged in, redirect to admin
          history.push('/admin');
          return;
        }
      }

      // Check for legacy admin session
      const adminSession = localStorage.getItem('adminSession');
      if (adminSession) {
        const session = JSON.parse(adminSession);
        if (session.user) {
          history.push('/admin');
          return;
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setAlertMessage('Please enter your email address');
      setAlertHeader('Missing Information');
      setShowAlert(true);
      return false;
    }

    if (!formData.password.trim()) {
      setAlertMessage('Please enter your password');
      setAlertHeader('Missing Information');
      setShowAlert(true);
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setAlertMessage('Please enter a valid email address');
      setAlertHeader('Invalid Email');
      setShowAlert(true);
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Find user by email
      const { data: user, error: userError } = await supabase
        .from('organization_users')
        .select(`
          *,
          organizations (
            id,
            name,
            subdomain,
            api_key,
            plan_type,
            member_limit,
            is_active
          )
        `)
        .eq('email', formData.email)
        .eq('is_active', true)
        .single();

      if (userError || !user) {
        setAlertMessage('No account found with this email address. Please check your email or sign up for a new account.');
        setAlertHeader('Account Not Found');
        setShowAlert(true);
        setIsLoading(false);
        return;
      }

      // Verify password
      if (user.password_hash) {
        const passwordValid = await bcrypt.compare(formData.password, user.password_hash);
        if (!passwordValid) {
          setAlertMessage('Incorrect password. Please try again.');
          setAlertHeader('Invalid Password');
          setShowAlert(true);
          setIsLoading(false);
          return;
        }
      }

      // Check if organization is active
      if (!user.organizations?.is_active) {
        setAlertMessage('Your organization account has been deactivated. Please contact support.');
        setAlertHeader('Account Deactivated');
        setShowAlert(true);
        setIsLoading(false);
        return;
      }

      // Store user session data in unified format
      const sessionData = {
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        },
        organization: user.organizations
      };

      localStorage.setItem('membershipScanSession', JSON.stringify(sessionData));

      // Redirect to admin
      history.push('/admin');

    } catch (error: any) {
      console.error('Login error:', error);
      setAlertMessage(error.message || 'An error occurred during login. Please try again.');
      setAlertHeader('Login Failed');
      setShowAlert(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    try {
      // Try to login with demo account from main system first
      const { data: user, error: userError } = await supabase
        .from('organization_users')
        .select(`
          *,
          organizations (
            id,
            name,
            subdomain,
            api_key,
            plan_type,
            member_limit,
            is_active
          )
        `)
        .eq('email', 'admin@demo.com')
        .single();

      if (!userError && user) {
        // Use main system demo account
        const sessionData = {
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role
          },
          organization: user.organizations
        };

        localStorage.setItem('membershipScanSession', JSON.stringify(sessionData));
        history.push('/admin');
        return;
      }
    } catch (error) {
      console.log('Main system demo not available, using legacy demo');
    }

    // Fallback to legacy demo credentials
    const sessionData = {
      user: {
        id: 'demo-user',
        username: 'demo',
        email: 'admin@demo.com',
        full_name: 'Demo Admin',
        role: 'admin'
      },
      isLegacyMode: true
    };

    localStorage.setItem('membershipScanSession', JSON.stringify(sessionData));
    localStorage.setItem('adminSession', JSON.stringify(sessionData)); // Keep legacy support
    history.push('/admin');

    setIsLoading(false);
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px',
          position: 'relative'
        }}>
          {/* Background decoration */}
          <div style={{
            position: 'absolute',
            top: '15%',
            right: '10%',
            width: '250px',
            height: '250px',
            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(40px)'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '20%',
            left: '8%',
            width: '180px',
            height: '180px',
            background: 'radial-gradient(circle, rgba(124, 58, 237, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(40px)'
          }} />

          <div style={{
            maxWidth: '500px',
            width: '100%',
            background: 'var(--enterprise-surface-primary)',
            borderRadius: 'var(--enterprise-radius-xl)',
            border: '1px solid var(--enterprise-border-subtle)',
            boxShadow: 'var(--enterprise-shadow-xl)',
            position: 'relative',
            zIndex: 10
          }}>
            {/* Header */}
            <div style={{
              textAlign: 'center',
              padding: '48px 40px 32px',
              borderBottom: '1px solid var(--enterprise-border-subtle)'
            }}>
              <IonButton
                fill="clear"
                color="primary"
                onClick={() => history.push('/')}
                style={{
                  position: 'absolute',
                  top: '24px',
                  left: '24px',
                  '--color': 'var(--ion-color-primary)'
                }}
              >
                <IonIcon icon={arrowBack} />
              </IonButton>

              <div style={{
                fontSize: '20px',
                fontWeight: '700',
                color: 'var(--ion-color-primary)',
                marginBottom: '8px',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>
                MembershipScan
              </div>

              <h1 style={{
                fontSize: '32px',
                fontWeight: '800',
                marginBottom: '12px',
                color: 'var(--ion-text-color)',
                fontFamily: 'Inter, system-ui, sans-serif',
                letterSpacing: '-0.02em'
              }}>
                Admin Access
              </h1>
              <p style={{
                color: 'var(--ion-color-medium)',
                margin: 0,
                fontSize: '16px',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>
                Sign in to manage your organization
              </p>
            </div>

            {/* Form */}
            <div style={{ padding: '40px' }}>
              <div style={{ marginBottom: '32px' }}>
                {/* Email */}
                <div className="enterprise-input" style={{
                  marginBottom: '20px',
                  background: 'var(--enterprise-surface-secondary)',
                  border: '1px solid var(--enterprise-border-medium)',
                  borderRadius: 'var(--enterprise-radius-md)',
                  padding: '16px 20px',
                  transition: 'border-color 0.15s ease'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <IonIcon icon={mail} style={{ color: 'var(--ion-color-primary)', fontSize: '20px' }} />
                    <div style={{ flex: 1 }}>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: 'var(--ion-color-medium)',
                        marginBottom: '4px',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        Email Address
                      </label>
                      <IonInput
                        type="email"
                        value={formData.email}
                        onIonInput={(e) => handleInputChange('email', e.detail.value!)}
                        placeholder="Enter your email"
                        style={{
                          '--color': 'var(--ion-text-color)',
                          '--placeholder-color': 'var(--ion-color-medium)',
                          '--padding-start': '0',
                          '--padding-end': '0',
                          fontFamily: 'Inter, system-ui, sans-serif'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div className="enterprise-input" style={{
                  marginBottom: '24px',
                  background: 'var(--enterprise-surface-secondary)',
                  border: '1px solid var(--enterprise-border-medium)',
                  borderRadius: 'var(--enterprise-radius-md)',
                  padding: '16px 20px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <IonIcon icon={lockClosed} style={{ color: 'var(--ion-color-primary)', fontSize: '20px' }} />
                    <div style={{ flex: 1 }}>
                      <label style={{
                        display: 'block',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: 'var(--ion-color-medium)',
                        marginBottom: '4px',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        Password
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <IonInput
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onIonInput={(e) => handleInputChange('password', e.detail.value!)}
                          placeholder="Enter your password"
                          style={{
                            '--color': 'var(--ion-text-color)',
                            '--placeholder-color': 'var(--ion-color-medium)',
                            '--padding-start': '0',
                            '--padding-end': '0',
                            fontFamily: 'Inter, system-ui, sans-serif',
                            flex: 1
                          }}
                        />
                        <IonButton
                          fill="clear"
                          size="small"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{ margin: 0, '--color': 'var(--ion-color-medium)' }}
                        >
                          <IonIcon icon={showPassword ? eyeOff : eye} />
                        </IonButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Demo info */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(5, 150, 105, 0.05) 100%)',
                border: '1px solid rgba(37, 99, 235, 0.2)',
                borderRadius: 'var(--enterprise-radius-lg)',
                padding: '20px',
                marginBottom: '32px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(37, 99, 235, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ fontSize: '16px' }}>🎯</span>
                  </div>
                  <div>
                    <p style={{
                      color: 'var(--ion-color-primary)',
                      fontSize: '14px',
                      fontWeight: '600',
                      margin: '0 0 4px 0',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      Demo Available
                    </p>
                    <p style={{
                      color: 'var(--ion-color-medium)',
                      fontSize: '13px',
                      margin: 0,
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      Try the demo account or use your organization credentials
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <IonButton
                expand="block"
                color="primary"
                onClick={handleLogin}
                disabled={isLoading}
                style={{
                  '--border-radius': 'var(--enterprise-radius-md)',
                  '--padding-top': '16px',
                  '--padding-bottom': '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  textTransform: 'none',
                  marginBottom: '16px'
                }}
              >
                {isLoading ? 'Signing In...' : 'Sign In'}
              </IonButton>

              {/* Demo Button */}
              <IonButton
                expand="block"
                fill="outline"
                color="secondary"
                onClick={handleDemoLogin}
                disabled={isLoading}
                style={{
                  '--border-radius': 'var(--enterprise-radius-md)',
                  '--padding-top': '16px',
                  '--padding-bottom': '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  textTransform: 'none',
                  marginBottom: '24px'
                }}
              >
                Try Demo Account
              </IonButton>

              {/* Sign up link */}
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  color: 'var(--ion-color-medium)',
                  fontSize: '14px',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}>
                  Don't have an account?{' '}
                  <span
                    style={{
                      color: 'var(--ion-color-primary)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontWeight: '600'
                    }}
                    onClick={() => history.push('/signup')}
                  >
                    Sign up here
                  </span>
                </span>
              </div>

              {/* Support link */}
              <div style={{
                textAlign: 'center',
                marginTop: '32px',
                paddingTop: '24px',
                borderTop: '1px solid var(--enterprise-border-subtle)'
              }}>
                <span style={{
                  color: 'var(--ion-color-medium)',
                  fontSize: '12px',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}>
                  Need help? Contact support at{' '}
                  <span style={{ color: 'var(--ion-color-primary)' }}>
                    help@membershipscan.com
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <IonLoading
          isOpen={isLoading}
          message="Signing you in..."
          spinner="dots"
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

export default AdminLogin;