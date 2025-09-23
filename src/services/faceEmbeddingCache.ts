export interface CachedFaceEmbedding {
  id: string;
  name: string;
  embedding: number[];
  status: 'Allowed' | 'Banned' | 'VIP';
  organization_id: string;
  updated_at: string;
}

export interface CacheInfo {
  organizationId: string;
  lastUpdated: number;
  count: number;
  version: string;
}

class FaceEmbeddingCache {
  private readonly CACHE_KEY = 'face_embeddings_cache';
  private readonly CACHE_INFO_KEY = 'face_embeddings_cache_info';
  private readonly CACHE_VERSION = '1.0';
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  private cache: Map<string, CachedFaceEmbedding[]> = new Map();
  private cacheInfo: Map<string, CacheInfo> = new Map();

  constructor() {
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage(): void {
    try {
      // Load cache data
      const cacheData = localStorage.getItem(this.CACHE_KEY);
      if (cacheData) {
        const parsedCache = JSON.parse(cacheData);
        this.cache = new Map(Object.entries(parsedCache));
      }

      // Load cache info
      const cacheInfoData = localStorage.getItem(this.CACHE_INFO_KEY);
      if (cacheInfoData) {
        const parsedInfo = JSON.parse(cacheInfoData);
        this.cacheInfo = new Map(Object.entries(parsedInfo));
      }

      console.log('📦 Face embedding cache loaded from localStorage');
      this.logCacheStats();
    } catch (error) {
      console.error('Failed to load cache from localStorage:', error);
      this.clearCache();
    }
  }

  private saveToLocalStorage(): void {
    try {
      // Convert Maps to objects for storage
      const cacheObject = Object.fromEntries(this.cache);
      const cacheInfoObject = Object.fromEntries(this.cacheInfo);

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheObject));
      localStorage.setItem(this.CACHE_INFO_KEY, JSON.stringify(cacheInfoObject));

      console.log('💾 Face embedding cache saved to localStorage');
    } catch (error) {
      console.error('Failed to save cache to localStorage:', error);

      // If storage is full, try to clear some space
      if (error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, clearing cache');
        this.clearCache();
      }
    }
  }

  private logCacheStats(): void {
    const totalEmbeddings = Array.from(this.cache.values()).reduce((sum, embeddings) => sum + embeddings.length, 0);
    const organizations = this.cache.size;

    console.log(`📊 Cache stats: ${totalEmbeddings} embeddings across ${organizations} organizations`);

    // Log per-organization stats
    for (const [orgId, embeddings] of this.cache) {
      const info = this.cacheInfo.get(orgId);
      const age = info ? Math.round((Date.now() - info.lastUpdated) / (60 * 1000)) : 'unknown';
      console.log(`  📁 ${orgId}: ${embeddings.length} embeddings (${age} min old)`);
    }
  }

  isCacheValid(organizationId: string): boolean {
    const info = this.cacheInfo.get(organizationId);
    if (!info) return false;

    const isExpired = Date.now() - info.lastUpdated > this.CACHE_EXPIRY;
    const isValidVersion = info.version === this.CACHE_VERSION;

    return !isExpired && isValidVersion;
  }

  getCachedEmbeddings(organizationId: string): CachedFaceEmbedding[] | null {
    if (!this.isCacheValid(organizationId)) {
      console.log(`📦 Cache invalid for organization ${organizationId}`);
      return null;
    }

    const embeddings = this.cache.get(organizationId);
    if (embeddings) {
      console.log(`📦 Retrieved ${embeddings.length} cached embeddings for ${organizationId}`);
      return [...embeddings]; // Return copy to prevent mutations
    }

    return null;
  }

  setCachedEmbeddings(organizationId: string, embeddings: CachedFaceEmbedding[]): void {
    try {
      // Filter out invalid embeddings
      const validEmbeddings = embeddings.filter(emb =>
        emb.id &&
        emb.name &&
        Array.isArray(emb.embedding) &&
        emb.embedding.length > 0 &&
        emb.organization_id === organizationId
      );

      this.cache.set(organizationId, validEmbeddings);

      const info: CacheInfo = {
        organizationId,
        lastUpdated: Date.now(),
        count: validEmbeddings.length,
        version: this.CACHE_VERSION
      };

      this.cacheInfo.set(organizationId, info);

      console.log(`📦 Cached ${validEmbeddings.length} embeddings for ${organizationId}`);

      this.saveToLocalStorage();
      this.logCacheStats();
    } catch (error) {
      console.error('Failed to cache embeddings:', error);
    }
  }

  addEmbedding(organizationId: string, embedding: CachedFaceEmbedding): void {
    const existingEmbeddings = this.cache.get(organizationId) || [];

    // Remove existing embedding with same ID if it exists
    const filteredEmbeddings = existingEmbeddings.filter(emb => emb.id !== embedding.id);

    // Add new/updated embedding
    filteredEmbeddings.push(embedding);

    this.setCachedEmbeddings(organizationId, filteredEmbeddings);
  }

  removeEmbedding(organizationId: string, memberId: string): void {
    const existingEmbeddings = this.cache.get(organizationId) || [];
    const filteredEmbeddings = existingEmbeddings.filter(emb => emb.id !== memberId);

    this.setCachedEmbeddings(organizationId, filteredEmbeddings);
    console.log(`📦 Removed embedding for member ${memberId} from cache`);
  }

  clearCache(organizationId?: string): void {
    if (organizationId) {
      this.cache.delete(organizationId);
      this.cacheInfo.delete(organizationId);
      console.log(`📦 Cleared cache for organization ${organizationId}`);
    } else {
      this.cache.clear();
      this.cacheInfo.clear();
      console.log('📦 Cleared all cache data');
    }

    this.saveToLocalStorage();
  }

  getCacheInfo(organizationId: string): CacheInfo | null {
    return this.cacheInfo.get(organizationId) || null;
  }

  getAllCachedOrganizations(): string[] {
    return Array.from(this.cache.keys());
  }

  // Get cache size in bytes (approximate)
  getCacheSize(): number {
    try {
      const cacheData = localStorage.getItem(this.CACHE_KEY) || '{}';
      const cacheInfoData = localStorage.getItem(this.CACHE_INFO_KEY) || '{}';
      return cacheData.length + cacheInfoData.length;
    } catch {
      return 0;
    }
  }

  // Check if cache is approaching localStorage limits
  isCacheNearLimit(): boolean {
    const cacheSize = this.getCacheSize();
    const approximateLimit = 5 * 1024 * 1024; // 5MB approximate limit
    return cacheSize > approximateLimit * 0.8; // 80% of limit
  }

  // Cleanup old/unused cache entries
  cleanup(): void {
    console.log('🧹 Running cache cleanup...');

    let removedCount = 0;

    // Remove expired cache entries
    for (const [orgId, info] of this.cacheInfo) {
      if (Date.now() - info.lastUpdated > this.CACHE_EXPIRY) {
        this.clearCache(orgId);
        removedCount++;
      }
    }

    console.log(`🧹 Cleanup complete: removed ${removedCount} expired cache entries`);

    if (this.isCacheNearLimit()) {
      console.warn('⚠️ Cache is approaching localStorage limits, consider clearing some data');
    }
  }
}

export const faceEmbeddingCache = new FaceEmbeddingCache();