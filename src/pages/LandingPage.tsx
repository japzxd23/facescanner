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
  arrowForward,
  playOutline,
  trendingUpOutline,
  lockClosedOutline,
  speedometerOutline
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const history = useHistory();

  const features = [
    {
      icon: camera,
      title: 'AI-Powered Recognition',
      description: 'State-of-the-art facial recognition with 99.7% accuracy for instant member identification',
      color: '#2563eb'
    },
    {
      icon: speedometerOutline,
      title: 'Real-Time Processing',
      description: 'Lightning-fast recognition in under 200ms with live attendance tracking',
      color: '#059669'
    },
    {
      icon: people,
      title: 'Smart Management',
      description: 'Intuitive dashboard with advanced member profiles and access control',
      color: '#7c3aed'
    },
    {
      icon: trendingUpOutline,
      title: 'Advanced Analytics',
      description: 'Comprehensive insights with customizable reports and trend analysis',
      color: '#dc2626'
    },
    {
      icon: lockClosedOutline,
      title: 'Enterprise Security',
      description: 'Bank-grade encryption with SOC 2 compliance and GDPR protection',
      color: '#ea580c'
    },
    {
      icon: cloud,
      title: 'Global Infrastructure',
      description: 'Multi-region deployment with 99.9% uptime and automatic scaling',
      color: '#0891b2'
    }
  ];

  const plans = [
    {
      name: 'Starter',
      price: '$0',
      period: 'forever',
      members: 'Up to 10 members',
      features: [
        'AI face recognition',
        'Basic member management',
        'Attendance tracking',
        'Mobile app access',
        'API access',
        'Email support'
      ],
      popular: false,
      cta: 'Start Free'
    },
    {
      name: 'Professional',
      price: '$29',
      period: 'per month',
      members: 'Up to 100 members',
      features: [
        'Everything in Starter',
        'Advanced analytics & reports',
        'Custom branding',
        'Webhook integrations',
        'Priority support',
        'Data export',
        'Multi-location support'
      ],
      popular: true,
      cta: 'Start 14-Day Trial'
    },
    {
      name: 'Enterprise',
      price: '$99',
      period: 'per month',
      members: 'Unlimited members',
      features: [
        'Everything in Professional',
        'White-label solution',
        'Custom integrations',
        'Dedicated CSM',
        '99.9% SLA guarantee',
        'On-premise deployment',
        'Advanced security features'
      ],
      popular: false,
      cta: 'Contact Sales'
    }
  ];

  const testimonials = [
    {
      quote: "MembershipScan transformed our gym operations. Check-ins are instant and our members love the seamless experience.",
      author: "Sarah Johnson",
      title: "Operations Manager",
      company: "FitLife Gyms"
    },
    {
      quote: "The accuracy is incredible. We've eliminated buddy punching and improved our attendance tracking by 95%.",
      author: "Michael Chen",
      title: "IT Director",
      company: "TechCorp"
    },
    {
      quote: "Setup took minutes, not weeks. The ROI was immediate with reduced administrative overhead.",
      author: "Lisa Rodriguez",
      title: "Facility Manager",
      company: "Elite Club"
    }
  ];

  return (
    <IonPage>
      <IonContent fullscreen>
        {/* Hero Section */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
          minHeight: '100vh',
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Background Elements */}
          <div style={{
            position: 'absolute',
            top: '10%',
            right: '10%',
            width: '300px',
            height: '300px',
            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.15) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(40px)'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '20%',
            left: '5%',
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(40px)'
          }} />

          {/* Navigation */}
          <nav style={{
            padding: '24px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            background: 'rgba(255, 255, 255, 0.05)',
            position: 'relative',
            zIndex: 10
          }}>
            <div style={{
              fontSize: '28px',
              fontWeight: '700',
              color: 'white',
              fontFamily: 'Inter, system-ui, sans-serif',
              letterSpacing: '-0.02em'
            }}>
              MembershipScan
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <IonButton
                fill="clear"
                style={{
                  '--color': 'rgba(255, 255, 255, 0.8)',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: '500'
                }}
                onClick={() => history.push('/login')}
              >
                Sign In
              </IonButton>
              <IonButton
                className="enterprise-button-primary"
                style={{
                  '--background': '#2563eb',
                  '--color': 'white',
                  '--border-radius': '8px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  fontWeight: '600',
                  textTransform: 'none'
                }}
                onClick={() => history.push('/signup')}
              >
                Start Free Trial
                <IonIcon icon={arrowForward} slot="end" />
              </IonButton>
            </div>
          </nav>

          {/* Hero Content */}
          <div style={{
            padding: '120px 32px 80px',
            textAlign: 'center',
            maxWidth: '1200px',
            margin: '0 auto',
            position: 'relative',
            zIndex: 5
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(37, 99, 235, 0.1)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              borderRadius: '50px',
              padding: '8px 24px',
              marginBottom: '32px',
              backdropFilter: 'blur(10px)'
            }}>
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#60a5fa',
                fontFamily: 'Inter, system-ui, sans-serif'
              }}>
                🚀 Trusted by 1000+ organizations worldwide
              </span>
            </div>

            <h1 style={{
              fontSize: 'clamp(48px, 5vw, 72px)',
              fontWeight: '800',
              marginBottom: '24px',
              background: 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: '1.1',
              fontFamily: 'Inter, system-ui, sans-serif',
              letterSpacing: '-0.02em'
            }}>
              Enterprise Face Recognition
              <br />
              <span style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Made Simple
              </span>
            </h1>

            <p style={{
              fontSize: '20px',
              color: 'rgba(255, 255, 255, 0.8)',
              marginBottom: '48px',
              maxWidth: '650px',
              margin: '0 auto 48px auto',
              lineHeight: '1.6',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              Deploy AI-powered member identification in minutes. 99.7% accuracy, sub-200ms processing, and enterprise-grade security for organizations of all sizes.
            </p>

            <div style={{
              display: 'flex',
              gap: '20px',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginBottom: '64px'
            }}>
              <IonButton
                size="large"
                style={{
                  '--background': '#2563eb',
                  '--color': 'white',
                  '--border-radius': '12px',
                  '--padding-start': '40px',
                  '--padding-end': '40px',
                  '--padding-top': '16px',
                  '--padding-bottom': '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  textTransform: 'none',
                  boxShadow: '0 10px 25px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => history.push('/signup')}
              >
                Start Free Trial
                <IonIcon icon={arrowForward} slot="end" />
              </IonButton>
              <IonButton
                size="large"
                fill="outline"
                style={{
                  '--border-color': 'rgba(255, 255, 255, 0.3)',
                  '--color': 'white',
                  '--border-radius': '12px',
                  '--padding-start': '40px',
                  '--padding-end': '40px',
                  '--padding-top': '16px',
                  '--padding-bottom': '16px',
                  fontSize: '16px',
                  fontWeight: '600',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  textTransform: 'none',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.3s ease'
                }}
                onClick={() => history.push('/demo')}
              >
                <IonIcon icon={playOutline} slot="start" />
                Watch Demo
              </IonButton>
            </div>

            {/* Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '32px',
              maxWidth: '800px',
              margin: '0 auto'
            }}>
              {[
                { value: '99.7%', label: 'Recognition Accuracy' },
                { value: '<200ms', label: 'Processing Time' },
                { value: '1000+', label: 'Organizations' },
                { value: '24/7', label: 'Support Available' }
              ].map((stat, index) => (
                <div key={index} style={{ textAlign: 'center' }}>
                  <div style={{
                    fontSize: '32px',
                    fontWeight: '800',
                    color: '#2563eb',
                    fontFamily: 'Inter, system-ui, sans-serif',
                    marginBottom: '8px'
                  }}>
                    {stat.value}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontFamily: 'Inter, system-ui, sans-serif'
                  }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div style={{
          background: 'var(--enterprise-surface-secondary)',
          padding: '120px 32px',
          color: 'var(--ion-text-color)'
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{
              fontSize: '48px',
              fontWeight: '800',
              marginBottom: '24px',
              color: 'var(--ion-text-color)',
              fontFamily: 'Inter, system-ui, sans-serif',
              letterSpacing: '-0.02em'
            }}>
              Everything you need to scale
            </h2>
            <p style={{
              fontSize: '20px',
              color: 'var(--ion-color-medium)',
              marginBottom: '80px',
              maxWidth: '600px',
              margin: '0 auto 80px auto',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              Built for enterprise demands with consumer-grade simplicity
            </p>

            <IonGrid>
              <IonRow>
                {features.map((feature, index) => (
                  <IonCol size="12" sizeMd="6" sizeLg="4" key={index}>
                    <div style={{
                      padding: '40px 32px',
                      textAlign: 'center',
                      height: '100%',
                      background: 'var(--enterprise-surface-primary)',
                      borderRadius: 'var(--enterprise-radius-xl)',
                      border: '1px solid var(--enterprise-border-subtle)',
                      boxShadow: 'var(--enterprise-shadow-md)',
                      transition: 'all 0.3s ease',
                      margin: '16px 0'
                    }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '20px',
                        background: `linear-gradient(135deg, ${feature.color}15 0%, ${feature.color}05 100%)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 32px auto',
                        border: `1px solid ${feature.color}20`
                      }}>
                        <IonIcon
                          icon={feature.icon}
                          style={{ fontSize: '40px', color: feature.color }}
                        />
                      </div>
                      <h3 style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        marginBottom: '16px',
                        color: 'var(--ion-text-color)',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        {feature.title}
                      </h3>
                      <p style={{
                        color: 'var(--ion-color-medium)',
                        lineHeight: '1.6',
                        fontSize: '16px',
                        fontFamily: 'Inter, system-ui, sans-serif'
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

        {/* Social Proof Section */}
        <div style={{
          background: 'var(--enterprise-surface-primary)',
          padding: '120px 32px',
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{
              fontSize: '48px',
              fontWeight: '800',
              marginBottom: '80px',
              color: 'var(--ion-text-color)',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              Trusted by industry leaders
            </h2>

            <IonGrid>
              <IonRow>
                {testimonials.map((testimonial, index) => (
                  <IonCol size="12" sizeMd="4" key={index}>
                    <div style={{
                      padding: '40px 32px',
                      background: 'var(--enterprise-surface-secondary)',
                      borderRadius: 'var(--enterprise-radius-xl)',
                      border: '1px solid var(--enterprise-border-subtle)',
                      boxShadow: 'var(--enterprise-shadow-sm)',
                      height: '100%',
                      margin: '16px 0'
                    }}>
                      <p style={{
                        fontSize: '18px',
                        lineHeight: '1.6',
                        marginBottom: '24px',
                        color: 'var(--ion-text-color)',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontStyle: 'italic'
                      }}>
                        "{testimonial.quote}"
                      </p>
                      <div>
                        <div style={{
                          fontWeight: '600',
                          color: 'var(--ion-text-color)',
                          fontFamily: 'Inter, system-ui, sans-serif'
                        }}>
                          {testimonial.author}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: 'var(--ion-color-medium)',
                          fontFamily: 'Inter, system-ui, sans-serif'
                        }}>
                          {testimonial.title}, {testimonial.company}
                        </div>
                      </div>
                    </div>
                  </IonCol>
                ))}
              </IonRow>
            </IonGrid>
          </div>
        </div>

        {/* Pricing Section */}
        <div style={{
          background: 'var(--enterprise-surface-secondary)',
          padding: '120px 32px',
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
            <h2 style={{
              fontSize: '48px',
              fontWeight: '800',
              marginBottom: '24px',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              Simple, transparent pricing
            </h2>
            <p style={{
              fontSize: '20px',
              color: 'var(--ion-color-medium)',
              marginBottom: '80px',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              Start free, scale as you grow
            </p>

            <IonGrid>
              <IonRow className="ion-justify-content-center">
                {plans.map((plan, index) => (
                  <IonCol size="12" sizeMd="6" sizeLg="4" key={index}>
                    <div style={{
                      background: plan.popular ? 'var(--enterprise-surface-primary)' : 'var(--enterprise-surface-primary)',
                      border: plan.popular ? '2px solid var(--ion-color-primary)' : '1px solid var(--enterprise-border-subtle)',
                      borderRadius: 'var(--enterprise-radius-xl)',
                      padding: '48px 32px',
                      height: '100%',
                      position: 'relative',
                      boxShadow: plan.popular ? 'var(--enterprise-shadow-xl)' : 'var(--enterprise-shadow-md)',
                      transform: plan.popular ? 'scale(1.05)' : 'scale(1)',
                      transition: 'all 0.3s ease',
                      margin: '16px 0'
                    }}>
                      {plan.popular && (
                        <div style={{
                          position: 'absolute',
                          top: '-16px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'var(--ion-color-primary)',
                          color: 'white',
                          padding: '8px 24px',
                          borderRadius: '50px',
                          fontSize: '14px',
                          fontWeight: '600',
                          fontFamily: 'Inter, system-ui, sans-serif'
                        }}>
                          Most Popular
                        </div>
                      )}

                      <div style={{
                        fontSize: '28px',
                        fontWeight: '800',
                        marginBottom: '16px',
                        color: 'var(--ion-text-color)',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        {plan.name}
                      </div>

                      <div style={{ marginBottom: '24px' }}>
                        <span style={{
                          fontSize: '56px',
                          fontWeight: '800',
                          color: 'var(--ion-color-primary)',
                          fontFamily: 'Inter, system-ui, sans-serif'
                        }}>
                          {plan.price}
                        </span>
                        <span style={{
                          color: 'var(--ion-color-medium)',
                          fontFamily: 'Inter, system-ui, sans-serif'
                        }}>
                          /{plan.period}
                        </span>
                      </div>

                      <p style={{
                        fontWeight: '600',
                        color: 'var(--ion-color-primary)',
                        marginBottom: '32px',
                        fontFamily: 'Inter, system-ui, sans-serif'
                      }}>
                        {plan.members}
                      </p>

                      <div style={{ marginBottom: '40px' }}>
                        {plan.features.map((feature, featureIndex) => (
                          <div key={featureIndex} style={{
                            display: 'flex',
                            alignItems: 'center',
                            marginBottom: '16px'
                          }}>
                            <IonIcon
                              icon={checkmarkCircle}
                              style={{
                                color: 'var(--ion-color-success)',
                                marginRight: '12px',
                                fontSize: '20px'
                              }}
                            />
                            <span style={{
                              color: 'var(--ion-text-color)',
                              fontFamily: 'Inter, system-ui, sans-serif'
                            }}>
                              {feature}
                            </span>
                          </div>
                        ))}
                      </div>

                      <IonButton
                        expand="block"
                        color={plan.popular ? 'primary' : 'secondary'}
                        fill={plan.popular ? 'solid' : 'outline'}
                        style={{
                          '--border-radius': 'var(--enterprise-radius-md)',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          fontWeight: '600',
                          textTransform: 'none',
                          '--padding-top': '16px',
                          '--padding-bottom': '16px'
                        }}
                        onClick={() => history.push('/signup')}
                      >
                        {plan.cta}
                      </IonButton>
                    </div>
                  </IonCol>
                ))}
              </IonRow>
            </IonGrid>
          </div>
        </div>

        {/* CTA Section */}
        <div style={{
          background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
          padding: '120px 32px',
          textAlign: 'center',
          color: 'white'
        }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{
              fontSize: '48px',
              fontWeight: '800',
              marginBottom: '24px',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              Ready to transform your business?
            </h2>
            <p style={{
              fontSize: '20px',
              marginBottom: '48px',
              opacity: 0.9,
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              Join thousands of organizations using MembershipScan to streamline operations and enhance security.
            </p>

            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <IonButton
                size="large"
                style={{
                  '--background': 'white',
                  '--color': '#2563eb',
                  '--border-radius': '12px',
                  '--padding-start': '48px',
                  '--padding-end': '48px',
                  '--padding-top': '16px',
                  '--padding-bottom': '16px',
                  fontSize: '16px',
                  fontWeight: '700',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  textTransform: 'none',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)'
                }}
                onClick={() => history.push('/signup')}
              >
                Start Free Trial Today
                <IonIcon icon={arrowForward} slot="end" />
              </IonButton>
            </div>

            <p style={{
              fontSize: '14px',
              marginTop: '24px',
              opacity: 0.8,
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              No credit card required • 10 members free • Setup in 2 minutes
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          background: 'var(--enterprise-surface-primary)',
          padding: '80px 32px 40px',
          borderTop: '1px solid var(--enterprise-border-subtle)'
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{
              fontSize: '24px',
              fontWeight: '700',
              color: 'var(--ion-color-primary)',
              marginBottom: '32px',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              MembershipScan
            </div>
            <p style={{
              color: 'var(--ion-color-medium)',
              fontSize: '14px',
              fontFamily: 'Inter, system-ui, sans-serif'
            }}>
              © 2024 MembershipScan. All rights reserved. Built with ❤️ for modern businesses.
            </p>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LandingPage;