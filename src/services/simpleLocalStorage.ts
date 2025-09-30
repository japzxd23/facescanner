import { getMembers, addMember as addMemberToSupabase, Member } from './supabaseClient';

// Simple member interface for local storage
export interface LocalMember {
  id: string;
  name: string;
  photo_url: string | null;
  status: 'Allowed' | 'Banned' | 'VIP';
  face_embedding: number[] | null;
  created_at: string;
  updated_at: string;
  organization_id: string | null;
}

// Ultra-simple local storage service (no WASM dependencies)
class SimpleLocalStorageService {
  private isInitialized = false;
  private localMembers: LocalMember[] = [];
  private storageKey = 'facecheck_simple_members';

  // Initialize simple local storage
  async initialize(): Promise<void> {
    console.log('⚡ Initializing simple local storage...');

    try {
      // Load existing data from localStorage
      const existingData = localStorage.getItem(this.storageKey);
      if (existingData) {
        try {
          this.localMembers = JSON.parse(existingData);
          console.log(`📂 Loaded ${this.localMembers.length} members from localStorage`);
        } catch (parseError) {
          console.warn('❌ Failed to parse existing localStorage data, starting fresh');
          this.localMembers = [];
        }
      } else {
        this.localMembers = [];
        console.log('🆕 Starting with empty localStorage');
      }

      this.isInitialized = true;
      console.log('✅ Simple local storage initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize simple local storage:', error);
      throw error;
    }
  }

  // Sync all members from Supabase to local storage
  async syncFromSupabase(): Promise<void> {
    console.log('🔄 Syncing members from Supabase to simple local storage...');

    if (!this.isInitialized) {
      throw new Error('Simple local storage not initialized');
    }

    try {
      // Get all members from Supabase
      const supabaseMembers = await getMembers();
      console.log(`📥 Retrieved ${supabaseMembers.length} members from Supabase`);

      // Convert to local member format
      this.localMembers = supabaseMembers.map(member => ({
        id: member.id,
        name: member.name,
        photo_url: member.photo_url,
        status: member.status,
        face_embedding: member.face_embedding,
        created_at: member.created_at,
        updated_at: member.updated_at || member.created_at,
        organization_id: member.organization_id || null
      }));

      // Save to localStorage
      this.saveToLocalStorage();

      console.log(`✅ Successfully synced ${this.localMembers.length} members to simple local storage`);

    } catch (error) {
      console.error('❌ Failed to sync from Supabase:', error);
      throw error;
    }
  }

  // Save data to localStorage
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.localMembers));
    } catch (error) {
      console.error('❌ Failed to save to localStorage:', error);
    }
  }

  // Get all members from local storage
  async getAllMembers(): Promise<LocalMember[]> {
    if (!this.isInitialized) {
      throw new Error('Simple local storage not initialized');
    }

    console.log(`📊 Retrieved ${this.localMembers.length} members from simple local storage`);
    return [...this.localMembers]; // Return a copy
  }

  // Get members with photo_url (base64 images) for face recognition
  async getMembersWithPhotos(): Promise<LocalMember[]> {
    if (!this.isInitialized) {
      throw new Error('Simple local storage not initialized');
    }

    const membersWithPhotos = this.localMembers.filter(
      member => member.photo_url && member.photo_url.startsWith('data:image/')
    );

    console.log(`📷 Retrieved ${membersWithPhotos.length} members with photos from simple local storage`);
    return membersWithPhotos;
  }

  // Add new member to both local storage and Supabase
  async addMember(memberData: {
    name: string;
    photo_url: string;
    status?: 'Allowed' | 'Banned' | 'VIP';
  }): Promise<LocalMember | null> {
    console.log('💾 Adding new member to both local and remote storage...');

    try {
      // First, add to Supabase to get the official ID and timestamps
      const supabaseMember = await addMemberToSupabase({
        name: memberData.name,
        photo_url: memberData.photo_url,
        status: memberData.status || 'Allowed',
        face_embedding: null
      });

      if (!supabaseMember) {
        throw new Error('Failed to add member to Supabase');
      }

      // Convert to local member format
      const localMember: LocalMember = {
        id: supabaseMember.id,
        name: supabaseMember.name,
        photo_url: supabaseMember.photo_url,
        status: supabaseMember.status,
        face_embedding: supabaseMember.face_embedding,
        created_at: supabaseMember.created_at,
        updated_at: supabaseMember.updated_at || supabaseMember.created_at,
        organization_id: supabaseMember.organization_id || null
      };

      // Add to local storage
      this.localMembers.push(localMember);
      this.saveToLocalStorage();

      console.log(`✅ Successfully added ${memberData.name} to both storage systems`);
      return localMember;

    } catch (error) {
      console.error('❌ Error adding member:', error);
      return null;
    }
  }

  // Get database statistics
  getStats(): {
    totalMembers: number;
    membersWithPhotos: number;
    allowedMembers: number;
    bannedMembers: number;
    vipMembers: number;
    isInitialized: boolean;
  } {
    if (!this.isInitialized) {
      return {
        totalMembers: 0,
        membersWithPhotos: 0,
        allowedMembers: 0,
        bannedMembers: 0,
        vipMembers: 0,
        isInitialized: false
      };
    }

    const withPhotos = this.localMembers.filter(
      member => member.photo_url && member.photo_url.startsWith('data:image/')
    ).length;

    const allowed = this.localMembers.filter(m => m.status === 'Allowed').length;
    const banned = this.localMembers.filter(m => m.status === 'Banned').length;
    const vip = this.localMembers.filter(m => m.status === 'VIP').length;

    return {
      totalMembers: this.localMembers.length,
      membersWithPhotos: withPhotos,
      allowedMembers: allowed,
      bannedMembers: banned,
      vipMembers: vip,
      isInitialized: true
    };
  }

  // Check if storage is ready
  isReady(): boolean {
    return this.isInitialized;
  }

  // Clear all local data (useful for testing or reset)
  async clearLocalData(): Promise<void> {
    try {
      this.localMembers = [];
      localStorage.removeItem(this.storageKey);
      console.log('🗑️ Cleared all simple local storage data');
    } catch (error) {
      console.error('❌ Error clearing local data:', error);
    }
  }

  // Get member by ID
  getMember(memberId: string): LocalMember | null {
    return this.localMembers.find(m => m.id === memberId) || null;
  }

  // Check if member exists
  hasMember(memberId: string): boolean {
    return this.localMembers.some(m => m.id === memberId);
  }
}

// Global instance
export const simpleLocalStorage = new SimpleLocalStorageService();