import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonPage,
  IonButton,
  IonInput,
  IonAlert,
  IonLoading,
  IonIcon,
  IonSpinner
} from '@ionic/react';
import { logoGoogle, arrowBack, shieldCheckmark } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { signInWithGoogle } from '../services/authService';

const AuthPage: React.FC = () => {
  const history = useHistory();
  const [isLoading, setIsLoading] = useState(false);
  const [showOrgSetup, setShowOrgSetup] = useState(false);
  const [organizationName, setOrganizationName] = useState('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertHeader, setAlertHeader] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // Handle OAuth callback from deep link (Custom Tabs)
    const handleOAuthCallback = async () => {
      console.log('🚀 useEffect triggered, checking for OAuth tokens...');

      // Check sessionStorage first (from deep link), then URL hash (from web)
      let hash = sessionStorage.getItem('oauth_callback_hash') || window.location.hash;
      console.log('📍 Hash source:', sessionStorage.getItem('oauth_callback_hash') ? 'sessionStorage' : 'URL');
      console.log('📍 Hash value:', hash);

      // Clear sessionStorage after reading
      if (sessionStorage.getItem('oauth_callback_hash')) {
        sessionStorage.removeItem('oauth_callback_hash');
      }

      if (!hash || hash.length <= 1) {
        console.log('ℹ️ No OAuth tokens found, waiting for callback...');
        return;
      }

      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      console.log('🔍 Token check:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken
      });

      if (accessToken && refreshToken) {
        console.log('🔑 OAuth tokens found in URL hash');
        setIsLoading(true);

        try {
          console.log('⏳ Setting Supabase session...');
          // Set Supabase session with tokens
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (sessionError) {
            console.error('❌ Error setting session:', sessionError);
            setIsLoading(false);
            setAlertHeader('Authentication Error');
            setAlertMessage(sessionError.message);
            setShowAlert(true);
            return;
          }

          console.log('✅ Session set successfully');

          // Get user from session
          console.log('⏳ Getting user from session...');
          const { data: { user }, error: userError } = await supabase.auth.getUser();

          console.log('📊 User fetch result:', { user: user?.email, error: userError });

          if (user) {
            console.log('✅ OAuth successful for:', user.email);
            console.log('👤 User metadata:', user.user_metadata);

            // Clear hash from URL
            window.history.replaceState({}, document.title, '/auth');

            // Process user authentication
            console.log('🔄 Checking if user exists in organization_users...');

            try {
              const { data: orgUser, error: orgError } = await supabase
                .from('organization_users')
                .select('*, organizations(*)')
                .eq('email', user.email)
                .eq('is_active', true)
                .single();

              console.log('📊 Organization user check:', { orgUser, orgError });

              if (orgUser && orgUser.organizations) {
                // Existing user - redirect to dashboard
                console.log('✅ Existing user found, redirecting to dashboard');
                const sessionData = {
                  user: {
                    id: orgUser.id,
                    email: orgUser.email,
                    full_name: orgUser.full_name,
                    role: orgUser.role
                  },
                  organization: orgUser.organizations,
                  timestamp: Date.now()
                };
                localStorage.setItem('FaceCheckSession', JSON.stringify(sessionData));
                setIsLoading(false);
                window.location.href = '/admin/dashboard';
              } else {
                // New user - show org setup
                console.log('🆕 New user, showing organization setup');
                setUserEmail(user.email);
                setUserName(user.user_metadata?.full_name || user.user_metadata?.name || '');
                setIsLoading(false);
                setShowOrgSetup(true);
              }
            } catch (dbError: any) {
              console.error('❌ Database error:', dbError);
              // If DB check fails, show org setup anyway
              console.log('⚠️ DB check failed, showing org setup');
              setUserEmail(user.email);
              setUserName(user.user_metadata?.full_name || user.user_metadata?.name || '');
              setIsLoading(false);
              setShowOrgSetup(true);
            }
          } else {
            console.error('❌ No user found after setting session');
            setIsLoading(false);
            setAlertHeader('Authentication Error');
            setAlertMessage('Failed to get user information');
            setShowAlert(true);
          }
        } catch (error: any) {
          console.error('❌ OAuth error:', error);
          setIsLoading(false);
          setAlertHeader('Authentication Error');
          setAlertMessage(error.message);
          setShowAlert(true);
        }
      }
    };

    // Run on mount
    handleOAuthCallback();

    // Also listen for custom event from deep link handler
    const oauthListener = (event: Event) => {
      console.log('📢 OAuth callback event received');
      handleOAuthCallback();
    };

    window.addEventListener('oauth_callback', oauthListener);

    return () => {
      window.removeEventListener('oauth_callback', oauthListener);
    };
  }, []);

  const handleSuccessfulAuth = async (user: any, skipSessionCheck = false) => {
    try {
      console.log('🔐 handleSuccessfulAuth called for:', user.email);
      setIsLoading(true);

      // If we already know there's no session (bypassed auth), skip straight to org setup
      if (skipSessionCheck) {
        console.log('⚡ Skipping session check, going directly to org setup');
        setUserEmail(user.email || '');
        setUserName(user.user_metadata?.full_name || user.user_metadata?.name || '');
        window.history.replaceState({}, document.title, '/auth');
        setIsLoading(false);
        setShowOrgSetup(true);
        return;
      }

      // Important: Ensure Supabase client has authentication context for RLS
      // Try to get current session, if none exists, the query will fail with RLS
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (!currentSession) {
        console.warn('⚠️ No Supabase session found, RLS queries may fail');
        console.log('💡 Treating as new user due to missing session');

        // Skip database check and go straight to org setup for new users
        setUserEmail(user.email || '');
        setUserName(user.user_metadata?.full_name || user.user_metadata?.name || '');
        window.history.replaceState({}, document.title, '/auth');
        setIsLoading(false);
        setShowOrgSetup(true);
        return;
      }

      // Check if user already exists in organization_users with timeout
      console.log('⏳ Querying organization_users table with authenticated session...');
      const queryPromise = supabase
        .from('organization_users')
        .select('*, organizations(*)')
        .eq('email', user.email)
        .eq('is_active', true)
        .single();

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Query timeout')), 10000)
      );

      let existingUser = null;
      let userError = null;

      try {
        const result = await Promise.race([queryPromise, timeoutPromise]) as any;
        existingUser = result.data;
        userError = result.error;
        console.log('📊 Existing user check:', { existingUser, userError });
      } catch (timeoutError: any) {
        if (timeoutError.message === 'Query timeout') {
          console.log('⏱️ Query timed out, treating as new user');
          existingUser = null;
          userError = null;
        } else {
          throw timeoutError;
        }
      }

      if (existingUser && existingUser.organizations) {
        // Existing user - log them in
        console.log('✅ Existing user found, redirecting to dashboard');
        const sessionData = {
          user: {
            id: existingUser.id,
            email: existingUser.email,
            full_name: existingUser.full_name,
            role: existingUser.role
          },
          organization: existingUser.organizations
        };
        localStorage.setItem('FaceCheckSession', JSON.stringify(sessionData));
        window.location.href = '/admin/dashboard';
      } else {
        // New user - need to setup organization
        console.log('🆕 New user, showing organization setup');
        console.log('📧 User email:', user.email);
        console.log('👤 User name:', user.user_metadata?.full_name || user.user_metadata?.name);

        setUserEmail(user.email || '');
        setUserName(user.user_metadata?.full_name || user.user_metadata?.name || '');

        // Clear the hash from URL to prevent re-processing
        window.history.replaceState({}, document.title, '/auth');

        console.log('⏸️ Setting isLoading to FALSE');
        setIsLoading(false);
        console.log('📋 Setting showOrgSetup to TRUE');
        setShowOrgSetup(true);
      }
    } catch (error: any) {
      console.error('❌ Auth handling error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setIsLoading(false);
      setAlertHeader('Authentication Error');
      setAlertMessage(error.message || 'Failed to complete authentication');
      setShowAlert(true);
    } finally {
      // Ensure loading is always cleared
      console.log('🏁 handleSuccessfulAuth finally block');
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      // Initiate OAuth (opens Custom Tabs)
      const result = await signInWithGoogle();

      if (!result.success) {
        setAlertHeader('Sign-In Failed');
        setAlertMessage(result.error || 'Failed to sign in with Google. Please try again.');
        setShowAlert(true);
        return;
      }

      // OAuth initiated - Custom Tabs opens
      // Deep link callback will handle the rest (see useEffect above)
      console.log('✅ OAuth initiated, waiting for callback...');
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      setAlertHeader('Sign-In Failed');
      setAlertMessage(error.message || 'Failed to sign in with Google. Please try again.');
      setShowAlert(true);
    }
  };

  const handleOrganizationSetup = async () => {
    if (!organizationName.trim()) {
      setAlertHeader('Missing Information');
      setAlertMessage('Please enter your organization name');
      setShowAlert(true);
      return;
    }

    setIsLoading(true);
    try {
      // Generate subdomain from organization name
      const subdomain = organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);

      // Generate API key
      const apiKey = `fck_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: organizationName,
          subdomain,
          api_key: apiKey,
          plan_type: 'free',
          member_limit: 50,
          is_active: true
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('No authenticated user found');

      // Create organization user
      const { data: orgUser, error: userError } = await supabase
        .from('organization_users')
        .insert({
          organization_id: org.id,
          email: user.email,
          full_name: userName || user.user_metadata?.full_name || user.email,
          role: 'owner',
          is_active: true,
          google_id: user.id
        })
        .select()
        .single();

      if (userError) throw userError;

      // Create session
      const sessionData = {
        user: {
          id: orgUser.id,
          email: orgUser.email,
          full_name: orgUser.full_name,
          role: orgUser.role
        },
        organization: org
      };

      localStorage.setItem('FaceCheckSession', JSON.stringify(sessionData));

      // Redirect to admin dashboard
      window.location.href = '/admin/dashboard';

    } catch (error: any) {
      console.error('Organization setup error:', error);
      setIsLoading(false);
      setAlertHeader('Setup Failed');
      setAlertMessage(error.message || 'Failed to create organization. Please try again.');
      setShowAlert(true);
    }
  };

  if (showOrgSetup) {
    console.log('🎨 Rendering organization setup page', {
      isLoading,
      showOrgSetup,
      userEmail,
      userName,
      organizationName
    });

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
            <div style={{
              maxWidth: '500px',
              width: '100%',
              background: 'white',
              borderRadius: '24px',
              padding: '48px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              position: 'relative',
              zIndex: 10
            }}>
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏢</div>
                <h1 style={{
                  fontSize: '28px',
                  fontWeight: '800',
                  color: '#1f2937',
                  marginBottom: '8px'
                }}>
                  Setup Your Organization
                </h1>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>
                  Welcome, {userName || userEmail}! Let's create your workspace.
                </p>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Organization Name
                </label>
                <IonInput
                  value={organizationName}
                  onIonInput={(e) => setOrganizationName(e.detail.value!)}
                  placeholder="e.g., Acme Corporation"
                  class="custom-input"
                  style={{
                    '--background': '#f3f4f6',
                    '--padding-start': '16px',
                    '--padding-end': '16px',
                    '--padding-top': '12px',
                    '--padding-bottom': '12px',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    marginBottom: '8px',
                    position: 'relative',
                    zIndex: 1
                  }}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                  This will be used to identify your workspace and members.
                </p>
              </div>

              <IonButton
                expand="block"
                onClick={handleOrganizationSetup}
                disabled={isLoading || !organizationName.trim()}
                style={{
                  '--border-radius': '12px',
                  '--padding-top': '16px',
                  '--padding-bottom': '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '16px',
                  position: 'relative',
                  zIndex: 1,
                  pointerEvents: 'auto'
                }}
              >
                {isLoading ? <IonSpinner name="dots" /> : 'Create Organization'}
              </IonButton>

              <div style={{
                background: '#dbeafe',
                border: '1px solid #93c5fd',
                borderRadius: '12px',
                padding: '16px',
                marginTop: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <IonIcon icon={shieldCheckmark} style={{ fontSize: '24px', color: '#2563eb' }} />
                  <div style={{ fontSize: '13px', color: '#1e40af' }}>
                    <strong>Secure Setup:</strong> Your organization will be created with enterprise-grade security and encryption.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <IonLoading
            isOpen={isLoading}
            message="Creating your organization..."
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
            maxWidth: '480px',
            width: '100%',
            background: 'white',
            borderRadius: '24px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            position: 'relative',
            zIndex: 10
          }}>
            {/* Header */}
            <div style={{
              textAlign: 'center',
              padding: '48px 40px 32px',
              borderBottom: '1px solid #e5e7eb'
            }}>
              <IonButton
                fill="clear"
                color="primary"
                onClick={() => history.push('/')}
                style={{
                  position: 'absolute',
                  top: '24px',
                  left: '24px'
                }}
              >
                <IonIcon icon={arrowBack} />
              </IonButton>

              <div style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#2563eb',
                marginBottom: '8px'
              }}>
                FaceCheck
              </div>

              <h1 style={{
                fontSize: '32px',
                fontWeight: '800',
                marginBottom: '12px',
                color: '#1f2937'
              }}>
                Welcome
              </h1>
              <p style={{
                color: '#6b7280',
                margin: 0,
                fontSize: '16px'
              }}>
                Sign in to access your organization dashboard
              </p>
            </div>

            {/* Authentication Section */}
            <div style={{ padding: '40px' }}>
              {/* Google Sign-In Button */}
              <IonButton
                expand="block"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                style={{
                  '--background': '#ffffff',
                  '--background-hover': '#f9fafb',
                  '--color': '#1f2937',
                  '--border-radius': '12px',
                  '--padding-top': '16px',
                  '--padding-bottom': '16px',
                  '--box-shadow': '0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)',
                  fontSize: '16px',
                  fontWeight: '600',
                  marginBottom: '24px',
                  border: '1px solid #e5e7eb'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <IonIcon icon={logoGoogle} style={{ fontSize: '20px', color: '#4285f4' }} />
                  <span>Continue with Google</span>
                </div>
              </IonButton>

              {/* Security Features */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.05) 0%, rgba(37, 99, 235, 0.05) 100%)',
                border: '1px solid rgba(5, 150, 105, 0.2)',
                borderRadius: '16px',
                padding: '20px',
                marginBottom: '24px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px'
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
                      color: '#059669',
                      fontSize: '14px',
                      fontWeight: '600',
                      margin: 0
                    }}>
                      Enterprise-Grade Security
                    </p>
                  </div>
                </div>
                <ul style={{
                  margin: 0,
                  paddingLeft: '20px',
                  color: '#6b7280',
                  fontSize: '13px',
                  lineHeight: '1.6'
                }}>
                  <li>Secure OAuth 2.0 authentication via Google</li>
                  <li>End-to-end encrypted data transmission</li>
                  <li>Multi-factor authentication support</li>
                  <li>Automatic session management</li>
                </ul>
              </div>

              {/* Support link */}
              <div style={{
                textAlign: 'center',
                paddingTop: '24px',
                borderTop: '1px solid #e5e7eb'
              }}>
                <span style={{
                  color: '#6b7280',
                  fontSize: '12px'
                }}>
                  Need help? Contact support at{' '}
                  <span style={{ color: '#2563eb', fontWeight: '600' }}>
                    help@facecheck.com
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <IonLoading
          isOpen={isLoading && !showOrgSetup}
          message="Signing you in securely..."
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

export default AuthPage;