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

      // Redirect to dashboard
      history.push('/dashboard');

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
      history.push('/dashboard');

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
          background: 'linear-gradient(135deg, #1a1d29 0%, #2a2f3e 100%)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px'
        }}>
          <IonCard style={{
            maxWidth: '500px',
            width: '100%',
            background: 'rgba(26, 29, 41, 0.95)',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            <IonCardHeader style={{ textAlign: 'center', padding: '32px 24px 16px' }}>
              <IonButton
                fill="clear"
                color="primary"
                onClick={() => history.push('/')}
                style={{ position: 'absolute', top: '16px', left: '16px' }}
              >
                <IonIcon icon={arrowBack} />
              </IonButton>

              <div style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#3b82f6',
                marginBottom: '8px'
              }}>
                MembershipScan
              </div>

              <IonCardTitle style={{ color: '#e2e8f0', fontSize: '28px', marginBottom: '8px' }}>
                Welcome Back
              </IonCardTitle>
              <p style={{ color: '#9ca3af', margin: 0 }}>
                Sign in to your organization dashboard
              </p>
            </IonCardHeader>

            <IonCardContent style={{ padding: '0 24px 32px' }}>
              <div style={{ marginBottom: '24px' }}>
                <IonItem style={{ '--background': 'rgba(42, 47, 62, 0.5)', '--border-radius': '12px', marginBottom: '16px' }}>
                  <IonIcon icon={mail} slot="start" color="primary" />
                  <IonLabel position="stacked" style={{ color: '#9ca3af' }}>Email Address</IonLabel>
                  <IonInput
                    type="email"
                    value={formData.email}
                    onIonInput={(e) => handleInputChange('email', e.detail.value!)}
                    style={{ color: '#e2e8f0' }}
                    placeholder="Enter your email"
                  />
                </IonItem>

                <IonItem style={{ '--background': 'rgba(42, 47, 62, 0.5)', '--border-radius': '12px', marginBottom: '16px' }}>
                  <IonIcon icon={lockClosed} slot="start" color="primary" />
                  <IonLabel position="stacked" style={{ color: '#9ca3af' }}>Password</IonLabel>
                  <IonInput
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onIonInput={(e) => handleInputChange('password', e.detail.value!)}
                    style={{ color: '#e2e8f0' }}
                    placeholder="Enter your password"
                  />
                  <IonButton
                    fill="clear"
                    slot="end"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <IonIcon icon={showPassword ? eyeOff : eye} color="medium" />
                  </IonButton>
                </IonItem>
              </div>

              <div style={{
                background: 'rgba(5, 150, 105, 0.1)',
                border: '1px solid rgba(5, 150, 105, 0.3)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <p style={{ color: '#6ee7b7', fontSize: '14px', margin: 0 }}>
                  <strong>Secure Login:</strong> Your account is protected with encrypted password authentication and organization-level access controls.
                </p>
              </div>

              <IonButton
                expand="block"
                color="primary"
                onClick={handleLogin}
                disabled={isLoading}
                style={{ marginBottom: '16px' }}
              >
                Sign In
              </IonButton>

              <IonButton
                expand="block"
                fill="outline"
                color="secondary"
                onClick={handleDemoLogin}
                disabled={isLoading}
                style={{ marginBottom: '24px' }}
              >
                Try Demo Account
              </IonButton>

              <div style={{ textAlign: 'center' }}>
                <IonText style={{ color: '#9ca3af', fontSize: '14px' }}>
                  Don't have an account?{' '}
                  <span
                    style={{ color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => history.push('/signup')}
                  >
                    Sign up here
                  </span>
                </IonText>
              </div>

              <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(107, 114, 128, 0.2)' }}>
                <IonText style={{ color: '#6b7280', fontSize: '12px' }}>
                  Need help? Contact support at help@membershipscan.com
                </IonText>
              </div>
            </IonCardContent>
          </IonCard>
        </div>

        <IonLoading
          isOpen={isLoading}
          message="Signing you in..."
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