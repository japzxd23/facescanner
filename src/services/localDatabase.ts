import initSqlJs, { Database } from 'sql.js';
import { getMembers, addMember as addMemberToSupabase, Member } from './supabaseClient';

// Local member interface matching Supabase structure
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

class LocalDatabaseService {
  private db: Database | null = null;
  private isInitialized = false;
  private sqlJs: any = null;

  // Initialize SQLite database with fallback to IndexedDB-like approach
  async initialize(): Promise<void> {
    console.log('⚡ Initializing local database...');

    try {
      // Try multiple CDNs and fallback approaches
      console.log('📚 Loading sql.js WASM...');

      const cdnOptions = [
        // Try unpkg first (usually faster)
        () => initSqlJs({
          locateFile: (file: string) => `https://unpkg.com/sql.js@1.8.0/dist/${file}`
        }),
        // Fallback to cdnjs
        () => initSqlJs({
          locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        }),
        // Try without specifying path (use defaults)
        () => initSqlJs()
      ];

      let sqlJsLoaded = false;

      for (const [index, loadFn] of cdnOptions.entries()) {
        try {
          console.log(`📚 Trying CDN option ${index + 1}...`);
          this.sqlJs = await Promise.race([
            loadFn(),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`CDN ${index + 1} timeout`)), 8000))
          ]);
          console.log(`✅ sql.js WASM loaded successfully from option ${index + 1}`);
          sqlJsLoaded = true;
          break;
        } catch (error) {
          console.warn(`❌ CDN option ${index + 1} failed:`, error);
          continue;
        }
      }

      if (!sqlJsLoaded) {
        throw new Error('All CDN options failed - falling back to simple storage');
      }

      // Create or load database
      const existingData = localStorage.getItem('facecheck_sqlite_db');
      if (existingData) {
        // Load existing database from localStorage
        const buffer = new Uint8Array(JSON.parse(existingData));
        this.db = new this.sqlJs.Database(buffer);
        console.log('📂 Loaded existing SQLite database from localStorage');
      } else {
        // Create new database
        this.db = new this.sqlJs.Database();
        console.log('🆕 Created new SQLite database');
      }

      // Create members table if it doesn't exist
      this.createMembersTable();

      this.isInitialized = true;
      console.log('✅ Local SQLite database initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize local database:', error);
      throw error;
    }
  }

  // Create members table
  private createMembersTable(): void {
    if (!this.db) throw new Error('Database not initialized');

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        photo_url TEXT,
        status TEXT CHECK(status IN ('Allowed', 'Banned', 'VIP')) DEFAULT 'Allowed',
        face_embedding TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        organization_id TEXT,
        synced INTEGER DEFAULT 1
      )
    `;

    this.db.run(createTableQuery);
    console.log('📋 Members table created/verified');
  }

  // Save database to localStorage
  private saveToLocalStorage(): void {
    if (!this.db) return;

    const data = this.db.export();
    const buffer = Array.from(data);
    localStorage.setItem('facecheck_sqlite_db', JSON.stringify(buffer));
  }

  // Sync all members from Supabase to local SQLite
  async syncFromSupabase(): Promise<void> {
    console.log('🔄 Syncing members from Supabase to local SQLite...');

    if (!this.isInitialized || !this.db) {
      throw new Error('Local database not initialized');
    }

    try {
      // Get all members from Supabase
      const supabaseMembers = await getMembers();
      console.log(`📥 Retrieved ${supabaseMembers.length} members from Supabase`);

      // Clear existing data and insert fresh data
      this.db.run('DELETE FROM members');

      // Insert members into SQLite
      const insertQuery = `
        INSERT INTO members (
          id, name, photo_url, status, face_embedding,
          created_at, updated_at, organization_id, synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `;

      let syncedCount = 0;
      for (const member of supabaseMembers) {
        try {
          const faceEmbedding = member.face_embedding ? JSON.stringify(member.face_embedding) : null;

          this.db.run(insertQuery, [
            member.id,
            member.name,
            member.photo_url,
            member.status,
            faceEmbedding,
            member.created_at,
            member.updated_at || member.created_at,
            member.organization_id || null
          ]);

          syncedCount++;
        } catch (error) {
          console.error(`❌ Error syncing member ${member.name}:`, error);
        }
      }

      // Save to localStorage
      this.saveToLocalStorage();

      console.log(`✅ Successfully synced ${syncedCount}/${supabaseMembers.length} members to local SQLite`);

    } catch (error) {
      console.error('❌ Failed to sync from Supabase:', error);
      throw error;
    }
  }

  // Get all members from local SQLite
  async getAllMembers(): Promise<LocalMember[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const query = 'SELECT * FROM members ORDER BY name';
      const result = this.db.exec(query);

      if (result.length === 0) return [];

      const members: LocalMember[] = [];
      const rows = result[0].values;

      for (const row of rows) {
        const member: LocalMember = {
          id: row[0] as string,
          name: row[1] as string,
          photo_url: row[2] as string | null,
          status: row[3] as 'Allowed' | 'Banned' | 'VIP',
          face_embedding: row[4] ? JSON.parse(row[4] as string) : null,
          created_at: row[5] as string,
          updated_at: row[6] as string,
          organization_id: row[7] as string | null,
        };
        members.push(member);
      }

      console.log(`📊 Retrieved ${members.length} members from local SQLite`);
      return members;

    } catch (error) {
      console.error('❌ Error getting members from local database:', error);
      return [];
    }
  }

  // Get members with photo_url (base64 images) for face recognition
  async getMembersWithPhotos(): Promise<LocalMember[]> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const query = `
        SELECT * FROM members
        WHERE photo_url IS NOT NULL
        AND photo_url LIKE 'data:image/%'
        ORDER BY name
      `;

      const result = this.db.exec(query);

      if (result.length === 0) return [];

      const members: LocalMember[] = [];
      const rows = result[0].values;

      for (const row of rows) {
        const member: LocalMember = {
          id: row[0] as string,
          name: row[1] as string,
          photo_url: row[2] as string | null,
          status: row[3] as 'Allowed' | 'Banned' | 'VIP',
          face_embedding: row[4] ? JSON.parse(row[4] as string) : null,
          created_at: row[5] as string,
          updated_at: row[6] as string,
          organization_id: row[7] as string | null,
        };
        members.push(member);
      }

      console.log(`📷 Retrieved ${members.length} members with photos from local SQLite`);
      return members;

    } catch (error) {
      console.error('❌ Error getting members with photos:', error);
      return [];
    }
  }

  // Add new member to both local SQLite and Supabase
  async addMember(memberData: {
    name: string;
    photo_url: string;
    status?: 'Allowed' | 'Banned' | 'VIP';
  }): Promise<LocalMember | null> {
    console.log('💾 Adding new member to both local and remote databases...');

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

      // Then add to local SQLite
      await this.addMemberToLocal(supabaseMember);

      console.log(`✅ Successfully added ${memberData.name} to both databases`);
      return supabaseMember;

    } catch (error) {
      console.error('❌ Error adding member:', error);
      return null;
    }
  }

  // Add member to local SQLite only (used during sync and after Supabase insert)
  private async addMemberToLocal(member: Member): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const insertQuery = `
      INSERT OR REPLACE INTO members (
        id, name, photo_url, status, face_embedding,
        created_at, updated_at, organization_id, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;

    const faceEmbedding = member.face_embedding ? JSON.stringify(member.face_embedding) : null;

    this.db.run(insertQuery, [
      member.id,
      member.name,
      member.photo_url,
      member.status,
      faceEmbedding,
      member.created_at,
      member.updated_at || member.created_at,
      member.organization_id || null
    ]);

    // Save to localStorage
    this.saveToLocalStorage();
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
    if (!this.db || !this.isInitialized) {
      return {
        totalMembers: 0,
        membersWithPhotos: 0,
        allowedMembers: 0,
        bannedMembers: 0,
        vipMembers: 0,
        isInitialized: false
      };
    }

    try {
      const totalQuery = 'SELECT COUNT(*) as count FROM members';
      const photosQuery = `SELECT COUNT(*) as count FROM members WHERE photo_url IS NOT NULL AND photo_url LIKE 'data:image/%'`;
      const allowedQuery = `SELECT COUNT(*) as count FROM members WHERE status = 'Allowed'`;
      const bannedQuery = `SELECT COUNT(*) as count FROM members WHERE status = 'Banned'`;
      const vipQuery = `SELECT COUNT(*) as count FROM members WHERE status = 'VIP'`;

      const total = this.db.exec(totalQuery)[0]?.values[0][0] as number || 0;
      const withPhotos = this.db.exec(photosQuery)[0]?.values[0][0] as number || 0;
      const allowed = this.db.exec(allowedQuery)[0]?.values[0][0] as number || 0;
      const banned = this.db.exec(bannedQuery)[0]?.values[0][0] as number || 0;
      const vip = this.db.exec(vipQuery)[0]?.values[0][0] as number || 0;

      return {
        totalMembers: total,
        membersWithPhotos: withPhotos,
        allowedMembers: allowed,
        bannedMembers: banned,
        vipMembers: vip,
        isInitialized: true
      };

    } catch (error) {
      console.error('❌ Error getting database stats:', error);
      return {
        totalMembers: 0,
        membersWithPhotos: 0,
        allowedMembers: 0,
        bannedMembers: 0,
        vipMembers: 0,
        isInitialized: false
      };
    }
  }

  // Check if database is ready
  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }

  // Clear all local data (useful for testing or reset)
  async clearLocalData(): Promise<void> {
    if (!this.db) return;

    try {
      this.db.run('DELETE FROM members');
      this.saveToLocalStorage();
      console.log('🗑️ Cleared all local database data');
    } catch (error) {
      console.error('❌ Error clearing local data:', error);
    }
  }
}

// Global instance
export const localDatabase = new LocalDatabaseService();