import { supabase } from './supabaseClient';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface AuthOrganization {
  id: string;
  name: string;
  subdomain: string;
  api_key: string;
  plan_type: string;
  member_limit: number;
  is_active: boolean;
}

export interface AuthSession {
  user: AuthUser;
  organization: AuthOrganization;
  timestamp: number;
}

export interface AuthResult {
  success: boolean;
  session?: AuthSession;
  error?: string;
}

const SESSION_KEY = 'FaceCheckSession';
const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Sign in with Google OAuth
 */
export const signInWithGoogle = async (): Promise<AuthResult> => {
  try {
    // Detect if running on mobile (Capacitor) or web
    const isCapacitorNative = (window as any).Capacitor?.isNativePlatform?.() === true;
    const isLocalhost = window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1' ||
                       window.location.protocol === 'http:';

    // Use deep link ONLY for native Capacitor app, NOT for localhost dev
    const isMobile = isCapacitorNative && !isLocalhost;

    // Use custom URL scheme for mobile APK, web URL for browser/localhost
    const redirectUrl = isMobile
      ? 'com.FaceCheck.app://auth/callback'  // Deep link for mobile APK
      : `${window.location.origin}/auth/callback`; // Web URL for browser/localhost

    console.log('🔍 OAuth Debug:', {
      isCapacitorNative,
      isLocalhost,
      isMobile,
      redirectUrl,
      hostname: window.location.hostname,
      protocol: window.location.protocol,
      origin: window.location.origin
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        }
      }
    });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true
    };
  } catch (error: any) {
    console.error('Sign in error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sign in with Google'
    };
  }
};

/**
 * Sign out current user
 */
export const signOut = async (): Promise<void> => {
  try {
    // Clear local session
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('localFaceCache');
    localStorage.removeItem('simpleFaces');

    // Sign out from Supabase
    await supabase.auth.signOut();

    // Redirect to auth page
    window.location.href = '/auth';
  } catch (error) {
    console.error('Sign out error:', error);
    // Force redirect even if sign out fails
    window.location.href = '/auth';
  }
};

/**
 * Get current session from localStorage
 */
export const getCurrentSession = (): AuthSession | null => {
  try {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (!sessionData) return null;

    const session: AuthSession = JSON.parse(sessionData);

    // Check if session has expired
    const now = Date.now();
    if (session.timestamp && (now - session.timestamp > SESSION_TIMEOUT)) {
      console.warn('Session expired');
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return session;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

/**
 * Refresh session - validate with Supabase and update timestamp
 */
export const refreshSession = async (): Promise<AuthSession | null> => {
  try {
    const currentSession = getCurrentSession();
    if (!currentSession) return null;

    // Verify with Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    // Verify organization is still active
    const { data: orgUser } = await supabase
      .from('organization_users')
      .select('*, organizations(*)')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (!orgUser || !orgUser.organizations || !orgUser.organizations.is_active) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    // Update session with new timestamp
    const refreshedSession: AuthSession = {
      user: {
        id: orgUser.id,
        email: orgUser.email,
        full_name: orgUser.full_name,
        role: orgUser.role
      },
      organization: orgUser.organizations,
      timestamp: Date.now()
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(refreshedSession));
    return refreshedSession;
  } catch (error) {
    console.error('Session refresh error:', error);
    return null;
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const session = getCurrentSession();
  if (!session) return false;

  // Refresh session if it's getting old (older than 30 minutes)
  const age = Date.now() - (session.timestamp || 0);
  if (age > 30 * 60 * 1000) {
    const refreshed = await refreshSession();
    return refreshed !== null;
  }

  return true;
};

/**
 * Check if user has specific role
 */
export const hasRole = (requiredRoles: string[]): boolean => {
  const session = getCurrentSession();
  if (!session) return false;

  return requiredRoles.includes(session.user.role);
};

/**
 * Check if user is admin (admin or owner role)
 */
export const isAdmin = (): boolean => {
  return hasRole(['admin', 'owner']);
};

/**
 * Get user's organization ID
 */
export const getOrganizationId = (): string | null => {
  const session = getCurrentSession();
  return session?.organization?.id || null;
};

/**
 * Update session in localStorage
 */
export const updateSession = (session: AuthSession): void => {
  session.timestamp = Date.now();
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

/**
 * Handle OAuth callback
 */
export const handleOAuthCallback = async (): Promise<AuthResult> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      return {
        success: false,
        error: 'No session found'
      };
    }

    // Check if user exists in organization_users
    const { data: orgUser } = await supabase
      .from('organization_users')
      .select('*, organizations(*)')
      .eq('email', session.user.email)
      .eq('is_active', true)
      .single();

    if (!orgUser || !orgUser.organizations) {
      return {
        success: false,
        error: 'User not found or organization not setup'
      };
    }

    const authSession: AuthSession = {
      user: {
        id: orgUser.id,
        email: orgUser.email,
        full_name: orgUser.full_name,
        role: orgUser.role
      },
      organization: orgUser.organizations,
      timestamp: Date.now()
    };

    updateSession(authSession);

    return {
      success: true,
      session: authSession
    };
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return {
      success: false,
      error: error.message || 'Failed to handle OAuth callback'
    };
  }
};

/**
 * Log security event
 */
export const logSecurityEvent = async (
  eventType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: any
): Promise<void> => {
  try {
    const session = getCurrentSession();
    const organizationId = session?.organization?.id;

    await supabase.from('security_events').insert({
      organization_id: organizationId,
      event_type: eventType,
      severity,
      details: JSON.stringify(details),
      ip_address: '', // Could be populated server-side
      user_agent: navigator.userAgent,
      device_fingerprint: generateDeviceFingerprint(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
    // Don't throw - logging should not break app functionality
  }
};

/**
 * Generate simple device fingerprint
 */
const generateDeviceFingerprint = (): string => {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
  ];

  return btoa(components.join('|')).substring(0, 32);
};

export default {
  signInWithGoogle,
  signOut,
  getCurrentSession,
  refreshSession,
  isAuthenticated,
  hasRole,
  isAdmin,
  getOrganizationId,
  updateSession,
  handleOAuthCallback,
  logSecurityEvent
};