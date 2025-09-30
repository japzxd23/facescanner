import React, { useState } from 'react';
import {
  IonContent,
  IonPage,
  IonButton,
  IonInput,
  IonItem,
  IonIcon,
  IonAlert,
  IonLoading,
  IonSpinner,
  IonCard,
  IonCardContent
} from '@ionic/react';
import {
  person,
  mail,
  business,
  arrowBack,
  checkmarkCircle,
  lockClosed,
  eyeOutline,
  eyeOffOutline,
  starOutline,
  rocket
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
    if (formData.password.length < 8) {
      setAlertMessage('Password must be at least 8 characters long');
      setAlertHeader('Password Requirements');
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
        .maybeSingle();

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
        .maybeSingle();

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

  const handleContinueToScanner = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Continue button clicked, navigating to /camera');

    try {
      history.push('/camera');
    } catch (error) {
      console.error('React Router failed, using window.location:', error);
      window.location.href = '/camera';
    }
  };

  // Success Screen - Mobile First
  if (showSuccess) {
    return (
      <IonPage>
        <IonContent fullscreen className="ion-no-bounce">
          <div style={{
            background: 'linear-gradient(180deg, #059669 0%, #047857 100%)',
            minHeight: '100vh',
            padding: '0',
            display: 'flex',
            flexDirection: 'column'
          }}>

            {/* Status Bar Spacer */}
            <div style={{ height: '44px', background: 'transparent' }} />

            {/* Success Header */}
            <div style={{
              padding: '32px 20px',
              textAlign: 'center',
              color: 'white'
            }}>
              <div style={{
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
              }}>
                <IonIcon icon={checkmarkCircle} style={{ fontSize: '60px', color: 'white' }} />
              </div>

              <h1 style={{
                fontSize: '28px',
                fontWeight: '800',
                margin: '0 0 8px 0',
                lineHeight: '1.2'
              }}>
                Welcome to FaceCheck!
              </h1>
              <p style={{
                fontSize: '16px',
                opacity: 0.9,
                margin: '0',
                lineHeight: '1.4'
              }}>
                Your organization is ready to go
              </p>
            </div>

            {/* Content Area */}
            <div style={{
              flex: 1,
              background: '#f8fafc',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              padding: '32px 20px',
              marginTop: '16px'
            }}>

              {/* Organization Details */}
              <IonCard style={{
                borderRadius: '16px',
                margin: '0 0 20px 0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}>
                <IonCardContent style={{ padding: '24px' }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#1f2937',
                    margin: '0 0 16px 0'
                  }}>
                    🏢 Organization Details
                  </h3>

                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0'
                    }}>
                      <span style={{ color: '#6b7280', fontSize: '14px' }}>Name:</span>
                      <span style={{ fontWeight: '600', color: '#1f2937', fontSize: '14px' }}>
                        {formData.organizationName}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0'
                    }}>
                      <span style={{ color: '#6b7280', fontSize: '14px' }}>Subdomain:</span>
                      <span style={{ fontWeight: '600', color: '#1f2937', fontSize: '12px' }}>
                        {formData.subdomain}.facecheck.com
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0'
                    }}>
                      <span style={{ color: '#6b7280', fontSize: '14px' }}>Plan:</span>
                      <span style={{
                        background: '#dcfce7',
                        color: '#166534',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        FREE (10 members)
                      </span>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>

              {/* API Key Section */}
              <IonCard style={{
                borderRadius: '16px',
                margin: '0 0 24px 0',
                border: '2px solid #3b82f6',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)'
              }}>
                <IonCardContent style={{ padding: '24px' }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#3b82f6',
                    margin: '0 0 12px 0'
                  }}>
                    🔑 Your API Key
                  </h3>
                  <p style={{
                    color: '#6b7280',
                    fontSize: '14px',
                    margin: '0 0 16px 0',
                    lineHeight: '1.4'
                  }}>
                    Save this securely - you'll need it for mobile app setup
                  </p>

                  <div style={{
                    background: '#f1f5f9',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '16px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    wordBreak: 'break-all',
                    color: '#1e293b',
                    lineHeight: '1.4'
                  }}>
                    {apiKey}
                  </div>

                  <IonButton
                    expand="block"
                    fill="outline"
                    onClick={copyApiKey}
                    style={{
                      '--border-color': '#3b82f6',
                      '--color': '#3b82f6',
                      '--border-radius': '12px',
                      '--padding-top': '12px',
                      '--padding-bottom': '12px',
                      fontSize: '16px',
                      fontWeight: '600'
                    }}
                  >
                    📋 Copy API Key
                  </IonButton>
                </IonCardContent>
              </IonCard>

              {/* Continue Button */}
              <IonButton
                expand="block"
                size="large"
                onClick={handleContinueToScanner}
                style={{
                  '--background': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  '--border-radius': '16px',
                  '--padding-top': '16px',
                  '--padding-bottom': '16px',
                  fontSize: '18px',
                  fontWeight: '700',
                  marginBottom: '24px',
                  boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)'
                }}
              >
                <IonIcon icon={rocket} style={{ marginRight: '8px' }} />
                Start Using FaceCheck
              </IonButton>

              {/* Footer */}
              <div style={{
                textAlign: 'center',
                padding: '20px 0'
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
                    style={{ height: '20px', opacity: 0.7 }}
                  />
                  <span style={{
                    color: '#6b7280',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    Powered by Alatiris
                  </span>
                </div>
              </div>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent fullscreen className="ion-no-bounce">
        {/* Mobile-First Signup Design */}
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
              Create Account
            </div>
          </div>

          {/* Main Content */}
          <div style={{
            flex: 1,
            background: '#f8fafc',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            marginTop: '16px',
            padding: '24px 20px',
            overflow: 'hidden'
          }}>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '20px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
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
                fontSize: '24px',
                fontWeight: '800',
                color: '#1f2937',
                margin: '0 0 8px 0',
                lineHeight: '1.2'
              }}>
                Join FaceCheck
              </h1>
              <p style={{
                color: '#6b7280',
                fontSize: '16px',
                margin: '0',
                lineHeight: '1.4'
              }}>
                Start with 10 free members included
              </p>
            </div>

            {/* Form Fields */}
            <div style={{ marginBottom: '24px' }}>

              {/* Full Name */}
              <div style={{ marginBottom: '16px' }}>
                <IonItem
                  style={{
                    '--background': 'white',
                    '--border-radius': '12px',
                    '--padding-start': '16px',
                    '--padding-end': '16px',
                    '--min-height': '56px',
                    '--inner-padding-end': '0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    border: '1px solid #e5e7eb',
                    marginBottom: '4px'
                  }}
                >
                  <IonIcon
                    icon={person}
                    slot="start"
                    style={{
                      color: '#3b82f6',
                      fontSize: '20px',
                      marginRight: '12px'
                    }}
                  />
                  <IonInput
                    placeholder="Full name"
                    value={formData.fullName}
                    onIonInput={(e) => handleInputChange('fullName', e.detail.value!)}
                    style={{
                      '--color': '#1f2937',
                      '--placeholder-color': '#9ca3af',
                      fontSize: '16px'
                    }}
                  />
                </IonItem>
              </div>

              {/* Email */}
              <div style={{ marginBottom: '16px' }}>
                <IonItem
                  style={{
                    '--background': 'white',
                    '--border-radius': '12px',
                    '--padding-start': '16px',
                    '--padding-end': '16px',
                    '--min-height': '56px',
                    '--inner-padding-end': '0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    border: '1px solid #e5e7eb',
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
                      '--color': '#1f2937',
                      '--placeholder-color': '#9ca3af',
                      fontSize: '16px'
                    }}
                  />
                </IonItem>
              </div>

              {/* Organization Name */}
              <div style={{ marginBottom: '16px' }}>
                <IonItem
                  style={{
                    '--background': 'white',
                    '--border-radius': '12px',
                    '--padding-start': '16px',
                    '--padding-end': '16px',
                    '--min-height': '56px',
                    '--inner-padding-end': '0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    border: '1px solid #e5e7eb',
                    marginBottom: '4px'
                  }}
                >
                  <IonIcon
                    icon={business}
                    slot="start"
                    style={{
                      color: '#3b82f6',
                      fontSize: '20px',
                      marginRight: '12px'
                    }}
                  />
                  <IonInput
                    placeholder="Organization name"
                    value={formData.organizationName}
                    onIonInput={(e) => handleInputChange('organizationName', e.detail.value!)}
                    style={{
                      '--color': '#1f2937',
                      '--placeholder-color': '#9ca3af',
                      fontSize: '16px'
                    }}
                  />
                </IonItem>
              </div>

              {/* Subdomain */}
              <div style={{ marginBottom: '16px' }}>
                <IonItem
                  style={{
                    '--background': 'white',
                    '--border-radius': '12px',
                    '--padding-start': '16px',
                    '--padding-end': '16px',
                    '--min-height': '56px',
                    '--inner-padding-end': '0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    border: '1px solid #e5e7eb',
                    marginBottom: '4px'
                  }}
                >
                  <IonIcon
                    icon={business}
                    slot="start"
                    style={{
                      color: '#3b82f6',
                      fontSize: '20px',
                      marginRight: '12px'
                    }}
                  />
                  <IonInput
                    placeholder="yourcompany"
                    value={formData.subdomain}
                    onIonInput={(e) => handleInputChange('subdomain', e.detail.value!)}
                    style={{
                      '--color': '#1f2937',
                      '--placeholder-color': '#9ca3af',
                      fontSize: '16px'
                    }}
                  />
                </IonItem>
                <div style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  paddingLeft: '8px',
                  marginTop: '4px'
                }}>
                  Your URL: {formData.subdomain || 'yourname'}.facecheck.com
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: '16px' }}>
                <IonItem
                  style={{
                    '--background': 'white',
                    '--border-radius': '12px',
                    '--padding-start': '16px',
                    '--padding-end': '16px',
                    '--min-height': '56px',
                    '--inner-padding-end': '0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    border: '1px solid #e5e7eb',
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
                    placeholder="Password (min 8 characters)"
                    value={formData.password}
                    onIonInput={(e) => handleInputChange('password', e.detail.value!)}
                    style={{
                      '--color': '#1f2937',
                      '--placeholder-color': '#9ca3af',
                      fontSize: '16px'
                    }}
                  />
                  <IonButton
                    fill="clear"
                    slot="end"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      '--color': '#6b7280',
                      '--padding-start': '8px',
                      '--padding-end': '0'
                    }}
                  >
                    <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} />
                  </IonButton>
                </IonItem>
              </div>

              {/* Confirm Password */}
              <div style={{ marginBottom: '20px' }}>
                <IonItem
                  style={{
                    '--background': 'white',
                    '--border-radius': '12px',
                    '--padding-start': '16px',
                    '--padding-end': '16px',
                    '--min-height': '56px',
                    '--inner-padding-end': '0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    border: '1px solid #e5e7eb',
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
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onIonInput={(e) => handleInputChange('confirmPassword', e.detail.value!)}
                    style={{
                      '--color': '#1f2937',
                      '--placeholder-color': '#9ca3af',
                      fontSize: '16px'
                    }}
                  />
                  <IonButton
                    fill="clear"
                    slot="end"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      '--color': '#6b7280',
                      '--padding-start': '8px',
                      '--padding-end': '0'
                    }}
                  >
                    <IonIcon icon={showConfirmPassword ? eyeOffOutline : eyeOutline} />
                  </IonButton>
                </IonItem>
              </div>
            </div>

            {/* Free Plan Features */}
            <div style={{
              background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '24px',
              border: '1px solid #0ea5e9'
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
                  background: '#0ea5e9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <IonIcon icon={starOutline} style={{ fontSize: '18px', color: 'white' }} />
                </div>
                <div>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#0369a1',
                    marginBottom: '2px'
                  }}>
                    Free Plan Includes
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  'Up to 10 members',
                  'AI face recognition',
                  'Real-time attendance',
                  'Mobile app access'
                ].map((feature, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <IonIcon
                      icon={checkmarkCircle}
                      style={{
                        color: '#059669',
                        fontSize: '16px'
                      }}
                    />
                    <span style={{
                      color: '#0369a1',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Create Account Button */}
            <IonButton
              expand="block"
              size="large"
              onClick={handleSignup}
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
                  Creating Account...
                </>
              ) : (
                'Create My Account'
              )}
            </IonButton>

            {/* Sign In Link */}
            <div style={{ textAlign: 'center' }}>
              <p style={{
                color: '#6b7280',
                fontSize: '16px',
                margin: '0'
              }}>
                Already have an account?{' '}
                <span
                  style={{
                    color: '#3b82f6',
                    fontWeight: '600',
                    textDecoration: 'underline',
                    cursor: 'pointer'
                  }}
                  onClick={() => history.push('/login')}
                >
                  Sign in here
                </span>
              </p>
            </div>
          </div>
        </div>

        <IonLoading
          isOpen={isLoading}
          message="Creating your account..."
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

export default SignupPage;