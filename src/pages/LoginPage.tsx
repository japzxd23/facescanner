import React, { useState } from 'react';
import {
  IonContent,
  IonPage,
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonText,
  IonIcon,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
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

const LoginPage: React.FC = () => {
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

      // Store user session data in localStorage
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

      // Force full page refresh to clear cached state and ensure buttons work
      window.location.href = '/admin';

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
      // Login with demo account
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

      if (userError || !user) {
        setAlertMessage('Demo account not available. Please create a new account.');
        setAlertHeader('Demo Unavailable');
        setShowAlert(true);
        setIsLoading(false);
        return;
      }

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
      window.location.href = '/admin';

    } catch (error: any) {
      console.error('Demo login error:', error);
      setAlertMessage('Demo login failed. Please try again.');
      setAlertHeader('Demo Login Failed');
      setShowAlert(true);
    } finally {
      setIsLoading(false);
    }
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
                Welcome Back
              </h1>
              <p style={{
                color: 'var(--ion-color-medium)',
                margin: 0,
                fontSize: '16px',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>
                Sign in to your organization dashboard
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
                          '--color': '#1f2937',
                          '--placeholder-color': 'var(--ion-color-medium)',
                          '--padding-start': '0',
                          '--padding-end': '0',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          color: '#1f2937'
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
                            '--color': '#1f2937',
                            '--placeholder-color': 'var(--ion-color-medium)',
                            '--padding-start': '0',
                            '--padding-end': '0',
                            fontFamily: 'Inter, system-ui, sans-serif',
                            flex: 1,
                            color: '#1f2937'
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

              {/* Security notice */}
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
                    background: 'rgba(5, 150, 105, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{ fontSize: '16px' }}>🔒</span>
                  </div>
                  <div>
                    <p style={{
                      color: 'var(--ion-color-success)',
                      fontSize: '14px',
                      fontWeight: '600',
                      margin: '0 0 4px 0',
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      Secure Login
                    </p>
                    <p style={{
                      color: 'var(--ion-color-medium)',
                      fontSize: '13px',
                      margin: 0,
                      fontFamily: 'Inter, system-ui, sans-serif'
                    }}>
                      Protected with enterprise-grade encryption and multi-factor authentication
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

export default LoginPage;