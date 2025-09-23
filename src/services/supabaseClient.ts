import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Member {
  id: string;
  name: string;
  face_embedding: number[] | null;
  status: 'Allowed' | 'Banned' | 'VIP';
  photo_url?: string;
  created_at: string;
  updated_at: string;
  organization_id?: string;
}

export interface AttendanceLog {
  id: string;
  member_id: string;
  timestamp: string;
  confidence: number;
  member?: Member;
  organization_id?: string;
}

export interface Organization {
  id: string;
  name: string;
  subdomain: string;
  api_key: string;
  plan_type: string;
  member_limit: number;
  is_active: boolean;
}

// Multi-tenant context
let currentOrganizationId: string | null = null;

// Set organization context for multi-tenant operations
export const setOrganizationContext = (organizationId: string) => {
  currentOrganizationId = organizationId;
};

// Clear organization context (legacy mode)
export const clearOrganizationContext = () => {
  currentOrganizationId = null;
};

// Get current organization ID
export const getCurrentOrganizationId = () => currentOrganizationId;

// Auth functions
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Member functions
export const getMembers = async (): Promise<Member[]> => {
  let query = supabase
    .from('members')
    .select('*');

  // Add organization filter if in multi-tenant mode
  if (currentOrganizationId) {
    query = query.eq('organization_id', currentOrganizationId);
  } else {
    // Legacy mode: get members with null organization_id
    query = query.is('organization_id', null);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

export const addMember = async (member: Omit<Member, 'id' | 'created_at' | 'updated_at'>) => {
  // Add organization_id if in multi-tenant mode
  const memberData = {
    ...member,
    organization_id: currentOrganizationId
  };

  const { data, error } = await supabase
    .from('members')
    .insert([memberData])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateMember = async (id: string, updates: Partial<Member>) => {
  const { data, error } = await supabase
    .from('members')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const deleteMember = async (id: string) => {
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// Attendance log functions
export const getAttendanceLogs = async (limit = 50): Promise<AttendanceLog[]> => {
  let query = supabase
    .from('attendance_logs')
    .select(`
      *,
      member:members(*)
    `);

  // Add organization filter if in multi-tenant mode
  if (currentOrganizationId) {
    query = query.eq('organization_id', currentOrganizationId);
  } else {
    // Legacy mode: get logs with null organization_id
    query = query.is('organization_id', null);
  }

  const { data, error } = await query
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
};

// Check if member already attended today
export const hasAttendedToday = async (memberID: string): Promise<boolean> => {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  let query = supabase
    .from('attendance_logs')
    .select('id')
    .eq('member_id', memberID)
    .gte('timestamp', startOfDay)
    .lt('timestamp', endOfDay);

  // Add organization filter if in multi-tenant mode
  if (currentOrganizationId) {
    query = query.eq('organization_id', currentOrganizationId);
  } else {
    query = query.is('organization_id', null);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    console.error('Error checking daily attendance:', error);
    return false; // If error, allow attendance to be safe
  }

  return data && data.length > 0;
};

export const addAttendanceLog = async (memberID: string, confidence: number) => {
  // Check if already attended today
  const alreadyAttended = await hasAttendedToday(memberID);

  if (alreadyAttended) {
    console.log('Member already attended today, skipping attendance log');
    return null; // Don't add duplicate attendance
  }

  const logData = {
    member_id: memberID,
    timestamp: new Date().toISOString(),
    confidence,
    organization_id: currentOrganizationId
  };

  const { data, error } = await supabase
    .from('attendance_logs')
    .insert([logData])
    .select()
    .single();

  if (error) throw error;
  return data;
};