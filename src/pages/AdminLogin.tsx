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
  IonSpinner
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { signIn, getCurrentUser } from '../services/supabaseClient';

const AdminLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const history = useHistory();

  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      if (user) {
        history.push('/admin/dashboard');
      }
    } catch (error) {
      console.error('Error checking current user:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await signIn(email, password);
      
      if (error) {
        setError(error.message);
      } else if (data.user) {
        history.push('/admin/dashboard');
      }
    } catch (error) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Admin Login</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '20px'
        }}>
          <IonCard className="clean-card" style={{ width: '100%', maxWidth: '400px' }}>
            <IonCardContent>
              <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h1>FaceCheck Admin</h1>
                <p style={{ color: '#666', margin: 0 }}>
                  Sign in to manage members and view logs
                </p>
              </div>

              <form onSubmit={handleLogin}>
                <IonItem>
                  <IonInput
                    label="Email"
                    labelPlacement="floating"
                    type="email"
                    value={email}
                    onIonInput={(e) => setEmail(e.detail.value!)}
                    required
                  />
                </IonItem>

                <IonItem>
                  <IonInput
                    label="Password"
                    labelPlacement="floating"
                    type="password"
                    value={password}
                    onIonInput={(e) => setPassword(e.detail.value!)}
                    required
                  />
                </IonItem>

                {error && (
                  <IonText color="danger" style={{ display: 'block', padding: '10px' }}>
                    {error}
                  </IonText>
                )}

                <IonButton
                  type="submit"
                  expand="block"
                  style={{ margin: '20px 0 10px 0' }}
                  disabled={loading || !email || !password}
                >
                  {loading ? <IonSpinner /> : 'Sign In'}
                </IonButton>
              </form>

              <div style={{
                textAlign: 'center',
                marginTop: '20px',
                padding: '15px',
                background: '#f8fafc',
                borderRadius: '8px',
                fontSize: '0.9em'
              }}>
                <p style={{ margin: 0, fontWeight: 600 }}>Demo Credentials:</p>
                <p style={{ margin: '5px 0 0 0' }}>
                  You'll need to set up Supabase authentication first.
                </p>
              </div>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default AdminLogin;