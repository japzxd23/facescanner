import * as faceapi from 'face-api.js';
import { localDatabase, LocalMember } from './localDatabase';
import { simpleLocalStorage } from './simpleLocalStorage';

// Member with cached base64 image for fast comparison
interface CachedMember {
  id: string;
  name: string;
  photo_url: string; // Base64 image
  status: 'Allowed' | 'Banned' | 'VIP';
  descriptor?: Float32Array; // Computed on-demand for comparison
}

// Ultra-fast face recognition service using local storage (SQLite or simple)
export class OptimizedFaceRecognitionService {
  private cachedMembers: CachedMember[] = [];
  private isInitialized = false;
  private excellentMatchThreshold = 0.55; // Distance threshold for excellent matches
  private goodMatchThreshold = 0.85; // Distance threshold for good matches
  private storageService: typeof localDatabase | typeof simpleLocalStorage | null = null;

  // Initialize and load all members with base64 images from local storage
  async initialize(storageService?: typeof localDatabase | typeof simpleLocalStorage): Promise<void> {
    // Use provided storage service or default to localDatabase
    this.storageService = storageService || localDatabase;

    const storageType = this.storageService === localDatabase ? 'SQLite' : 'simple localStorage';
    console.log(`⚡ Initializing ultra-fast face recognition with ${storageType}...`);

    try {
      // Ensure storage service is initialized
      if (!this.storageService.isReady()) {
        console.log(`📂 ${storageType} not ready, initializing...`);
        await this.storageService.initialize();
      }

      // Load members with photos from local storage (much faster than Supabase!)
      const localMembers = await this.storageService.getMembersWithPhotos();

      // Convert to cached members format
      this.cachedMembers = localMembers.map(member => ({
        id: member.id,
        name: member.name,
        photo_url: member.photo_url!,
        status: member.status,
        descriptor: undefined // Will be computed on first comparison
      }));

      this.isInitialized = true;
      console.log(`⚡ Ultra-fast face recognition initialized with ${this.cachedMembers.length} members from ${storageType}`);

    } catch (error) {
      console.error('❌ Failed to initialize optimized face recognition:', error);
      throw error;
    }
  }

  // Reload members from local storage (call after sync or new member addition)
  async reloadMembers(): Promise<void> {
    if (!this.storageService) {
      console.error('❌ No storage service available for reload');
      return;
    }

    const storageType = this.storageService === localDatabase ? 'SQLite' : 'simple localStorage';
    console.log(`🔄 Reloading members from ${storageType}...`);

    try {
      // Load fresh data from storage service
      const localMembers = await this.storageService.getMembersWithPhotos();

      // Update cached members
      this.cachedMembers = localMembers.map(member => ({
        id: member.id,
        name: member.name,
        photo_url: member.photo_url!,
        status: member.status,
        descriptor: undefined // Reset descriptors to recompute if needed
      }));

      console.log(`✅ Reloaded ${this.cachedMembers.length} members from ${storageType}`);
    } catch (error) {
      console.error('❌ Error reloading members:', error);
    }
  }

