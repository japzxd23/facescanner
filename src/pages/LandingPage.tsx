import React from 'react';
import {
  IonContent,
  IonPage,
  IonButton,
  IonText,
  IonIcon,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle
} from '@ionic/react';
import {
  checkmarkCircle,
  camera,
  people,
  analytics,
  shield,
  cloud,
  star,
  arrowForward
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const history = useHistory();

  const features = [
    {
      icon: camera,
      title: 'AI Face Recognition',
      description: 'Advanced facial recognition technology for accurate member identification'
    },
    {
      icon: people,
      title: 'Member Management',
      description: 'Easy-to-use dashboard for managing members and their access levels'
    },
    {
      icon: analytics,
      title: 'Analytics & Reports',
      description: 'Detailed attendance tracking and comprehensive reporting tools'
    },
    {
      icon: shield,
      title: 'Enterprise Security',
      description: 'Bank-level security with encrypted data and secure API access'
    },
    {
      icon: cloud,
      title: 'Cloud-Based',
      description: 'Access your data anywhere with our secure cloud infrastructure'
    }
  ];

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      members: '10 members',
      features: [
        'Face recognition scanning',
        'Basic member management',
        'Attendance tracking',
        'Mobile app access',
        'API access'
      ],
      popular: false
    },
    {
      name: 'Pro',
      price: '$29',
      period: 'per month',
      members: '100 members',
      features: [
        'Everything in Free',
        'Advanced analytics',
        'Export reports',
        'Priority support',
        'Custom branding',
        'Webhook integrations'
      ],
      popular: true
    },
    {
      name: 'Enterprise',
      price: '$99',
      period: 'per month',
      members: 'Unlimited members',
      features: [
        'Everything in Pro',
        'White-label solution',
        'Custom integrations',
        'Dedicated support',
        'SLA guarantee',
        'On-premise option'
      ],
      popular: false
    }
  ];

  return (
    <IonPage>
      <IonContent fullscreen>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1a1d29 0%, #2a2f3e 100%)',
          minHeight: '100vh',
          color: '#e2e8f0'
        }}>
          {/* Navigation */}
          <div style={{
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#3b82f6',
              fontFamily: '"Segoe UI", system-ui, sans-serif'
            }}>
              MembershipScan
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <IonButton
                fill="clear"
                color="primary"
                onClick={() => history.push('/login')}
              >
                Sign In
              </IonButton>
              <IonButton
                color="primary"
                onClick={() => history.push('/signup')}
              >
                Get Started
                <IonIcon icon={arrowForward} slot="end" />
              </IonButton>
            </div>
          </div>

          {/* Hero Section */}
          <div style={{
            padding: '80px 24px',
            textAlign: 'center',
            maxWidth: '1200px',
            margin: '0 auto'
          }}>
            <h1 style={{
              fontSize: '48px',
              fontWeight: 'bold',
              marginBottom: '24px',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: '1.2'
            }}>
              Smart Face Recognition for Modern Businesses
            </h1>

            <p style={{
              fontSize: '20px',
              color: '#9ca3af',
              marginBottom: '40px',
              maxWidth: '600px',
              margin: '0 auto 40px auto',
              lineHeight: '1.6'
            }}>
              Transform your membership management with AI-powered face recognition.
              Secure, fast, and incredibly easy to use.
            </p>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <IonButton
                size="large"
                color="primary"
                onClick={() => history.push('/signup')}
                style={{ '--padding-start': '32px', '--padding-end': '32px' }}
              >
                Start Free Trial
                <IonIcon icon={arrowForward} slot="end" />
              </IonButton>
              <IonButton
                size="large"
                fill="outline"
                color="primary"
                onClick={() => history.push('/demo')}
                style={{ '--padding-start': '32px', '--padding-end': '32px' }}
              >
                <IonIcon icon={camera} slot="start" />
                View Demo
              </IonButton>
            </div>

            <div style={{
              marginTop: '60px',
              padding: '32px',
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: '16px',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <p style={{ color: '#3b82f6', fontSize: '14px', margin: '0 0 8px 0' }}>
                ✨ Special Launch Offer
              </p>
              <p style={{ color: '#e2e8f0', fontSize: '18px', margin: 0 }}>
                Get started with <strong>10 members free</strong> - no credit card required
              </p>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div style={{
          background: '#0f1419',
          padding: '80px 24px',
          color: '#e2e8f0'
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{
              fontSize: '36px',
              fontWeight: 'bold',
              marginBottom: '16px',
              color: '#e2e8f0'
            }}>
              Powerful Features for Every Business
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#9ca3af',
              marginBottom: '60px'
            }}>
              Everything you need to manage member access with cutting-edge technology
            </p>

            <IonGrid>
              <IonRow>
                {features.map((feature, index) => (
                  <IonCol size="12" sizeMd="6" sizeLg="4" key={index}>
                    <div style={{
                      padding: '32px',
                      textAlign: 'center',
                      height: '100%'
                    }}>
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'rgba(59, 130, 246, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px auto',
                        border: '1px solid rgba(59, 130, 246, 0.3)'
                      }}>
                        <IonIcon
                          icon={feature.icon}
                          style={{ fontSize: '32px', color: '#3b82f6' }}
                        />
                      </div>
                      <h3 style={{
                        fontSize: '20px',
                        fontWeight: '600',
                        marginBottom: '16px',
                        color: '#e2e8f0'
                      }}>
                        {feature.title}
                      </h3>
                      <p style={{
                        color: '#9ca3af',
                        lineHeight: '1.6'
                      }}>
                        {feature.description}
                      </p>
                    </div>
                  </IonCol>
                ))}
              </IonRow>
            </IonGrid>
          </div>
        </div>

        {/* Pricing Section */}
        <div style={{
          background: 'linear-gradient(135deg, #1a1d29 0%, #2a2f3e 100%)',
          padding: '80px 24px',
          color: '#e2e8f0'
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{
              fontSize: '36px',
              fontWeight: 'bold',
              marginBottom: '16px'
            }}>
              Simple, Transparent Pricing
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#9ca3af',
              marginBottom: '60px'
            }}>
              Start free and scale as you grow
            </p>

            <IonGrid>
              <IonRow className="ion-justify-content-center">
                {plans.map((plan, index) => (
                  <IonCol size="12" sizeMd="6" sizeLg="4" key={index}>
                    <IonCard style={{
                      background: plan.popular ? 'rgba(59, 130, 246, 0.1)' : 'rgba(26, 29, 41, 0.8)',
                      border: plan.popular ? '2px solid #3b82f6' : '1px solid rgba(59, 130, 246, 0.2)',
                      height: '100%',
                      position: 'relative'
                    }}>
                      {plan.popular && (
                        <div style={{
                          position: 'absolute',
                          top: '-12px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#3b82f6',
                          color: 'white',
                          padding: '4px 16px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          Most Popular
                        </div>
                      )}

                      <IonCardHeader>
                        <IonCardTitle style={{
                          color: '#e2e8f0',
                          fontSize: '24px',
                          textAlign: 'center'
                        }}>
                          {plan.name}
                        </IonCardTitle>
                        <div style={{ textAlign: 'center', margin: '16px 0' }}>
                          <span style={{
                            fontSize: '48px',
                            fontWeight: 'bold',
                            color: '#3b82f6'
                          }}>
                            {plan.price}
                          </span>
                          <span style={{ color: '#9ca3af' }}>
                            /{plan.period}
                          </span>
                        </div>
                        <p style={{
                          textAlign: 'center',
                          color: '#f59e0b',
                          fontWeight: '600'
                        }}>
                          {plan.members}
                        </p>
                      </IonCardHeader>

                      <IonCardContent>
                        <div style={{ marginBottom: '24px' }}>
                          {plan.features.map((feature, featureIndex) => (
                            <div key={featureIndex} style={{
                              display: 'flex',
                              alignItems: 'center',
                              marginBottom: '12px'
                            }}>
                              <IonIcon
                                icon={checkmarkCircle}
                                style={{
                                  color: '#059669',
                                  marginRight: '12px',
                                  fontSize: '20px'
                                }}
                              />
                              <span style={{ color: '#e2e8f0' }}>
                                {feature}
                              </span>
                            </div>
                          ))}
                        </div>

                        <IonButton
                          expand="block"
                          color={plan.popular ? 'primary' : 'secondary'}
                          fill={plan.popular ? 'solid' : 'outline'}
                          onClick={() => history.push('/signup')}
                        >
                          {plan.name === 'Free' ? 'Get Started' : 'Start Trial'}
                        </IonButton>
                      </IonCardContent>
                    </IonCard>
                  </IonCol>
                ))}
              </IonRow>
            </IonGrid>
          </div>
        </div>

        {/* CTA Section */}
        <div style={{
          background: '#0f1419',
          padding: '80px 24px',
          textAlign: 'center',
          color: '#e2e8f0'
        }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            marginBottom: '16px'
          }}>
            Ready to Transform Your Business?
          </h2>
          <p style={{
            fontSize: '18px',
            color: '#9ca3af',
            marginBottom: '40px',
            maxWidth: '600px',
            margin: '0 auto 40px auto'
          }}>
            Join thousands of businesses using MembershipScan to streamline their operations
          </p>

          <IonButton
            size="large"
            color="primary"
            onClick={() => history.push('/signup')}
            style={{ '--padding-start': '48px', '--padding-end': '48px' }}
          >
            Start Your Free Trial Today
            <IonIcon icon={arrowForward} slot="end" />
          </IonButton>

          <p style={{
            color: '#6b7280',
            fontSize: '14px',
            marginTop: '16px'
          }}>
            No credit card required • 10 members free • Setup in 2 minutes
          </p>
        </div>

        {/* Footer */}
        <div style={{
          background: '#1a1d29',
          padding: '40px 24px',
          textAlign: 'center',
          borderTop: '1px solid rgba(59, 130, 246, 0.2)'
        }}>
          <p style={{ color: '#6b7280', margin: 0 }}>
            © 2024 MembershipScan. All rights reserved.
          </p>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LandingPage;