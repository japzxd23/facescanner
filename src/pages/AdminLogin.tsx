import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonPage,
  IonInput,
  IonButton,
  IonSpinner,
  IonIcon,
  IonAlert,
  IonLoading,
  IonItem,
  IonLabel
} from '@ionic/react';
import {
  mail,
  lockClosed,
  arrowBack,
  eye,
  eyeOff,
  person,
  checkmarkCircle
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
      const sessionData = localStorage.getItem('FaceCheckSession');
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

      localStorage.setItem('FaceCheckSession', JSON.stringify(sessionData));

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

        localStorage.setItem('FaceCheckSession', JSON.stringify(sessionData));
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

    localStorage.setItem('FaceCheckSession', JSON.stringify(sessionData));
    localStorage.setItem('adminSession', JSON.stringify(sessionData)); // Keep legacy support
    history.push('/admin');

    setIsLoading(false);
  };

  return (
    <IonPage>
      <IonContent fullscreen className="ion-no-bounce">
        {/* Mobile-First Login Design */}
        <div style={{
          background: 'linear-gradient(180deg, #1e293b 0%, #334155 100%)',
          minHeight: '100vh',
          padding: '0',
          display: 'flex',
          flexDirection: 'column'
        }}>

          {/* Status Bar Spacer */}
          <div style={{ height: '44px', background: 'transparent' }} />

          {/* Header with Back Button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <IonButton
              fill="clear"
              size="small"
              onClick={() => history.push('/')}
              style={{
                '--color': 'rgba(255,255,255,0.9)',
                '--padding-start': '0',
                '--padding-end': '8px'
              }}
            >
              <IonIcon icon={arrowBack} style={{ fontSize: '24px' }} />
            </IonButton>
            <div style={{
              color: 'white',
              fontSize: '18px',
              fontWeight: '600',
              marginLeft: '8px'
            }}>
              Sign In
            </div>
          </div>

          {/* Main Content */}
          <div style={{
            flex: 1,
            padding: '32px 20px',
            display: 'flex',
            flexDirection: 'column'
          }}>

            {/* App Logo & Title */}
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)'
              }}>
                <IonIcon
                  icon={person}
                  style={{
                    fontSize: '40px',
                    color: 'white'
                  }}
                />
              </div>

              <h1 style={{
                color: 'white',
                fontSize: '28px',
                fontWeight: '800',
                margin: '0 0 8px 0',
                lineHeight: '1.2'
              }}>
                Admin Login
              </h1>
              <p style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: '16px',
                margin: '0',
                lineHeight: '1.4'
              }}>
                Sign in to manage your organization
              </p>
            </div>

            {/* Login Form */}
            <div style={{ marginBottom: '32px' }}>

              {/* Email Input */}
              <div style={{ marginBottom: '20px' }}>
                <IonItem
                  style={{
                    '--background': 'rgba(255,255,255,0.1)',
                    '--border-radius': '12px',
                    '--padding-start': '16px',
                    '--padding-end': '16px',
                    '--min-height': '56px',
                    '--inner-padding-end': '0',
                    border: '1px solid rgba(255,255,255,0.2)',
                    marginBottom: '4px'
                  }}
                >
                  <IonIcon
                    icon={mail}
                    slot="start"
                    style={{
                      color: '#3b82f6',
                      fontSize: '20px',
                      marginRight: '12px'
                    }}
                  />
                  <IonInput
                    type="email"
                    placeholder="Email address"
                    value={formData.email}
                    onIonInput={(e) => handleInputChange('email', e.detail.value!)}
                    style={{
                      '--color': 'white',
                      '--placeholder-color': 'rgba(255,255,255,0.6)',
                      fontSize: '16px'
                    }}
                  />
                </IonItem>
              </div>

              {/* Password Input */}
              <div style={{ marginBottom: '24px' }}>
                <IonItem
                  style={{
                    '--background': 'rgba(255,255,255,0.1)',
                    '--border-radius': '12px',
                    '--padding-start': '16px',
                    '--padding-end': '16px',
                    '--min-height': '56px',
                    '--inner-padding-end': '0',
                    border: '1px solid rgba(255,255,255,0.2)',
                    marginBottom: '4px'
                  }}
                >
                  <IonIcon
                    icon={lockClosed}
                    slot="start"
                    style={{
                      color: '#3b82f6',
                      fontSize: '20px',
                      marginRight: '12px'
                    }}
                  />
                  <IonInput
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={formData.password}
                    onIonInput={(e) => handleInputChange('password', e.detail.value!)}
                    style={{
                      '--color': 'white',
                      '--placeholder-color': 'rgba(255,255,255,0.6)',
                      fontSize: '16px'
                    }}
                  />
                  <IonButton
                    fill="clear"
                    slot="end"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      '--color': 'rgba(255,255,255,0.6)',
                      '--padding-start': '8px',
                      '--padding-end': '0'
                    }}
                  >
                    <IonIcon icon={showPassword ? eyeOff : eye} />
                  </IonButton>
                </IonItem>
              </div>

              {/* Sign In Button */}
              <IonButton
                expand="block"
                size="large"
                onClick={handleLogin}
                disabled={isLoading}
                style={{
                  '--background': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  '--border-radius': '12px',
                  '--padding-top': '16px',
                  '--padding-bottom': '16px',
                  fontSize: '18px',
                  fontWeight: '700',
                  marginBottom: '16px',
                  boxShadow: '0 4px 16px rgba(59, 130, 246, 0.3)'
                }}
              >
                {isLoading ? (
                  <>
                    <IonSpinner style={{ marginRight: '8px' }} />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </IonButton>
            </div>

            {/* Demo Section */}
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '24px',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '16px' }}>🎯</span>
                </div>
                <div>
                  <div style={{
                    color: '#3b82f6',
                    fontSize: '14px',
                    fontWeight: '600',
                    marginBottom: '2px'
                  }}>
                    Try Demo Mode
                  </div>
                  <div style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '12px'
                  }}>
                    Explore features without creating an account
                  </div>
                </div>
              </div>

              <IonButton
                expand="block"
                fill="outline"
                onClick={handleDemoLogin}
                disabled={isLoading}
                style={{
                  '--border-color': 'rgba(255,255,255,0.3)',
                  '--color': 'white',
                  '--border-radius': '10px',
                  '--padding-top': '12px',
                  '--padding-bottom': '12px',
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              >
                <IonIcon icon={checkmarkCircle} style={{ marginRight: '8px', fontSize: '18px' }} />
                Access Demo
              </IonButton>
            </div>

            {/* Sign Up Link */}
            <div style={{ textAlign: 'center', marginTop: 'auto' }}>
              <p style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: '16px',
                margin: '0'
              }}>
                Don't have an account?{' '}
                <span
                  style={{
                    color: '#3b82f6',
                    fontWeight: '600',
                    textDecoration: 'underline',
                    cursor: 'pointer'
                  }}
                  onClick={() => history.push('/signup')}
                >
                  Sign up here
                </span>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '20px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <img
                src="/alatiris_logo.png"
                alt="Alatiris"
                style={{ height: '24px', opacity: 0.7 }}
              />
              <span style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: '12px',
                fontWeight: '500'
              }}>
                Powered by Alatiris
              </span>
            </div>
            <p style={{
              color: 'rgba(255,255,255,0.5)',
              fontSize: '11px',
              margin: '0'
            }}>
              Need help? Contact support@alatiris.com
            </p>
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