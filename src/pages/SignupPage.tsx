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
  person,
  mail,
  business,
  arrowBack,
  checkmarkCircle,
  lockClosed
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import bcrypt from 'bcryptjs';

const SignupPage: React.FC = () => {
  const history = useHistory();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
    subdomain: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertHeader, setAlertHeader] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-generate subdomain from organization name
    if (field === 'organizationName') {
      const subdomain = value
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);
      setFormData(prev => ({
        ...prev,
        subdomain
      }));
    }
  };

  const validateForm = () => {
    if (!formData.fullName.trim()) {
      setAlertMessage('Please enter your full name');
      setAlertHeader('Missing Information');
      setShowAlert(true);
      return false;
    }
    if (!formData.email.trim()) {
      setAlertMessage('Please enter your email address');
      setAlertHeader('Missing Information');
      setShowAlert(true);
      return false;
    }
    if (!formData.password.trim()) {
      setAlertMessage('Please enter a password');
      setAlertHeader('Missing Information');
      setShowAlert(true);
      return false;
    }
    if (formData.password.length < 6) {
      setAlertMessage('Password must be at least 6 characters long');
      setAlertHeader('Password Too Short');
      setShowAlert(true);
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setAlertMessage('Passwords do not match');
      setAlertHeader('Password Mismatch');
      setShowAlert(true);
      return false;
    }
    if (!formData.organizationName.trim()) {
      setAlertMessage('Please enter your organization name');
      setAlertHeader('Missing Information');
      setShowAlert(true);
      return false;
    }
    if (!formData.subdomain.trim()) {
      setAlertMessage('Please enter a subdomain');
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

    const subdomainRegex = /^[a-z0-9]{3,20}$/;
    if (!subdomainRegex.test(formData.subdomain)) {
      setAlertMessage('Subdomain must be 3-20 characters, letters and numbers only');
      setAlertHeader('Invalid Subdomain');
      setShowAlert(true);
      return false;
    }

    return true;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Check if subdomain already exists
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('subdomain')
        .eq('subdomain', formData.subdomain)
        .single();

      if (existingOrg) {
        setAlertMessage('This subdomain is already taken. Please choose another one.');
        setAlertHeader('Subdomain Unavailable');
        setShowAlert(true);
        setIsLoading(false);
        return;
      }

      // Check if email already exists
      const { data: existingUser } = await supabase
        .from('organization_users')
        .select('email')
        .eq('email', formData.email)
        .single();

      if (existingUser) {
        setAlertMessage('An account with this email already exists. Please use a different email or sign in.');
        setAlertHeader('Email Already Exists');
        setShowAlert(true);
        setIsLoading(false);
        return;
      }

      // Create organization
      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: formData.organizationName,
          subdomain: formData.subdomain,
          plan_type: 'free',
          member_limit: 10
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(formData.password, saltRounds);

      // Create organization user
      const { data: user, error: userError } = await supabase
        .from('organization_users')
        .insert({
          email: formData.email,
          password_hash: hashedPassword,
          full_name: formData.fullName,
          organization_id: organization.id,
          role: 'admin'
        })
        .select()
        .single();

      if (userError) throw userError;

      // Store the API key for display
      setApiKey(organization.api_key);
      setShowSuccess(true);

    } catch (error: any) {
      console.error('Signup error:', error);
      setAlertMessage(error.message || 'An error occurred during signup. Please try again.');
      setAlertHeader('Signup Failed');
      setShowAlert(true);
    } finally {
      setIsLoading(false);
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
  };

  if (showSuccess) {
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
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'rgba(5, 150, 105, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px',
                  border: '2px solid #059669'
                }}>
                  <IonIcon icon={checkmarkCircle} style={{ fontSize: '48px', color: '#059669' }} />
                </div>
                <IonCardTitle style={{ color: '#e2e8f0', fontSize: '24px', marginBottom: '8px' }}>
                  Welcome to MembershipScan!
                </IonCardTitle>
                <p style={{ color: '#9ca3af', margin: 0 }}>
                  Your organization has been created successfully
                </p>
              </IonCardHeader>

              <IonCardContent style={{ padding: '0 24px 32px' }}>
                <div style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '24px'
                }}>
                  <h3 style={{ color: '#3b82f6', margin: '0 0 12px 0', fontSize: '16px' }}>
                    Your API Key
                  </h3>
                  <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0 0 16px 0' }}>
                    Save this API key securely. You'll need it to configure your scanner app.
                  </p>
                  <div style={{
                    background: '#0f1419',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    marginBottom: '16px'
                  }}>
                    <code style={{
                      color: '#e2e8f0',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      wordBreak: 'break-all'
                    }}>
                      {apiKey}
                    </code>
                  </div>
                  <IonButton
                    fill="outline"
                    size="small"
                    color="primary"
                    onClick={copyApiKey}
                  >
                    Copy API Key
                  </IonButton>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{ color: '#e2e8f0', margin: '0 0 12px 0' }}>Organization Details</h4>
                  <div style={{ color: '#9ca3af', fontSize: '14px' }}>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Organization:</strong> {formData.organizationName}
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Subdomain:</strong> {formData.subdomain}
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Plan:</strong> Free (10 members)
                    </p>
                  </div>
                </div>

                <IonButton
                  expand="block"
                  color="primary"
                  onClick={() => history.push('/login')}
                >
                  Continue to Sign In
                </IonButton>
              </IonCardContent>
            </IonCard>
          </div>
        </IonContent>
      </IonPage>
    );
  }

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

              <IonCardTitle style={{ color: '#e2e8f0', fontSize: '28px', marginBottom: '8px' }}>
                Create Your Account
              </IonCardTitle>
              <p style={{ color: '#9ca3af', margin: 0 }}>
                Start your free MembershipScan organization
              </p>
            </IonCardHeader>

            <IonCardContent style={{ padding: '0 24px 32px' }}>
              <div style={{ marginBottom: '20px' }}>
                <IonItem style={{ '--background': 'rgba(42, 47, 62, 0.5)', '--border-radius': '12px', marginBottom: '16px' }}>
                  <IonIcon icon={person} slot="start" color="primary" />
                  <IonLabel position="stacked" style={{ color: '#9ca3af' }}>Full Name</IonLabel>
                  <IonInput
                    value={formData.fullName}
                    onIonInput={(e) => handleInputChange('fullName', e.detail.value!)}
                    style={{ color: '#e2e8f0' }}
                    placeholder="Enter your full name"
                  />
                </IonItem>

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
                    type="password"
                    value={formData.password}
                    onIonInput={(e) => handleInputChange('password', e.detail.value!)}
                    style={{ color: '#e2e8f0' }}
                    placeholder="Create a password (min 6 characters)"
                  />
                </IonItem>

                <IonItem style={{ '--background': 'rgba(42, 47, 62, 0.5)', '--border-radius': '12px', marginBottom: '16px' }}>
                  <IonIcon icon={lockClosed} slot="start" color="primary" />
                  <IonLabel position="stacked" style={{ color: '#9ca3af' }}>Confirm Password</IonLabel>
                  <IonInput
                    type="password"
                    value={formData.confirmPassword}
                    onIonInput={(e) => handleInputChange('confirmPassword', e.detail.value!)}
                    style={{ color: '#e2e8f0' }}
                    placeholder="Confirm your password"
                  />
                </IonItem>

                <IonItem style={{ '--background': 'rgba(42, 47, 62, 0.5)', '--border-radius': '12px', marginBottom: '16px' }}>
                  <IonIcon icon={business} slot="start" color="primary" />
                  <IonLabel position="stacked" style={{ color: '#9ca3af' }}>Organization Name</IonLabel>
                  <IonInput
                    value={formData.organizationName}
                    onIonInput={(e) => handleInputChange('organizationName', e.detail.value!)}
                    style={{ color: '#e2e8f0' }}
                    placeholder="Your company or organization"
                  />
                </IonItem>

                <IonItem style={{ '--background': 'rgba(42, 47, 62, 0.5)', '--border-radius': '12px', marginBottom: '16px' }}>
                  <IonIcon icon={business} slot="start" color="primary" />
                  <IonLabel position="stacked" style={{ color: '#9ca3af' }}>
                    Subdomain
                    <span style={{ fontSize: '12px', color: '#6b7280', display: 'block' }}>
                      Will be: {formData.subdomain || 'yourname'}.membershipscan.com
                    </span>
                  </IonLabel>
                  <IonInput
                    value={formData.subdomain}
                    onIonInput={(e) => handleInputChange('subdomain', e.detail.value!)}
                    style={{ color: '#e2e8f0' }}
                    placeholder="yourcompany"
                  />
                </IonItem>
              </div>

              <div style={{
                background: 'rgba(5, 150, 105, 0.1)',
                border: '1px solid rgba(5, 150, 105, 0.3)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <p style={{ color: '#6ee7b7', fontSize: '14px', margin: '0 0 8px 0', fontWeight: '600' }}>
                  ✨ Free Plan Includes:
                </p>
                <ul style={{ color: '#9ca3af', fontSize: '13px', margin: 0, paddingLeft: '20px' }}>
                  <li>Up to 10 members</li>
                  <li>Face recognition scanning</li>
                  <li>Basic attendance tracking</li>
                  <li>Mobile app access</li>
                  <li>API access with your key</li>
                </ul>
              </div>

              <IonButton
                expand="block"
                color="primary"
                onClick={handleSignup}
                disabled={isLoading}
                style={{ marginBottom: '16px' }}
              >
                Create Account
              </IonButton>

              <div style={{ textAlign: 'center' }}>
                <IonText style={{ color: '#9ca3af', fontSize: '14px' }}>
                  Already have an account?{' '}
                  <span
                    style={{ color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => history.push('/login')}
                  >
                    Sign in here
                  </span>
                </IonText>
              </div>
            </IonCardContent>
          </IonCard>
        </div>

        <IonLoading
          isOpen={isLoading}
          message="Creating your account..."
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

export default SignupPage;