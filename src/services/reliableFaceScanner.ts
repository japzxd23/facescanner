// Reliable face scanner that uses your proven current system with better organization
import { faceRecognitionService } from './faceRecognition';
import { addAttendanceLog, supabase } from './supabaseClient';

export interface ReliableMatchResult {
  member: {
    id: string;
    name: string;
    status: 'Allowed' | 'Banned' | 'VIP';
  };
  confidence: number;
  processingTime: number;
  method: 'reliable';
}

export class ReliableFaceScanner {
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('✅ Reliable face scanner already initialized');
      return;
    }

    console.log('🛡️ Initializing RELIABLE face recognition system...');
    const startTime = performance.now();

    try {
      // Use your proven face recognition system
      await faceRecognitionService.initialize();

      this.isInitialized = true;
      const initTime = performance.now() - startTime;

      console.log(`✅ RELIABLE face scanner ready in ${initTime.toFixed(1)}ms`);
      console.log('🎯 Using proven face recognition system - guaranteed to work!');

    } catch (error) {
      console.error('❌ Reliable face scanner initialization failed:', error);
      throw error;
    }
  }

  async processVideoFrame(
    videoElement: HTMLVideoElement,
    organizationId: string,
    onMatch: (result: ReliableMatchResult) => void,
    onNoMatch: () => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (!this.isInitialized) {
      onError('Reliable face scanner not initialized');
      return;
    }

    const totalStart = performance.now();

    try {
      console.log('🛡️ Processing frame with reliable face recognition...');

      // Step 1: Detect faces using your proven system
      const faces = await faceRecognitionService.detectFaces(videoElement);

      if (faces.length === 0) {
        console.log('⚠️ No faces detected');
        onNoMatch();
        return;
      }

      // Step 2: Validate face quality using your proven validation
      const face = faces[0];
      const qualityCheck = faceRecognitionService.validateFaceQuality(
        face,
        videoElement.videoWidth,
        videoElement.videoHeight
      );

      if (!qualityCheck.isValid) {
        console.log('⚠️ Face quality too low:', qualityCheck.reason);
        onNoMatch();
        return;
      }

      // Step 3: Generate embedding using your proven method
      const embedding = faceRecognitionService.generateEmbedding(face);
      if (embedding.length === 0) {
        console.log('⚠️ Failed to generate embedding');
        onNoMatch();
        return;
      }

      // Step 4: Match against cached embeddings using your proven method
      const matchResult = await faceRecognitionService.matchFaceWithCache(
        embedding,
        organizationId,
        0.85 // Your proven threshold
      );

      if (!matchResult) {
        console.log('❌ No match found above confidence threshold');
        onNoMatch();
        return;
      }

      // Step 5: Log attendance async (non-blocking)
      this.logAttendanceAsync(matchResult.id, matchResult.confidence);

      const totalTime = performance.now() - totalStart;
      console.log(`✅ RELIABLE MATCH: ${matchResult.name} in ${totalTime.toFixed(1)}ms (confidence: ${matchResult.confidence.toFixed(3)})`);

      // Return successful match
      onMatch({
        member: {
          id: matchResult.id,
          name: matchResult.name,
          status: matchResult.status
        },
        confidence: matchResult.confidence,
        processingTime: totalTime,
        method: 'reliable'
      });

    } catch (error) {
      console.error('❌ Reliable face processing failed:', error);
      onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async captureFaceForRegistration(videoElement: HTMLVideoElement): Promise<{
    embedding: number[];
    cropCanvas: HTMLCanvasElement | null;
    processingTime: number;
    method: 'reliable';
  } | null> {
    if (!this.isInitialized) {
      throw new Error('Reliable face scanner not initialized');
    }

    const startTime = performance.now();

    try {
      console.log('📸 RELIABLE face capture for registration...');

      // Step 1: Detect faces
      const faces = await faceRecognitionService.detectFaces(videoElement);
      if (faces.length === 0) {
        console.log('❌ No faces detected for registration');
        return null;
      }

      // Step 2: Validate face quality
      const face = faces[0];
      const qualityCheck = faceRecognitionService.validateFaceQuality(
        face,
        videoElement.videoWidth,
        videoElement.videoHeight
      );

      if (!qualityCheck.isValid) {
        console.log('⚠️ Face quality too low for registration:', qualityCheck.reason);
        return null;
      }

      // Step 3: Crop face for display
      const cropCanvas = faceRecognitionService.cropFaceFromVideo(videoElement, face);

      // Step 4: Generate embedding for storage
      const embedding = faceRecognitionService.generateEmbedding(face);
      if (embedding.length === 0) {
        console.log('❌ Failed to generate embedding for registration');
        return null;
      }

      const processingTime = performance.now() - startTime;
      console.log(`📸 RELIABLE face captured in ${processingTime.toFixed(1)}ms`);

      return {
        embedding,
        cropCanvas,
        processingTime,
        method: 'reliable'
      };

    } catch (error) {
      console.error('❌ Reliable face capture failed:', error);
      return null;
    }
  }

  async registerNewMember(
    name: string,
    embedding: number[],
    organizationId: string,
    status: 'Allowed' | 'Banned' | 'VIP' = 'Allowed'
  ): Promise<{ success: boolean; memberId?: string; error?: string }> {
    try {
      console.log(`📝 RELIABLE registration: ${name}...`);

      // Store in Supabase
      const { data: newMember, error } = await supabase
        .from('members')
        .insert([{
          name,
          face_embedding: embedding,
          status,
          organization_id: organizationId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('❌ Reliable registration failed:', error);
        return { success: false, error: error.message };
      }

      // Clear cache to include new member
      try {
        await faceRecognitionService.refreshCache(organizationId);
        console.log('🔄 Cache refreshed to include new member');
      } catch (cacheError) {
        console.warn('⚠️ Cache refresh failed (non-critical):', cacheError);
      }

      console.log(`✅ RELIABLE registration successful: ${name} (ID: ${newMember.id})`);
      return { success: true, memberId: newMember.id };

    } catch (error) {
      console.error('❌ Reliable member registration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Async attendance logging (non-blocking)
  private async logAttendanceAsync(memberId: string, confidence: number): Promise<void> {
    setTimeout(async () => {
      try {
        await addAttendanceLog(memberId, confidence);
        console.log(`📊 Attendance logged for member ${memberId} (confidence: ${confidence.toFixed(3)})`);
      } catch (error) {
        console.error('⚠️ Attendance logging failed (non-critical):', error);
      }
    }, 0);
  }

  // Cache management
  clearCache(organizationId?: string): void {
    try {
      faceRecognitionService.refreshCache(organizationId || '');
      console.log(`🧹 Cache cleared for ${organizationId || 'current organization'}`);
    } catch (error) {
      console.warn('⚠️ Cache clear failed:', error);
    }
  }

  // Health check
  isReady(): boolean {
    return this.isInitialized && faceRecognitionService.isReady();
  }

  // Get system info
  getSystemInfo(): { initialized: boolean; ready: boolean; performance: string } {
    return {
      initialized: this.isInitialized,
      ready: this.isReady(),
      performance: 'RELIABLE (proven system)'
    };
  }

  // Get cache statistics
  getCacheStats(organizationId: string): { cached: boolean; count: number; age: number } {
    return faceRecognitionService.getCacheStats(organizationId);
  }
}

// Singleton for optimal performance
export const reliableFaceScanner = new ReliableFaceScanner();