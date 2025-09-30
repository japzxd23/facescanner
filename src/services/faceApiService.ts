import * as faceapi from '@vladmandic/face-api';
import { faceEmbeddingCache, CachedFaceEmbedding } from './faceEmbeddingCache';
import { supabase } from './supabaseClient';

export interface FaceDetectionResult {
  detected: boolean;
  confidence: number;
  landmarks?: faceapi.FaceLandmarks68;
  descriptor?: Float32Array;
  qualityScore: number;
  faceSize: number;
  box?: faceapi.Box;
}

export interface FaceMatchResult {
  matched: boolean;
  person?: CachedFaceEmbedding;
  similarity: number;
  confidence: number;
}

class FaceApiService {
  private isInitialized = false;
  private readonly SIMILARITY_THRESHOLD = 0.85; // SECURITY FIX: Raised from 0.6 to prevent false positives
  private readonly MIN_FACE_SIZE = 80;
  private readonly MIN_CONFIDENCE = 0.5;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('🤖 Initializing face-api.js...');

      // Use jsdelivr CDN for models
      const modelUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model';

      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl)
      ]);

      this.isInitialized = true;
      console.log('✅ face-api.js initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize face-api.js:', error);
      throw error;
    }
  }

  async detectFaces(videoElement: HTMLVideoElement): Promise<FaceDetectionResult[]> {
    if (!this.isInitialized) {
      throw new Error('FaceApiService not initialized');
    }

    try {
      const detections = await faceapi
        .detectAllFaces(videoElement, new faceapi.SsdMobilenetv1Options({
          minConfidence: this.MIN_CONFIDENCE,
          maxResults: 5
        }))
        .withFaceLandmarks()
        .withFaceDescriptors();

      const results: FaceDetectionResult[] = [];

      for (const detection of detections) {
        const box = detection.detection.box;
        const confidence = detection.detection.score;
        const faceSize = Math.min(box.width, box.height);

        // Calculate quality score
        const qualityScore = this.calculateQualityScore(detection, videoElement);

        results.push({
          detected: true,
          confidence,
          landmarks: detection.landmarks,
          descriptor: detection.descriptor,
          qualityScore,
          faceSize,
          box
        });
      }

      return results;
    } catch (error) {
      console.error('Face detection error:', error);
      return [];
    }
  }

  private calculateQualityScore(
    detection: faceapi.WithFaceLandmarks<faceapi.WithFaceDescriptor<faceapi.FaceDetection>, faceapi.FaceLandmarks68>,
    videoElement: HTMLVideoElement
  ): number {
    const box = detection.detection.box;
    const confidence = detection.detection.score;

    // Size quality (0-1)
    const sizeQuality = Math.min(Math.min(box.width, box.height) / this.MIN_FACE_SIZE, 1);

    // Position quality (0-1, better when centered)
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const videoCenterX = videoElement.videoWidth / 2;
    const videoCenterY = videoElement.videoHeight / 2;

    const distanceFromCenter = Math.sqrt(
      Math.pow(centerX - videoCenterX, 2) + Math.pow(centerY - videoCenterY, 2)
    );
    const maxDistance = Math.sqrt(Math.pow(videoCenterX, 2) + Math.pow(videoCenterY, 2));
    const positionQuality = 1 - (distanceFromCenter / maxDistance);

    // Combined quality score
    return (confidence * 0.5 + sizeQuality * 0.3 + positionQuality * 0.2);
  }

  async loadMembersFromCache(organizationId: string): Promise<CachedFaceEmbedding[]> {
    console.log(`📦 Loading face embeddings for organization: ${organizationId}`);

    // Try to get from cache first
    const cached = faceEmbeddingCache.getCachedEmbeddings(organizationId);
    if (cached) {
      console.log(`📦 Using cached embeddings: ${cached.length} faces`);
      return cached;
    }

    // Cache miss - load from Supabase
    console.log('📡 Cache miss - loading from Supabase...');
    try {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, face_embedding, status, organization_id, updated_at')
        .eq('organization_id', organizationId)
        .not('face_embedding', 'is', null);

      if (error) throw error;

      const embeddings: CachedFaceEmbedding[] = (data || []).map(member => ({
        id: member.id,
        name: member.name,
        embedding: member.face_embedding,
        status: member.status,
        organization_id: member.organization_id,
        updated_at: member.updated_at
      }));

      // Cache the results
      faceEmbeddingCache.setCachedEmbeddings(organizationId, embeddings);

      console.log(`📡 Loaded ${embeddings.length} embeddings from Supabase and cached them`);
      return embeddings;
    } catch (error) {
      console.error('Failed to load embeddings from Supabase:', error);
      return [];
    }
  }

  async matchFace(descriptor: Float32Array, organizationId: string): Promise<FaceMatchResult> {
    try {
      const cachedEmbeddings = await this.loadMembersFromCache(organizationId);

      if (cachedEmbeddings.length === 0) {
        console.log('🔍 No cached embeddings available for matching');
        return {
          matched: false,
          similarity: 0,
          confidence: 0
        };
      }

      let bestMatch: CachedFaceEmbedding | null = null;
      let bestSimilarity = 0;
      const allSimilarities: Array<{name: string, similarity: number}> = [];

      console.log(`🔒 SECURE FaceAPI MATCHING: Comparing against ${cachedEmbeddings.length} cached faces with threshold ${this.SIMILARITY_THRESHOLD}`);

      // SECURITY FIX: Find the absolute best match first, then check threshold
      for (const embedding of cachedEmbeddings) {
        const embeddingArray = new Float32Array(embedding.embedding);
        const distance = faceapi.euclideanDistance(descriptor, embeddingArray);
        const similarity = 1 - distance;

        allSimilarities.push({ name: embedding.name, similarity: similarity });
        console.log(`🔍 ${embedding.name}: ${similarity.toFixed(4)}`);

        // Find the best match regardless of threshold (security fix)
        if (similarity > bestSimilarity) {
          bestMatch = embedding;
          bestSimilarity = similarity;
        }
      }

      // Sort and log all matches for debugging
      allSimilarities.sort((a, b) => b.similarity - a.similarity);
      console.log(`🏆 All matches (sorted):`, allSimilarities.slice(0, 3));

      // SECURITY: Only accept the best match if it meets the minimum threshold
      if (bestMatch && bestSimilarity >= this.SIMILARITY_THRESHOLD) {
        console.log(`✅ SECURE FaceAPI MATCH CONFIRMED: ${bestMatch.name} (similarity: ${bestSimilarity.toFixed(4)} >= ${this.SIMILARITY_THRESHOLD})`);

        // Additional security check: ensure significant confidence
        const secondBest = allSimilarities[1]?.similarity || 0;
        const confidenceGap = bestSimilarity - secondBest;

        if (confidenceGap < 0.1 && cachedEmbeddings.length > 1) {
          console.log(`⚠️  LOW CONFIDENCE GAP: ${confidenceGap.toFixed(4)} - could be family member or false positive`);
          console.log(`🔒 SECURITY REJECTION: Ambiguous match between similar faces`);
          return { matched: false, similarity: bestSimilarity, confidence: 0 };
        }

        return {
          matched: true,
          person: bestMatch,
          similarity: bestSimilarity,
          confidence: bestSimilarity
        };
      }

      console.log(`🔒 SECURITY REJECTION: Best match ${bestMatch?.name || 'none'} similarity ${bestSimilarity.toFixed(4)} < threshold ${this.SIMILARITY_THRESHOLD}`);
      return {
        matched: false,
        similarity: bestSimilarity,
        confidence: 0
      };
    } catch (error) {
      console.error('Face matching error:', error);
      return {
        matched: false,
        similarity: 0,
        confidence: 0
      };
    }
  }

  async storeFaceEmbedding(memberId: string, descriptor: Float32Array, organizationId: string): Promise<void> {
    try {
      const embedding = Array.from(descriptor);

      const { error } = await supabase
        .from('members')
        .update({ face_embedding: embedding })
        .eq('id', memberId);

      if (error) throw error;

      // Update cache
      const { data: memberData } = await supabase
        .from('members')
        .select('*')
        .eq('id', memberId)
        .single();

      if (memberData) {
        const cachedEmbedding: CachedFaceEmbedding = {
          id: memberData.id,
          name: memberData.name,
          embedding: memberData.face_embedding,
          status: memberData.status,
          organization_id: memberData.organization_id,
          updated_at: memberData.updated_at
        };

        faceEmbeddingCache.addEmbedding(organizationId, cachedEmbedding);
      }

      console.log(`💾 Stored face embedding for member ${memberId} and updated cache`);
    } catch (error) {
      console.error('Failed to store face embedding:', error);
      throw error;
    }
  }

  isHighQuality(result: FaceDetectionResult): boolean {
    return result.detected &&
           result.confidence >= this.MIN_CONFIDENCE &&
           result.faceSize >= this.MIN_FACE_SIZE &&
           result.qualityScore >= 0.6;
  }

  // Draw face detection overlays on canvas
  drawDetections(
    canvas: HTMLCanvasElement,
    videoElement: HTMLVideoElement,
    detections: FaceDetectionResult[]
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set canvas size to match video
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;

    for (const detection of detections) {
      if (!detection.box || !detection.landmarks) continue;

      const { box } = detection;

      // Draw face bounding box
      ctx.strokeStyle = this.isHighQuality(detection) ? '#00ff00' : '#ffff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      // Draw landmarks
      ctx.fillStyle = '#ff0000';
      const landmarks = detection.landmarks.positions;
      for (const point of landmarks) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
        ctx.fill();
      }

      // Draw confidence and quality scores
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.fillText(
        `Conf: ${detection.confidence.toFixed(2)} | Qual: ${detection.qualityScore.toFixed(2)}`,
        box.x,
        box.y - 5
      );
    }
  }

  // Refresh cache manually
  async refreshCache(organizationId: string): Promise<void> {
    console.log(`🔄 Manually refreshing cache for organization ${organizationId}`);
    faceEmbeddingCache.clearCache(organizationId);
    await this.loadMembersFromCache(organizationId);
  }

  // Get cache statistics
  getCacheStats(organizationId: string): { cached: boolean; count: number; age: number } {
    const info = faceEmbeddingCache.getCacheInfo(organizationId);
    const cached = faceEmbeddingCache.getCachedEmbeddings(organizationId);

    return {
      cached: !!cached,
      count: cached?.length || 0,
      age: info ? Math.round((Date.now() - info.lastUpdated) / (60 * 1000)) : 0
    };
  }
}

export const faceApiService = new FaceApiService();