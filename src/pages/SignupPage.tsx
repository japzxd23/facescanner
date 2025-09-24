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
  lockClosed,
  eyeOutline,
  eyeOffOutline
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
              width: '200px',
              height: '200px',
              background: 'radial-gradient(circle, rgba(37, 99, 235, 0.1) 0%, transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(40px)'
            }} />

            <div style={{
              maxWidth: '600px',
              width: '100%',
              background: 'var(--enterprise-surface-primary)',
              borderRadius: 'var(--enterprise-radius-xl)',
              border: '1px solid var(--enterprise-border-subtle)',
              boxShadow: 'var(--enterprise-shadow-xl)',
              overflow: 'hidden'
            }}>
              <div style={{
                textAlign: 'center',
                padding: '48px 40px 24px',
                background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                color: 'white'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 24px',
                  backdropFilter: 'blur(10px)'
                }}>
                  <IonIcon icon={checkmarkCircle} style={{ fontSize: '48px', color: 'white' }} />
                </div>
                <h1 style={{
                  fontSize: '32px',
                  fontWeight: '800',
                  marginBottom: '16px',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}>
                  Welcome to MembershipScan!
                </h1>
                <p style={{
                  fontSize: '18px',
                  opacity: 0.9,
                  margin: 0,
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}>
                  Your organization has been created successfully
                </p>
              </div>

              <div style={{ padding: '40px' }}>
                <div style={{
                  background: 'var(--enterprise-surface-tertiary)',
                  border: '1px solid var(--enterprise-border-medium)',
                  borderRadius: 'var(--enterprise-radius-lg)',
                  padding: '32px',
                  marginBottom: '32px'
                }}>
                  <h3 style={{
                    color: 'var(--ion-color-primary)',
                    margin: '0 0 16px 0',
                    fontSize: '20px',
                    fontWeight: '700',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}>
                    🔑 Your API Key
                  </h3>
                  <p style={{
                    color: 'var(--ion-color-medium)',
                    fontSize: '14px',
                    margin: '0 0 20px 0',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}>
                    Save this API key securely. You'll need it to configure your scanner app and mobile applications.
                  </p>
                  <div style={{
                    background: 'var(--enterprise-surface-primary)',
                    padding: '20px',
                    borderRadius: 'var(--enterprise-radius-md)',
                    border: '1px solid var(--enterprise-border-subtle)',
                    marginBottom: '20px',
                    fontFamily: 'Monaco, monospace'
                  }}>
                    <code style={{
                      color: 'var(--ion-text-color)',
                      fontSize: '14px',
                      wordBreak: 'break-all',
                      lineHeight: '1.5'
                    }}>
                      {apiKey}
                    </code>
                  </div>
                  <IonButton
                    fill="outline"
                    color="primary"
                    onClick={copyApiKey}
                    style={{
                      '--border-radius': 'var(--enterprise-radius-md)',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontWeight: '600'
                    }}
                  >
                    📋 Copy API Key
                  </IonButton>
                </div>

                <div style={{
                  background: 'var(--enterprise-surface-secondary)',
                  borderRadius: 'var(--enterprise-radius-lg)',
                  padding: '24px',
                  marginBottom: '32px'
                }}>
                  <h4 style={{
                    color: 'var(--ion-text-color)',
                    margin: '0 0 16px 0',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontWeight: '600'
                  }}>
                    Organization Details
                  </h4>
                  <div style={{
                    color: 'var(--ion-color-medium)',
                    fontSize: '15px',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px'
                    }}>
                      <span>Organization:</span>
                      <span style={{ fontWeight: '600', color: 'var(--ion-text-color)' }}>
                        {formData.organizationName}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px'
                    }}>
                      <span>Subdomain:</span>
                      <span style={{ fontWeight: '600', color: 'var(--ion-text-color)' }}>
                        {formData.subdomain}.membershipscan.com
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}>
                      <span>Plan:</span>
                      <span style={{
                        fontWeight: '600',
                        color: 'var(--ion-color-success)',
                        background: 'rgba(5, 150, 105, 0.1)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        FREE (10 members)
                      </span>
                    </div>
                  </div>
                </div>

                <IonButton
                  expand="block"
                  color="primary"
                  onClick={() => history.push('/login')}
                  style={{
                    '--border-radius': 'var(--enterprise-radius-md)',
                    '--padding-top': '16px',
                    '--padding-bottom': '16px',
                    fontSize: '16px',
                    fontWeight: '600',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    textTransform: 'none'
                  }}
                >
                  Continue to Dashboard
                </IonButton>
              </div>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

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
            top: '10%',
            right: '15%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(40px)'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '15%',
            left: '10%',
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle, rgba(124, 58, 237, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(40px)'
          }} />

          <div style={{
            maxWidth: '600px',
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
                Create Your Account
              </h1>
              <p style={{
                color: 'var(--ion-color-medium)',
                margin: 0,
                fontSize: '16px',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>
                Start your free organization with 10 members included
              </p>
            </div>

            {/* Form */}
            <div style={{ padding: '40px' }}>
              <div style={{ marginBottom: '32px' }}>
                {/* Full Name */}
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
                    <IonIcon icon={person} style={{ color: 'var(--ion-color-primary)', fontSize: '20px' }} />
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
                        Full Name
                      </label>
                      <IonInput
                        value={formData.fullName}
                        onIonInput={(e) => handleInputChange('fullName', e.detail.value!)}
                        placeholder="Enter your full name"
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

                {/* Email */}
                <div className="enterprise-input" style={{
                  marginBottom: '20px',
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
                  marginBottom: '20px',
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
                          placeholder="Create a secure password (min 8 characters)"
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
                          <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} />
                        </IonButton>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="enterprise-input" style={{
                  marginBottom: '20px',
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
                        Confirm Password
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <IonInput
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onIonInput={(e) => handleInputChange('confirmPassword', e.detail.value!)}
                          placeholder="Confirm your password"
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
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={{ margin: 0, '--color': 'var(--ion-color-medium)' }}
                        >
                          <IonIcon icon={showConfirmPassword ? eyeOffOutline : eyeOutline} />
                        </IonButton>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Organization Name */}
                <div className="enterprise-input" style={{
                  marginBottom: '20px',
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
                    <IonIcon icon={business} style={{ color: 'var(--ion-color-primary)', fontSize: '20px' }} />
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
                        Organization Name
                      </label>
                      <IonInput
                        value={formData.organizationName}
                        onIonInput={(e) => handleInputChange('organizationName', e.detail.value!)}
                        placeholder="Your company or organization"
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

                {/* Subdomain */}
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
                    <IonIcon icon={business} style={{ color: 'var(--ion-color-primary)', fontSize: '20px' }} />
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
                        Subdomain
                      </label>
                      <IonInput
                        value={formData.subdomain}
                        onIonInput={(e) => handleInputChange('subdomain', e.detail.value!)}
                        placeholder="yourcompany"
                        style={{
                          '--color': '#1f2937',
                          '--placeholder-color': 'var(--ion-color-medium)',
                          '--padding-start': '0',
                          '--padding-end': '0',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          color: '#1f2937'
                        }}
                      />
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--ion-color-medium)',
                        marginTop: '4px',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        Your URL: {formData.subdomain || 'yourname'}.membershipscan.com
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Features highlight */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(124, 58, 237, 0.05) 100%)',
                border: '1px solid rgba(37, 99, 235, 0.2)',
                borderRadius: 'var(--enterprise-radius-lg)',
                padding: '24px',
                marginBottom: '32px'
              }}>
                <h4 style={{
                  color: 'var(--ion-color-primary)',
                  fontSize: '16px',
                  fontWeight: '700',
                  margin: '0 0 16px 0',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}>
                  ✨ Your Free Plan Includes:
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px'
                }}>
                  {[
                    'Up to 10 members',
                    'AI face recognition',
                    'Real-time attendance',
                    'Mobile app access',
                    'Secure API access',
                    'Basic analytics'
                  ].map((feature, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <IonIcon
                        icon={checkmarkCircle}
                        style={{
                          color: 'var(--ion-color-success)',
                          fontSize: '16px'
                        }}
                      />
                      <span style={{
                        color: 'var(--ion-text-color)',
                        fontSize: '14px',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <IonButton
                expand="block"
                color="primary"
                onClick={handleSignup}
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
                {isLoading ? 'Creating Account...' : 'Create My Account'}
              </IonButton>

              {/* Sign in link */}
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  color: 'var(--ion-color-medium)',
                  fontSize: '14px',
                  fontFamily: 'Inter, system-ui, sans-serif'
                }}>
                  Already have an account?{' '}
                  <span
                    style={{
                      color: 'var(--ion-color-primary)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontWeight: '600'
                    }}
                    onClick={() => history.push('/login')}
                  >
                    Sign in here
                  </span>
                </span>
              </div>
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