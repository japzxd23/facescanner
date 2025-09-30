import React, { useEffect } from 'react';
import {
  IonContent,
  IonPage,
  IonButton,
  IonIcon,
  IonCard,
  IonCardContent,
  IonChip
} from '@ionic/react';
import {
  checkmarkCircle,
  camera,
  people,
  shield,
  arrowForward,
  speedometerOutline,
  lockClosedOutline,
  flashOutline
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const history = useHistory();

  useEffect(() => {
    const checkExistingSession = () => {
      try {
        const membershipSession = localStorage.getItem('FaceCheckSession');
        if (membershipSession) {
          const sessionData = JSON.parse(membershipSession);
          if (sessionData && sessionData.organization) {
            history.replace('/admin/dashboard');
          }
        }
      } catch (error) {
        console.error('Error checking existing session:', error);
      }
    };

    checkExistingSession();
  }, [history]);

  const features = [
    {
      icon: camera,
      title: 'AI Face Recognition',
      description: 'Instant member ID with 99.7% accuracy',
      color: '#3b82f6'
    },
    {
      icon: speedometerOutline,
      title: 'Lightning Fast',
      description: 'Recognition in under 200ms',
      color: '#10b981'
    },
    {
      icon: people,
      title: 'Smart Management',
      description: 'Complete member database & logs',
      color: '#8b5cf6'
    },
    {
      icon: lockClosedOutline,
      title: 'Secure & Private',
      description: 'Bank-grade encryption',
      color: '#f59e0b'
    }
  ];

  return (
    <IonPage>
      <IonContent fullscreen className="ion-no-bounce">
        {/* Mobile-First Hero Section */}
        <div style={{
          background: 'linear-gradient(180deg, #1e293b 0%, #334155 100%)',
          minHeight: '100vh',
          padding: '0',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}>

          {/* Status Bar Spacer */}
          <div style={{ height: '44px', background: 'transparent' }} />

          {/* App Header */}
          <div style={{
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '20px',
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}>
                FS
              </div>
              <div>
                <div style={{
                  color: 'white',
                  fontSize: '18px',
                  fontWeight: '700',
                  lineHeight: '1'
                }}>
                  FaceCheck
                </div>
                <div style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '12px',
                  lineHeight: '1'
                }}>
                  Smart Attendance
                </div>
              </div>
            </div>

            <IonButton
              fill="clear"
              size="small"
              onClick={() => history.push('/login')}
              style={{
                '--color': 'rgba(255,255,255,0.9)',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Sign In
            </IonButton>
          </div>

          {/* Hero Content - Mobile Optimized */}
          <div style={{
            flex: 1,
            padding: '40px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: 'center'
          }}>

            {/* App Icon */}
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '28px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 32px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2), 0 0 0 8px rgba(59, 130, 246, 0.1)'
            }}>
              <IonIcon
                icon={camera}
                style={{
                  fontSize: '60px',
                  color: 'white'
                }}
              />
            </div>

            {/* Main Headline */}
            <h1 style={{
              color: 'white',
              fontSize: '32px',
              fontWeight: '800',
              lineHeight: '1.2',
              margin: '0 0 16px 0',
              textAlign: 'center'
            }}>
              Smart Face Recognition
              <br />
              Attendance System
            </h1>

            {/* Subtitle */}
            <p style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: '18px',
              lineHeight: '1.4',
              margin: '0 0 32px 0',
              maxWidth: '300px',
              marginLeft: 'auto',
              marginRight: 'auto'
            }}>
              Identify members instantly with AI-powered face recognition
            </p>

            {/* Key Stats */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '24px',
              marginBottom: '40px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  color: '#3b82f6',
                  fontSize: '24px',
                  fontWeight: '800',
                  lineHeight: '1'
                }}>
                  99.7%
                </div>
                <div style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '12px',
                  marginTop: '4px'
                }}>
                  Accuracy
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  color: '#10b981',
                  fontSize: '24px',
                  fontWeight: '800',
                  lineHeight: '1'
                }}>
                  &lt;200ms
                </div>
                <div style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '12px',
                  marginTop: '4px'
                }}>
                  Response
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  color: '#f59e0b',
                  fontSize: '24px',
                  fontWeight: '800',
                  lineHeight: '1'
                }}>
                  24/7
                </div>
                <div style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '12px',
                  marginTop: '4px'
                }}>
                  Available
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <IonButton
              expand="block"
              size="large"
              onClick={() => history.push('/signup')}
              style={{
                '--background': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                '--border-radius': '16px',
                '--padding-top': '16px',
                '--padding-bottom': '16px',
                fontSize: '18px',
                fontWeight: '700',
                margin: '0 0 16px 0',
                boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)'
              }}
            >
              Get Started Free
              <IonIcon icon={arrowForward} style={{ marginLeft: '8px' }} />
            </IonButton>

            <p style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '14px',
              margin: '0'
            }}>
              No credit card required • 30-day free trial
            </p>
          </div>
        </div>

        {/* Features Section - Mobile Cards */}
        <div style={{
          background: '#f8fafc',
          padding: '32px 20px'
        }}>
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0 0 8px 0'
            }}>
              Why Choose FaceCheck?
            </h2>
            <p style={{
              fontSize: '16px',
              color: '#6b7280',
              margin: '0'
            }}>
              Advanced features designed for modern organizations
            </p>
          </div>

          <div style={{
            display: 'grid',
            gap: '16px',
            gridTemplateColumns: '1fr 1fr'
          }}>
            {features.map((feature, index) => (
              <IonCard
                key={index}
                style={{
                  margin: '0',
                  borderRadius: '16px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  border: '1px solid #e5e7eb'
                }}
              >
                <IonCardContent style={{
                  padding: '20px',
                  textAlign: 'center'
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    background: `${feature.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    border: `1px solid ${feature.color}25`
                  }}>
                    <IonIcon
                      icon={feature.icon}
                      style={{
                        fontSize: '24px',
                        color: feature.color
                      }}
                    />
                  </div>

                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#1f2937',
                    margin: '0 0 8px 0',
                    lineHeight: '1.2'
                  }}>
                    {feature.title}
                  </h3>

                  <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    margin: '0',
                    lineHeight: '1.4'
                  }}>
                    {feature.description}
                  </p>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        </div>

        {/* Benefits Section - Mobile Optimized */}
        <div style={{
          background: 'white',
          padding: '32px 20px'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#1f2937',
              margin: '0 0 8px 0'
            }}>
              Transform Your Organization
            </h2>
            <p style={{
              fontSize: '16px',
              color: '#6b7280',
              margin: '0'
            }}>
              Join organizations saving time and improving security
            </p>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid #0ea5e9',
            marginBottom: '24px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '16px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: '#0ea5e9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <IonIcon icon={flashOutline} style={{ fontSize: '24px', color: 'white' }} />
              </div>
              <div>
                <div style={{
                  fontSize: '28px',
                  fontWeight: '800',
                  color: '#0ea5e9',
                  lineHeight: '1'
                }}>
                  85%
                </div>
                <div style={{
                  fontSize: '14px',
                  color: '#0369a1',
                  fontWeight: '500'
                }}>
                  Faster Check-ins
                </div>
              </div>
            </div>
            <p style={{
              fontSize: '14px',
              color: '#0369a1',
              margin: '0',
              lineHeight: '1.4'
            }}>
              Average improvement in processing time across all clients
            </p>
          </div>

          {/* Key Benefits List */}
          <div style={{ display: 'grid', gap: '12px' }}>
            {[
              'Eliminate buddy punching completely',
              'Automate attendance tracking',
              'Generate detailed reports',
              'Improve security protocols'
            ].map((benefit, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 0'
              }}>
                <IonIcon
                  icon={checkmarkCircle}
                  style={{
                    fontSize: '20px',
                    color: '#10b981',
                    flexShrink: 0
                  }}
                />
                <span style={{
                  fontSize: '16px',
                  color: '#374151',
                  fontWeight: '500'
                }}>
                  {benefit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA Section */}
        <div style={{
          background: '#1f2937',
          padding: '40px 20px',
          textAlign: 'center'
        }}>
          <h2 style={{
            color: 'white',
            fontSize: '24px',
            fontWeight: '700',
            margin: '0 0 12px 0'
          }}>
            Ready to Get Started?
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: '16px',
            margin: '0 0 32px 0',
            maxWidth: '280px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            Set up your organization in minutes and start saving time today
          </p>

          <IonButton
            expand="block"
            size="large"
            onClick={() => history.push('/signup')}
            style={{
              '--background': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              '--border-radius': '16px',
              '--padding-top': '16px',
              '--padding-bottom': '16px',
              fontSize: '18px',
              fontWeight: '700',
              margin: '0 0 16px 0',
              boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)'
            }}
          >
            Start Your Free Trial
            <IonIcon icon={arrowForward} style={{ marginLeft: '8px' }} />
          </IonButton>

          <IonButton
            expand="block"
            fill="outline"
            size="large"
            onClick={() => history.push('/login')}
            style={{
              '--border-color': '#6b7280',
              '--color': '#9ca3af',
              '--border-radius': '16px',
              '--padding-top': '16px',
              '--padding-bottom': '16px',
              fontSize: '16px',
              fontWeight: '600'
            }}
          >
            Sign In to Existing Account
          </IonButton>

          {/* Footer */}
          <div style={{
            marginTop: '40px',
            paddingTop: '24px',
            borderTop: '1px solid #374151'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <img
                src="/alatiris_logo.png"
                alt="Alatiris"
                style={{ height: '32px', opacity: 0.8 }}
              />
              <div style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Powered by Alatiris
              </div>
            </div>
            <p style={{
              color: 'rgba(255,255,255,0.6)',
              fontSize: '12px',
              margin: '0'
            }}>
              © 2024 FaceCheck by Alatiris. All rights reserved.
            </p>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LandingPage;