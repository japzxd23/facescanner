// Robust version of the blazing fast scanner with better error handling
import { faceRecognitionService } from './faceRecognition';
import { addAttendanceLog, supabase } from './supabaseClient';

export interface RobustMatchResult {
  member: {
    id: string;
    name: string;
    status: 'Allowed' | 'Banned' | 'VIP';
  };
  confidence: number;
  processingTime: number;
  method: 'optimized' | 'fallback';
}

export class RobustBlazingFastScanner {
  private isInitialized = false;
  private useOptimizedPath = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log('🚀 Initializing ROBUST BLAZING FAST Scanner...');
    const startTime = performance.now();

    // ALWAYS initialize the fallback system first (to ensure we have a working system)
    console.log('🛡️ Initializing robust fallback system...');
    try {
      await faceRecognitionService.initialize();
      console.log('✅ Robust fallback system ready');
    } catch (fallbackError) {
      console.error('❌ CRITICAL: Even fallback system failed:', fallbackError);
      throw new Error(`Both optimized and fallback systems failed to initialize: ${fallbackError.message}`);
    }

    // Now try to add optimized capabilities (optional)
    console.log('⚡ Attempting to add optimized capabilities...');
    try {
      const { superOptimizedFaceRecognition } = await import('./superOptimizedFaceRecognition');
      await superOptimizedFaceRecognition.initialize();
      this.useOptimizedPath = true;
      console.log('✅ OPTIMIZED path available - will use maximum performance!');
    } catch (optimizedError) {
      console.warn('⚠️ Optimized system unavailable, using robust fallback:', optimizedError);
      this.useOptimizedPath = false;
      console.log('✅ Using ROBUST fallback only - guaranteed accuracy!');
    }