  // Accurate face recognition using cached base64 images
  async recognizeFace(capturedImageBase64: string): Promise<{
    member: CachedMember | null;
    confidence: number;
    processingTimeMs: number;
  }> {
    const startTime = performance.now();

    if (!this.isInitialized) {
      throw new Error('OptimizedFaceRecognitionService not initialized');
    }

    if (this.cachedMembers.length === 0) {
      return {
        member: null,
        confidence: 0,
        processingTimeMs: performance.now() - startTime
      };
    }

    console.log(`🔍 Starting accurate base64 face recognition against ${this.cachedMembers.length} cached members...`);

    // Extract descriptor from captured image
    const capturedDescriptor = await this.extractDescriptorFromBase64(capturedImageBase64);
    if (!capturedDescriptor) {
      console.log('❌ Could not extract descriptor from captured image');
      return {
        member: null,
        confidence: 0,
        processingTimeMs: performance.now() - startTime
      };
    }

    let bestMatch: CachedMember | null = null;
    let bestDistance = Infinity;

    // Compare against all cached members using high-accuracy face-api.js
    for (const member of this.cachedMembers) {
      try {
        // Get or compute descriptor for cached member
        if (!member.descriptor) {
          console.log(`🧮 Computing descriptor for ${member.name}...`);
          member.descriptor = await this.extractDescriptorFromBase64(member.photo_url);
        }

        if (!member.descriptor) {
          console.log(`⚠️ Could not extract descriptor for ${member.name}, skipping`);
          continue;
        }

        // Calculate euclidean distance using face-api.js for accuracy
        const distance = faceapi.euclideanDistance(capturedDescriptor, member.descriptor);

        console.log(`📊 ${member.name}: distance=${distance.toFixed(4)}`);

        // Early exit for excellent matches
        if (distance < this.excellentMatchThreshold) {
          const processingTime = performance.now() - startTime;
          const confidence = Math.max(0, (1 - distance) * 100);

          console.log(`⚡ EXCELLENT MATCH FOUND: ${member.name} (distance: ${distance.toFixed(4)}, confidence: ${confidence.toFixed(1)}%, time: ${processingTime.toFixed(1)}ms)`);

          return {
            member,
            confidence,
            processingTimeMs: processingTime
          };
        }

        // Track best match
        if (distance < bestDistance) {
          bestDistance = distance;
          bestMatch = member;
        }

      } catch (error) {
        console.error(`❌ Error comparing with ${member.name}:`, error);
      }
    }

    const processingTime = performance.now() - startTime;

    // Check if best match meets good threshold
    if (bestMatch && bestDistance < this.goodMatchThreshold) {
      const confidence = Math.max(0, (1 - bestDistance) * 100);

      console.log(`✅ GOOD MATCH FOUND: ${bestMatch.name} (distance: ${bestDistance.toFixed(4)}, confidence: ${confidence.toFixed(1)}%, time: ${processingTime.toFixed(1)}ms)`);

      return {
        member: bestMatch,
        confidence,
        processingTimeMs: processingTime
      };
    }

    // No match found
    console.log(`❌ No match found (best distance: ${bestDistance.toFixed(4)}, time: ${processingTime.toFixed(1)}ms)`);

    return {
      member: null,
      confidence: 0,
      processingTimeMs: processingTime
    };
  }

  // Extract face descriptor from base64 image
  private async extractDescriptorFromBase64(base64Image: string): Promise<Float32Array | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = async () => {
        try {
          const detections = await faceapi
            .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (detections && detections.descriptor) {
            resolve(detections.descriptor);
          } else {
            resolve(null);
          }
        } catch (error) {
          console.error('❌ Error extracting descriptor:', error);
          resolve(null);
        }
      };

      img.onerror = () => {
        console.error('❌ Error loading base64 image');
        resolve(null);
      };

      img.src = base64Image;
    });
  }

  // Get statistics about loaded members
  getStats(): {
    totalMembers: number;
    membersWithDescriptors: number;
    allowedMembers: number;
    bannedMembers: number;
    vipMembers: number;
  } {
    const allowed = this.cachedMembers.filter(m => m.status === 'Allowed').length;
    const banned = this.cachedMembers.filter(m => m.status === 'Banned').length;
    const vip = this.cachedMembers.filter(m => m.status === 'VIP').length;
    const withDescriptors = this.cachedMembers.filter(m => m.descriptor).length;

    return {
      totalMembers: this.cachedMembers.length,
      membersWithDescriptors: withDescriptors,
      allowedMembers: allowed,
      bannedMembers: banned,
      vipMembers: vip
    };
  }

  // Check if member exists in cache
  hasMember(memberId: string): boolean {
    return this.cachedMembers.some(m => m.id === memberId);
  }

  // Get member by ID from cache
  getMember(memberId: string): CachedMember | null {
    return this.cachedMembers.find(m => m.id === memberId) || null;
  }

  // Check if service is ready
  isReady(): boolean {
    return this.isInitialized && this.cachedMembers.length > 0;
  }

  // Update configurable thresholds
  updateThresholds(excellentThreshold: number, goodThreshold: number): void {
    this.excellentMatchThreshold = excellentThreshold;
    this.goodMatchThreshold = goodThreshold;
    console.log(`🔧 Updated thresholds - Excellent: ${excellentThreshold}, Good: ${goodThreshold}`);
  }

  // Get current thresholds
  getThresholds(): { excellent: number; good: number } {
    return {
      excellent: this.excellentMatchThreshold,
      good: this.goodMatchThreshold
    };
  }
}

// Global instance
export const optimizedFaceRecognition = new OptimizedFaceRecognitionService();