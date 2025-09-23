import React, { createContext, useContext, useState, useEffect } from 'react';

interface Organization {
  id: string;
  name: string;
  subdomain: string;
  api_key: string;
  plan_type: string;
  member_limit: number;
  is_active: boolean;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface OrganizationContextType {
  organization: Organization | null;
  user: User | null;
  isAuthenticated: boolean;
  isLegacyMode: boolean;
  setOrganizationData: (org: Organization, user: User) => void;
  clearSession: () => void;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLegacyMode, setIsLegacyMode] = useState(false);

  useEffect(() => {
    // Check for session data on app start
    const sessionJson = localStorage.getItem('membershipScanSession');
    if (sessionJson) {
      try {
        const session = JSON.parse(sessionJson);
        if (session.organization && session.user) {
          setOrganization(session.organization);
          setUser(session.user);
          setIsAuthenticated(true);
          setIsLegacyMode(false);
        }
      } catch (error) {
        console.error('Invalid session data:', error);
        localStorage.removeItem('membershipScanSession');
      }
    } else {
      // If no session, enable legacy mode for backwards compatibility
      setIsLegacyMode(true);
    }
  }, []);

  const setOrganizationData = (org: Organization, userData: User) => {
    setOrganization(org);
    setUser(userData);
    setIsAuthenticated(true);
    setIsLegacyMode(false);

    // Store in localStorage
    const sessionData = {
      organization: org,
      user: userData
    };
    localStorage.setItem('membershipScanSession', JSON.stringify(sessionData));
  };

  const clearSession = () => {
    setOrganization(null);
    setUser(null);
    setIsAuthenticated(false);
    setIsLegacyMode(true);
    localStorage.removeItem('membershipScanSession');
  };

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        user,
        isAuthenticated,
        isLegacyMode,
        setOrganizationData,
        clearSession
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
};