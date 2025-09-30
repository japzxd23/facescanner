import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Member {
  id: string;
  name: string;
  face_embedding: number[] | null;
  face_descriptor: number[] | null; // Pre-computed face descriptor for fast recognition
  status: 'Allowed' | 'Banned' | 'VIP';
  photo_url?: string; // Base64 photo data (fallback/cloud storage)
  local_photo_path?: string; // Local filesystem path for fast access (mobile only)
  details?: string; // Reason for status (e.g., ban reason, VIP notes, etc.)
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
  console.log('🏢 Setting organization context in supabaseClient:', organizationId);
  currentOrganizationId = organizationId;
};

// Clear organization context (legacy mode)
export const clearOrganizationContext = () => {
  console.log('🧹 Clearing organization context in supabaseClient');
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

/**
 * Get members WITHOUT photo_url for fast queries
 * Use this when you have local images cached
 */
export const getMembersMetadata = async (): Promise<Member[]> => {
  console.log('⚡ getMembersMetadata called (OPTIMIZED - no photo_url)');

  // Check authentication status
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('❌ Auth error in getMembersMetadata:', authError);
  }
  console.log('👤 Current auth user:', user?.email || 'NOT AUTHENTICATED');
  console.log('🏢 Current organization context:', currentOrganizationId || 'NONE (legacy mode)');

  let query = supabase
    .from('members')
    .select('id, name, face_embedding, face_descriptor, status, local_photo_path, details, created_at, updated_at, organization_id');

  // Add organization filter if in multi-tenant mode
  if (currentOrganizationId) {
    console.log('🏢 Filtering members by organization_id:', currentOrganizationId);
    query = query.eq('organization_id', currentOrganizationId);
  } else {
    // Legacy mode: get members with null organization_id
    console.log('🔧 Using legacy mode - filtering for null organization_id');
    query = query.is('organization_id', null);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error in getMembersMetadata:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    throw error;
  }

  console.log('⚡ getMembersMetadata query successful');
  console.log('📊 Returned', data?.length || 0, 'members');
  if (data && data.length > 0) {
    console.log('📋 Sample member:', { id: data[0].id, name: data[0].name, org: data[0].organization_id });
  }

  return data || [];
};

/**
 * Get single member WITH photo_url (fallback for missing local images)
 */
export const getMemberPhoto = async (memberId: string): Promise<string | null> => {
  console.log('📥 Fetching photo_url for member', memberId, '(fallback)');

  const { data, error } = await supabase
    .from('members')
    .select('photo_url')
    .eq('id', memberId)
    .single();

  if (error) {
    console.error('❌ Error fetching member photo:', error);
    return null;
  }

  return data?.photo_url || null;
};

/**
 * Get members WITH photo_url (legacy/full query)
 * Use this for initial sync or when local storage is not available
 */
export const getMembers = async (): Promise<Member[]> => {
  console.log('📊 getMembers called with organization context:', currentOrganizationId);

  let query = supabase
    .from('members')
    .select('*');

  // Add organization filter if in multi-tenant mode
  if (currentOrganizationId) {
    console.log('🏢 Filtering members by organization_id:', currentOrganizationId);
    query = query.eq('organization_id', currentOrganizationId);
  } else {
    // Legacy mode: get members with null organization_id
    console.log('🔧 Using legacy mode - filtering for null organization_id');
    query = query.is('organization_id', null);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error in getMembers:', error);
    throw error;
  }

  console.log('📈 getMembers returning', data?.length || 0, 'members');
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
  console.log('📊 getAttendanceLogs called with organization context:', currentOrganizationId);

  let query = supabase
    .from('attendance_logs')
    .select(`
      *,
      member:members(*)
    `);

  // Add organization filter if in multi-tenant mode
  if (currentOrganizationId) {
    console.log('🏢 Filtering attendance logs by organization_id:', currentOrganizationId);
    query = query.eq('organization_id', currentOrganizationId);
  } else {
    // Legacy mode: get logs with null organization_id
    console.log('🔧 Using legacy mode - filtering attendance logs for null organization_id');
    query = query.is('organization_id', null);
  }

  const { data, error } = await query
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('❌ Error in getAttendanceLogs:', error);
    throw error;
  }

  console.log('📈 getAttendanceLogs returning', data?.length || 0, 'logs');
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

// Optimized face descriptor functions for fast recognition
export interface OptimizedMember {
  id: string;
  name: string;
  face_descriptor: Float32Array;
  status: 'Allowed' | 'Banned' | 'VIP';
  photo_url?: string;
}

// Get members with pre-computed face descriptors (optimized for recognition)
export const getMembersWithDescriptors = async (): Promise<OptimizedMember[]> => {
  console.log('⚡ getMembersWithDescriptors called with organization context:', currentOrganizationId);

  let query = supabase
    .from('members')
    .select('id, name, face_descriptor, status, photo_url');

  // Add organization filter if in multi-tenant mode
  if (currentOrganizationId) {
    console.log('🏢 Filtering members by organization_id:', currentOrganizationId);
    query = query.eq('organization_id', currentOrganizationId);
  } else {
    // Legacy mode: get members with null organization_id
    console.log('🔧 Using legacy mode - filtering for null organization_id');
    query = query.is('organization_id', null);
  }

  // Only get members with face descriptors (include all statuses: Allowed, Banned, VIP)
  query = query
    .not('face_descriptor', 'is', null);

  const { data, error } = await query.order('name');

  if (error) {
    console.error('❌ Error in getMembersWithDescriptors:', error);
    throw error;
  }

  if (!data) {
    console.log('📊 No members with descriptors found');
    return [];
  }

  // Convert JSON arrays back to Float32Array for fast comparison
  const optimizedMembers: OptimizedMember[] = data.map(member => ({
    id: member.id,
    name: member.name,
    face_descriptor: new Float32Array(member.face_descriptor),
    status: member.status,
    photo_url: member.photo_url
  }));

  console.log('⚡ getMembersWithDescriptors returning', optimizedMembers.length, 'optimized members');
  return optimizedMembers;
};

// Update member with computed face descriptor
export const updateMemberDescriptor = async (id: string, descriptor: Float32Array, photoUrl?: string) => {
  const updates: any = {
    face_descriptor: Array.from(descriptor), // Convert Float32Array to regular array for JSON storage
    updated_at: new Date().toISOString()
  };

  if (photoUrl) {
    updates.photo_url = photoUrl;
  }

  const { data, error } = await supabase
    .from('members')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('❌ Error updating member descriptor:', error);
    throw error;
  }

  console.log('✅ Updated face descriptor for member:', data.name);
  return data;
};

// Get count of members needing descriptor computation
export const getMembersNeedingDescriptors = async (): Promise<number> => {
  let query = supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .not('photo_url', 'is', null)
    .is('face_descriptor', null);

  if (currentOrganizationId) {
    query = query.eq('organization_id', currentOrganizationId);
  } else {
    query = query.is('organization_id', null);
  }

  const { count, error } = await query;

  if (error) {
    console.error('❌ Error counting members needing descriptors:', error);
    return 0;
  }

  return count || 0;
};