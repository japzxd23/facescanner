import React, { useEffect, useRef, useState } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonText,
  IonSpinner,
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonAlert
} from '@ionic/react';
import { arrowBack, home, settings } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { faceRecognitionService } from '../services/faceRecognition';
import { faceApiService } from '../services/faceApiService';
import { tensorflowFaceDetection } from '../services/tensorflowFaceDetection';
import {
  addAttendanceLog,
  addMember,
  hasAttendedToday,
  Member,
  setOrganizationContext,
  clearOrganizationContext,
  supabase
} from '../services/supabaseClient';
import { faceEmbeddingCache } from '../services/faceEmbeddingCache';
import { useOrganization } from '../contexts/OrganizationContext';

// 🎛️ CONFIGURATION
const MIRROR_CAMERA = true; // Set to false to disable camera mirroring
const USE_FACE_API = false; // Set to true to use face-api.js instead of TensorFlow.js
const USE_IMPROVED_TENSORFLOW = true; // Set to true to use improved TensorFlow face detection
const SKIP_QUALITY_CHECK = false; // Set to true to skip face quality validation (for testing)
const SKIP_CAPTURE_VALIDATION = false; // Set to true to skip captured face validation (for testing)

// Mobile-optimized styles
const styles = `
  .camera-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    padding: 16px;
    gap: 12px;
    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  }

  .camera-wrapper {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
  }

  .status-info {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    font-size: 14px;
    color: #1f2937;
  }

  .camera-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 255, 255, 0.98);
    backdrop-filter: blur(20px);
    color: #1f2937;
    padding: 24px;
    border-radius: 16px;
    text-align: center;
    z-index: 100;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .distance-indicator {
    position: absolute;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 50;
  }

  .distance-indicator.too-far {
    background: rgba(239, 68, 68, 0.9);
  }

  .distance-indicator.too-close {
    background: rgba(245, 158, 11, 0.9);
  }

  .distance-indicator.perfect {
    background: rgba(16, 185, 129, 0.9);
  }

  .status-allowed {
    color: #10b981;
  }

  .status-banned {
    color: #ef4444;
  }

  .status-vip {
    color: #8b5cf6;
  }

  @media (min-width: 768px) {
    .camera-container {
      flex-direction: column;
      padding: 40px;
      align-items: center;
    }

    .status-info {
      max-width: 100%;
      width: 100%;
      max-width: 640px;
    }
  }
`;