    this.isInitialized = true;
    const initTime = performance.now() - startTime;
    console.log(`🚀 ROBUST system ready in ${initTime.toFixed(1)}ms (${this.useOptimizedPath ? 'HYBRID' : 'FALLBACK'} mode)`);
  }

  async processVideoFrame(
    videoElement: HTMLVideoElement,
    organizationId: string,
    onMatch: (result: RobustMatchResult) => void,
    onNoMatch: () => void,
    onError: (error: string) => void
  ): Promise<void> {
    if (!this.isInitialized) {
      onError('Robust scanner not initialized');
      return;
    }

    const totalStart = performance.now();

    try {
      if (this.useOptimizedPath) {
        console.log('⚡ Attempting optimized processing...');
        // Try blazing fast optimized path first
        try {
          await this.processWithOptimizedPath(videoElement, organizationId, onMatch, onNoMatch, onError, totalStart);
        } catch (optimizedError) {
          console.warn('⚠️ Optimized processing failed, falling back to robust method:', optimizedError);
          // Immediately fallback to robust processing
          await this.processWithFallbackPath(videoElement, organizationId, onMatch, onNoMatch, onError, totalStart);
        }
      } else {
        console.log('🛡️ Using robust fallback processing...');
        // Use robust fallback path
        await this.processWithFallbackPath(videoElement, organizationId, onMatch, onNoMatch, onError, totalStart);
      }
    } catch (error) {
      console.error('❌ All processing methods failed:', error);
      onError(error instanceof Error ? error.message : 'All processing methods failed');
    }
  }

  private async processWithOptimizedPath(
    videoElement: HTMLVideoElement,
    organizationId: string,
    onMatch: (result: RobustMatchResult) => void,
    onNoMatch: () => void,
    onError: (error: string) => void,
    startTime: number
  ): Promise<void> {
    try {
      const { superOptimizedFaceRecognition } = await import('./superOptimizedFaceRecognition');

      // Extract face embedding (BLAZING FAST)
      const embedding = await superOptimizedFaceRecognition.extractFaceFromVideo(videoElement);

      if (!embedding) {
        onNoMatch();
        return;
      }

      // Find match (ULTRA FAST)
      const matchResult = await superOptimizedFaceRecognition.findBestMatch(embedding, organizationId);

      if (!matchResult) {
        onNoMatch();
        return;
      }

      // Log attendance async
      this.logAttendanceAsync(matchResult.member.id, matchResult.confidence);

      const totalTime = performance.now() - startTime;

      onMatch({
        member: {
          id: matchResult.member.id,
          name: matchResult.member.name,
          status: matchResult.member.status
        },
        confidence: matchResult.confidence,
        processingTime: totalTime,
        method: 'optimized'
      });

    } catch (error) {
      console.warn('⚠️ Optimized path failed:', error);
      // Throw error to trigger fallback at higher level
      throw new Error(`Optimized processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processWithFallbackPath(
    videoElement: HTMLVideoElement,
    organizationId: string,
    onMatch: (result: RobustMatchResult) => void,
    onNoMatch: () => void,
    onError: (error: string) => void,
    startTime: number
  ): Promise<void> {
    try {
      console.log('🔄 Using robust fallback processing...');

      // Use your current robust face recognition system
      const faces = await faceRecognitionService.detectFaces(videoElement);

      if (faces.length === 0) {
        onNoMatch();
        return;
      }

      // Use the first detected face
      const face = faces[0];

      // Validate face quality
      const qualityCheck = faceRecognitionService.validateFaceQuality(face, videoElement.videoWidth, videoElement.videoHeight);
      if (!qualityCheck.isValid) {
        console.log('⚠️ Face quality too low:', qualityCheck.reason);
        onNoMatch();
        return;
      }

      // Generate embedding using your current robust method
      const embedding = faceRecognitionService.generateEmbedding(face);
      if (embedding.length === 0) {
        onNoMatch();
        return;
      }

      // Match against cached embeddings
      const matchResult = await faceRecognitionService.matchFaceWithCache(embedding, organizationId, 0.85);

      if (!matchResult) {
        onNoMatch();
        return;
      }

      // Log attendance async
      this.logAttendanceAsync(matchResult.id, matchResult.confidence);

      const totalTime = performance.now() - startTime;

      onMatch({
        member: {
          id: matchResult.id,
          name: matchResult.name,
          status: matchResult.status
        },
        confidence: matchResult.confidence,
        processingTime: totalTime,
        method: 'fallback'
      });

    } catch (error) {
      console.error('❌ Fallback processing failed:', error);
      onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async captureFaceForRegistration(videoElement: HTMLVideoElement): Promise<{
    embedding: number[];
    cropCanvas: HTMLCanvasElement | null;
    processingTime: number;
    method: 'optimized' | 'fallback';
  } | null> {
    if (!this.isInitialized) {
      throw new Error('Robust scanner not initialized');
    }

    const startTime = performance.now();

    try {
      if (this.useOptimizedPath) {
        // Try optimized capture first
        console.log('⚡ Attempting optimized capture...');
        try {
          const { superOptimizedFaceRecognition } = await import('./superOptimizedFaceRecognition');

          const embedding = await superOptimizedFaceRecognition.extractFaceFromVideo(videoElement);
          if (embedding) {
            return {
              embedding: Array.from(embedding),
              cropCanvas: null, // Simplified for now
              processingTime: performance.now() - startTime,
              method: 'optimized'
            };
          }
        } catch (optimizedError) {
          console.warn('⚠️ Optimized capture failed, falling back to robust method:', optimizedError);
          // Continue to fallback below
        }
      }

      // Fallback to robust capture (ALWAYS available)
      console.log('🛡️ Using robust fallback for capture...');

      const faces = await faceRecognitionService.detectFaces(videoElement);
      if (faces.length === 0) {
        return null;
      }

      const face = faces[0];
      const qualityCheck = faceRecognitionService.validateFaceQuality(face, videoElement.videoWidth, videoElement.videoHeight);

      if (!qualityCheck.isValid) {
        console.log('⚠️ Face quality too low for registration:', qualityCheck.reason);
        return null;
      }

      // Crop face for display
      const cropCanvas = faceRecognitionService.cropFaceFromVideo(videoElement, face);

      // Generate embedding for storage
      const embedding = faceRecognitionService.generateEmbedding(face);
      if (embedding.length === 0) {
        return null;
      }

      return {
        embedding,
        cropCanvas,
        processingTime: performance.now() - startTime,
        method: 'fallback'
      };

    } catch (error) {
      console.error('❌ Face capture failed:', error);
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
      console.log(`📝 Registering new member: ${name}...`);

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
        console.error('❌ Registration failed:', error);
        return { success: false, error: error.message };
      }

      // Clear both caches
      try {
        if (this.useOptimizedPath) {
          const { superOptimizedFaceRecognition } = await import('./superOptimizedFaceRecognition');
          superOptimizedFaceRecognition.clearCache(organizationId);
        }
        faceRecognitionService.refreshCache(organizationId);
      } catch (cacheError) {
        console.warn('⚠️ Cache refresh failed (non-critical):', cacheError);
      }

      console.log(`✅ Member registered successfully: ${name} (ID: ${newMember.id})`);
      return { success: true, memberId: newMember.id };

    } catch (error) {
      console.error('❌ Member registration error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

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

  clearCache(organizationId?: string): void {
    try {
      if (this.useOptimizedPath) {
        import('./superOptimizedFaceRecognition').then(({ superOptimizedFaceRecognition }) => {
          superOptimizedFaceRecognition.clearCache(organizationId);
        });
      }
      faceRecognitionService.refreshCache(organizationId || '');
    } catch (error) {
      console.warn('⚠️ Cache clear failed:', error);
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  getSystemInfo(): { initialized: boolean; optimized: boolean; performance: string } {
    return {
      initialized: this.isInitialized,
      optimized: this.useOptimizedPath,
      performance: this.useOptimizedPath ? 'ROBUST BLAZING FAST (hybrid)' : 'ROBUST (fallback only)'
    };
  }
}

// Singleton for optimal performance
export const robustBlazingFastScanner = new RobustBlazingFastScanner();