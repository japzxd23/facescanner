import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonButton,
  IonIcon,
  IonText,
  IonInput,
  IonItem,
  IonLabel,
  IonAlert,
  IonBadge
} from '@ionic/react';
import { arrowBack, key, checkmark, warning, scan } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase, setOrganizationContext } from '../services/supabaseClient';
import { useOrganization } from '../contexts/OrganizationContext';

const ApiConfigPage: React.FC = () => {
  const history = useHistory();
  const { setOrganizationData } = useOrganization();
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertHeader, setAlertHeader] = useState('');
  const [organizationInfo, setOrganizationInfo] = useState<any>(null);

  const validateApiKey = async () => {
    if (!apiKey.trim()) {
      setAlertHeader('Missing API Key');
      setAlertMessage('Please enter your API key');
      setShowAlert(true);
      return;
    }

    setIsLoading(true);
    try {
      // Validate API key by looking up organization
      const { data: organization, error } = await supabase
        .from('organizations')
        .select(`
          *,
          organization_users (
            id,
            email,
            full_name,
            role
          )
        `)
        .eq('api_key', apiKey.trim())
        .eq('is_active', true)
        .single();

      if (error || !organization) {
        setAlertHeader('Invalid API Key');
        setAlertMessage('The API key you entered is not valid. Please check your key and try again.');
        setShowAlert(true);
        setIsLoading(false);
        return;
      }

      // Set organization context and user data
      const primaryUser = organization.organization_users[0];
      if (primaryUser) {
        setOrganizationData(organization, primaryUser);
        setOrganizationInfo(organization);
        setAlertHeader('Success!');
        setAlertMessage(`Connected to ${organization.name}. You can now use the scanner.`);
        setShowAlert(true);
      } else {
        setAlertHeader('Configuration Error');
        setAlertMessage('This organization has no users configured. Please contact support.');
        setShowAlert(true);
      }
    } catch (error) {
      console.error('API key validation error:', error);
      setAlertHeader('Connection Error');
      setAlertMessage('Unable to validate API key. Please check your internet connection and try again.');
      setShowAlert(true);
    } finally {
      setIsLoading(false);
    }
  };

  const clearConfiguration = () => {
    setApiKey('');
    setOrganizationInfo(null);
    localStorage.removeItem('membershipScanSession');
  };

  const goToScanner = () => {
    history.push('/camera');
  };

  const handleAlertDismiss = () => {
    setShowAlert(false);
    if (organizationInfo && alertHeader === 'Success!') {
      // Redirect to scanner after successful configuration
      goToScanner();
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': '#1a1d29', '--color': '#e2e8f0' }}>
          <IonButton
            fill="clear"
            slot="start"
            onClick={() => history.push('/')}
            style={{ '--color': '#3b82f6' }}
          >
            <IonIcon icon={arrowBack} />
          </IonButton>
          <IonTitle>API Configuration</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen style={{ '--background': '#0f1419' }}>
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
          {/* Header Section */}
          <IonCard className="clean-card">
            <IonCardHeader style={{ textAlign: 'center' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                border: '2px solid #3b82f6'
              }}>
                <IonIcon icon={key} style={{ fontSize: '40px', color: '#3b82f6' }} />
              </div>
              <IonCardTitle style={{ color: '#e2e8f0', fontSize: '24px' }}>
                Configure Your Scanner
              </IonCardTitle>
              <p style={{ color: '#9ca3af', margin: '10px 0 0 0' }}>
                Enter your organization's API key to connect to MembershipScan
              </p>
            </IonCardHeader>
          </IonCard>

          {/* Configuration Form */}
          <IonCard className="clean-card">
            <IonCardContent>
              <IonItem style={{ '--background': 'rgba(42, 47, 62, 0.5)', '--border-radius': '12px', marginBottom: '20px' }}>
                <IonIcon icon={key} slot="start" color="primary" />
                <IonLabel position="stacked" style={{ color: '#9ca3af' }}>API Key</IonLabel>
                <IonInput
                  value={apiKey}
                  onIonInput={(e) => setApiKey(e.detail.value!)}
                  placeholder="Enter your organization's API key"
                  style={{ color: '#e2e8f0' }}
                />
              </IonItem>

              <IonButton
                expand="block"
                color="primary"
                onClick={validateApiKey}
                disabled={isLoading || !apiKey.trim()}
                style={{ marginBottom: '16px' }}
              >
                {isLoading ? 'Validating...' : 'Connect'}
              </IonButton>

              {organizationInfo && (
                <div style={{
                  background: 'rgba(5, 150, 105, 0.1)',
                  border: '1px solid rgba(5, 150, 105, 0.3)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginTop: '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                    <IonIcon icon={checkmark} style={{ color: '#059669', marginRight: '8px' }} />
                    <span style={{ color: '#6ee7b7', fontWeight: '600' }}>Connected Successfully</span>
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '14px' }}>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Organization:</strong> {organizationInfo.name}
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Plan:</strong>
                      <IonBadge color="primary" style={{ marginLeft: '8px' }}>
                        {organizationInfo.plan_type.charAt(0).toUpperCase() + organizationInfo.plan_type.slice(1)}
                      </IonBadge>
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      <strong>Member Limit:</strong> {organizationInfo.member_limit}
                    </p>
                  </div>

                  <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                    <IonButton
                      size="small"
                      color="primary"
                      onClick={goToScanner}
                    >
                      <IonIcon icon={scan} slot="start" />
                      Open Scanner
                    </IonButton>
                    <IonButton
                      size="small"
                      fill="outline"
                      color="medium"
                      onClick={clearConfiguration}
                    >
                      Clear
                    </IonButton>
                  </div>
                </div>
              )}
            </IonCardContent>
          </IonCard>

          {/* Instructions */}
          <IonCard className="clean-card">
            <IonCardHeader>
              <IonCardTitle style={{ color: '#e2e8f0' }}>How to get your API Key</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <div style={{ color: '#9ca3af', fontSize: '14px' }}>
                <ol style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
                  <li>Visit the MembershipScan website</li>
                  <li>Sign up for an account or log in</li>
                  <li>Go to your organization dashboard</li>
                  <li>Copy your API key from the dashboard</li>
                  <li>Paste it here to configure your scanner</li>
                </ol>
              </div>

              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <IonIcon icon={warning} style={{ color: '#f59e0b', marginRight: '8px' }} />
                  <span style={{ color: '#fcd34d', fontWeight: '600', fontSize: '14px' }}>
                    Keep your API key secure
                  </span>
                </div>
                <p style={{ color: '#fde68a', fontSize: '12px', margin: 0 }}>
                  Your API key provides access to your organization's data. Don't share it publicly.
                </p>
              </div>
            </IonCardContent>
          </IonCard>
        </div>

        <IonAlert
          isOpen={showAlert}
          onDidDismiss={handleAlertDismiss}
          header={alertHeader}
          message={alertMessage}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  );
};

export default ApiConfigPage;