const CameraScanner: React.FC = () => {
  const history = useHistory();
  const { organization, user, isLegacyMode, isAuthenticated } = useOrganization();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastMatch, setLastMatch] = useState<{name: string; status: string; confidence: number} | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState<string>('');
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertHeader, setAlertHeader] = useState('');

  // Registration prompt state
  const [showRegistrationPrompt, setShowRegistrationPrompt] = useState(false);
  const [unrecognizedFace, setUnrecognizedFace] = useState<{embedding: number[], imageData?: string} | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberStatus, setNewMemberStatus] = useState<'Allowed' | 'Banned' | 'VIP'>('Allowed');
  const [isRegistering, setIsRegistering] = useState(false);
  const [lastUnrecognizedFace, setLastUnrecognizedFace] = useState<{embedding: number[], imageData?: string} | null>(null);

  // Visual feedback state
  const [statusFlash, setStatusFlash] = useState<'success' | 'warning' | 'danger' | null>(null);
  const [detectedFaces, setDetectedFaces] = useState<any[]>([]);
  const [tensorflowDetections, setTensorflowDetections] = useState<any[]>([]);
  const [faceQuality, setFaceQuality] = useState<{isValid: boolean; reason?: string; score: number} | null>(null);
  const [positioningGuide, setPositioningGuide] = useState<'no-face' | 'too-far' | 'too-close' | 'perfect'>('no-face');
  const [facialFeatures, setFacialFeatures] = useState<{x: number; y: number; type: string}[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessingFace, setIsProcessingFace] = useState(false);

  // Cooldown system to prevent repeated detections
  const [lastDetectionTime, setLastDetectionTime] = useState<number>(0);
  const [recentFaces, setRecentFaces] = useState<Set<string>>(new Set());
  const [lastEmbedding, setLastEmbedding] = useState<number[]>([]);
  const DETECTION_COOLDOWN = 2000; // Reduced to 2 seconds for better responsiveness

  // Face stability tracking for registration
  const [stableHighQualityFrames, setStableHighQualityFrames] = useState<number>(0);
  const [lastHighQualityTime, setLastHighQualityTime] = useState<number>(0);
  const REQUIRED_STABLE_FRAMES = 3; // Must be high quality for 3 consecutive frames
  const STABILITY_TIMEOUT = 1000; // Frames must be within 1 second of each other

  // Best quality face tracking for optimal embedding
  const [bestQualityFace, setBestQualityFace] = useState<{
    embedding: number[],
    qualityScore: number,
    imageData?: string
  } | null>(null);

  // Embedding debug info for UI
  const [embeddingDebug, setEmbeddingDebug] = useState<{
    currentEmbeddingLength: number,
    bestEmbeddingLength: number,
    lastSimilarityScore: number,
    matchedMemberName?: string,
    similarityBreakdown?: any,
    currentValidityPercent: number,
    bestValidityPercent: number
  }>({ currentEmbeddingLength: 0, bestEmbeddingLength: 0, lastSimilarityScore: 0, currentValidityPercent: 0, bestValidityPercent: 0 });

  // Cache refresh
  const [lastCacheRefresh, setLastCacheRefresh] = useState<number>(Date.now());
  const CACHE_REFRESH_INTERVAL = 30000; // 30 seconds

  // Monitor registration prompt state changes (reduced logging)
  useEffect(() => {
    if (showRegistrationPrompt) {
      console.log('🎬 Registration prompt opened');
    }
  }, [showRegistrationPrompt]);

  // Sound effects
  const playSound = (type: 'approved' | 'banned' | 'unregistered' | 'scan') => {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();

      let frequency = 440;
      let duration = 0.3;

      switch (type) {
        case 'approved':
          // Pleasant ascending tone for approved users
          frequency = 523; // C5
          duration = 0.5;
          break;
        case 'banned':
          // Warning low tone for banned users
          frequency = 220; // A3
          duration = 0.8;
          break;
        case 'unregistered':
          // Neutral questioning tone for unregistered
          frequency = 349; // F4
          duration = 0.4;
          break;
        case 'scan':
          // Subtle scan beep
          frequency = 800;
          duration = 0.1;
          break;
      }

      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);

      oscillator.frequency.setValueAtTime(frequency, context.currentTime);
      oscillator.type = type === 'banned' ? 'sawtooth' : 'sine';

      // Volume envelope
      gainNode.gain.setValueAtTime(0, context.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, context.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);

      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + duration);
    } catch (error) {
      console.warn('Sound playback failed:', error);
    }
  };

  // Set organization context for database operations and initialize scanner
  useEffect(() => {
    const initializeWithContext = async () => {
      if (!isLegacyMode && organization) {
        console.log('🏢 Setting organization context for:', organization.name, 'ID:', organization.id);
        setOrganizationContext(organization.id);
      } else if (isLegacyMode) {
        console.log('🔧 Using legacy mode - clearing organization context');
        clearOrganizationContext();
      }

      // Only initialize scanner after context is set
      if (isLegacyMode || organization) {
        console.log('🚀 Starting scanner initialization...');
        await initializeAndStartScanning();
      }
    };

    initializeWithContext();

    return () => {
      stopScanning();
    };
  }, [organization, isLegacyMode]); // Depend on organization and legacyMode

  // Periodic cache refresh
  useEffect(() => {
    const interval = setInterval(async () => {
      console.log('⏰ Periodic cache refresh triggered');
      await refreshMembersCache();
    }, CACHE_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const initializeAndStartScanning = async () => {
    // Prevent duplicate initialization
    if (isInitialized) {
      console.log('Already initialized, skipping...');
      return;
    }

    try {
      if (USE_FACE_API) {
        console.log('🤖 Initializing face-api.js service...');
        await faceApiService.initialize();
        console.log('✅ face-api.js service initialized successfully');
      } else if (USE_IMPROVED_TENSORFLOW) {
        console.log('🤖 Initializing improved TensorFlow.js face detection...');
        await tensorflowFaceDetection.initialize();
        console.log('✅ Improved TensorFlow.js face detection initialized successfully');
      } else {
        console.log('🤖 Initializing legacy TensorFlow.js face recognition service...');
        await faceRecognitionService.initialize();
        console.log('✅ Legacy TensorFlow.js face recognition service initialized successfully');
      }

      console.log('💾 Loading and caching face embeddings (no direct member calls)...');
      await loadFaceEmbeddingsToCache();

      // Check if no members exist after loading cache
      if (members.length === 0) {
        console.log('No members found - this is why registration might not trigger');
        console.log('Face detection will work but will always show registration prompt');
      }

      // Set initialized state BEFORE starting scanning
      console.log('Initialization complete, starting camera...');

      // Set initialized state FIRST
      setIsInitialized(true);

      // Start camera immediately without waiting for state update
      await startCamera();

      // Start the continuous scanning loop
      console.log('Starting continuous face detection loop...');
      startContinuousScanning();

    } catch (error) {
      const errorMessage = `Failed to initialize face recognition: ${error.message}`;
      setError(errorMessage);
      console.error('Initialization error:', error);

      // Show specific help based on error type
      if (error.message.includes('network') || error.message.includes('fetch')) {
        console.log('💡 SOLUTION: Check your internet connection - TensorFlow.js needs to download models');
      } else if (error.message.includes('WebGL')) {
        console.log('💡 SOLUTION: Try a different browser (Chrome/Edge) or enable hardware acceleration');
      } else {
        console.log('💡 SOLUTION: Try refreshing the page or using a different browser');
      }
    }
  };

  const startCamera = async () => {
    try {
      console.log('Requesting camera access with ULTRA-OPTIMIZED mobile settings...');

      // Advanced device detection for optimal camera settings
      const userAgent = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isTablet = /iPad|Android.*tablet|tablet/i.test(userAgent);
      const isPhone = isMobile && !isTablet;
      const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
      const isAndroid = /Android/i.test(userAgent);

      // Device-specific optimal settings for best face recognition
      let videoConstraints;

      if (isPhone) {
        // Phone: Portrait orientation, close-up usage
        videoConstraints = {
          facingMode: 'user',
          width: { ideal: isIOS ? 960 : 720, max: 1280, min: 480 },
          height: { ideal: isIOS ? 1280 : 1280, max: 1920, min: 640 },
          frameRate: { ideal: 30, min: 15, max: 60 },
          aspectRatio: { ideal: 0.75 }, // 3:4 ratio for phones
          focusMode: 'continuous',
          exposureMode: 'continuous',
          whiteBalanceMode: 'continuous'
        };
      } else if (isTablet) {
        // Tablet: Landscape/portrait, arm's length usage
        videoConstraints = {
          facingMode: 'user',
          width: { ideal: 1024, max: 1920, min: 640 },
          height: { ideal: 768, max: 1080, min: 480 },
          frameRate: { ideal: 30, min: 20, max: 60 },
          aspectRatio: { ideal: 1.33 }, // 4:3 ratio for tablets
          focusMode: 'continuous',
          exposureMode: 'continuous'
        };
      } else {
        // Desktop/Laptop: Standard webcam distance
        videoConstraints = {
          facingMode: 'user',
          width: { ideal: 640, max: 1280, min: 320 },
          height: { ideal: 480, max: 720, min: 240 },
          frameRate: { ideal: 30, min: 15, max: 60 },
          aspectRatio: { ideal: 1.33 }, // 4:3 ratio for webcams
          focusMode: 'continuous'
        };
      }

      const deviceType = isPhone ? 'Phone' : isTablet ? 'Tablet' : 'Desktop';
      const platform = isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop';

      console.log(`📱 Optimizing for: ${deviceType} (${platform})`, videoConstraints);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('Camera stream attached to video element');

        // Wait for video to load and start playing
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded:', {
            videoWidth: videoRef.current?.videoWidth,
            videoHeight: videoRef.current?.videoHeight
          });
        };

        await videoRef.current.play();
        console.log('Video is playing');
        setIsScanning(true); // Set scanning state when video is ready
      }
    } catch (error) {
      setError('Failed to access camera');
      setIsScanning(false);
      console.error('Camera error:', error);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const stopScanning = () => {
    setIsScanning(false);
    setDetectedFaces([]);
    stopCamera();
  };

  const triggerStatusFlash = (type: 'success' | 'warning' | 'danger') => {
    setStatusFlash(type);
    setTimeout(() => setStatusFlash(null), 1000);
  };

  // Load all face embeddings once and cache them
  const loadFaceEmbeddingsToCache = async () => {
    try {
      if (!organization?.id && !isLegacyMode) {
        console.warn('⚠️ No organization ID available for loading embeddings');
        return;
      }

      const orgId = isLegacyMode ? 'legacy' : organization!.id;
      console.log('💾 Loading face embeddings to cache for:', orgId);

      // Load from Supabase and cache in localStorage
      if (USE_IMPROVED_TENSORFLOW) {
        await tensorflowFaceDetection._loadCachedEmbeddings(orgId);
      } else if (USE_FACE_API) {
        await faceApiService.loadMembersFromCache(orgId);
      } else {
        await faceRecognitionService.loadMembersFromCache(orgId);
      }

      // Get member data from cache for UI (avoid Supabase call)
      const cachedEmbeddings = faceEmbeddingCache.getCachedEmbeddings(orgId) || [];

      // Convert cached embeddings to Member format for UI
      const membersData = cachedEmbeddings.map(cached => ({
        id: cached.id,
        name: cached.name,
        status: cached.status,
        organization_id: cached.organization_id,
        face_embedding: cached.embedding,
        created_at: '',
        updated_at: cached.updated_at
      }));

      setMembers(membersData);
      setLastCacheRefresh(Date.now());

      console.log('✅ Face embeddings loaded and cached successfully');
    } catch (error) {
      console.error('❌ Failed to load face embeddings:', error);
    }
  };

  // Only refresh cache when explicitly needed (new member added)
  const refreshCacheAfterNewMember = async () => {
    console.log('🔄 Refreshing cache after new member addition...');
    await loadFaceEmbeddingsToCache();
  };

  // Refresh members cache and return updated count
  const refreshMembersCache = async () => {
    try {
      console.log('🔄 Refreshing members cache...');
      await loadFaceEmbeddingsToCache();

      // Return updated members for count verification
      const orgId = isLegacyMode ? 'legacy' : organization?.id;
      if (orgId) {
        const cachedEmbeddings = faceEmbeddingCache.getCachedEmbeddings(orgId) || [];
        const updatedMembers = cachedEmbeddings.map(cached => ({
          id: cached.id,
          name: cached.name,
          status: cached.status,
          organization_id: cached.organization_id,
          face_embedding: cached.embedding,
          created_at: '',
          updated_at: cached.updated_at
        }));
        setMembers(updatedMembers);
        console.log('✅ Members cache refreshed, new count:', updatedMembers.length);
        return updatedMembers;
      }
      return [];
    } catch (error) {
      console.error('❌ Failed to refresh members cache:', error);
      return [];
    }
  };

  // 💾 DIRECT DATABASE QUERY for 100% quality faces (no abuse risk)
  const queryDatabaseDirectly = async (embedding: number[], orgId: string): Promise<any> => {
    try {
      console.log('💾 DIRECT DATABASE QUERY for perfect quality face...');

      // Query all members with face embeddings for this organization
      const { data: members, error } = await supabase
        .from('members')
        .select('id, name, face_embedding, status, organization_id')
        .eq('organization_id', orgId)
        .not('face_embedding', 'is', null);

      if (error) {
        console.error('Database query error:', error);
        throw error;
      }

      if (!members || members.length === 0) {
        console.log('💾 No members found in database for organization:', orgId);
        return null;
      }

      console.log(`💾 Comparing against ${members.length} members in database...`);

      // Calculate similarity with each member
      let bestMatch = null;
      let bestSimilarity = 0;
      const SIMILARITY_THRESHOLD = 0.85; // Stricter threshold for better accuracy (was 0.75)

      for (const member of members) {
        const memberEmbedding = member.face_embedding;
        if (!memberEmbedding || !Array.isArray(memberEmbedding)) {
          continue;
        }

        // Use the same similarity calculation as the TensorFlow service
        // 🔥 ENHANCED: Multi-metric similarity validation
        const similarityMetrics = calculateAdvancedSimilarity(embedding, memberEmbedding);

        console.log(`🔍 Advanced similarity with ${member.name}:`, {
          cosine: similarityMetrics.cosine.toFixed(3),
          euclidean: similarityMetrics.euclidean.toFixed(3),
          pearson: similarityMetrics.pearson.toFixed(3),
          combined: similarityMetrics.combinedScore.toFixed(3),
          isValidMatch: similarityMetrics.isValidMatch
        });

        // Use combined score and validation
        if (similarityMetrics.combinedScore > bestSimilarity &&
            similarityMetrics.combinedScore >= SIMILARITY_THRESHOLD &&
            similarityMetrics.isValidMatch) {
          bestMatch = {
            id: member.id,
            name: member.name,
            status: member.status,
            confidence: similarityMetrics.combinedScore
          };
          bestSimilarity = similarityMetrics.combinedScore;
        }
      }

      if (bestMatch) {
        console.log(`✅ DIRECT DB MATCH: ${bestMatch.name} (${(bestMatch.confidence * 100).toFixed(1)}%)`);
        return bestMatch;
      } else {
        console.log(`❌ DIRECT DB: No match above threshold (${SIMILARITY_THRESHOLD})`);
        return null;
      }

    } catch (error) {
      console.error('❌ Direct database query failed:', error);
      throw error;
    }
  };

  // 🔥 ADVANCED: Multi-metric similarity with pose validation
  const calculateAdvancedSimilarity = (embedding1: number[], embedding2: number[]): {
    cosine: number;
    euclidean: number;
    pearson: number;
    combinedScore: number;
    isValidMatch: boolean;
  } => {
    if (embedding1.length !== embedding2.length || embedding1.length === 0) {
      return { cosine: 0, euclidean: 0, pearson: 0, combinedScore: 0, isValidMatch: false };
    }

    // 1. COSINE SIMILARITY (traditional)
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    const cosine = (norm1 === 0 || norm2 === 0) ? 0 : dotProduct / (norm1 * norm2);

    // 2. EUCLIDEAN SIMILARITY (distance-based, sensitive to pose changes)
    let euclideanDistance = 0;
    for (let i = 0; i < embedding1.length; i++) {
      const diff = embedding1[i] - embedding2[i];
      euclideanDistance += diff * diff;
    }
    euclideanDistance = Math.sqrt(euclideanDistance);
    const euclidean = 1 / (1 + euclideanDistance); // Convert distance to similarity

    // 3. PEARSON CORRELATION (detects linear relationships, good for pose variations)
    const mean1 = embedding1.reduce((a, b) => a + b, 0) / embedding1.length;
    const mean2 = embedding2.reduce((a, b) => a + b, 0) / embedding2.length;

    let numerator = 0;
    let denom1 = 0;
    let denom2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      const diff1 = embedding1[i] - mean1;
      const diff2 = embedding2[i] - mean2;
      numerator += diff1 * diff2;
      denom1 += diff1 * diff1;
      denom2 += diff2 * diff2;
    }

    const pearson = (denom1 === 0 || denom2 === 0) ? 0 : numerator / Math.sqrt(denom1 * denom2);

    // 4. POSE/ORIENTATION VALIDATION
    const poseValidation = validateFacialPose(embedding1, embedding2);

    // 5. COMBINED SCORING with strict validation
    const metrics = [cosine, euclidean, Math.abs(pearson)]; // Use absolute pearson
    const weights = [0.5, 0.3, 0.2]; // Prioritize cosine, then euclidean, then pearson

    let combinedScore = 0;
    for (let i = 0; i < metrics.length; i++) {
      combinedScore += metrics[i] * weights[i];
    }

    // 6. STRICT VALIDATION RULES
    const isValidMatch =
      cosine >= 0.80 &&           // Cosine must be high (was allowing too low)
      euclidean >= 0.40 &&        // Euclidean distance must be reasonable
      Math.abs(pearson) >= 0.30 && // Must have some correlation
      poseValidation.isConsistent && // Pose must be consistent
      poseValidation.orientationScore >= 0.7; // Orientation must be similar

    // Apply penalty if validation fails
    if (!isValidMatch) {
      combinedScore *= 0.5; // Heavily penalize invalid matches
    }

    return {
      cosine,
      euclidean,
      pearson,
      combinedScore,
      isValidMatch
    };
  };

  // Validate facial pose consistency between embeddings
  const validateFacialPose = (embedding1: number[], embedding2: number[]): {
    isConsistent: boolean;
    orientationScore: number;
    poseVariation: number;
  } => {
    try {
      // Analyze embedding patterns to detect pose differences
      // Focus on first portions which often contain pose-sensitive features

      const poseSegment1 = embedding1.slice(0, Math.min(20, embedding1.length));
      const poseSegment2 = embedding2.slice(0, Math.min(20, embedding2.length));

      // Calculate variation in pose-sensitive features
      let totalVariation = 0;
      for (let i = 0; i < poseSegment1.length; i++) {
        const variation = Math.abs(poseSegment1[i] - poseSegment2[i]);
        totalVariation += variation;
      }

      const poseVariation = totalVariation / poseSegment1.length;

      // Calculate orientation consistency
      const orientationScore = 1 / (1 + poseVariation * 5); // Convert variation to score

      // Pose is consistent if variation is low
      const isConsistent = poseVariation < 0.3 && orientationScore > 0.6;

      return {
        isConsistent,
        orientationScore,
        poseVariation
      };

    } catch (error) {
      console.error('Pose validation error:', error);
      return { isConsistent: false, orientationScore: 0, poseVariation: 1.0 };
    }
  };

  // Cosine similarity calculation (matching TensorFlow service)
  const calculateCosineSimilarity = (embedding1: number[], embedding2: number[]): number => {
    if (embedding1.length !== embedding2.length || embedding1.length === 0) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude1 = Math.sqrt(norm1);
    const magnitude2 = Math.sqrt(norm2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  };

  // Generate embedding from captured image data (base64) for consistency
  const generateEmbeddingFromCapturedImage = async (imageDataUrl: string): Promise<number[]> => {
    try {
      console.log('🧠 Converting captured image to embedding...');

      // Create image element from base64 data
      const img = new Image();
      img.crossOrigin = 'anonymous';

      // Wait for image to load
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load captured image'));
        img.src = imageDataUrl;
      });

      console.log('🖼️ Image loaded:', `${img.width}x${img.height}`);

      // Use TensorFlow face detection on the captured image
      if (USE_IMPROVED_TENSORFLOW && tensorflowFaceDetection) {
        console.log('🔍 Using TensorFlow to detect face in captured image...');

        const faces = await tensorflowFaceDetection.detectFaces(img);
        if (faces.length > 0 && faces[0].embedding) {
          console.log('✅ TensorFlow embedding from captured image:', faces[0].embedding.length, 'dimensions');
          return faces[0].embedding;
        } else {
          throw new Error('No face or embedding found in captured image using TensorFlow');
        }
      }

      // Fallback to legacy face recognition service
      else if (faceRecognitionService) {
        console.log('🔍 Using legacy face recognition on captured image...');

        const faces = await faceRecognitionService.detectFaces(img);
        if (faces.length > 0) {
          const embedding = faceRecognitionService.generateEmbedding(faces[0]);
          if (embedding && embedding.length > 0) {
            console.log('✅ Legacy embedding from captured image:', embedding.length, 'dimensions');
            return embedding;
          }
        }
        throw new Error('No face found in captured image using legacy detection');
      }

      else {
        throw new Error('No face detection service available');
      }

    } catch (error) {
      console.error('❌ Failed to generate embedding from captured image:', error);
      throw error;
    }
  };

  // 🎆 PERFECT QUALITY FACE PROCESSING
  const processPerfectQualityFace = async (face: any, qualityScore: number) => {
    try {
      console.log('🎆 Processing perfect quality face (100%)...');

      const videoElement = videoRef.current;
      if (!videoElement) {
        console.error('Video element not available');
        setIsProcessingFace(false);
        setTimeout(() => scanForFaces(), 500);
        return;
      }

      // 📸 IMMEDIATE CAPTURE: Capture clean image at 100% quality
      console.log('📸 CAPTURING image at 100% quality...');

      let cleanImageData = null;
      try {
        // Method 1: Try direct video frame capture first
        cleanImageData = captureVideoFrame(videoElement, face);
        console.log('📸 Direct video capture:', !!cleanImageData ? 'SUCCESS' : 'FAILED');

        // Method 2: Fallback to face cropping service if direct capture fails
        if (!cleanImageData) {
          console.log('📸 Trying face recognition service crop...');
          if (USE_IMPROVED_TENSORFLOW && face.box) {
            const compatibleFace = {
              box: {
                xMin: face.box.xMin,
                yMin: face.box.yMin,
                width: face.box.width,
                height: face.box.height
              }
            };
            cleanImageData = faceRecognitionService.cropFaceFromVideo(videoElement, compatibleFace as any);
          } else {
            cleanImageData = faceRecognitionService.cropFaceFromVideo(videoElement, face);
          }
          console.log('📸 Service crop capture:', !!cleanImageData ? 'SUCCESS' : 'FAILED');
        }

        if (cleanImageData) {
          console.log('📸 Final image captured successfully:', `${Math.round(cleanImageData.length / 1024)}KB`);
        } else {
          console.error('📸 All image capture methods failed!');
        }
      } catch (error) {
        console.error('📸 Image capture error:', error);
        cleanImageData = null;
      }

      // 🧠 CRITICAL: Generate embedding from the CAPTURED IMAGE, not live video
      let embedding;

      if (cleanImageData) {
        console.log('📸 Generating embedding from CAPTURED IMAGE for consistency...');

        try {
          // Generate embedding from the captured image
          embedding = await generateEmbeddingFromCapturedImage(cleanImageData);
          console.log('🧠 Successfully generated embedding from captured image:', embedding.length, 'dimensions');
        } catch (error) {
          console.error('❌ Failed to generate embedding from captured image:', error);

          // Fallback to live face detection embedding
          console.log('🔄 Falling back to live face detection embedding...');
          if (USE_IMPROVED_TENSORFLOW && face.embedding) {
            embedding = face.embedding;
            console.log('🧠 Using TensorFlow fallback embedding:', embedding.length, 'dimensions');
          } else if (USE_FACE_API) {
            embedding = face.descriptor ? Array.from(face.descriptor) : [];
            console.log('🧠 Using FaceAPI fallback embedding:', embedding.length, 'dimensions');
          } else {
            embedding = faceRecognitionService.generateEmbedding(face);
            console.log('🧠 Using legacy fallback embedding:', embedding.length, 'dimensions');
          }
        }
      } else {
        console.warn('⚠️ No captured image - using live face detection embedding');

        // No captured image, use live detection
        if (USE_IMPROVED_TENSORFLOW && face.embedding) {
          embedding = face.embedding;
          console.log('🧠 Using TensorFlow live embedding:', embedding.length, 'dimensions');
        } else if (USE_FACE_API) {
          embedding = face.descriptor ? Array.from(face.descriptor) : [];
          console.log('🧠 Using FaceAPI live embedding:', embedding.length, 'dimensions');
        } else {
          embedding = faceRecognitionService.generateEmbedding(face);
          console.log('🧠 Using legacy live embedding:', embedding.length, 'dimensions');
        }
      }

      // ✅ CONSISTENCY: The embedding is now calculated from the CAPTURED IMAGE
      // This ensures perfect consistency between registration and recognition
      console.log('🧠 Perfect quality embedding generated:', {
        embeddingLength: embedding.length,
        hasImageData: !!cleanImageData,
        qualityScore: qualityScore,
        source: cleanImageData ? 'CAPTURED_IMAGE' : 'LIVE_DETECTION',
        imageSize: cleanImageData ? `${Math.round(cleanImageData.length / 1024)}KB` : 'N/A'
      });

      // Update debug info
      setEmbeddingDebug(prev => ({
        ...prev,
        currentEmbeddingLength: embedding.length,
        currentValidityPercent: qualityScore * 100
      }));

      // Update best quality face
      setBestQualityFace({
        embedding: embedding,
        qualityScore: qualityScore,
        imageData: cleanImageData || undefined
      });

      if (embedding.length > 0) {
        // 🔍 Query database for match
        const orgId = isLegacyMode ? 'legacy' : organization?.id;
        let match = null;

        if (orgId) {
          console.log('💾 PERFECT QUALITY - Using DIRECT database query (no cache)...');

          // Use direct database query for 100% quality faces
          match = await queryDatabaseDirectly(embedding, orgId);

          console.log('💾 Perfect Quality Direct DB Result:', match);

          // Update debug info with match results
          setEmbeddingDebug(prev => ({
            ...prev,
            lastSimilarityScore: match ? match.confidence : 0,
            matchedMemberName: match ? match.name : undefined,
            similarityBreakdown: match ? {
              cosine: match.confidence.toFixed(3),
              euclidean: 'direct_db',
              pearson: 'direct_db',
              combined: match.confidence.toFixed(3)
            } : null
          }));
        }

        if (match) {
          // ✅ MATCH FOUND - Display result and play feedback
          console.log('✅ PERFECT QUALITY MATCH FOUND:', match.name, '- Status:', match.status);
          setLastMatch(match);

          // 🎨 Visual and Audio Feedback based on status
          if (match.status === 'Allowed') {
            console.log('🟢 ALLOWED MEMBER - Green flash + approval sound');
            triggerStatusFlash('success');
            playSound('approved');
          } else if (match.status === 'VIP') {
            console.log('🟣 VIP MEMBER - Green flash + approval sound');
            triggerStatusFlash('success');
            playSound('approved');
          } else if (match.status === 'Banned') {
            console.log('🔴 BANNED MEMBER - Red flash + banned sound');
            triggerStatusFlash('danger');
            playSound('banned');
          }

          // 📋 Log attendance
          try {
            await addAttendanceLog(match.id, match.confidence);
            console.log('✅ Attendance logged for perfect quality match');
          } catch (error) {
            console.error('Attendance logging error:', error);
          }

          // Resume scanning after showing result
          setTimeout(() => {
            setIsProcessingFace(false);
            scanForFaces();
          }, 2000);

        } else {
          // ❌ NO MATCH - Prompt registration with perfect quality face
          console.log('❌ PERFECT QUALITY - NO MATCH FOUND - Prompting registration');

          // 🚨 CRITICAL: Ensure we have captured image for registration
          if (!cleanImageData) {
            console.error('❌ No image captured for 100% quality face - this should not happen!');

            // Emergency capture attempt
            try {
              cleanImageData = captureVideoFrame(videoElement, face);
              console.log('🚨 Emergency capture result:', !!cleanImageData ? 'SUCCESS' : 'FAILED');
            } catch (error) {
              console.error('🚨 Emergency capture failed:', error);
            }
          }

          const perfectFaceData = {
            embedding: embedding,
            qualityScore: qualityScore,
            imageData: cleanImageData || undefined // Use captured image or undefined
          };

          console.log('🎬 Setting registration data:', {
            hasEmbedding: !!perfectFaceData.embedding,
            embeddingLength: perfectFaceData.embedding?.length,
            hasImageData: !!perfectFaceData.imageData,
            imageSize: perfectFaceData.imageData ? `${Math.round(perfectFaceData.imageData.length / 1024)}KB` : 'None',
            qualityScore: perfectFaceData.qualityScore
          });

          setUnrecognizedFace(perfectFaceData);
          setLastUnrecognizedFace(perfectFaceData);
          setShowRegistrationPrompt(true);

          // Trigger warning flash and sound
          triggerStatusFlash('warning');
          playSound('unregistered');

          console.log('🎬 Perfect quality registration prompt triggered with captured image');
          // Scanning remains paused until registration is handled
        }
      } else {
        console.error('❌ Failed to generate embedding for perfect quality face');
        setIsProcessingFace(false);
        setTimeout(() => scanForFaces(), 500);
      }

    } catch (error) {
      console.error('❌ Error processing perfect quality face:', error);
      setIsProcessingFace(false);
      setTimeout(() => scanForFaces(), 500);
    }
  };

  // Extract facial features for visual tracking
  const extractFacialFeatures = (face: any, videoElement: HTMLVideoElement) => {
    if (!face.keypoints || !videoElement) return [];

    const videoRect = videoElement.getBoundingClientRect();
    const scaleX = videoRect.width / videoElement.videoWidth;
    const scaleY = videoRect.height / videoElement.videoHeight;

    const features: {x: number; y: number; type: string}[] = [];

    // MediaPipe Face Detector keypoints mapping (approximate)
    face.keypoints.forEach((keypoint: any, index: number) => {
      let x = keypoint.x * scaleX;
      const y = keypoint.y * scaleY;

      // Flip X coordinate if camera is mirrored
      if (MIRROR_CAMERA) {
        x = videoRect.width - x;
      }

      // Classify keypoints based on typical MediaPipe indices
      let type = 'face-outline';
      if (index < 6) {
        // First few keypoints are usually around eyes
        type = 'eye';
      } else if (index >= 6 && index < 10) {
        // Middle keypoints often include nose area
        type = 'nose';
      } else if (index >= 10) {
        // Later keypoints often include mouth area
        type = 'mouth';
      }

      features.push({ x, y, type });
    });

    return features;
  };

  // Mobile-first positioning guidance optimized for phones and tablets
  const getPositioningGuidance = (faces: any[], videoElement: HTMLVideoElement) => {
    if (faces.length === 0) {
      return 'no-face';
    }

    const face = faces[0];
    const { box } = face;

    if (!box) return 'no-face';

    // Detect device type for optimal ranges
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTablet = /iPad|Android.*tablet|tablet/i.test(navigator.userAgent);
    const isPhone = isMobile && !isTablet;

    const faceArea = box.width * box.height;
    const videoArea = videoElement.videoWidth * videoElement.videoHeight;
    const faceRatio = faceArea / videoArea;

    // Device-specific optimal ranges
    let tooFarThreshold, tooCloseThreshold;

    if (isPhone) {
      // Phones: Users hold closer, smaller screen
      tooFarThreshold = 0.06;  // Increased for phones
      tooCloseThreshold = 0.50; // Higher tolerance for close faces
    } else if (isTablet) {
      // Tablets: Users hold at arm's length, larger screen
      tooFarThreshold = 0.04;
      tooCloseThreshold = 0.35;
    } else {
      // Desktop/Laptop: Standard webcam distance
      tooFarThreshold = 0.03;
      tooCloseThreshold = 0.25;
    }

    console.log(`📱 Device: ${isPhone ? 'Phone' : isTablet ? 'Tablet' : 'Desktop'}, Face ratio: ${faceRatio.toFixed(3)}, Thresholds: ${tooFarThreshold}-${tooCloseThreshold}`);

    if (faceRatio < tooFarThreshold) {
      return 'too-far';
    } else if (faceRatio > tooCloseThreshold) {
      return 'too-close';
    } else {
      return 'perfect';
    }
  };

  // Direct video frame capture for 100% quality faces
  const captureVideoFrame = (videoElement: HTMLVideoElement, face: any): string | null => {
    try {
      console.log('📸 Starting direct video frame capture...');

      // Create a temporary canvas for capture
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('📸 Could not get canvas context');
        return null;
      }

      // Get video dimensions
      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;

      if (videoWidth === 0 || videoHeight === 0) {
        console.error('📸 Invalid video dimensions:', { videoWidth, videoHeight });
        return null;
      }

      // Extract face bounding box
      let faceBox;
      if (face.box) {
        // TensorFlow format
        faceBox = {
          x: face.box.xMin || face.box.x || 0,
          y: face.box.yMin || face.box.y || 0,
          width: face.box.width || 0,
          height: face.box.height || 0
        };
      } else {
        console.error('📸 No face box available');
        return null;
      }

      // Add padding around face (30%)
      const padding = 0.3;
      const paddingX = faceBox.width * padding;
      const paddingY = faceBox.height * padding;

      const cropX = Math.max(0, faceBox.x - paddingX);
      const cropY = Math.max(0, faceBox.y - paddingY);
      const cropWidth = Math.min(videoWidth - cropX, faceBox.width + (paddingX * 2));
      const cropHeight = Math.min(videoHeight - cropY, faceBox.height + (paddingY * 2));

      // Validate crop dimensions
      if (cropWidth <= 0 || cropHeight <= 0) {
        console.error('📸 Invalid crop dimensions:', { cropWidth, cropHeight });
        return null;
      }

      // Set canvas size to the crop area
      canvas.width = cropWidth;
      canvas.height = cropHeight;

      console.log('📸 Capture parameters:', {
        video: { width: videoWidth, height: videoHeight },
        face: faceBox,
        crop: { x: cropX, y: cropY, width: cropWidth, height: cropHeight }
      });

      // Draw the cropped video frame to canvas
      ctx.drawImage(
        videoElement,
        cropX, cropY, cropWidth, cropHeight,  // Source coordinates
        0, 0, cropWidth, cropHeight           // Destination coordinates
      );

      // Convert to base64 with high quality
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);

      console.log('📸 Direct capture successful:', {
        canvasSize: `${cropWidth}x${cropHeight}`,
        dataSize: `${Math.round(imageDataUrl.length / 1024)}KB`
      });

      return imageDataUrl;

    } catch (error) {
      console.error('📸 Direct video capture failed:', error);
      return null;
    }
  };

  // Validate that detected "face" is actually a face and not a hand/body part
  const validateDetectedFace = async (face: any, videoElement: HTMLVideoElement): Promise<boolean> => {
    try {
      // 1. Basic geometric validation - faces have certain proportions
      const { box } = face;
      if (!box) return false;

      const aspectRatio = box.width / box.height;
      // Faces are typically between 0.7:1 to 1.3:1 ratio (slightly taller than wide to slightly wider than tall)
      if (aspectRatio < 0.6 || aspectRatio > 1.5) {
        console.log('❌ Face validation failed: Bad aspect ratio', aspectRatio.toFixed(2));
        return false;
      }

      // 2. Size validation - hands are usually much smaller or larger than faces at typical distances
      const faceArea = box.width * box.height;
      const videoArea = videoElement.videoWidth * videoElement.videoHeight;
      const faceRatio = faceArea / videoArea;

      // Face should be between 1% and 70% of video area (hands are usually much smaller when at face distance)
      if (faceRatio < 0.01 || faceRatio > 0.7) {
        console.log('❌ Face validation failed: Size out of range', faceRatio.toFixed(3));
        return false;
      }

      // 3. CRITICAL: Facial keypoint pattern validation
      if (face.keypoints && face.keypoints.length > 0) {
        const keypoints = face.keypoints;

        console.log('🔍 DEBUG: Keypoint analysis:', {
          totalKeypoints: keypoints.length,
          keypointSample: keypoints.slice(0, 5).map((kp, i) => ({
            index: i,
            x: kp.x,
            y: kp.y,
            name: kp.name || 'unknown'
          }))
        });

        // MediaPipe Face Detector provides specific facial landmarks
        // We need to validate these are in facial feature patterns, not hand patterns
        if (!validateFacialFeaturePattern(keypoints, box)) {
          console.log('❌ Face validation failed: Keypoints do not match facial feature pattern');
          return false;
        }

        // Check for reasonable keypoint distribution
        const keyPointSpread = calculateKeypointSpread(keypoints, box);
        if (keyPointSpread < 0.3) { // Keypoints should spread across at least 30% of face area
          console.log('❌ Face validation failed: Poor keypoint distribution', keyPointSpread.toFixed(3));
          return false;
        }

        // 4. Enhanced MediaPipe validation - check keypoint patterns
        if (keypoints.length < 6) { // MediaPipe typically returns many keypoints for faces
          console.log('❌ Face validation failed: Too few keypoints', keypoints.length);
          return false;
        }
      } else {
        // If no keypoints at all, this is likely not a face
        console.log('❌ Face validation failed: No keypoints detected');
        return false;
      }

      // 5. Position validation - faces are usually in upper 2/3 of frame
      const centerY = box.yMin + (box.height / 2);
      const relativeCenterY = centerY / videoElement.videoHeight;

      // Allow faces in upper 80% of frame (hands could be lower when gesturing)
      if (relativeCenterY > 0.8) {
        console.log('❌ Face validation failed: Too low in frame', relativeCenterY.toFixed(3));
        return false;
      }

      console.log('✅ Face validation passed:', {
        aspectRatio: aspectRatio.toFixed(2),
        faceRatio: faceRatio.toFixed(3),
        keypoints: face.keypoints?.length || 0,
        position: relativeCenterY.toFixed(3)
      });

      return true;
    } catch (error) {
      console.error('Face validation error:', error);
      return false; // Fail safely
    }
  };

  // Validate that keypoints follow facial feature patterns (eyes, nose, mouth)
  const validateFacialFeaturePattern = (keypoints: any[], box: any): boolean => {
    try {
      if (keypoints.length < 6) return false;

      // MediaPipe Face Detection returns facial landmarks in a specific order
      // We need to check if these keypoints are arranged like facial features

      // Group keypoints by their relative positions within the face
      const faceWidth = box.width;
      const faceHeight = box.height;
      const faceLeft = box.xMin || box.x || 0;
      const faceTop = box.yMin || box.y || 0;

      // Convert keypoints to relative positions within the face
      const relativeKeypoints = keypoints.map(kp => ({
        x: (kp.x - faceLeft) / faceWidth,  // 0 = left edge, 1 = right edge
        y: (kp.y - faceTop) / faceHeight,  // 0 = top edge, 1 = bottom edge
        absoluteX: kp.x,
        absoluteY: kp.y
      }));

      // FACIAL FEATURE VALIDATION RULES:

      // 1. Eye region validation (top 1/3 of face)
      const eyeRegionKeypoints = relativeKeypoints.filter(kp =>
        kp.y >= 0.15 && kp.y <= 0.5 && kp.x >= 0.1 && kp.x <= 0.9
      );

      if (eyeRegionKeypoints.length < 2) {
        console.log('❌ Facial pattern failed: No eye region keypoints detected');
        return false;
      }

      // 2. Check for bilateral symmetry (left and right features)
      const leftSideKeypoints = relativeKeypoints.filter(kp => kp.x < 0.45);
      const rightSideKeypoints = relativeKeypoints.filter(kp => kp.x > 0.55);

      if (leftSideKeypoints.length === 0 || rightSideKeypoints.length === 0) {
        console.log('❌ Facial pattern failed: No bilateral symmetry (missing left or right features)');
        return false;
      }

      // 3. Vertical facial structure (features should be distributed vertically)
      const upperRegion = relativeKeypoints.filter(kp => kp.y <= 0.4); // Eyes/forehead
      const middleRegion = relativeKeypoints.filter(kp => kp.y > 0.4 && kp.y <= 0.7); // Nose
      const lowerRegion = relativeKeypoints.filter(kp => kp.y > 0.7); // Mouth/chin

      if (upperRegion.length === 0) {
        console.log('❌ Facial pattern failed: No upper facial features (eyes/forehead)');
        return false;
      }

      if (middleRegion.length === 0 && lowerRegion.length === 0) {
        console.log('❌ Facial pattern failed: No middle or lower facial features (nose/mouth)');
        return false;
      }

      // 4. Check keypoint density in center area (faces have features concentrated in center)
      const centerKeypoints = relativeKeypoints.filter(kp =>
        kp.x >= 0.2 && kp.x <= 0.8 && kp.y >= 0.2 && kp.y <= 0.8
      );

      const centerDensity = centerKeypoints.length / keypoints.length;
      if (centerDensity < 0.4) { // At least 40% of keypoints should be in center region
        console.log('❌ Facial pattern failed: Low keypoint density in face center:', centerDensity.toFixed(3));
        return false;
      }

      // 5. Hand rejection: Check for hand-like patterns
      // Hands often have keypoints in a line or clustered differently than faces
      const isHandLikePattern = detectHandPattern(relativeKeypoints);
      if (isHandLikePattern) {
        console.log('❌ Facial pattern failed: Detected hand-like keypoint pattern');
        return false;
      }

      console.log('✅ Facial pattern validation passed:', {
        eyeRegion: eyeRegionKeypoints.length,
        bilateral: { left: leftSideKeypoints.length, right: rightSideKeypoints.length },
        vertical: { upper: upperRegion.length, middle: middleRegion.length, lower: lowerRegion.length },
        centerDensity: centerDensity.toFixed(3)
      });

      return true;

    } catch (error) {
      console.error('Facial pattern validation error:', error);
      return false;
    }
  };

  // Detect hand-like keypoint patterns
  const detectHandPattern = (relativeKeypoints: any[]): boolean => {
    // Hands often have keypoints arranged in linear patterns (fingers)
    // or clustered in a single area, unlike the distributed facial features

    // Check for linear arrangements (fingers)
    const sortedByX = [...relativeKeypoints].sort((a, b) => a.x - b.x);
    const sortedByY = [...relativeKeypoints].sort((a, b) => a.y - b.y);

    // If keypoints are too linearly arranged horizontally or vertically, likely a hand
    let linearHorizontal = 0;
    let linearVertical = 0;

    for (let i = 1; i < sortedByX.length; i++) {
      const deltaX = sortedByX[i].x - sortedByX[i-1].x;
      const deltaY = Math.abs(sortedByX[i].y - sortedByX[i-1].y);
      if (deltaX > 0.05 && deltaY < 0.15) { // Moving horizontally with little vertical change
        linearHorizontal++;
      }
    }

    for (let i = 1; i < sortedByY.length; i++) {
      const deltaY = sortedByY[i].y - sortedByY[i-1].y;
      const deltaX = Math.abs(sortedByY[i].x - sortedByY[i-1].x);
      if (deltaY > 0.05 && deltaX < 0.15) { // Moving vertically with little horizontal change
        linearVertical++;
      }
    }

    const linearityRatio = Math.max(linearHorizontal, linearVertical) / relativeKeypoints.length;
    if (linearityRatio > 0.6) { // If >60% of keypoints follow linear pattern
      console.log('🖐️ Hand pattern detected: Linear arrangement ratio', linearityRatio.toFixed(3));
      return true;
    }

    return false;
  };

  // Helper function to calculate how well keypoints are distributed across the face
  const calculateKeypointSpread = (keypoints: any[], box: any): number => {
    if (keypoints.length < 3) return 0;

    // Find bounding box of keypoints
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const kp of keypoints) {
      minX = Math.min(minX, kp.x);
      maxX = Math.max(maxX, kp.x);
      minY = Math.min(minY, kp.y);
      maxY = Math.max(maxY, kp.y);
    }

    const keypointWidth = maxX - minX;
    const keypointHeight = maxY - minY;
    const keypointArea = keypointWidth * keypointHeight;
    const faceArea = box.width * box.height;

    return faceArea > 0 ? keypointArea / faceArea : 0;
  };

  const startContinuousScanning = () => {
    console.log('🚀 Starting continuous face detection loop');

    // Wait for video to be ready then start scanning
    const checkAndStartScanning = () => {
      if (videoRef.current && videoRef.current.videoWidth > 0) {
        console.log('✅ Video ready with dimensions:', {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        });
        console.log('🎯 Starting face detection scanning loop...');
        scanForFaces(); // Start the scanning loop
      } else {
        console.log('⏳ Waiting for video to be ready...', {
          hasVideo: !!videoRef.current,
          videoWidth: videoRef.current?.videoWidth,
          videoHeight: videoRef.current?.videoHeight
        });
        setTimeout(checkAndStartScanning, 500);
      }
    };

    // Start checking after a brief delay
    setTimeout(checkAndStartScanning, 1000);
  };


  const scanForFaces = async () => {
    // Skip scanning if we're currently processing a face
    if (isProcessingFace) {
      console.log('⏸️ Scanning paused - currently processing face');
      setTimeout(() => {
        scanForFaces();
      }, 500);
      return;
    }

    if (!videoRef.current || !canvasRef.current) {
      console.log('Scan skipped - missing refs:', {
        video: !!videoRef.current,
        canvas: !!canvasRef.current
      });

      // Retry scanning if we're supposed to be scanning but conditions aren't met
      if (isScanning) {
        setTimeout(() => {
          scanForFaces();
        }, 1000);
      }
      return;
    }

    // Check if video has proper dimensions
    if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      console.log('Video dimensions not ready yet, retrying...');
      setTimeout(() => {
        scanForFaces();
      }, 500);
      return;
    }

    try {
      console.log('Starting face detection...');
      let faces;

      if (USE_FACE_API) {
        const detections = await faceApiService.detectFaces(videoRef.current);
        faces = detections.map(d => ({
          box: d.box,
          keypoints: d.landmarks?.positions || [],
          detection: { score: d.confidence }
        }));
      } else if (USE_IMPROVED_TENSORFLOW) {
        const detections = await tensorflowFaceDetection.detectFaces(videoRef.current);

        // Store raw detections for keypoint visualization
        setTensorflowDetections(detections);

        // Draw keypoints on canvas if available
        if (canvasRef.current && videoRef.current && detections.length > 0) {
          tensorflowFaceDetection.drawFaceDetection(canvasRef.current, videoRef.current, detections);
        }

        faces = detections.map(d => ({
          box: { xMin: d.box?.x || 0, yMin: d.box?.y || 0, width: d.box?.width || 0, height: d.box?.height || 0 },
          keypoints: d.keypoints || [],
          detection: { score: d.confidence },
          embedding: d.embedding,
          qualityScore: d.qualityScore || 0  // Add quality score to face object
        }));
      } else {
        faces = await faceRecognitionService.detectFaces(videoRef.current);
      }
      console.log('Faces detected:', faces.length, faces);

      // Update positioning guidance and facial features
      const videoElement = videoRef.current;
      const guidance = getPositioningGuidance(faces, videoElement);
      setPositioningGuide(guidance);

      // Update detected faces for visual tracking
      setDetectedFaces(faces);

      // Extract and display facial features
      if (faces.length > 0) {
        const features = extractFacialFeatures(faces[0], videoElement);
        setFacialFeatures(features);
      } else {
        setFacialFeatures([]);
        setTensorflowDetections([]);

        // Clear canvas when no faces detected
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }

        // Clear match state when no faces are detected
        if (lastMatch) {
          console.log('🧹 No faces detected - clearing previous match state');
          setLastMatch(null);
        }
        // Reset stability tracking when no faces
        setStableHighQualityFrames(0);
      }

      if (faces.length > 0) {
        const face = faces[0]; // Use the first detected face

        // 🚫 CRITICAL: Validate this is actually a face, not a hand or other object
        if (!await validateDetectedFace(face, videoElement)) {
          console.log('⚠️ Invalid face detected (likely hand/body part) - skipping processing');

          // 🧹 CLEAR ALL STATE when invalid face detected (hand/body part)
          setLastMatch(null);
          setStableHighQualityFrames(0);
          setBestQualityFace(null); // Clear any cached image data
          setUnrecognizedFace(null);
          setLastUnrecognizedFace(null);
          setLastEmbedding([]);
          setRecentFaces(new Set());

          // Clear embedding debug info
          setEmbeddingDebug({
            currentEmbeddingLength: 0,
            bestEmbeddingLength: 0,
            lastSimilarityScore: 0,
            currentValidityPercent: 0,
            bestValidityPercent: 0
          });

          console.log('🧹 Cleared all cached state due to invalid face detection');
          setTimeout(() => scanForFaces(), 300);
          return;
        }

        // Use improved TensorFlow quality scoring with stability requirement
        const qualityScore = face.qualityScore || 0;
        const isHighQuality = qualityScore >= 0.90; // Strict 90% threshold

        console.log('🎯 Quality Debug:', {
          faceHasQualityScore: 'qualityScore' in face,
          rawQualityScore: face.qualityScore,
          finalQualityScore: qualityScore,
          isHighQuality: isHighQuality
        });
        const currentTime = Date.now();

        // 🎯 PERFECT QUALITY (100%) - INSTANT PROCESSING
        const isPerfectQuality = qualityScore >= 1.0;
        if (isPerfectQuality) {
          console.log('🎆 PERFECT QUALITY DETECTED (100%) - INSTANT PROCESSING!');

          // 🛑 PAUSE SCANNING immediately for perfect quality
          setIsProcessingFace(true);

          // Clear canvas for clean capture (no keypoints/bounding boxes)
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
          }

          // 📸 INSTANT CAPTURE of clean image
          console.log('📸 Capturing perfect quality image (no overlays)...');

          // Process this perfect face immediately
          setTimeout(() => {
            processPerfectQualityFace(face, qualityScore);
          }, 100); // Small delay to ensure canvas is cleared

          return; // Exit early for perfect quality processing
        }

        // Track face stability for registration (90-99% quality)
        if (isHighQuality) {
          // Check if this continues a stable sequence
          if (currentTime - lastHighQualityTime <= STABILITY_TIMEOUT) {
            setStableHighQualityFrames(prev => prev + 1);
          } else {
            // Reset stability counter if too much time passed
            setStableHighQualityFrames(1);
          }
          setLastHighQualityTime(currentTime);

          // Track best quality face for optimal embedding
          if (!bestQualityFace || qualityScore > bestQualityFace.qualityScore) {
            console.log('🏆 New best quality face found:', qualityScore.toFixed(3));
            // We'll set the best face embedding later when we generate it
          }
        } else {
          // Reset stability if quality drops
          setStableHighQualityFrames(0);
        }

        const isStableAndHighQuality = isHighQuality && stableHighQualityFrames >= REQUIRED_STABLE_FRAMES;

        // Update face quality state for UI
        setFaceQuality({
          isValid: isStableAndHighQuality,
          score: qualityScore,
          reason: isStableAndHighQuality ?
            `Excellent quality & stable (${stableHighQualityFrames}/${REQUIRED_STABLE_FRAMES} frames)` :
            isHighQuality ?
              `Good quality, stabilizing... (${stableHighQualityFrames}/${REQUIRED_STABLE_FRAMES} frames)` :
              `Quality: ${(qualityScore * 100).toFixed(1)}% (need 90%+)`
        });

        console.log('🔍 Face Quality Analysis:', {
          score: qualityScore.toFixed(3),
          isHigh: isHighQuality,
          stableFrames: stableHighQualityFrames,
          requiredFrames: REQUIRED_STABLE_FRAMES,
          isStableAndHigh: isStableAndHighQuality
        });

        // Only proceed with face matching if quality is high AND stable
        if (!isStableAndHighQuality) {
          console.log('⏭️ Skipping - face not stable/high-quality enough');
          // Continue scanning for unstable or low quality faces
          setTimeout(() => scanForFaces(), 200);
          return;
        }

        console.log('✅ Processing excellent stable face - proceeding with matching');

        // 🛑 PAUSE SCANNING to process this face properly
        console.log('🛑 PAUSING scanning to process detected face...');
        setIsProcessingFace(true);

        // 🚀 IMMEDIATE CAPTURE: Crop face image right now before any delays
        console.log('📸 Capturing face image immediately to avoid movement delays...');
        let immediatelycroppedFace = null;

        if (USE_IMPROVED_TENSORFLOW && face.box) {
          // For TensorFlow faces, create a compatible face object
          const compatibleFace = {
            box: {
              xMin: face.box.xMin,
              yMin: face.box.yMin,
              width: face.box.width,
              height: face.box.height
            }
          };
          immediatelycroppedFace = faceRecognitionService.cropFaceFromVideo(videoElement, compatibleFace as any);
        } else {
          immediatelycroppedFace = faceRecognitionService.cropFaceFromVideo(videoElement, face);
        }

        console.log('📸 IMMEDIATE CAPTURE RESULT:', !!immediatelycroppedFace ? 'SUCCESS' : 'FAILED');

        let embedding;
        if (USE_IMPROVED_TENSORFLOW && face.embedding) {
          // Use embedding from improved TensorFlow service
          embedding = face.embedding;
        } else if (USE_FACE_API) {
          // Generate embedding using face-api.js (would need descriptor)
          embedding = face.descriptor ? Array.from(face.descriptor) : [];
        } else {
          // Use legacy embedding generation
          embedding = faceRecognitionService.generateEmbedding(face);
        }
        console.log('Generated embedding length:', embedding.length);

        // Update embedding debug info
        setEmbeddingDebug(prev => ({
          ...prev,
          currentEmbeddingLength: embedding.length,
          bestEmbeddingLength: bestQualityFace?.embedding.length || 0,
          currentValidityPercent: qualityScore * 100
        }));

        // Update best quality face if this is better
        if (!bestQualityFace || qualityScore > bestQualityFace.qualityScore) {
          setBestQualityFace({
            embedding: embedding,
            qualityScore: qualityScore,
            imageData: immediatelycroppedFace || undefined
          });
          console.log('🏆 Updated best quality face embedding (score:', qualityScore.toFixed(3), ')');

          // Update debug info for best embedding
          setEmbeddingDebug(prev => ({
            ...prev,
            bestEmbeddingLength: embedding.length,
            bestValidityPercent: qualityScore * 100
          }));
        }

        // 🆔 CHECK IF DIFFERENT PERSON: Compare embeddings to detect new person
        let isDifferentPerson = true;
        let similarityScore = 0;

        if (lastEmbedding.length > 0 && embedding.length > 0) {
          if (USE_IMPROVED_TENSORFLOW) {
            similarityScore = tensorflowFaceDetection.calculateSimilarity(embedding, lastEmbedding);
          } else if (USE_FACE_API) {
            // Use face-api.js similarity calculation if available
            similarityScore = faceApiService ? 0.5 : 0; // Placeholder
          } else {
            similarityScore = faceRecognitionService.calculateSimilarity(embedding, lastEmbedding);
          }
          // Very strict threshold for different person detection - must be significantly different
          isDifferentPerson = similarityScore < 0.80; // Increased to 0.80 for much stricter person distinction
          console.log('Face similarity with last detection:', similarityScore.toFixed(3), '- Different person:', isDifferentPerson);
        }

        // 🚫 MANDATORY DELAY for fast switching: Always wait at least 1.5 seconds between different people
        // Reuse currentTime from above
        if (isDifferentPerson && lastDetectionTime > 0 && (currentTime - lastDetectionTime) < 1500) {
          console.log('⏱️ Fast person switching detected - enforcing 1.5s delay before processing');
          setIsProcessingFace(false);
          setTimeout(() => scanForFaces(), 800);
          return;
        }

        // 🧹 CLEAR STATE for different person
        if (isDifferentPerson) {
          console.log('🧹 Different person detected - clearing ALL previous state');
          setLastMatch(null);
          setRecentFaces(new Set());
          setLastDetectionTime(0);
          setUnrecognizedFace(null);
          setLastUnrecognizedFace(null);
          setBestQualityFace(null); // 🚨 CRITICAL: Clear cached image data
          setStableHighQualityFrames(0); // Reset stability tracking

          // Clear embedding debug info
          setEmbeddingDebug({
            currentEmbeddingLength: 0,
            bestEmbeddingLength: 0,
            lastSimilarityScore: 0,
            currentValidityPercent: 0,
            bestValidityPercent: 0
          });

          console.log('🧹 Cleared cached image data and all previous detection state');
        }

        // Store current embedding for next comparison
        setLastEmbedding(embedding);

        if (embedding.length > 0) {
          // Use cached embeddings for face matching (no Supabase calls)
          let match = null;
          const orgId = isLegacyMode ? 'legacy' : organization?.id;

          if (orgId) {
            if (USE_IMPROVED_TENSORFLOW) {
              const matchResult = await tensorflowFaceDetection.matchFace(embedding, orgId);
              console.log('🔍 TensorFlow Match Result:', matchResult);
              match = matchResult.matched ? {
                id: matchResult.person!.id,
                name: matchResult.person!.name,
                status: matchResult.person!.status,
                confidence: matchResult.confidence
              } : null;
            } else if (USE_FACE_API) {
              const matchResult = await faceApiService.matchFace(new Float32Array(embedding), orgId);
              console.log('🔍 FaceAPI Match Result:', matchResult);
              match = matchResult.matched ? {
                id: matchResult.person!.id,
                name: matchResult.person!.name,
                status: matchResult.person!.status,
                confidence: matchResult.confidence
              } : null;
            } else {
              match = await faceRecognitionService.matchFaceWithCache(embedding, orgId, 0.75);
              console.log('🔍 Legacy Match Result:', match);
            }
          }

          // Reuse currentTime from above

          console.log('🔍 FACE MATCHING RESULT:', {
            embeddingLength: embedding.length,
            cachedMembersCount: members.length,
            matchFound: !!match,
            matchDetails: match ? { name: match.name, confidence: match.confidence } : 'No match'
          });

          // Update embedding debug info with match results
          const similarityBreakdown = (window as any).lastSimilarityBreakdown;
          setEmbeddingDebug(prev => ({
            ...prev,
            lastSimilarityScore: match ? match.confidence : 0,
            matchedMemberName: match ? match.name : undefined,
            similarityBreakdown: similarityBreakdown
          }));

          if (match) {
            console.log('Face match found:', match.name, 'confidence:', match.confidence);

            // Check cooldown to prevent repeated detections of the same person
            const faceId = match.id;
            if (currentTime - lastDetectionTime < DETECTION_COOLDOWN && recentFaces.has(faceId) && !isDifferentPerson) {
              console.log('Skipping detection - in cooldown period for', match.name);
              setTimeout(() => {
                scanForFaces();
              }, 500);
              return;
            }

            // Different person state was already cleared above

            // Set last match without attendance info (attendance handled in background)
            setLastMatch(match);
            setLastDetectionTime(currentTime);
            setRecentFaces(prev => new Set([...prev, faceId]));

            // Clear recent faces after cooldown period
            setTimeout(() => {
              setRecentFaces(prev => {
                const newSet = new Set(prev);
                newSet.delete(faceId);
                return newSet;
              });
            }, DETECTION_COOLDOWN);

            // Trigger appropriate status flash and sound based on member status
            if (match.status === 'Banned') {
              triggerStatusFlash('danger');
              playSound('banned');
            } else if (match.status === 'VIP') {
              triggerStatusFlash('success');
              playSound('approved');
            } else {
              triggerStatusFlash('success'); // Allowed members get green
              playSound('approved');
            }

            // Silently check and log attendance (only once per day) in background
            addAttendanceLog(match.id, match.confidence).then((attendanceResult) => {
              if (attendanceResult) {
                console.log('✅ First attendance logged for', match.name);
              } else {
                console.log('ℹ️ Already attended today:', match.name, '- continuing scan');
              }
            }).catch(async (error) => {
              console.error('Attendance logging error:', error);

              // Check if this is a foreign key constraint violation (member was deleted)
              if (error.code === '23503' || error.message.includes('foreign key constraint')) {
                console.warn('🔄 Member was deleted from database, refreshing cache...');
                await refreshMembersCache();
                console.log('⚠️ Cache refreshed due to deleted member. Face will be treated as unrecognized.');

                // Clear the last match since this member no longer exists
                setLastMatch(null);
              }
            });

            // ▶️ RESUME SCANNING after processing match
            setIsProcessingFace(false);
            setTimeout(() => scanForFaces(), 1500);
          } else {
            // No match found - trigger registration prompt for unrecognized face
            console.log('❌ No match found in database');

            // Check if this is the same unrecognized person (avoid spam)
            if (!isDifferentPerson && lastUnrecognizedFace && Date.now() - lastDetectionTime < 3000) {
              console.log('⏭️ Same unrecognized person within 3 seconds - skipping duplicate prompt');
              setIsProcessingFace(false);
              setTimeout(() => scanForFaces(), 1000);
              return;
            }

            console.log('🚨 AUTO-PROMPTING registration for unrecognized high-quality face');

            // ⏸️ PAUSE SCANNING for registration
            setIsProcessingFace(true);
            console.log('⏸️ SCANNING PAUSED for registration dialog');

            console.log('🚨 Unrecognized face detected - starting registration process');
            setLastDetectionTime(currentTime);

            // Trigger yellow flash and sound for unrecognized face
            triggerStatusFlash('warning');
            playSound('unregistered');

            // Use the immediately captured face image (no delay!)
            if (immediatelycroppedFace) {
              console.log('📸 Processing face for registration');

              // 🔍 VALIDATE: Make sure we captured a face, not a body (unless skipped)
              let isValidFace = true; // Default to valid if skipping

              if (!SKIP_CAPTURE_VALIDATION) {
                console.log('🔍 Validating captured image contains actual face...');
                isValidFace = await faceRecognitionService.validateCapturedFace(immediatelycroppedFace);
                console.log('🔍 FACE VALIDATION RESULT:', isValidFace ? 'VALID' : 'INVALID');
              } else {
                console.log('⏭️ Skipping captured face validation (SKIP_CAPTURE_VALIDATION = true)');
              }

              if (isValidFace) {
                console.log('✅ Captured image validation passed - showing registration');
                const unrecognizedFaceData = { embedding, imageData: immediatelycroppedFace };
                setUnrecognizedFace(unrecognizedFaceData);
                setLastUnrecognizedFace(unrecognizedFaceData); // Store for re-triggering

                // Use the best quality face for registration if available
                const faceForRegistration = bestQualityFace || unrecognizedFaceData;
                console.log('✅ Using', bestQualityFace ? 'BEST' : 'current', 'quality face for registration (score:', faceForRegistration.qualityScore?.toFixed(3) || 'unknown', ')');

                setUnrecognizedFace(faceForRegistration);
                setLastUnrecognizedFace(faceForRegistration); // Store for re-triggering
                setShowRegistrationPrompt(true);
                // Scanning is already paused via setIsProcessingFace(true)
                return;

                console.log('✅ Showing registration prompt for unrecognized face');
                setShowRegistrationPrompt(true);
                // Keep processing paused while showing registration prompt
                console.log('⏸️ Keeping scanning paused while registration prompt is shown');
                return;
              } else {
                console.warn('⚠️ Captured image validation failed - likely captured body instead of face');
                // Continue scanning instead of showing registration with invalid image
              }
            } else {
              console.error('❌ Immediate face capture failed - trying fallback...');
              // Fallback: try to capture again (though this might have the delay issue)
              let fallbackCroppedFace = null;
              if (USE_IMPROVED_TENSORFLOW && face.box) {
                const compatibleFace = {
                  box: {
                    xMin: face.box.xMin,
                    yMin: face.box.yMin,
                    width: face.box.width,
                    height: face.box.height
                  }
                };
                fallbackCroppedFace = faceRecognitionService.cropFaceFromVideo(videoElement, compatibleFace as any);
              } else {
                fallbackCroppedFace = faceRecognitionService.cropFaceFromVideo(videoElement, face);
              }
              console.log('🔄 FALLBACK CAPTURE RESULT:', !!fallbackCroppedFace ? 'SUCCESS' : 'FAILED');
              if (fallbackCroppedFace) {
                console.log('⚠️ Using fallback face capture - validating...');
                let isValidFallback = true;

                if (!SKIP_CAPTURE_VALIDATION) {
                  isValidFallback = await faceRecognitionService.validateCapturedFace(fallbackCroppedFace);
                } else {
                  console.log('⏭️ Skipping fallback face validation (SKIP_CAPTURE_VALIDATION = true)');
                }

                if (isValidFallback) {
                  console.log('✅ Fallback capture validation passed');
                  const fallbackUnrecognizedFaceData = { embedding, imageData: fallbackCroppedFace };
                  // Use the best quality face for registration if available
                  const faceForRegistration = bestQualityFace || fallbackUnrecognizedFaceData;
                  console.log('✅ Using', bestQualityFace ? 'BEST' : 'fallback', 'quality face for registration');

                  setUnrecognizedFace(faceForRegistration);
                  setLastUnrecognizedFace(faceForRegistration); // Store for re-triggering
                  setShowRegistrationPrompt(true);
                  return;
                  console.log('⏸️ Keeping scanning paused while registration prompt is shown (fallback)');
                  return;
                } else {
                  console.warn('⚠️ Fallback capture also invalid - person likely moved');
                }
              } else {
                console.error('❌ Both immediate and fallback face capture failed');

                // 🚨 EMERGENCY FALLBACK: Show registration prompt without image for testing
                console.log('🚨 EMERGENCY FALLBACK: Showing registration prompt without image for testing');
                const emergencyUnrecognizedFaceData = { embedding, imageData: undefined };
                // Use the best quality face for registration if available
                const faceForRegistration = bestQualityFace || emergencyUnrecognizedFaceData;
                console.log('🎆 Emergency: Using', bestQualityFace ? 'BEST' : 'current', 'quality face for registration');

                setUnrecognizedFace(faceForRegistration);
                setLastUnrecognizedFace(faceForRegistration);
                setShowRegistrationPrompt(true);
                return;
                console.log('🎬 EMERGENCY REGISTRATION PROMPT SET TO TRUE');
                return;
              }

              // Continue scanning if all captures failed or were invalid
            }

            setIsProcessingFace(false);
            setTimeout(() => scanForFaces(), 800);
          }
        }
      } else {
        // 🧹 CLEAR ALL STATES: No faces detected, reset everything
        console.log('🧹 No faces detected - clearing all detection states');
        setLastMatch(null);
        setDetectedFaces([]);
        setFaceQuality(null);
        setFacialFeatures([]);

        // Also clear recent faces and last embedding if no one is in frame for a while
        setRecentFaces(new Set());
        setLastEmbedding([]);
        setBestQualityFace(null); // Clear cached image data when no faces

        // Clear embedding debug info
        setEmbeddingDebug({
          currentEmbeddingLength: 0,
          bestEmbeddingLength: 0,
          lastSimilarityScore: 0,
          currentValidityPercent: 0,
          bestValidityPercent: 0
        });

        setTimeout(() => scanForFaces(), 300); // Faster scanning when no faces
      }
    } catch (error) {
      console.error('Scanning error:', error);
      setTimeout(() => scanForFaces(), 500);
    }
  };

  // Validate embedding before storing in database to prevent hand/non-face embeddings
  const validateEmbeddingForStorage = async (embedding: number[], imageData?: string): Promise<boolean> => {
    try {
      console.log('🔍 Validating embedding for database storage...');

      // 1. Basic embedding validation
      if (!embedding || embedding.length === 0) {
        console.log('❌ Embedding validation failed: Empty embedding');
        return false;
      }

      // 2. Skip re-validation since the image was already validated during 100% quality detection
      if (imageData) {
        console.log('✅ Image validation skipped - already validated during 100% quality detection');
        console.log('📸 Image size:', `${Math.round(imageData.length / 1024)}KB`);

        // The fact that we have imageData means it passed all validation during 100% quality detection:
        // - Face pattern validation (eyes, nose, mouth)
        // - Hand detection rejection
        // - Quality scoring at 100%
        // - Facial landmark validation (if using 468-point system)
        // - validateDetectedFace() passed all criteria

        // No need to re-validate what has already been thoroughly validated
        console.log('✅ Image contains valid face (validated during capture)');
      }

      // 3. Embedding pattern analysis - check for hand-like vs face-like patterns
      const embeddingAnalysis = analyzeEmbeddingPattern(embedding);
      if (!embeddingAnalysis.looksLikeFace) {
        console.log('❌ Embedding validation failed: Pattern analysis suggests non-face data');
        console.log('Embedding analysis:', embeddingAnalysis);
        return false;
      }

      // 4. Compare against known good face embeddings pattern
      if (members.length > 0) {
        const similarityToExistingFaces = checkSimilarityToValidFaces(embedding);
        if (similarityToExistingFaces.averageSimilarity < 0.1) { // Very dissimilar to all existing faces
          console.log('❌ Embedding validation failed: Too dissimilar to existing face patterns');
          console.log('Similarity analysis:', similarityToExistingFaces);
          return false;
        }
      }

      console.log('✅ Embedding validation passed - appears to be valid face data');
      return true;

    } catch (error) {
      console.error('Embedding validation error:', error);
      return false; // Fail safe
    }
  };

  // Analyze embedding pattern to detect hand vs face characteristics
  const analyzeEmbeddingPattern = (embedding: number[]): { looksLikeFace: boolean; confidence: number; reason: string } => {
    try {
      // Face embeddings have certain statistical properties
      // Hands would have different patterns

      // 1. Check embedding magnitude distribution
      const magnitudes = embedding.map(Math.abs);
      const avgMagnitude = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
      const maxMagnitude = Math.max(...magnitudes);
      const minMagnitude = Math.min(...magnitudes);

      // Face embeddings typically have more balanced distributions
      const magnitudeRange = maxMagnitude - minMagnitude;
      const magnitudeVariance = magnitudes.reduce((sum, mag) => sum + Math.pow(mag - avgMagnitude, 2), 0) / magnitudes.length;

      // 2. Check for outlier patterns (hands might have extreme values)
      const outliers = magnitudes.filter(mag => mag > avgMagnitude + 3 * Math.sqrt(magnitudeVariance));
      const outlierRatio = outliers.length / embedding.length;

      // 3. Pattern scoring
      let faceConfidence = 1.0;
      let reason = 'Normal face pattern';

      if (outlierRatio > 0.1) { // More than 10% outliers
        faceConfidence -= 0.3;
        reason = 'High outlier ratio suggests non-face';
      }

      if (magnitudeRange > avgMagnitude * 10) { // Very wide range
        faceConfidence -= 0.2;
        reason = 'Extreme magnitude range suggests non-face';
      }

      if (avgMagnitude < 0.001 || avgMagnitude > 100) { // Unusual magnitude
        faceConfidence -= 0.3;
        reason = 'Unusual magnitude pattern';
      }

      const looksLikeFace = faceConfidence > 0.5;

      console.log('🧠 Embedding pattern analysis:', {
        avgMagnitude: avgMagnitude.toFixed(4),
        magnitudeRange: magnitudeRange.toFixed(4),
        outlierRatio: outlierRatio.toFixed(3),
        faceConfidence: faceConfidence.toFixed(3),
        looksLikeFace,
        reason
      });

      return { looksLikeFace, confidence: faceConfidence, reason };

    } catch (error) {
      console.error('Embedding pattern analysis error:', error);
      return { looksLikeFace: false, confidence: 0, reason: 'Analysis failed' };
    }
  };

  // Check similarity to existing valid face embeddings
  const checkSimilarityToValidFaces = (embedding: number[]): { averageSimilarity: number; maxSimilarity: number; validFaceCount: number } => {
    try {
      if (members.length === 0) {
        return { averageSimilarity: 1.0, maxSimilarity: 1.0, validFaceCount: 0 }; // No comparison data
      }

      const similarities: number[] = [];

      for (const member of members) {
        if (member.face_embedding && member.face_embedding.length > 0) {
          // Calculate cosine similarity
          const similarity = calculateCosineSimilarity(embedding, member.face_embedding);
          similarities.push(similarity);
        }
      }

      if (similarities.length === 0) {
        return { averageSimilarity: 1.0, maxSimilarity: 1.0, validFaceCount: 0 };
      }

      const averageSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
      const maxSimilarity = Math.max(...similarities);

      return {
        averageSimilarity,
        maxSimilarity,
        validFaceCount: similarities.length
      };

    } catch (error) {
      console.error('Similarity check error:', error);
      return { averageSimilarity: 0, maxSimilarity: 0, validFaceCount: 0 };
    }
  };

  // Optimize image for database storage (reduce size while maintaining quality)
  const optimizeImageForDatabase = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const img = new Image();
        img.onload = () => {
          // Create canvas for optimization
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          // Set optimal size for database storage (max 150x150)
          const maxSize = 150;
          let { width, height } = img;

          // Calculate scaled dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;

          // Draw optimized image
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to optimized data URL with reduced quality for smaller size
          const optimizedDataUrl = canvas.toDataURL('image/jpeg', 0.7);

          console.log('📸 Image optimization:', {
            original: `${img.width}x${img.height}`,
            optimized: `${width}x${height}`,
            originalSize: `${Math.round(dataUrl.length / 1024)}KB`,
            optimizedSize: `${Math.round(optimizedDataUrl.length / 1024)}KB`
          });

          resolve(optimizedDataUrl);
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = dataUrl;
      } catch (error) {
        reject(error);
      }
    });
  };

  const handleApproveRegistration = async () => {
    if (!unrecognizedFace || !newMemberName.trim()) return;

    setIsRegistering(true);
    try {
      // Check member limits for multi-tenant mode
      if (!isLegacyMode && organization) {
        const currentMemberCount = members.length;
        if (currentMemberCount >= organization.member_limit) {
          setAlertHeader('Member Limit Reached');
          setAlertMessage(`You've reached your plan limit of ${organization.member_limit} members. Please upgrade your plan to add more members.`);
          setShowAlert(true);
          setIsRegistering(false);
          return;
        }
      }

      console.log('🆕 Adding new member to organization:', {
        name: newMemberName.trim(),
        status: newMemberStatus,
        hasEmbedding: !!unrecognizedFace.embedding,
        embeddingLength: unrecognizedFace.embedding?.length,
        hasImageData: !!unrecognizedFace.imageData,
        imageSize: unrecognizedFace.imageData ? `${Math.round(unrecognizedFace.imageData.length / 1024)}KB` : 'N/A',
        organizationMode: isLegacyMode ? 'legacy' : 'multi-tenant',
        organizationId: organization?.id
      });

      // ✅ SKIP VALIDATION: Face was already validated during 100% quality detection
      console.log('✅ Skipping validation - face already validated during capture at 100% quality');

      // Optimize image for database storage
      let optimizedImageData = unrecognizedFace.imageData;
      if (optimizedImageData) {
        try {
          // Create a smaller image for database storage
          optimizedImageData = await optimizeImageForDatabase(optimizedImageData);
          console.log('📸 Image optimized for database storage');
        } catch (error) {
          console.warn('⚠️ Image optimization failed, using original:', error);
        }
      }

      const newMember = await addMember({
        name: newMemberName.trim(),
        face_embedding: unrecognizedFace.embedding,
        status: newMemberStatus,
        photo_url: optimizedImageData
      });

      console.log('✅ Member added successfully:', newMember);

      // Refresh cache to ensure we have the latest data from database
      console.log('🔄 Refreshing cache after new member registration...');
      const updatedMembers = await refreshMembersCache();
      console.log('📊 Updated members count:', updatedMembers.length);

      // Reset state
      setShowRegistrationPrompt(false);
      setUnrecognizedFace(null);
      setLastUnrecognizedFace(null); // Clear saved face after successful registration
      setNewMemberName('');
      setNewMemberStatus('Allowed');

      // Show success message briefly
      setLastMatch({
        name: newMember.name,
        status: newMember.status,
        confidence: 1.0
      });

      setIsProcessingFace(false);
      setTimeout(() => {
        setLastMatch(null);
        scanForFaces();
      }, 1200);

    } catch (error) {
      console.error('Failed to register member:', error);
      setError('Failed to register new member');
      setIsProcessingFace(false);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleRejectRegistration = () => {
    setShowRegistrationPrompt(false);
    setUnrecognizedFace(null);
    setNewMemberName('');
    setNewMemberStatus('Allowed');
    // Keep lastUnrecognizedFace for re-triggering

    // 🔄 CLEAR DETECTION STATE so registration can trigger again for any unrecognized face
    console.log('🔄 Clearing detection state - registration can trigger again for any face');
    setLastEmbedding([]); // Clear so any face can trigger registration again
    setLastDetectionTime(0); // Reset detection cooldown
    setLastMatch(null); // Clear match state

    setIsProcessingFace(false);
    setTimeout(() => scanForFaces(), 200);
  };

  const handleRetriggerRegistration = () => {
    if (lastUnrecognizedFace) {
      console.log('Re-triggering registration for last unrecognized face');
      setUnrecognizedFace(lastUnrecognizedFace);
      setShowRegistrationPrompt(true);
    }
  };

  return (
    <IonPage>
      <style>{styles}</style>
      <IonHeader>
        <IonToolbar style={{
          '--background': 'rgba(26, 29, 41, 0.95)',
          '--color': '#e2e8f0',
          '--border-color': 'rgba(59, 130, 246, 0.2)'
        }}>
          {!isLegacyMode && (
            <IonButton
              fill="clear"
              slot="start"
              onClick={() => history.push('/dashboard')}
              style={{ '--color': '#3b82f6' }}
            >
              <IonIcon icon={arrowBack} />
            </IonButton>
          )}

          <IonTitle style={{
            color: '#e2e8f0',
            fontFamily: '"Segoe UI", system-ui, sans-serif',
            fontWeight: '600',
            textShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
            letterSpacing: '0.5px'
          }}>
            {!isLegacyMode && organization ? organization.name : 'MembershipScan'}
          </IonTitle>

          {!isLegacyMode && (
            <IonButton
              fill="clear"
              slot="end"
              onClick={() => history.push('/admin')}
              style={{ '--color': '#3b82f6' }}
            >
              <IonIcon icon={settings} />
            </IonButton>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div className="camera-container" style={{
          background: '#f8f9fa',
          minHeight: '100vh'
        }}>
          {/* Status Info - Mobile: Top, Desktop: Side */}
          <div className="status-info">
            <div style={{ marginBottom: '8px' }}>
              Members: {members.length} | Status: {
                !isScanning ? 'Offline' :
                isProcessingFace ? 'Processing' :
                'Live'
              }
              {detectedFaces.length > 0 && ` | Faces: ${detectedFaces.length}`}
              {lastMatch && ` | Last: ${lastMatch.name}`}
            </div>

            {/* Embedding Debug Info */}
            {(embeddingDebug.currentEmbeddingLength > 0 || embeddingDebug.bestEmbeddingLength > 0) && (
              <div style={{ fontSize: '12px', opacity: 0.8, fontFamily: 'monospace' }}>
                🧠 Embeddings: Current: {embeddingDebug.currentEmbeddingLength}D
                {embeddingDebug.currentValidityPercent > 0 && (
                  <span style={{ color: embeddingDebug.currentValidityPercent >= 90 ? '#10b981' : '#f59e0b' }}>
                    {' '}({embeddingDebug.currentValidityPercent.toFixed(1)}%)
                  </span>
                )}
                {embeddingDebug.bestEmbeddingLength > 0 && (
                  <>
                    {' | Best: '}{embeddingDebug.bestEmbeddingLength}D
                    {embeddingDebug.bestValidityPercent > 0 && (
                      <span style={{ color: '#10b981' }}>
                        {' '}({embeddingDebug.bestValidityPercent.toFixed(1)}%)
                      </span>
                    )}
                  </>
                )}
                {embeddingDebug.lastSimilarityScore > 0 && (
                  <> | Similarity: {(embeddingDebug.lastSimilarityScore * 100).toFixed(1)}%</>
                )}
                {embeddingDebug.matchedMemberName && (
                  <> → {embeddingDebug.matchedMemberName}</>
                )}
                {embeddingDebug.similarityBreakdown && (
                  <div style={{ marginTop: '4px', fontSize: '11px' }}>
                    🔍 Cosine: {embeddingDebug.similarityBreakdown.cosine} |
                    Euclidean: {embeddingDebug.similarityBreakdown.euclidean} |
                    Pearson: {embeddingDebug.similarityBreakdown.pearson}
                  </div>
                )}
              </div>
            )}

            {/* Face Quality Indicator */}
            {faceQuality && (
              <div style={{ marginTop: '8px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '6px'
                }}>
                  <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
                    Quality
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      width: '100%',
                      height: '6px',
                      backgroundColor: '#e5e7eb',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${Math.min(faceQuality.score * 100, 100)}%`,
                        height: '100%',
                        backgroundColor: faceQuality.score >= 1.0 ? '#ff6b00' :
                                      faceQuality.isValid ? '#10b981' :
                                      faceQuality.score >= 0.8 ? '#f59e0b' : '#ef4444',
                        borderRadius: '3px',
                        transition: 'width 0.3s ease-in-out',
                        boxShadow: faceQuality.score >= 1.0 ? '0 0 8px rgba(255, 107, 0, 0.6)' : 'none'
                      }} />
                    </div>
                  </div>
                </div>
                <div style={{
                  fontSize: '11px',
                  color: faceQuality.isValid ? '#10b981' : '#6b7280',
                  fontWeight: faceQuality.isValid ? '500' : '400'
                }}>
                  {faceQuality.isValid ? '✓ Ready to scan' :
                   faceQuality.score >= 0.8 ? 'Stabilizing...' : 'Position face clearly'}
                </div>
              </div>
            )}
          </div>

          {/* Camera Feed */}
          <div className="camera-wrapper">
            <div style={{
              position: 'relative',
              display: 'inline-block',
              width: '100%',
              maxWidth: '640px'
            }}>
              <video
                ref={videoRef}
                width={640}
                height={480}
                style={{
                  width: '100%',
                  height: 'auto',
                  background: '#000',
                  transform: MIRROR_CAMERA ? 'scaleX(-1)' : 'none',
                  borderRadius: '8px'
                }}
                autoPlay
                muted
                playsInline
              />
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 10,
                  borderRadius: '8px'
                }}
              />






          
          {/* Match result overlay */}
          {lastMatch && (
            <div style={{
              position: 'fixed',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              padding: '16px 24px',
              borderRadius: '12px',
              textAlign: 'center',
              zIndex: 100,
              minWidth: '200px'
            }}>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                {lastMatch.name}
              </div>
              <div style={{
                fontSize: '14px',
                color: lastMatch.status === 'VIP' ? '#8b5cf6' :
                       lastMatch.status === 'Banned' ? '#ef4444' : '#10b981'
              }}>
                {lastMatch.status}
              </div>
              <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                {(lastMatch.confidence * 100).toFixed(1)}% match
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {!isInitialized && (
            <div className="camera-overlay">
              <IonSpinner />
              <div style={{ marginTop: '12px' }}>Initializing...</div>
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="camera-overlay">
              <div style={{ color: '#ef4444' }}>{error}</div>
            </div>
          )}

          {/* Distance Indicator */}
          {detectedFaces.length > 0 && (
            <div className={`distance-indicator ${positioningGuide}`}>
              <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                {positioningGuide === 'too-far' && 'Move Closer'}
                {positioningGuide === 'too-close' && 'Step Back'}
                {positioningGuide === 'perfect' && 'Perfect!'}
              </div>
            </div>
          )}

            </div>
          </div>

        </div>

        {/* Registration Prompt Modal */}
        <IonModal
          isOpen={showRegistrationPrompt}
          onDidDismiss={handleRejectRegistration}
          backdropDismiss={false}
        >
          <IonHeader>
            <IonToolbar>
              <IonTitle>Unrecognized Face Detected</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              {unrecognizedFace?.imageData ? (
                <div style={{ marginBottom: '16px' }}>
                  <img
                    src={unrecognizedFace.imageData}
                    alt="Captured face"
                    style={{
                      maxWidth: '200px',
                      maxHeight: '200px',
                      borderRadius: '8px',
                      border: '3px solid #3b82f6',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                      transform: 'scaleX(-1)' // Mirror the image to match camera view
                    }}
                  />
                  <div style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    marginTop: '8px'
                  }}>
                    📸 Captured at {unrecognizedFace.qualityScore ? `${(unrecognizedFace.qualityScore * 100).toFixed(1)}%` : 'high'} quality
                  </div>
                </div>
              ) : (
                <div style={{
                  width: '200px',
                  height: '200px',
                  margin: '0 auto 16px',
                  border: '2px dashed #ef4444',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#fef2f2',
                  color: '#dc2626',
                  fontSize: '14px',
                  textAlign: 'center',
                  padding: '16px'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>❌</div>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>No Image Captured</div>
                  <div style={{ fontSize: '12px', opacity: 0.7 }}>
                    Image capture failed during 100% quality detection
                  </div>
                  <div style={{ fontSize: '11px', marginTop: '8px', opacity: 0.6 }}>
                    Debug: Check console for capture errors
                  </div>
                </div>
              )}
            </div>

            <IonText>
              <p style={{ textAlign: 'center', margin: '20px 0' }}>
                An unrecognized person has been detected. Would you like to register them?
              </p>
            </IonText>

            <IonItem>
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput
                value={newMemberName}
                placeholder="Enter person's name"
                onIonInput={(e) => setNewMemberName(e.detail.value!)}
              />
            </IonItem>

            <IonItem>
              <IonLabel position="stacked">Status</IonLabel>
              <IonSelect
                value={newMemberStatus}
                placeholder="Select status"
                onIonChange={(e) => setNewMemberStatus(e.detail.value)}
              >
                <IonSelectOption value="Allowed">Allowed</IonSelectOption>
                <IonSelectOption value="VIP">VIP</IonSelectOption>
                <IonSelectOption value="Banned">Banned</IonSelectOption>
              </IonSelect>
            </IonItem>

            <div style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
              <IonButton
                expand="block"
                fill="outline"
                color="medium"
                onClick={handleRejectRegistration}
                disabled={isRegistering}
              >
                Skip / Reject
              </IonButton>
              <IonButton
                expand="block"
                color="primary"
                onClick={handleApproveRegistration}
                disabled={!newMemberName.trim() || isRegistering}
              >
                {isRegistering ? (
                  <>
                    <IonSpinner name="crescent" />
                    &nbsp;Registering...
                  </>
                ) : (
                  'Approve & Register'
                )}
              </IonButton>
            </div>
          </IonContent>
        </IonModal>

        <IonAlert
          isOpen={showAlert}
          onDidDismiss={() => setShowAlert(false)}
          header={alertHeader}
          message={alertMessage}
          buttons={['OK']}
        />
      </IonContent>
    </IonPage>
  );
};

export default CameraScanner;