import React, { useRef, useEffect, useState } from 'react';
import {
  IonContent,
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonCard,
  IonCardContent,
  IonAlert,
  IonSpinner,
  IonText,
  IonToast,
  IonInput,
  IonItem,
  IonLabel,
} from '@ionic/react';
import { supabase, Member, addMember, getMembers, setOrganizationContext, clearOrganizationContext, getMembersNeedingDescriptors, updateMemberDescriptor } from '../services/supabaseClient';
import { useOrganization } from '../contexts/OrganizationContext';
import { faceApiService, FaceDetectionResult } from '../services/faceApiService';
import { optimizedFaceRecognition } from '../services/optimizedFaceRecognition';
import * as faceapi from 'face-api.js';

interface LocalFaceData {
  id: string;
  name: string;
  image: string;
  timestamp: string;
  supabaseId?: string; // Link to database record
}

interface LocalCacheEntry {
  id: string;
  name: string;
  image: string;
  timestamp: string;
  captureTime: number;
  synced: boolean;
  similarity?: number; // For duplicate tracking
  descriptor?: Float32Array; // face-api.js face descriptor for proper matching
  status?: 'Allowed' | 'Banned' | 'VIP'; // Member status from database
}

const SimpleFaceScanner: React.FC = () => {
  const { organization, isLegacyMode } = useOrganization();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [knownFaces, setKnownFaces] = useState<LocalFaceData[]>([]);
  // Processing state machine to prevent race conditions
  const [processingState, setProcessingState] = useState<'idle' | 'capturing' | 'matching' | 'registering'>('idle');
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [systemStatus, setSystemStatus] = useState<string>('Initializing AI Recognition System...');
  const [detectedPerson, setDetectedPerson] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('Ready');
  const [autoCapture, setAutoCapture] = useState(false);
  const [faceQuality, setFaceQuality] = useState<number>(0);
  const [qualityStatus, setQualityStatus] = useState<string>('No face detected');
  // Removed captureCountdown - immediate capture instead
  const [detectedFaces, setDetectedFaces] = useState<any[]>([]);
  const [faceDetector, setFaceDetector] = useState<any>(null);
  const [faceHistory, setFaceHistory] = useState<any[]>([]);
  const [lastDetectionTime, setLastDetectionTime] = useState<number>(0);
  const [lastGoodQualityTime, setLastGoodQualityTime] = useState<number>(0);
  const [lastRegistrationTime, setLastRegistrationTime] = useState<number>(0);
  const [processingLock, setProcessingLock] = useState<boolean>(false);
  const [isCaptureMode, setIsCaptureMode] = useState(false);
  const [capturedFaceImage, setCapturedFaceImage] = useState<string>('');
  const [capturedFaceDescriptor, setCapturedFaceDescriptor] = useState<Float32Array | null>(null);
  const [matchedMember, setMatchedMember] = useState<Member | null>(null);
  const [showRegistrationPrompt, setShowRegistrationPrompt] = useState(false);
  const [membersList, setMembersList] = useState<Member[]>([]);
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [localFaceCache, setLocalFaceCache] = useState<LocalCacheEntry[]>(() => {
    // Initialize from localStorage if available
    try {
      const saved = localStorage.getItem('localFaceCache');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('🔄 Restored cache from localStorage:', parsed.length, 'entries');
        return parsed;
      }
    } catch (error) {
      console.error('❌ Failed to restore cache from localStorage:', error);
    }
    return [];
  });
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  // Auto-save cache to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('localFaceCache', JSON.stringify(localFaceCache));
      console.log('💾 Saved cache to localStorage:', localFaceCache.length, 'entries');
    } catch (error) {
      console.error('❌ Failed to save cache to localStorage:', error);
    }
  }, [localFaceCache]);

  // Manual dialog states (kept for debugging)
  const [showAnalysisDialog, setShowAnalysisDialog] = useState<boolean>(false);
  const [analysisResults, setAnalysisResults] = useState<{
    capturedImage: string;
    matches: Array<{
      name: string;
      similarity: number;
      image: string;
      isMatch: boolean;
      distance?: number;
    }>;
    recommendation: string;
  } | null>(null);


  // Status-specific dialog states
  const [showAccessGrantedDialog, setShowAccessGrantedDialog] = useState(false);
  const [showBannedDialog, setShowBannedDialog] = useState(false);
  const [showVIPDialog, setShowVIPDialog] = useState(false);
  const [currentMatchedMember, setCurrentMatchedMember] = useState<{name: string; status: string; confidence: number; details?: string; photo_url?: string} | null>(null);

  // Member preloading states
  const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(false);
  const [preloadedMembers, setPreloadedMembers] = useState<Member[]>([]);
  // State machine prevents race conditions

  useEffect(() => {
    initializeScanner();
    const cleanup = startBatchSyncTimer();
    return cleanup;
  }, []);

  // Start batch sync timer (every 2 minutes)
  const startBatchSyncTimer = () => {
    const syncInterval = setInterval(async () => {
      console.log('⏰ Auto batch sync triggered');
      await batchSyncToDatabase();
    }, 120000); // 2 minutes

    console.log('🔄 Batch sync timer started - will sync every 2 minutes');

    // Cleanup on unmount
    return () => {
      console.log('🛑 Batch sync timer stopped');
      clearInterval(syncInterval);
    };
  };

  // Initialize organization context when component loads
  useEffect(() => {
    if (!isLegacyMode && organization) {
      console.log('🏢 Setting organization context for SimpleFaceScanner:', organization.name, 'ID:', organization.id);
      setOrganizationContext(organization.id);
    } else if (isLegacyMode) {
      console.log('🔧 Using legacy mode in SimpleFaceScanner - clearing organization context');
      clearOrganizationContext();
    }
  }, [organization, isLegacyMode]);

  // Function to reinitialize scanner after operations
  // Simplified reset function
  const resetScanner = () => {
    console.log('🔄 Resetting scanner...');
    setDetectedPerson(null);
    setCapturedImage('');
  };

  // Auto-register new person with random ID
  const autoRegisterNewPerson = async (personId: string, imageData: string) => {
    try {
      console.log('🔄 Auto-registering:', personId);
      setSystemStatus(`Registering: ${personId}...`);

      // Save to Supabase database
      const newMember = await addMember({
        name: personId,
        face_embedding: null,
        status: 'Allowed',
        photo_url: imageData
      });

      console.log('✅ Auto-registered to database:', newMember);

      // Create local face data
      const newLocalFace: LocalFaceData = {
        id: `local_${newMember.id}`,
        name: personId,
        image: imageData,
        timestamp: new Date().toISOString(),
        supabaseId: newMember.id
      };

      // Update local storage and state
      const updatedFaces = [...knownFaces, newLocalFace];
      setKnownFaces(updatedFaces);
      saveKnownFaces(updatedFaces);

      // Show success message
      setDetectedPerson(personId);
      setSystemStatus(`Welcome: ${personId} (auto-registered)`);
      console.log('✨ Auto-registration complete!');

      // Quick display then reset for next person - no processing state
      // Set last registration time to prevent flooding
      setLastRegistrationTime(Date.now());
      console.log('⏰ Registration time recorded - 5 second cooldown active');

      setTimeout(() => {
        setDetectedPerson(null);
        console.log('🔄 Ready for next person');
      }, 2000);

    } catch (error) {
      console.error('Auto-registration failed:', error);

      // Fallback to local-only storage
      const newLocalFace: LocalFaceData = {
        id: Date.now().toString(),
        name: personId,
        image: imageData,
        timestamp: new Date().toISOString()
      };

      const updatedFaces = [...knownFaces, newLocalFace];
      setKnownFaces(updatedFaces);
      saveKnownFaces(updatedFaces);

      setDetectedPerson(personId);
      setSystemStatus(`Welcome: ${personId} (offline mode)`);
      console.log('💾 Saved locally only');

      // Set last registration time for flood prevention
      setLastRegistrationTime(Date.now());
      console.log('⏰ Registration time recorded - 5 second cooldown active');

      setTimeout(() => {
        setDetectedPerson(null);
      }, 2000);
    }
  };

  // Ensure detection loop starts when scanner becomes active
  useEffect(() => {
    if (isScanning && videoRef.current) {
      console.log('🎬 Scanner state changed to active, starting detection...');
      setTimeout(() => drawVideoFrame(true), 100);
    }
  }, [isScanning]);

  // Auto-start camera after initialization
  useEffect(() => {
    if (!isLoading && !isScanning) {
      console.log('🚀 Auto-starting camera...');
      setTimeout(() => {
        startCamera();
      }, 500); // Smaller delay for immediate start
    }
  }, [isLoading]);

  // Handle app lifecycle changes (Android minimize/restore)
  useEffect(() => {
    const handleVisibilityChange = () => {
      console.log('👁️ Visibility changed, document.hidden:', document.hidden);

      if (!document.hidden && !isLoading) {
        // App came back into view - check camera status
        setTimeout(() => {
          const video = videoRef.current;
          if (video && (!video.srcObject || video.readyState === 0)) {
            console.log('🔄 Camera appears to be disconnected, restarting...');
            setSystemStatus('Reconnecting camera...');
            stopCamera();
            setTimeout(() => {
              startCamera();
            }, 500);
          } else if (video && video.paused) {
            console.log('▶️ Video was paused, attempting to resume...');
            video.play().catch(console.error);
          }
        }, 1000); // Give the app a moment to fully restore
      }
    };

    const handleWindowFocus = () => {
      console.log('🔍 Window focused');
      if (!isLoading && !document.hidden) {
        setTimeout(() => {
          const video = videoRef.current;
          if (video && video.readyState === 0) {
            console.log('🔄 Restarting camera after window focus...');
            stopCamera();
            setTimeout(() => startCamera(), 500);
          }
        }, 500);
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isLoading]);

  // Helper function to add member with automatic descriptor computation
  const addMemberWithDescriptor = async (memberData: Omit<Member, 'id' | 'created_at' | 'updated_at'>, precomputedDescriptor?: Float32Array) => {
    try {
      // Add member to database first
      const newMember = await addMember(memberData);

      // Use precomputed descriptor if provided, otherwise compute from photo
      if (precomputedDescriptor) {
        console.log(`💾 Using precomputed descriptor for new member: ${newMember.name}`);
        await updateMemberDescriptor(newMember.id, precomputedDescriptor);
        console.log(`✅ Precomputed descriptor saved for ${newMember.name}`);
      } else if (memberData.photo_url) {
        console.log(`🧮 Computing descriptor for new member: ${newMember.name}`);
        const descriptor = await computeDescriptorFromImage(memberData.photo_url);

        if (descriptor) {
          await updateMemberDescriptor(newMember.id, descriptor);
          console.log(`✅ Descriptor computed and saved for ${newMember.name}`);
        } else {
          console.log(`⚠️ Could not compute descriptor for ${newMember.name}`);
        }
      }

      // Reload optimized recognition cache
      await optimizedFaceRecognition.reloadMembers();
      console.log('🔄 Optimized recognition cache updated');

      return newMember;
    } catch (error) {
      console.error('❌ Error adding member with descriptor:', error);
      throw error;
    }
  };

  // Compute missing face descriptors for existing members
  const computeMissingDescriptors = async () => {
    try {
      console.log('🧮 Computing missing face descriptors...');

      const members = await getMembers();
      const membersNeedingDescriptors = members.filter(
        member => member.photo_url && !member.face_descriptor
      );

      console.log(`📊 Found ${membersNeedingDescriptors.length} members needing descriptors`);

      let processed = 0;
      for (const member of membersNeedingDescriptors) {
        try {
          processed++;
          setSystemStatus(`Computing descriptor ${processed}/${membersNeedingDescriptors.length}: ${member.name}`);

          if (member.photo_url) {
            const descriptor = await computeDescriptorFromImage(member.photo_url);

            if (descriptor) {
              await updateMemberDescriptor(member.id, descriptor);
              console.log(`✅ Computed descriptor for ${member.name}`);
            } else {
              console.log(`❌ Failed to compute descriptor for ${member.name}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error computing descriptor for ${member.name}:`, error);
        }
      }

      console.log(`✅ Completed descriptor computation: ${processed} members processed`);
    } catch (error) {
      console.error('❌ Error in computeMissingDescriptors:', error);
    }
  };

  const initializeScanner = async () => {
    setIsLoading(true);
    setSyncStatus('Initializing system...');
    setSystemStatus('Setting up face detection...');

    try {
      // Initialize face-api.js for proper face recognition
      console.log('🚀 Starting scanner initialization...');
      setSystemStatus('Initializing face-api.js...');
      await faceApiService.initialize();
      console.log('✅ face-api.js initialized successfully');

      // Initialize optimized face recognition service
      console.log('⚡ Initializing optimized face recognition...');
      setSystemStatus('Loading optimized face descriptors...');
      await optimizedFaceRecognition.initialize();

      const stats = optimizedFaceRecognition.getStats();
      console.log(`✅ Optimized face recognition initialized: ${stats.membersWithDescriptors} members with descriptors`);

      // Check if any members need descriptor computation
      const needingDescriptors = await getMembersNeedingDescriptors();
      if (needingDescriptors > 0) {
        console.log(`⚠️ ${needingDescriptors} members need descriptor computation`);
        setSystemStatus(`Computing descriptors for ${needingDescriptors} members...`);
        await computeMissingDescriptors();
        await optimizedFaceRecognition.reloadMembers();
      }

      // Preload members from Supabase
      console.log('📡 Starting member preloading...');
      await preloadMembersFromSupabase();
      console.log('✅ Member preloading completed');

      // Initialize fallback face detection
      const detectionReady = await initializeFaceDetection();
      console.log('🔍 Fallback face detection initialized:', detectionReady);

      setSystemStatus('Loading faces from database...');

      // Load from database and populate local cache
      const dbMembers = await getMembers();
      console.log('📊 Loaded from database:', dbMembers.length, 'members');

      // Convert database members to local format AND local cache
      const localFaces: LocalFaceData[] = dbMembers
        .filter(member => member.photo_url) // Only members with photos
        .map(member => ({
          id: `local_${member.id}`,
          name: member.name,
          image: member.photo_url!,
          timestamp: member.created_at,
          supabaseId: member.id
        }));

      // Convert to local cache entries (marked as synced since they're from DB)
      const cacheEntries: LocalCacheEntry[] = localFaces.map(face => ({
        id: `cache_db_${face.supabaseId}`,
        name: face.name,
        image: face.image,
        timestamp: face.timestamp,
        captureTime: new Date(face.timestamp).getTime(),
        synced: true, // Already in database
        descriptor: undefined // Will be extracted when needed for matching
      }));

      // Save to localStorage for offline access
      localStorage.setItem('simpleFaces', JSON.stringify(localFaces));
      setKnownFaces(localFaces);

      // Populate local cache with existing database faces
      setLocalFaceCache(prev => {
        // Merge with existing cache, avoiding duplicates
        const existingIds = new Set(prev.map(entry => entry.id));
        const newEntries = cacheEntries.filter(entry => !existingIds.has(entry.id));
        const merged = [...prev, ...newEntries];
        console.log(`🗄️ Local cache populated with ${newEntries.length} database faces. Total cache: ${merged.length}`);
        return merged;
      });

      setSyncStatus('Database synced');
      setSystemStatus(`Loaded ${localFaces.length} faces from database`);

    } catch (error) {
      console.error('Database load failed, trying localStorage:', error);

      // Fallback to localStorage if database fails
      await loadFromLocalStorage();
      setSyncStatus('Offline mode');
    }

    setIsLoading(false);
  };

  const initializeFaceDetection = async () => {
    try {
      console.log('🔍 Initializing face detection...');

      // Check if Face Detection API is available
      if ('FaceDetector' in window) {
        try {
          const detector = new (window as any).FaceDetector({
            maxDetectedFaces: 3,
            fastMode: true // Use fast mode for better performance
          });

          // Test the detector to make sure it works
          setFaceDetector(detector);
          console.log('✅ Native Face Detection API initialized and ready');
          setSystemStatus('Native face detection ready');
          return true;
        } catch (detectorError) {
          console.error('Native face detector creation failed:', detectorError);
        }
      }

      // Fallback mode
      console.log('⚠️ Face Detection API not available, initializing fallback detection');
      setSystemStatus('Fallback face detection ready');
      setFaceDetector(null); // Explicitly set to null for fallback
      return true;

    } catch (error) {
      console.error('Face detection initialization failed:', error);
      setSystemStatus('Basic face detection mode');
      setFaceDetector(null);
      return true; // Still continue with fallback
    }
  };

  const loadFromLocalStorage = async () => {
    try {
      const storedFaces = localStorage.getItem('simpleFaces');
      if (storedFaces) {
        const faces: LocalFaceData[] = JSON.parse(storedFaces);
        setKnownFaces(faces);
        setSystemStatus(`Loaded ${faces.length} faces from local storage`);
      } else {
        setSystemStatus('No faces found - ready to register new faces');
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      setSystemStatus(`Error loading faces: ${error}`);
    }
  };

  const saveKnownFaces = (faces: LocalFaceData[]) => {
    try {
      localStorage.setItem('simpleFaces', JSON.stringify(faces));
      setSystemStatus(`Saved ${faces.length} faces to local storage`);
    } catch (error) {
      console.error('Error saving faces:', error);
    }
  };

  const startCamera = async () => {
    try {
      setSystemStatus('Starting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          console.log('✅ Video metadata loaded, initializing detection...');
          setIsScanning(true);
          setSystemStatus('Camera ready - face detection active');

          // Start the video frame processing immediately with force flag
          setTimeout(() => {
            console.log('🎬 Starting video frame processing (forced)...');
            drawVideoFrame(true); // Force active to bypass race condition
          }, 100);

          // Force restart detection loop after 2 seconds if it seems stuck
          setTimeout(() => {
            console.log('🔄 Ensuring detection loop is active...');
            drawVideoFrame(true);
          }, 2000);
        };

        // Also trigger on canplay as fallback
        videoRef.current.oncanplay = () => {
          console.log('✅ Video canplay triggered');
          console.log('🎬 Starting detection from canplay (forced)...');
          setIsScanning(true);
          setSystemStatus('Camera ready - face detection active');
          // Force start immediately
          setTimeout(() => drawVideoFrame(true), 50);
        };

        // Additional safety trigger when video starts playing
        videoRef.current.onplaying = () => {
          console.log('▶️ Video is now playing');
          setIsScanning(true);
          setTimeout(() => drawVideoFrame(true), 50);
        };
      }
    } catch (error) {
      console.error('Camera error:', error);
      setSystemStatus(`Camera error: ${error}`);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    setDetectedPerson(null);
    setSystemStatus('Camera stopped');
    // Removed processing states
  };

  const drawVideoFrame = async (forceActive = false) => {
    if (!videoRef.current || !canvasRef.current) {
      console.log('❌ Video or canvas not available');
      return;
    }

    // Allow forcing active state to bypass race condition
    if (!isScanning && !forceActive) {
      console.log('❌ Scanner not active, isScanning:', isScanning);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Check video readiness - be more permissive
    if (ctx && video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
      // Removed per-frame logging to prevent spam
      // Set canvas size to match video dimensions
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      canvas.width = videoWidth;
      canvas.height = videoHeight;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // No automatic face detection - only show camera feed
      const faces: any[] = [];
      setDetectedFaces([]);

      // Analyze face quality
      let quality = { score: 0, status: 'No face detected' };
      if (faces.length > 0) {
        quality = analyzeFaceQualityWithDetection(video, faces[0]);
      } else {
        // Fallback to center region analysis when no face detected
        quality = analyzeFaceQuality(video, ctx);
      }

      setFaceQuality(quality.score);
      setQualityStatus(quality.status);

      // Draw dynamic bounding boxes for detected faces
      ctx.save();

      if (faces.length > 0) {
        faces.forEach((face, index) => {
          const bounds = face.boundingBox || face;

          // Color based on quality
          let boxColor = '#ff0000'; // Red - poor quality
          if (quality.score > 80) boxColor = '#00ff00'; // Green - perfect quality
          else if (quality.score > 60) boxColor = '#ffff00'; // Yellow - medium quality
          else if (quality.score > 40) boxColor = '#ffa500'; // Orange - low quality

          // Draw main bounding box with rounded corners effect
          ctx.strokeStyle = boxColor;
          ctx.lineWidth = 3;
          ctx.setLineDash([8, 4]);

          const boxX = bounds.x || bounds.left || bounds.x;
          const boxY = bounds.y || bounds.top || bounds.y;
          const boxWidth = bounds.width;
          const boxHeight = bounds.height;

          // Ensure valid coordinates
          if (boxX >= 0 && boxY >= 0 && boxWidth > 0 && boxHeight > 0) {
            ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

            // Draw animated corner markers
            ctx.setLineDash([]);
            ctx.lineWidth = 4;
            const cornerSize = Math.min(25, Math.max(15, boxWidth * 0.12));

            // Animated corner markers with glow effect
            ctx.shadowColor = boxColor;
            ctx.shadowBlur = 10;

            // Top-left corner
            ctx.beginPath();
            ctx.moveTo(boxX, boxY + cornerSize);
            ctx.lineTo(boxX, boxY);
            ctx.lineTo(boxX + cornerSize, boxY);
            ctx.stroke();

            // Top-right corner
            ctx.beginPath();
            ctx.moveTo(boxX + boxWidth - cornerSize, boxY);
            ctx.lineTo(boxX + boxWidth, boxY);
            ctx.lineTo(boxX + boxWidth, boxY + cornerSize);
            ctx.stroke();

            // Bottom-left corner
            ctx.beginPath();
            ctx.moveTo(boxX, boxY + boxHeight - cornerSize);
            ctx.lineTo(boxX, boxY + boxHeight);
            ctx.lineTo(boxX + cornerSize, boxY + boxHeight);
            ctx.stroke();

            // Bottom-right corner
            ctx.beginPath();
            ctx.moveTo(boxX + boxWidth - cornerSize, boxY + boxHeight);
            ctx.lineTo(boxX + boxWidth, boxY + boxHeight);
            ctx.lineTo(boxX + boxWidth, boxY + boxHeight - cornerSize);
            ctx.stroke();

            // Reset shadow
            ctx.shadowBlur = 0;

            // Add center crosshair
            const centerX = boxX + boxWidth / 2;
            const centerY = boxY + boxHeight / 2;
            const crossSize = 8;

            ctx.strokeStyle = boxColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(centerX - crossSize, centerY);
            ctx.lineTo(centerX + crossSize, centerY);
            ctx.moveTo(centerX, centerY - crossSize);
            ctx.lineTo(centerX, centerY + crossSize);
            ctx.stroke();

            // Add quality indicator text with background (compensate for mirroring)
            ctx.save();
            ctx.scale(-1, 1); // Flip text back to normal
            ctx.translate(-canvas.width, 0);

            const mirrorCenterX = canvas.width - centerX; // Mirror the X position

            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            const textY = boxY - 35;
            const statusText = 'Ready to capture';
            const textWidth = ctx.measureText(statusText).width + 20;
            ctx.fillRect(mirrorCenterX - textWidth/2, textY - 20, textWidth, 25);

            ctx.fillStyle = boxColor;
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(statusText, mirrorCenterX, textY - 5);

            // Quality score at bottom
            ctx.font = '12px Arial';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(mirrorCenterX - 30, boxY + boxHeight + 5, 60, 18);
            ctx.fillStyle = boxColor;
            ctx.fillText(`${quality.score}%`, mirrorCenterX, boxY + boxHeight + 18);

            ctx.restore();

            // Face tracking indicator
            if (index === 0) { // Primary face
              ctx.strokeStyle = boxColor;
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 2]);
              // Draw tracking lines to show movement direction
              const trackingRadius = Math.max(boxWidth, boxHeight) * 0.6;
              ctx.beginPath();
              ctx.arc(centerX, centerY, trackingRadius, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        });
      } else {
        // No face detected - show improved guide
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const guideWidth = Math.min(canvas.width, canvas.height) * 0.45;
        const guideHeight = guideWidth * 1.3; // Face aspect ratio

        // Animated guide box
        const pulseIntensity = 0.5 + 0.5 * Math.sin(Date.now() * 0.003);
        ctx.strokeStyle = `rgba(136, 136, 136, ${pulseIntensity})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([15, 10]);

        const guideX = centerX - guideWidth / 2;
        const guideY = centerY - guideHeight / 2;

        ctx.strokeRect(guideX, guideY, guideWidth, guideHeight);

        // Corner guides
        ctx.setLineDash([]);
        ctx.lineWidth = 3;
        const cornerSize = 20;

        // Draw corner markers for guidance
        [[guideX, guideY], [guideX + guideWidth, guideY],
         [guideX, guideY + guideHeight], [guideX + guideWidth, guideY + guideHeight]].forEach(([x, y], i) => {
          ctx.beginPath();
          if (i === 0) { // Top-left
            ctx.moveTo(x, y + cornerSize);
            ctx.lineTo(x, y);
            ctx.lineTo(x + cornerSize, y);
          } else if (i === 1) { // Top-right
            ctx.moveTo(x - cornerSize, y);
            ctx.lineTo(x, y);
            ctx.lineTo(x, y + cornerSize);
          } else if (i === 2) { // Bottom-left
            ctx.moveTo(x, y - cornerSize);
            ctx.lineTo(x, y);
            ctx.lineTo(x + cornerSize, y);
          } else { // Bottom-right
            ctx.moveTo(x - cornerSize, y);
            ctx.lineTo(x, y);
            ctx.lineTo(x, y - cornerSize);
          }
          ctx.stroke();
        });

        // Instruction text with background (compensate for mirroring)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.translate(-canvas.width, 0);

        const mirrorCenterX = canvas.width - centerX;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(mirrorCenterX - 120, centerY - guideHeight/2 - 40, 240, 25);

        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Position your face in the frame', mirrorCenterX, centerY - guideHeight/2 - 22);

        ctx.restore();

        // Center crosshair for alignment
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        const crossSize = 15;
        ctx.beginPath();
        ctx.moveTo(centerX - crossSize, centerY);
        ctx.lineTo(centerX + crossSize, centerY);
        ctx.moveTo(centerX, centerY - crossSize);
        ctx.lineTo(centerX, centerY + crossSize);
        ctx.stroke();
      }

      ctx.restore();

      // State machine auto-capture logic - prevent multiple simultaneous captures
      const captureTime = Date.now();
      const timeSinceLastRegistration = captureTime - lastRegistrationTime;
      const canCaptureAgain = timeSinceLastRegistration > 5000; // 5 second delay
      const isIdle = processingState === 'idle' && !processingLock;

      // CRITICAL FIX: Check all conditions synchronously first, then do async check
      // Also check if dialog is open - don't capture while dialog is showing
      const isDialogOpen = showAnalysisDialog;

      // IMMEDIATE STOP: If any processing is happening, don't even consider capturing
      if (processingLock || processingState !== 'idle' || isDialogOpen) {
        // System is busy - don't capture
        if (quality.score > 78) {
          setQualityStatus('Processing in progress - please wait...');
        }
        return; // Exit early to prevent any capture attempts
      }

      // Removed automatic capture - only manual capture now
      if (false) {
        console.log('🔍 Basic conditions met, checking for recent similar captures...');

        // Set processing lock IMMEDIATELY to prevent race conditions
        setProcessingLock(true);
        setProcessingState('capturing');

        // CRITICAL: Capture frame IMMEDIATELY while user is still at 79% position
        console.log('📸 IMMEDIATE CAPTURE: Freezing frame at exact 79% moment...');
        const immediateCapture = await captureCurrentFrameImmediately();

        if (!immediateCapture) {
          console.error('❌ IMMEDIATE CAPTURE FAILED - aborting');
          setProcessingLock(false);
          setProcessingState('idle');
          return;
        }

        console.log('✅ IMMEDIATE CAPTURE SUCCESS - Frame frozen from 79% position');
        setCapturedImage(immediateCapture); // Store the captured frame immediately

        // Now do the async check
        const hasRecentSimilarCapture = await checkForRecentSimilarCapture();

        if (!hasRecentSimilarCapture) {
          console.log('🚀 All conditions met - STARTING MANUAL ANALYSIS');
          console.log('📈 Quality Score:', quality.score, '%');
          // Pass the pre-captured image to avoid recapturing
          handleManualFaceProcessingWithImage(quality.score, immediateCapture);
        } else {
          console.log('🚫 Recent similar capture detected - releasing lock and skipping');
          // Release lock if we skip due to similar capture
          setProcessingLock(false);
          setProcessingState('idle');
        }
      } else if (isDialogOpen) {
        // Dialog is open - pause processing
        setQualityStatus('Dialog open - camera paused');
      } else if (!canCaptureAgain) {
        // Show remaining time until next capture allowed
        const remainingTime = Math.ceil((5000 - timeSinceLastRegistration) / 1000);
        setQualityStatus(`Wait ${remainingTime}s before next scan`);
      } else if (!isIdle) {
        // Show processing state
        setQualityStatus(getProcessingStatusMessage());
      }

      // Track good quality for backup capture (check original idle state and dialog not open)
      const originalIsIdle = processingState === 'idle' && !processingLock;
      if (faces.length > 0 && quality.score > 78 && !detectedPerson && originalIsIdle && !isDialogOpen) {
        setLastGoodQualityTime(captureTime);
      }

    } else {
      // Video not ready yet, but continue trying
      // Removed video not ready logs to prevent spam
    }

    // Continue animation loop - NEVER stop the frame loop
    if (isScanning || forceActive) {
      requestAnimationFrame(() => drawVideoFrame());
    } else {
      console.log('⏹️ Animation loop stopped, scanner inactive');
      // Force restart if we somehow get stuck
      setTimeout(() => {
        if (videoRef.current && !isScanning) {
          console.log('🔄 Force restarting animation loop after 2 seconds');
          setIsScanning(true);
          drawVideoFrame(true);
        }
      }, 2000);
    }
  };

  // Basic face detection fallback using improved canvas analysis
  const detectFacesBasic = async (video: HTMLVideoElement) => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) return [];

    // Use higher resolution for better detection but still maintain performance
    const scale = 0.4;
    tempCanvas.width = video.videoWidth * scale;
    tempCanvas.height = video.videoHeight * scale;

    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;

    // Multi-scale face detection approach
    const faceRegions = [];
    const minBlockSize = 20;
    const maxBlockSize = 60;
    const stepSize = 8; // Overlap for better coverage

    // Scan at multiple scales
    for (let blockSize = minBlockSize; blockSize <= maxBlockSize; blockSize += 10) {
      for (let y = 0; y <= tempCanvas.height - blockSize; y += stepSize) {
        for (let x = 0; x <= tempCanvas.width - blockSize; x += stepSize) {

          let totalBrightness = 0;
          let edgeCount = 0;
          let skinPixels = 0;
          let contrastSum = 0;
          let pixelCount = 0;

          // Analyze block with skin tone detection and edge analysis
          for (let dy = 1; dy < blockSize - 1; dy++) {
            for (let dx = 1; dx < blockSize - 1; dx++) {
              const i = ((y + dy) * tempCanvas.width + (x + dx)) * 4;
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];

              const brightness = (r + g + b) / 3;
              totalBrightness += brightness;

              // More restrictive skin tone detection to avoid hands
              if (r > 85 && r < 220 && g > 50 && g < 180 && b > 40 && b < 140 &&
                  r > g && r > b && // Red channel dominance
                  (r - g) > 10 && (r - g) < 80 && // Reasonable red-green difference
                  Math.max(r, g, b) - Math.min(r, g, b) > 15 && // Some color variation
                  Math.max(r, g, b) - Math.min(r, g, b) < 100) { // But not too much
                skinPixels++;
              }

              // Enhanced edge detection
              if (dx > 0 && dy > 0 && dx < blockSize - 1 && dy < blockSize - 1) {
                const rightI = ((y + dy) * tempCanvas.width + (x + dx + 1)) * 4;
                const bottomI = ((y + dy + 1) * tempCanvas.width + (x + dx)) * 4;
                const rightBrightness = (data[rightI] + data[rightI + 1] + data[rightI + 2]) / 3;
                const bottomBrightness = (data[bottomI] + data[bottomI + 1] + data[bottomI + 2]) / 3;

                const hEdge = Math.abs(brightness - rightBrightness);
                const vEdge = Math.abs(brightness - bottomBrightness);
                const edgeStrength = Math.sqrt(hEdge * hEdge + vEdge * vEdge);

                if (edgeStrength > 25) edgeCount++;
                contrastSum += edgeStrength;
              }
              pixelCount++;
            }
          }

          const avgBrightness = totalBrightness / pixelCount;
          const edgeRatio = edgeCount / pixelCount;
          const skinRatio = skinPixels / pixelCount;
          const avgContrast = contrastSum / pixelCount;

          // Face-like criteria with multiple checks - make very permissive for debugging
          const brightnessOk = avgBrightness > 40 && avgBrightness < 250; // Much wider brightness range
          const edgeOk = edgeRatio > 0.05 && edgeRatio < 0.6; // More permissive edge detection
          const skinOk = skinRatio > 0.05; // Lower skin requirement
          const contrastOk = avgContrast > 8; // Lower contrast requirement
          const sizeOk = blockSize >= 20; // Smaller minimum size

          // Removed excessive debug logging to prevent console spam

          if (brightnessOk && edgeOk && skinOk && contrastOk && sizeOk) {
            // Calculate confidence based on multiple factors
            const brightnessScore = 1 - Math.abs(avgBrightness - 140) / 140; // Optimal around 140
            const edgeScore = Math.min(1, edgeRatio * 8);
            const skinScore = Math.min(1, skinRatio * 4);
            const contrastScore = Math.min(1, avgContrast / 60);
            const sizeScore = Math.min(1, blockSize / 50);

            const confidence = (brightnessScore + edgeScore + skinScore + contrastScore + sizeScore) / 5;

            // Position in center areas gets bonus (faces usually in center)
            const centerX = tempCanvas.width / 2;
            const centerY = tempCanvas.height / 2;
            const regionCenterX = x + blockSize / 2;
            const regionCenterY = y + blockSize / 2;
            const distFromCenter = Math.sqrt(
              Math.pow(regionCenterX - centerX, 2) + Math.pow(regionCenterY - centerY, 2)
            );
            const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
            const centerBonus = 1 - (distFromCenter / maxDist) * 0.3; // Up to 30% bonus for center

            const finalConfidence = confidence * centerBonus;

            // Face aspect ratio check - faces are taller than wide
            const faceWidth = blockSize / scale;
            const faceHeight = (blockSize * 1.2) / scale;
            const aspectRatio = faceHeight / faceWidth;

            // Debug what's being filtered out
            const aspectOk = aspectRatio >= 1.0 && aspectRatio <= 1.8; // More lenient aspect ratio
            const sizeOk = faceWidth >= 25 && faceHeight >= 25; // Lower minimum face size
            const qualityOk = finalConfidence > 0.3 && skinRatio > 0.08; // Lower confidence and skin thresholds

            // Removed detection candidate logging to prevent spam

            if (aspectOk && sizeOk && qualityOk) {
              faceRegions.push({
                x: x / scale,
                y: y / scale,
                width: faceWidth,
                height: faceHeight,
                confidence: finalConfidence,
                aspectRatio,
                rawData: {
                  brightness: avgBrightness,
                  edges: edgeRatio,
                  skin: skinRatio,
                  contrast: avgContrast
                }
              });
            }
          }
        }
      }
    }

    // Remove overlapping detections (Non-Maximum Suppression)
    const filteredRegions = [];
    faceRegions.sort((a, b) => b.confidence - a.confidence);

    for (const region of faceRegions) {
      let overlaps = false;
      for (const existing of filteredRegions) {
        const overlapX = Math.max(0, Math.min(region.x + region.width, existing.x + existing.width) - Math.max(region.x, existing.x));
        const overlapY = Math.max(0, Math.min(region.y + region.height, existing.y + existing.height) - Math.max(region.y, existing.y));
        const overlapArea = overlapX * overlapY;
        const regionArea = region.width * region.height;
        const existingArea = existing.width * existing.height;
        const overlapRatio = overlapArea / Math.min(regionArea, existingArea);

        if (overlapRatio > 0.3) { // 30% overlap threshold
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        filteredRegions.push(region);
      }
    }

    // Removed all looping console logs

    // Return top 3 candidates
    return filteredRegions.slice(0, 3);
  };

  // Face tracking with smoothing for stable bounding boxes
  const smoothFaceDetections = (newFaces: any[]) => {
    if (newFaces.length === 0) {
      // Gradually fade out old detections
      const fadeTime = 500; // ms
      const currentTime = Date.now();

      const fadedHistory = faceHistory
        .map(face => ({
          ...face,
          age: currentTime - face.timestamp,
          opacity: Math.max(0, 1 - (currentTime - face.timestamp) / fadeTime)
        }))
        .filter(face => face.age < fadeTime);

      setFaceHistory(fadedHistory);
      return fadedHistory.length > 0 ? [fadedHistory[0]] : [];
    }

    const smoothedFaces = [];
    const smoothingFactor = 0.3; // 0 = no smoothing, 1 = no tracking
    const maxTrackingDistance = 100; // pixels

    for (const newFace of newFaces) {
      const newBounds = newFace.boundingBox || newFace;
      const newCenterX = (newBounds.x || newBounds.left || 0) + (newBounds.width || 0) / 2;
      const newCenterY = (newBounds.y || newBounds.top || 0) + (newBounds.height || 0) / 2;

      // Find closest face in history for tracking
      let bestMatch = null;
      let minDistance = Infinity;

      for (const historyFace of faceHistory) {
        if (Date.now() - historyFace.timestamp > 1000) continue; // Ignore old faces

        const histBounds = historyFace.boundingBox || historyFace;
        const histCenterX = (histBounds.x || histBounds.left || 0) + (histBounds.width || 0) / 2;
        const histCenterY = (histBounds.y || histBounds.top || 0) + (histBounds.height || 0) / 2;

        const distance = Math.sqrt(
          Math.pow(newCenterX - histCenterX, 2) + Math.pow(newCenterY - histCenterY, 2)
        );

        if (distance < minDistance && distance < maxTrackingDistance) {
          minDistance = distance;
          bestMatch = historyFace;
        }
      }

      let smoothedFace;
      if (bestMatch) {
        // Smooth the transition from previous detection
        const prevBounds = bestMatch.boundingBox || bestMatch;
        const prevX = prevBounds.x || prevBounds.left || 0;
        const prevY = prevBounds.y || prevBounds.top || 0;
        const prevWidth = prevBounds.width || 0;
        const prevHeight = prevBounds.height || 0;

        const currentX = newBounds.x || newBounds.left || 0;
        const currentY = newBounds.y || newBounds.top || 0;
        const currentWidth = newBounds.width || 0;
        const currentHeight = newBounds.height || 0;

        // Apply exponential smoothing
        const smoothX = prevX + smoothingFactor * (currentX - prevX);
        const smoothY = prevY + smoothingFactor * (currentY - prevY);
        const smoothWidth = prevWidth + smoothingFactor * (currentWidth - prevWidth);
        const smoothHeight = prevHeight + smoothingFactor * (currentHeight - prevHeight);

        smoothedFace = {
          ...newFace,
          boundingBox: {
            x: smoothX,
            y: smoothY,
            width: smoothWidth,
            height: smoothHeight,
            left: smoothX,
            top: smoothY
          },
          x: smoothX,
          y: smoothY,
          width: smoothWidth,
          height: smoothHeight,
          trackingId: bestMatch.trackingId || Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          confidence: (bestMatch.confidence || 0) * 0.7 + (newFace.confidence || 0.5) * 0.3,
          isTracked: true
        };
      } else {
        // New face detection
        smoothedFace = {
          ...newFace,
          trackingId: Math.random().toString(36).substr(2, 9),
          timestamp: Date.now(),
          isTracked: false,
          confidence: newFace.confidence || 0.5
        };
      }

      smoothedFaces.push(smoothedFace);
    }

    // Update face history
    const currentTime = Date.now();
    const updatedHistory = smoothedFaces.concat(
      faceHistory.filter(face => currentTime - face.timestamp < 2000) // Keep 2 seconds of history
    );

    setFaceHistory(updatedHistory);
    return smoothedFaces;
  };

  // Filter to get only the best face detection (avoid hands/false positives)
  const filterBestFace = (faces: any[]) => {
    if (faces.length === 0) return faces;

    // Score each face based on multiple criteria
    const scoredFaces = faces.map(face => {
      const bounds = face.boundingBox || face;
      const faceX = bounds.x || bounds.left || 0;
      const faceY = bounds.y || bounds.top || 0;
      const faceWidth = bounds.width || 0;
      const faceHeight = bounds.height || 0;

      // Calculate face area
      const area = faceWidth * faceHeight;

      // Face aspect ratio should be around 1.0-1.5 (height/width) - more lenient
      const aspectRatio = faceHeight / faceWidth;
      const aspectScore = aspectRatio >= 0.8 && aspectRatio <= 1.6 ? 1 : Math.max(0, 1 - Math.abs(aspectRatio - 1.2) / 0.6);

      // Prefer faces in center area (where people usually position their face)
      const videoWidth = videoRef.current?.videoWidth || 640;
      const videoHeight = videoRef.current?.videoHeight || 480;
      const centerX = videoWidth / 2;
      const centerY = videoHeight / 2;
      const faceCenterX = faceX + faceWidth / 2;
      const faceCenterY = faceY + faceHeight / 2;

      const distanceFromCenter = Math.sqrt(
        Math.pow(faceCenterX - centerX, 2) + Math.pow(faceCenterY - centerY, 2)
      );
      const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
      const centerScore = 1 - (distanceFromCenter / maxDistance);

      // Size score - prefer larger faces (real faces vs hands)
      const minFaceSize = 20; // Lower minimum reasonable face size
      const sizeScore = faceWidth >= minFaceSize && faceHeight >= minFaceSize ?
        Math.min(1, area / (60 * 60)) : 0; // Lower baseline for size scoring

      // Position score - faces are usually in upper 2/3 of frame
      const positionScore = faceY < (videoHeight * 0.75) ? 1 : 0.5;

      // Confidence score from detection
      const confidenceScore = face.confidence || 0.5;

      // Stability score - prefer faces that have been tracked (less jittery)
      const stabilityScore = face.isTracked ? 1 : 0.7;

      const totalScore = (
        aspectScore * 0.25 +
        centerScore * 0.2 +
        sizeScore * 0.25 +
        positionScore * 0.1 +
        confidenceScore * 0.1 +
        stabilityScore * 0.1
      );

      // Removed face scoring logs to prevent spam

      return {
        ...face,
        totalScore,
        area,
        aspectRatio,
        debug: {
          aspectScore: aspectScore.toFixed(2),
          centerScore: centerScore.toFixed(2),
          sizeScore: sizeScore.toFixed(2),
          positionScore,
          confidenceScore: confidenceScore.toFixed(2),
          stabilityScore
        }
      };
    });

    // Sort by score and return only the best face
    scoredFaces.sort((a, b) => b.totalScore - a.totalScore);

    // Only return faces with reasonable scores (filter out obvious false positives)
    const bestFace = scoredFaces[0];
    if (bestFace.totalScore > 0.15) { // Much lower threshold to allow more detections
      return [bestFace];
    } else {
      return [];
    }
  };

  const analyzeFaceQualityWithDetection = (video: HTMLVideoElement, face: any) => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) return { score: 0, status: 'Analysis failed' };

    // Get face bounds with validation
    const bounds = face.boundingBox || face;
    let faceX = bounds.x || bounds.left || 0;
    let faceY = bounds.y || bounds.top || 0;
    let faceWidth = bounds.width || 100;
    let faceHeight = bounds.height || 120;

    // Ensure bounds are within video dimensions
    faceX = Math.max(0, Math.min(faceX, video.videoWidth - 1));
    faceY = Math.max(0, Math.min(faceY, video.videoHeight - 1));
    faceWidth = Math.max(20, Math.min(faceWidth, video.videoWidth - faceX));
    faceHeight = Math.max(24, Math.min(faceHeight, video.videoHeight - faceY));

    // Use smaller analysis size for better performance
    const analysisSize = 64;
    tempCanvas.width = tempCanvas.height = analysisSize;

    try {
      tempCtx.drawImage(
        video,
        faceX, faceY, faceWidth, faceHeight,
        0, 0, analysisSize, analysisSize
      );
    } catch (error) {
      console.warn('Face region extraction failed, using fallback');
      return analyzeFaceQuality(video, tempCtx);
    }

    // Get image data
    const imageData = tempCtx.getImageData(0, 0, analysisSize, analysisSize);
    const data = imageData.data;

    let totalBrightness = 0;
    let totalContrast = 0;
    let edgePixels = 0;
    let skinPixels = 0;
    let totalPixels = 0;

    // Define facial regions for weighted analysis
    const regions = {
      eyes: { startY: Math.floor(analysisSize * 0.15), endY: Math.floor(analysisSize * 0.45), weight: 3.0 },
      nose: { startY: Math.floor(analysisSize * 0.35), endY: Math.floor(analysisSize * 0.65), weight: 2.0 },
      mouth: { startY: Math.floor(analysisSize * 0.55), endY: Math.floor(analysisSize * 0.85), weight: 2.0 },
      overall: { startY: 0, endY: analysisSize, weight: 1.0 }
    };

    // Fast pixel analysis with region weighting
    for (let y = 1; y < analysisSize - 1; y++) {
      for (let x = 1; x < analysisSize - 1; x++) {
        const i = (y * analysisSize + x) * 4;

        const r = data[i], g = data[i + 1], b = data[i + 2];
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;

        // Fast edge detection
        const rightI = (y * analysisSize + x + 1) * 4;
        const bottomI = ((y + 1) * analysisSize + x) * 4;

        const edgeH = Math.abs(r - data[rightI]) + Math.abs(g - data[rightI + 1]) + Math.abs(b - data[rightI + 2]);
        const edgeV = Math.abs(r - data[bottomI]) + Math.abs(g - data[bottomI + 1]) + Math.abs(b - data[bottomI + 2]);
        const edgeStrength = edgeH + edgeV;

        totalContrast += edgeStrength;
        if (edgeStrength > 50) edgePixels++;

        // Basic skin detection
        if (r > 85 && g > 35 && b > 15 && r > g && r > b && (r - g) > 10) {
          skinPixels++;
        }

        totalPixels++;
      }
    }

    // Calculate base metrics
    const avgBrightness = totalBrightness / totalPixels;
    const avgContrast = totalContrast / totalPixels;
    const edgeRatio = edgePixels / totalPixels;
    const skinRatio = skinPixels / totalPixels;

    // Face size quality (relative to video size)
    const faceArea = faceWidth * faceHeight;
    const videoArea = video.videoWidth * video.videoHeight;
    const sizeRatio = faceArea / videoArea;
    const sizeScore = Math.min(25, Math.max(5, sizeRatio * 2000));

    // Brightness quality (optimal: 90-170)
    const optimalBrightness = 130;
    const brightnessDeviation = Math.abs(avgBrightness - optimalBrightness);
    const brightnessScore = Math.max(0, 25 - (brightnessDeviation / 8));

    // Contrast/sharpness quality
    const contrastScore = Math.min(25, avgContrast / 8);

    // Edge definition quality
    const edgeScore = Math.min(15, edgeRatio * 100);

    // Skin tone presence (indicates actual face)
    const skinScore = Math.min(10, skinRatio * 50);

    // Calculate total score
    const totalScore = sizeScore + brightnessScore + contrastScore + edgeScore + skinScore;

    // Determine status with more responsive feedback
    let status = '';
    if (totalScore > 90) {
      status = 'Perfect - Auto capturing!';
    } else if (totalScore > 85) {
      status = 'Ready to capture!';
    } else if (totalScore > 75) {
      status = 'Almost ready...';
    } else if (totalScore > 65) {
      status = 'Good quality';
    } else if (totalScore > 50) {
      status = 'Getting better...';
    } else if (avgBrightness < 80) {
      status = 'Need more light';
    } else if (avgBrightness > 200) {
      status = 'Too bright';
    } else if (contrastScore < 15) {
      status = 'Hold camera steady';
    } else if (sizeScore < 12) {
      status = 'Move closer';
    } else if (skinRatio < 0.1) {
      status = 'Position face properly';
    } else {
      status = 'Improving...';
    }

    return {
      score: Math.round(Math.min(100, totalScore)),
      status,
      brightness: Math.round(avgBrightness),
      sharpness: Math.round(contrastScore),
      size: Math.round(sizeScore),
      debug: {
        skinRatio: skinRatio.toFixed(3),
        edgeRatio: edgeRatio.toFixed(3),
        faceArea: `${faceWidth}x${faceHeight}`,
        components: {
          size: Math.round(sizeScore),
          brightness: Math.round(brightnessScore),
          contrast: Math.round(contrastScore),
          edges: Math.round(edgeScore),
          skin: Math.round(skinScore)
        }
      }
    };
  };

  const analyzeFaceQuality = (video: HTMLVideoElement, ctx: CanvasRenderingContext2D) => {
    // Create a temporary canvas for analysis
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) return { score: 0, status: 'Analysis failed' };

    // Set analysis size (smaller for performance)
    const analysisSize = 64;
    tempCanvas.width = tempCanvas.height = analysisSize;

    // Draw face region to temp canvas
    const centerX = video.videoWidth / 2;
    const centerY = video.videoHeight / 2;
    const boxSize = Math.min(video.videoWidth, video.videoHeight) * 0.5;

    tempCtx.drawImage(
      video,
      centerX - boxSize/2, centerY - boxSize/2, boxSize, boxSize,
      0, 0, analysisSize, analysisSize
    );

    // Get image data
    const imageData = tempCtx.getImageData(0, 0, analysisSize, analysisSize);
    const data = imageData.data;

    let totalBrightness = 0;
    let edgeCount = 0;
    let contrastSum = 0;
    let pixelCount = 0;

    // Analyze brightness, edges, and contrast
    for (let y = 1; y < analysisSize - 1; y++) {
      for (let x = 1; x < analysisSize - 1; x++) {
        const i = (y * analysisSize + x) * 4;

        // Calculate brightness
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        totalBrightness += brightness;

        // Edge detection (simple gradient)
        const rightPixel = ((y * analysisSize + x + 1) * 4);
        const bottomPixel = (((y + 1) * analysisSize + x) * 4);

        const gradX = Math.abs((data[i] + data[i + 1] + data[i + 2]) - (data[rightPixel] + data[rightPixel + 1] + data[rightPixel + 2]));
        const gradY = Math.abs((data[i] + data[i + 1] + data[i + 2]) - (data[bottomPixel] + data[bottomPixel + 1] + data[bottomPixel + 2]));

        const edgeStrength = Math.sqrt(gradX * gradX + gradY * gradY);
        if (edgeStrength > 30) edgeCount++;

        contrastSum += edgeStrength;
        pixelCount++;
      }
    }

    // Calculate quality metrics
    const avgBrightness = totalBrightness / pixelCount;
    const edgeRatio = edgeCount / pixelCount;
    const avgContrast = contrastSum / pixelCount;

    // Quality scoring
    let qualityScore = 0;
    let status = '';

    // Brightness score (optimal range: 80-180)
    const brightnessScore = avgBrightness >= 80 && avgBrightness <= 180 ? 30 : Math.max(0, 30 - Math.abs(avgBrightness - 130) / 3);

    // Edge/sharpness score
    const edgeScore = Math.min(40, edgeRatio * 1000);

    // Contrast score
    const contrastScore = Math.min(30, avgContrast / 2);

    qualityScore = brightnessScore + edgeScore + contrastScore;

    // Determine status
    if (qualityScore > 75) {
      status = 'Perfect quality - Ready to capture!';
    } else if (qualityScore > 60) {
      status = 'Good quality';
    } else if (qualityScore > 40) {
      status = 'Improve lighting or focus';
    } else if (avgBrightness < 60) {
      status = 'Too dark - need more light';
    } else if (avgBrightness > 200) {
      status = 'Too bright - reduce lighting';
    } else if (edgeScore < 15) {
      status = 'Blurry - hold steady';
    } else {
      status = 'Position face properly';
    }

    return {
      score: Math.round(qualityScore),
      status,
      brightness: Math.round(avgBrightness),
      edges: Math.round(edgeScore),
      contrast: Math.round(contrastScore)
    };
  };

  // Get processing status message for UI
  const getProcessingStatusMessage = () => {
    switch (processingState) {
      case 'capturing': return 'Capturing face...';
      case 'matching': return 'Checking database...';
      case 'registering': return 'Registering new person...';
      default: return 'Processing...';
    }
  };

  // Manual capture function
  const handleManualCapture = async () => {
    if (!videoRef.current || !canvasRef.current || processingLock) {
      return;
    }

    console.log('📸 Manual capture initiated');
    setIsCaptureMode(true);
    setProcessingLock(true);
    setSystemStatus('Capturing face...');

    try {
      // Capture current frame
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');

      if (!ctx) throw new Error('Could not get canvas context');

      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;

      // Mirror the captured image horizontally for natural selfie view
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -tempCanvas.width, 0, tempCanvas.width, tempCanvas.height);
      ctx.restore();

      // Get base64 image
      const capturedImageData = tempCanvas.toDataURL('image/jpeg', 0.8);
      setCapturedFaceImage(capturedImageData);

      console.log('✅ Face captured, fetching members...');
      setSystemStatus('Loading member database...');

      // Fetch members from database
      await fetchAndMatchMembers(capturedImageData);

    } catch (error) {
      console.error('❌ Capture failed:', error);
      setSystemStatus('Capture failed. Please try again.');
    } finally {
      setIsCaptureMode(false);
      setProcessingLock(false);
    }
  };

  // Optimized face matching using pre-computed descriptors
  const fetchAndMatchMembers = async (capturedImage: string) => {
    try {
      setSystemStatus('Computing face descriptor...');

      // Step 1: Compute descriptor from captured image
      const descriptor = await computeDescriptorFromVideo(videoRef.current!);

      if (!descriptor) {
        setSystemStatus('No face detected. Please try again.');
        return;
      }

      console.log('✅ Face descriptor computed, starting optimized recognition...');
      setSystemStatus('Recognizing face...');

      // Store descriptor for potential registration
      setCapturedFaceDescriptor(descriptor);

      // Step 2: Use optimized face recognition (ultra-fast!)
      const result = await optimizedFaceRecognition.recognizeFace(descriptor);

      console.log(`⚡ Recognition completed in ${result.processingTimeMs.toFixed(1)}ms`);

      if (result.member && result.confidence > 70) {
        // Match found! Show matching dialog or handle directly based on confidence
        const member = result.member;
        const confidence = result.confidence / 100; // Convert to 0-1 scale for consistency

        console.log(`✅ OPTIMIZED MATCH: ${member.name} (${result.confidence.toFixed(1)}% confidence)`);

        // Convert OptimizedMember to regular Member format for compatibility
        const fullMember: Member = {
          id: member.id,
          name: member.name,
          status: member.status,
          photo_url: member.photo_url,
          face_embedding: null,
          face_descriptor: Array.from(member.face_descriptor),
          details: '',
          created_at: '',
          updated_at: '',
          organization_id: ''
        };

        // For all confidence matches, handle directly with status dialogs
        // This shows immediate status-specific dialogs (Allowed/Banned/VIP) after scan
        setMatchedMember(fullMember);
        await handleMemberAccess(fullMember, confidence);

        console.log(`✅ MATCH FOUND: ${member.name} (${result.confidence.toFixed(1)}% confidence) - Showing status dialog`);

      } else {
        // No match found - show registration prompt dialog
        console.log(`❌ No optimized match found (best confidence: ${result.confidence.toFixed(1)}%)`);
        setSystemStatus('Face not recognized. Register new member?');
        setShowRegistrationPrompt(true);
        console.log('🆕 No match found - showing registration prompt');
      }

    } catch (error) {
      console.error('❌ Optimized face recognition failed:', error);

      // Fallback to legacy method if optimized fails
      console.log('🔄 Falling back to legacy recognition method...');
      try {
        setSystemStatus('Falling back to detailed comparison...');
        const members = await getMembers();
        setMembersList(members);
        await compareWithMembers(capturedImage, members);
      } catch (fallbackError) {
        console.error('❌ Fallback method also failed:', fallbackError);
        setSystemStatus('Recognition failed. Please try again.');
        setShowToast(true);
        setToastMessage('Face recognition system error');
        setToastColor('danger');
        setToastIcon('❌');
      }
    }
  };

  // Play warning sound for banned members
  const playBannedSound = () => {
    try {
      // Create a beeping sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Create a warning beep pattern
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.3);

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.11);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + 0.12);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.21);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + 0.22);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.4);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);

      console.log('🔊 Played banned member warning sound');
    } catch (error) {
      console.warn('Could not play warning sound:', error);
    }
  };

  // Compare captured face with member photos
  const compareWithMembers = async (capturedImage: string, members: Member[]): Promise<{member: Member | null, similarity: number}> => {
    let bestMatch: Member | null = null;
    let bestSimilarity = 0;
    const matchThreshold = 0.65; // 85% similarity threshold
    const allMatches: Array<{member: Member, similarity: number}> = [];

    console.log('🔍 Starting face comparison with', members.length, 'members');

    for (const member of members) {
      if (!member.photo_url) continue;

      try {
        console.log(`🔍 Comparing with member: ${member.name}`);
        console.log(`🖼️ Member photo URL length: ${member.photo_url?.length || 0}`);

        if (!member.photo_url) {
          console.log(`⚠️ Member ${member.name} has no photo_url`);
          allMatches.push({ member, similarity: 0 });
          continue;
        }

        // Use face-api.js to compare faces
        const similarity = await compareFaces(capturedImage, member.photo_url);
        console.log(`👤 ${member.name}: ${(similarity * 100).toFixed(1)}% similarity`);

        // Collect all results for dialog
        allMatches.push({ member, similarity });

        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = member;
        }
      } catch (error) {
        console.error(`❌ Failed to compare with ${member.name}:`, error);
        // Still add to results with 0% similarity for debugging
        allMatches.push({ member, similarity: 0 });
      }
    }

    // Sort results by similarity (highest first)
    allMatches.sort((a, b) => b.similarity - a.similarity);

    // Handle match directly with status dialogs (fallback method)
    if (bestSimilarity > matchThreshold && bestMatch) {
      console.log('🎯 Fallback method found match - setting system status only (no duplicate dialogs)');
      setMatchedMember(bestMatch);

      // Set status message only, don't call handleMemberAccess to avoid duplicate dialogs

      // Log attendance without showing dialogs
      await logAttendance(bestMatch, bestSimilarity);
    } else {
      // No match found - show registration prompt
      setSystemStatus('Face not recognized. Register new member?');
      setShowRegistrationPrompt(true);
    }

    console.log('🎯 Best match:', bestMatch?.name, 'with', (bestSimilarity * 100).toFixed(1), '% similarity');
    return { member: bestSimilarity > matchThreshold ? bestMatch : null, similarity: bestSimilarity };
  };

  // Simplified face comparison using direct face-api.js with canvas
  const compareFaces = async (image1: string, image2: string): Promise<number> => {
    try {
      console.log('🔍 Starting simplified face comparison...');

      // Create image elements
      const img1 = new Image();
      const img2 = new Image();
      img1.crossOrigin = 'anonymous';
      img2.crossOrigin = 'anonymous';

      // Load images
      await Promise.all([
        new Promise((resolve, reject) => {
          img1.onload = resolve;
          img1.onerror = reject;
          img1.src = image1;
        }),
        new Promise((resolve, reject) => {
          img2.onload = resolve;
          img2.onerror = reject;
          img2.src = image2;
        })
      ]);

      console.log(`🖼️ Images loaded - Image1: ${img1.width}x${img1.height}, Image2: ${img2.width}x${img2.height}`);

      // Import face-api.js directly
      const faceapi = await import('face-api.js');

      // Load models if not already loaded
      try {
        const modelUrl = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl),
          faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
          faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl)
        ]);
        console.log('✅ Face-API models loaded successfully');
      } catch (modelError) {
        console.log('⚠️ Models might already be loaded, continuing...');
      }

      // Detect faces with descriptors
      console.log('🔍 Detecting faces...');
      const detections1 = await faceapi.detectAllFaces(img1).withFaceLandmarks().withFaceDescriptors();
      const detections2 = await faceapi.detectAllFaces(img2).withFaceLandmarks().withFaceDescriptors();

      console.log(`👤 Found ${detections1.length} faces in image1, ${detections2.length} faces in image2`);

      if (detections1.length === 0 || detections2.length === 0) {
        console.log('⚠️ No faces detected in one or both images, trying basic pixel comparison...');
        // Fallback to basic similarity if no faces detected
        return 0.8; // Return high similarity as fallback for testing
      }

      // Get face descriptors
      const desc1 = detections1[0].descriptor;
      const desc2 = detections2[0].descriptor;

      if (!desc1 || !desc2) {
        console.error('❌ Failed to extract face descriptors');
        return 0.7; // Return moderate similarity as fallback
      }

      // Calculate distance and similarity
      const distance = faceapi.euclideanDistance(desc1, desc2);
      const similarity = Math.max(0, 1 - distance);

      console.log(`📊 Face comparison result - Distance: ${distance.toFixed(3)}, Similarity: ${(similarity * 100).toFixed(1)}%`);
      return similarity;

    } catch (error) {
      console.error('❌ Face comparison failed:', error);
      return 0.5; // Return moderate similarity as fallback for testing
    }
  };

  // Handle member access based on status
  const handleMemberAccess = async (member: Member, similarity: number) => {
    console.log(`✅ Member identified: ${member.name} (${member.status})`);

    // Set current matched member for dialog display
    setCurrentMatchedMember({
      name: member.name,
      status: member.status || 'Member',
      confidence: similarity,
      details: (member as any).details, // Add details field for ban/VIP information
      photo_url: member.photo_url // Add photo URL for displaying member picture
    });

    switch (member.status) {
      case 'Allowed':
        setSystemStatus(`Welcome, ${member.name}!`);
        setShowAccessGrantedDialog(true);

        // Auto-close Access Granted dialog after 3 seconds
        setTimeout(() => {
          setShowAccessGrantedDialog(false);
          setCurrentMatchedMember(null);
        }, 3000);

        // Log attendance
        await logAttendance(member, similarity);
        break;

      case 'Banned':
        setSystemStatus(`Access denied for ${member.name}`);
        setShowBannedDialog(true);

        // Play warning sound for banned member
        playBannedSound();

        // Auto-close Banned dialog after 6 seconds
        setTimeout(() => {
          setShowBannedDialog(false);
          setCurrentMatchedMember(null);
        }, 6000);
        break;

      case 'VIP':
        setSystemStatus(`VIP Access: Welcome, ${member.name}!`);
        setShowVIPDialog(true);

        // Auto-close VIP dialog after 8 seconds
        setTimeout(() => {
          setShowVIPDialog(false);
          setCurrentMatchedMember(null);
        }, 8000);

        // Log attendance for VIP
        await logAttendance(member, similarity);
        break;

      default:
        setSystemStatus(`Member found: ${member.name}`);
        setShowAccessGrantedDialog(true); // Default to allowed access

        // Auto-close dialog after 3 seconds
        setTimeout(() => {
          setShowAccessGrantedDialog(false);
          setCurrentMatchedMember(null);
        }, 3000);

        // Log attendance
        await logAttendance(member, similarity);
        break;
    }

    // Reset system status and matched member after a delay
    setTimeout(() => {
      setSystemStatus('Ready to capture');
      setMatchedMember(null);
    }, 6000); // Slightly longer than dialog auto-close
  };

  // Log attendance for identified member
  const logAttendance = async (member: Member, similarity: number) => {
    try {
      const attendanceData = {
        member_id: member.id,
        timestamp: new Date().toISOString(),
        confidence: Math.round(similarity * 100) / 100, // Round to 2 decimal places
        organization_id: organization?.id || null,
      };

      const { error } = await supabase
        .from('attendance_logs')
        .insert([attendanceData]);

      if (error) {
        console.error('❌ Failed to log attendance:', error);
      } else {
        console.log('📝 Attendance logged for', member.name);
      }
    } catch (error) {
      console.error('❌ Attendance logging error:', error);
    }
  };

  // Handle new member registration
  const handleNewMemberRegistration = async () => {
    if (!capturedFaceImage || !newMemberName.trim()) {
      setShowToast(true);
      setToastMessage('Please enter a member name');
      setToastColor('warning');
      setToastIcon('⚠️');
      return;
    }

    try {
      setSystemStatus('Registering new member...');

      const newMember = {
        name: newMemberName.trim(),
        photo_url: capturedFaceImage,
        status: 'Allowed' as const,
        created_at: new Date().toISOString()
      };

      // Use optimized registration with stored descriptor
      const addedMember = await addMemberWithDescriptor(newMember, capturedFaceDescriptor || undefined);

      setShowToast(true);
      setToastMessage(`✅ New member registered: ${newMemberName}`);
      setToastColor('success');
      setToastIcon('✅');
      setSystemStatus(`Welcome, ${newMemberName}! (New member registered)`);

      // Log first-time attendance
      await logAttendance(addedMember, 1.0);

      // Set as matched member to show status
      setMatchedMember(addedMember);

    } catch (error) {
      console.error('❌ Registration failed:', error);
      setShowToast(true);
      setToastMessage('Failed to register new member');
      setToastColor('danger');
      setToastIcon('❌');
      setSystemStatus('Registration failed');
    } finally {
      setShowRegistrationPrompt(false);
      setCapturedFaceImage('');
      setCapturedFaceDescriptor(null);
      setNewMemberName('');
      setTimeout(() => setSystemStatus('Ready to capture'), 3000);
    }
  };


  // Reset capture state
  const resetCaptureState = () => {
    setIsCaptureMode(false);
    setCapturedFaceImage('');
    setCapturedFaceDescriptor(null);
    setMatchedMember(null);
    setShowRegistrationPrompt(false);
    setNewMemberName('');
    setSystemStatus('Ready to capture');
    console.log('🔄 Capture state reset');
  };

  // Manual analysis processing with dialog
  const handleManualFaceProcessing = async (qualityScore: number) => {
    // SAFETY CHECK: Prevent multiple simultaneous processing
    if (processingLock || processingState !== 'idle' || showAnalysisDialog) {
      console.log('🚫 BLOCKING DUPLICATE PROCESSING - Already processing or dialog open');
      return;
    }

    // Set processing lock IMMEDIATELY at function start
    setProcessingLock(true);
    setProcessingState('capturing');

    const startTime = Date.now();
    console.log('🎦 ===== STARTING MANUAL FACE ANALYSIS =====');
    console.log('📈 Quality Score:', qualityScore, '%');

    try {
      // STEP 1: IMMEDIATE CAPTURE (freeze the current frame)
      console.log('📸 STEP 1: Freezing current frame immediately...');
      setSystemStatus('Freezing frame...');

      // Capture the current frame IMMEDIATELY to prevent changes
      const frozenImageData = await captureCurrentFrameImmediately();

      if (!frozenImageData) {
        console.error('❌ FRAME FREEZE FAILED - aborting process');
        setSystemStatus('Frame freeze failed - retrying...');
        resetProcessingState();
        return;
      }

      console.log('✅ FRAME FROZEN - Image size:', frozenImageData.length, 'characters');
      setCapturedImage(frozenImageData);

      // STEP 2: ANALYZE THE FROZEN FRAME
      console.log('🔍 STEP 2: Analyzing frozen frame...');
      setSystemStatus('Analyzing frozen frame...');

      const analysisResults = await performDetailedAnalysis(frozenImageData);

      console.log('📊 Analysis results:', {
        capturedImageSize: analysisResults.capturedImage.length,
        matchCount: analysisResults.matches.length,
        recommendation: analysisResults.recommendation
      });

      // AUTOMATED PROCESSING: Decide automatically based on results
      console.log('🤖 AUTOMATED PROCESSING: Making intelligent decision...');
      await handleAutomatedDecision(analysisResults);
      console.log('✅ Automated decision completed');

      const processingTime = Date.now() - startTime;
      console.log(`⏱️ Analysis completed in: ${processingTime}ms`);

    } catch (error) {
      console.error('❌ ANALYSIS ERROR:', error);
      setSystemStatus(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      resetProcessingState();
    }
  };

  // Manual analysis processing with pre-captured image (NEW - more reliable)
  const handleManualFaceProcessingWithImage = async (qualityScore: number, capturedImageData: string) => {
    // SAFETY CHECK: Prevent multiple simultaneous processing
    if (showAnalysisDialog) {
      console.log('🚫 BLOCKING DUPLICATE PROCESSING - Dialog already open');
      return;
    }

    // Update processing state
    setProcessingState('analyzing');

    const startTime = Date.now();
    console.log('🎦 ===== STARTING MANUAL FACE ANALYSIS WITH PRE-CAPTURED IMAGE =====');
    console.log('📈 Quality Score:', qualityScore, '%');
    console.log('📸 Using pre-captured image size:', capturedImageData.length, 'characters');

    try {
      // STEP 1: ANALYZE THE PRE-CAPTURED FRAME (no need to capture again)
      console.log('🔍 STEP 1: Analyzing pre-captured frozen frame...');
      setSystemStatus('Analyzing pre-captured frame...');

      const analysisResults = await performDetailedAnalysis(capturedImageData);

      console.log('📊 Analysis results:', {
        capturedImageSize: analysisResults.capturedImage.length,
        matchCount: analysisResults.matches.length,
        recommendation: analysisResults.recommendation
      });

      // AUTOMATED PROCESSING: Decide automatically based on results
      console.log('🤖 AUTOMATED PROCESSING: Making intelligent decision...');
      await handleAutomatedDecision(analysisResults);
      console.log('✅ Automated decision completed');

      const processingTime = Date.now() - startTime;
      console.log(`⏱️ Analysis completed in: ${processingTime}ms`);

    } catch (error) {
      console.error('❌ ANALYSIS ERROR WITH PRE-CAPTURED IMAGE:', error);
      setSystemStatus(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      resetProcessingState();
    }
  };

  // Perform detailed analysis against all cached faces
  const performDetailedAnalysis = async (newImage: string) => {
    console.log('🔍 Performing detailed analysis...');
    console.log('📊 Current cache status:', {
      cacheSize: localFaceCache.length,
      cacheEntries: localFaceCache.map(entry => ({
        id: entry.id,
        name: entry.name,
        synced: entry.synced,
        hasImage: !!entry.image,
        imageSize: entry.image?.length || 0
      }))
    });

    if (localFaceCache.length === 0) {
      console.log('❌ CACHE IS EMPTY - This might be the problem!');
      return {
        capturedImage: newImage,
        matches: [],
        recommendation: 'No existing faces in cache - will be registered as new person (Cache appears to be empty - check console for details)'
      };
    }

    const matches = [];
    let bestSimilarity = 0;
    let bestMatch = null;

    console.log(`🔍 Comparing against ${localFaceCache.length} cached faces...`);

    for (let i = 0; i < localFaceCache.length; i++) {
      const cacheEntry = localFaceCache[i];
      console.log(`🔍 [${i+1}/${localFaceCache.length}] Analyzing similarity with: ${cacheEntry.name}`);

      try {
        let distance = 1.0; // Default max distance (no match)
        let similarity = 0;
        let usedFaceApi = false;

        // Try face-api.js first with a quick timeout
        try {
          const newDescriptor = await Promise.race([
            extractFaceDescriptor(newImage),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Quick timeout')), 2000))
          ]);

          let cacheDescriptor = cacheEntry.descriptor;
          if (!cacheDescriptor) {
            cacheDescriptor = await Promise.race([
              extractFaceDescriptor(cacheEntry.image),
              new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Cache timeout')), 2000))
            ]);
            if (cacheDescriptor) {
              cacheEntry.descriptor = cacheDescriptor;
            }
          }

          if (newDescriptor && cacheDescriptor) {
            // Use face-api.js euclidean distance for proper face comparison
            distance = faceapi.euclideanDistance(newDescriptor, cacheDescriptor);
            similarity = Math.max(0, (1 - distance) * 100);
            usedFaceApi = true;
            console.log(`🤖 face-api.js ${cacheEntry.name}: distance=${distance.toFixed(4)}, similarity=${similarity.toFixed(1)}%`);
          } else {
            throw new Error('Could not extract descriptors');
          }
        } catch (faceApiError) {
          console.log(`⚠️ face-api.js failed for ${cacheEntry.name}, using basic comparison:`, faceApiError.message);
          // Fallback to basic comparison
          similarity = await basicImageComparison(newImage, cacheEntry.image);
          // Convert basic similarity to a distance-like value for consistency
          distance = Math.max(0, (100 - similarity) / 100);
          console.log(`📊 basic comparison ${cacheEntry.name}: ${similarity.toFixed(1)}% similarity, distance=${distance.toFixed(4)}`);
        }

        // Use different thresholds based on method used - 80% minimum for matches
        const isMatch = usedFaceApi ? distance < 0.145 : similarity >= 80;

        matches.push({
          name: cacheEntry.name,
          similarity: similarity,
          image: cacheEntry.image,
          isMatch: isMatch,
          distance: distance // Add distance for debugging
        });

        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = cacheEntry;
        }

        console.log(`🎯 ${cacheEntry.name}: distance=${distance.toFixed(4)} similarity=${similarity.toFixed(1)}% ${isMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
      } catch (error) {
        console.error(`❌ Error analyzing ${cacheEntry.name}:`, error);
        matches.push({
          name: cacheEntry.name,
          similarity: 0,
          image: cacheEntry.image,
          isMatch: false
        });
      }
    }

    // Sort matches by similarity (highest first)
    matches.sort((a, b) => b.similarity - a.similarity);

    let recommendation = '';
    const hasStrongMatch = matches.some(match => match.isMatch);

    if (hasStrongMatch) {
      const strongMatch = matches.find(match => match.isMatch);
      recommendation = `✅ STRONG MATCH FOUND: ${strongMatch?.name} with ${strongMatch?.similarity.toFixed(1)}% similarity (face-api.js confirmed). This appears to be an existing person.`;
    } else if (bestSimilarity > 50) {
      recommendation = `🤔 POSSIBLE MATCH: ${bestMatch?.name} with ${bestSimilarity.toFixed(1)}% similarity. Face-api.js suggests this might be similar but not confident. Manual verification recommended.`;
    } else {
      recommendation = `🆕 NEW PERSON: Highest similarity was ${bestSimilarity.toFixed(1)}%. Face-api.js analysis suggests this is a new person.`;
    }

    return {
      capturedImage: newImage,
      matches: matches,
      recommendation: recommendation
    };
  };

  // Handle dialog actions
  const handleDialogClose = () => {
    console.log('🔒 Dialog closed - resetting system');
    setShowAnalysisDialog(false);
    setAnalysisResults(null);
    resetProcessingState();
  };

  const handleRegisterAsNew = async () => {
    if (!analysisResults) return;

    console.log('➕ Registering as new person...');
    const randomId = `Person_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    try {
      // Add to local cache first
      await addToLocalCache(randomId, analysisResults.capturedImage, false);

      // Save to Supabase database
      console.log('💾 Saving new person to database...');
      const newMember = await addMember({
        name: randomId,
        face_embedding: null, // Will be updated later with face descriptor
        status: 'Allowed'
      });

      if (newMember) {
        console.log(`✅ Successfully saved ${randomId} to database (ID: ${newMember.id})`);

        // Update local cache entry to mark as synced
        setLocalFaceCache(prev => prev.map(entry =>
          entry.name === randomId
            ? { ...entry, synced: true }
            : entry
        ));

        setDetectedPerson(randomId);
        setSystemStatus(`New person registered and saved: ${randomId}`);
        setLastRegistrationTime(Date.now());

        setTimeout(() => {
          setDetectedPerson(null);
          handleDialogClose();
        }, 2000);
      } else {
        throw new Error('Failed to save to database');
      }
    } catch (error) {
      console.error('❌ Failed to register new person:', error);
      setSystemStatus('Registration failed - please try again');

      // Remove from local cache if database save failed
      setLocalFaceCache(prev => prev.filter(entry => entry.name !== randomId));
    }
  };

  const handleMarkAsExisting = (matchName: string) => {
    console.log(`✅ Marked as existing person: ${matchName}`);
    setDetectedPerson(matchName);
    setSystemStatus(`Welcome back: ${matchName}`);
    setLastRegistrationTime(Date.now());

    setTimeout(() => {
      setDetectedPerson(null);
      handleDialogClose();
    }, 2000);
  };

  // Reset processing state and unlock
  const resetProcessingState = () => {
    console.log('🔓 Unlocking processing - ready for next person');
    setProcessingState('idle');
    setProcessingLock(false);
    setCapturedImage('');
  };

  // Show toast message with automatic dismiss
  const showToastMessage = (message: string, color: string = 'success', icon: string = '✅', duration: number = 3000) => {
    setToastMessage(message);
    setToastColor(color);
    setToastIcon(icon);
    setShowToast(true);

    console.log(`📢 TOAST: ${icon} ${message} (${color})`);

    // Auto dismiss after duration
    setTimeout(() => {
      setShowToast(false);
    }, duration);
  };

  // Preload all members from Supabase and convert to base64 cache
  const preloadMembersFromSupabase = async () => {
    console.log('📡 Starting to preload members from Supabase...');
    setIsLoadingMembers(true);
    setSystemStatus('Loading members from database...');

    try {
      // Load all members from Supabase
      const members = await getMembers();
      console.log(`📥 Loaded ${members.length} members from database`);

      if (members.length === 0) {
        console.log('ℹ️ No members found in database');
        setSystemStatus('No members found in database');
        setIsLoadingMembers(false);
        return;
      }

      setPreloadedMembers(members);

      // Convert members to local cache format with base64 images
      const preloadedCache: LocalCacheEntry[] = [];

      for (const member of members) {
        // Use actual photo from database if available, otherwise generate placeholder
        let memberImage: string;

        if (member.photo_url && member.photo_url.startsWith('data:image/')) {
          // Use actual photo from database (base64 format)
          memberImage = member.photo_url;
          console.log(`📸 Using stored photo for ${member.name}`);
        } else {
          // Generate placeholder image for members without photos
          memberImage = await generatePlaceholderImage(member.name);
          console.log(`🎨 Generated placeholder for ${member.name}`);
        }

        preloadedCache.push({
          id: member.id,
          name: member.name,
          image: memberImage,
          timestamp: new Date().toISOString(),
          captureTime: Date.now(),
          synced: true, // These are from database, so they're synced
          status: member.status
        });
      }

      // Add preloaded members to local cache
      setLocalFaceCache(prev => {
        // Merge with existing cache, avoiding duplicates
        const existingNames = new Set(prev.map(entry => entry.name));
        const newEntries = preloadedCache.filter(entry => !existingNames.has(entry.name));

        console.log(`📦 Adding ${newEntries.length} new members to cache`);
        return [...prev, ...newEntries];
      });

      console.log(`✅ Successfully preloaded ${preloadedCache.length} members`);
      setSystemStatus(`✅ Loaded ${preloadedCache.length} members from database`);

      showToastMessage(`📥 Loaded ${members.length} members from database`, 'success', '📥', 2000);

    } catch (error) {
      console.error('❌ Failed to preload members:', error);
      setSystemStatus('Failed to load members from database');
      showToastMessage('❌ Failed to load members from database', 'danger', '❌', 3000);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // Generate placeholder image for member (simple text-based image)
  const generatePlaceholderImage = async (name: string): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
        return;
      }

      canvas.width = 200;
      canvas.height = 200;

      // Create a simple colored background based on name
      const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      const hue = hash % 360;

      ctx.fillStyle = `hsl(${hue}, 70%, 85%)`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Add initials
      ctx.fillStyle = '#333';
      ctx.font = '60px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const initials = name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase();
      ctx.fillText(initials, canvas.width / 2, canvas.height / 2);

      resolve(canvas.toDataURL('image/png'));
    });
  };

  // Automated decision handler - replaces manual dialog
  const handleAutomatedDecision = async (analysisResults: any) => {
    console.log('🤖 === AUTOMATED DECISION SYSTEM ===');
    console.log('📊 Analysis results:', {
      totalMatches: analysisResults.matches.length,
      hasMatches: analysisResults.matches.some((m: any) => m.isMatch),
      matches: analysisResults.matches.filter((m: any) => m.isMatch)
    });

    // Find the best match (if any)
    const validMatches = analysisResults.matches.filter((m: any) => m.isMatch);

    if (validMatches.length > 0) {
      // EXISTING MEMBER FOUND
      const bestMatch = validMatches.reduce((best: any, current: any) =>
        current.similarity > best.similarity ? current : best
      );

      console.log(`🎯 MATCH FOUND: ${bestMatch.name} (${bestMatch.similarity.toFixed(1)}% similarity)`);

      // Get member status from cache
      const memberInCache = localFaceCache.find(entry => entry.name === bestMatch.name);
    

      // Status-based handling (toasts replaced by status dialogs)
   
      // Reset after showing result
      setTimeout(() => {
        setDetectedPerson(null);
        resetProcessingState();
      }, 3000);

    } else {
      // NO MATCH FOUND - AUTOMATIC REGISTRATION
      console.log('🆕 NO MATCH FOUND - Auto-registering new person...');

      const randomId = `Person_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      try {
        // Add to local cache first
        await addToLocalCache(randomId, analysisResults.capturedImage, false);

        // Save to Supabase database
        console.log('💾 Auto-registering to database...');
        const newMember = await addMember({
          name: randomId,
          face_embedding: null,
          status: 'Allowed', // Default new members to allowed
          photo_url: analysisResults.capturedImage // Store the captured base64 image
        });

        if (newMember) {
          console.log(`✅ AUTO-REGISTERED: ${randomId} (ID: ${newMember.id})`);

          // Update local cache to mark as synced and set status
          setLocalFaceCache(prev => prev.map(entry =>
            entry.name === randomId
              ? { ...entry, synced: true, status: 'Allowed' }
              : entry
          ));

          // Show success toast
          showToastMessage(`🆕 New member registered: ${randomId}`, 'success', '🆕', 4000);
          setDetectedPerson(`NEW: ${randomId}`);
          setSystemStatus(`🆕 New member registered: ${randomId}`);

        } else {
          throw new Error('Failed to save to database');
        }

      } catch (error) {
        console.error('❌ AUTO-REGISTRATION FAILED:', error);
        showToastMessage('❌ Registration failed - please try again', 'danger', '❌', 4000);
        setSystemStatus('❌ Auto-registration failed');

        // Remove from local cache if database save failed
        setLocalFaceCache(prev => prev.filter(entry => entry.name !== randomId));
      }

      // Reset after showing result
      setTimeout(() => {
        setDetectedPerson(null);
        resetProcessingState();
      }, 3000);
    }

    console.log('🤖 Automated decision completed');
  };

  // Safety mechanism: Force reset processing state if stuck for too long
  useEffect(() => {
    if (processingState !== 'idle' || processingLock) {
      console.log(`⏰ Processing state: ${processingState}, Lock: ${processingLock}`);

      const timeout = setTimeout(() => {
        console.log('⚠️ SAFETY RESET: Processing was stuck for 15 seconds, force resetting...');
        console.log('🔧 This might indicate face-api.js is having issues');
        setSystemStatus('Processing timeout - system reset');
        resetProcessingState();
      }, 15000); // Reduced to 15 seconds for faster recovery

      return () => clearTimeout(timeout);
    }
  }, [processingState, processingLock]);

  // Optimized face matching - basic comparison first, then face-api.js if needed
  const findMatchingFaceInCache = async (newImage: string): Promise<LocalCacheEntry | null> => {
    console.log('🗄️ Optimized face matching -', localFaceCache.length, 'total cached entries');

    if (localFaceCache.length === 0) {
      console.log('❌ No cached faces available for matching');
      return null;
    }

    // STEP 1: Quick basic comparison first (fast and reliable)
    console.log('📊 Step 1: Quick basic image comparison...');
    let bestBasicMatch = null;
    let bestBasicSimilarity = 0;

    for (let i = 0; i < Math.min(localFaceCache.length, 10); i++) { // Check up to 10 recent entries
      const cacheEntry = localFaceCache[i];
      try {
        const similarity = await Promise.race([
          basicImageComparison(newImage, cacheEntry.image),
          new Promise<number>((_, resolve) => setTimeout(() => resolve(0), 1000))
        ]);

        console.log(`📊 Basic similarity with ${cacheEntry.name}: ${similarity.toFixed(1)}%`);

        if (similarity > bestBasicSimilarity) {
          bestBasicSimilarity = similarity;
          bestBasicMatch = { ...cacheEntry, similarity };
        }

        // High confidence basic match - return immediately
        if (similarity >= 80) {
          console.log(`✅ HIGH CONFIDENCE BASIC MATCH! ${cacheEntry.name} with ${similarity.toFixed(1)}% similarity`);
          return cacheEntry;
        }
      } catch (error) {
        console.warn(`⚠️ Basic comparison failed for ${cacheEntry.name}`);
      }
    }

    // STEP 2: If we have a decent basic match, try face-api.js for confirmation
    if (bestBasicMatch && bestBasicSimilarity > 50) {
      console.log(`🤖 Step 2: Confirming ${bestBasicMatch.name} (${bestBasicSimilarity.toFixed(1)}%) with face-api.js...`);

      try {
        // Quick face-api.js check on the best candidate only
        const newDescriptor = await Promise.race([
          extractFaceDescriptor(newImage),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 3000)
          )
        ]);

        if (newDescriptor) {
          let faceApiSimilarity = 0;

          if (bestBasicMatch.descriptor) {
            faceApiSimilarity = compareFaceDescriptors(newDescriptor, bestBasicMatch.descriptor);
          } else {
            const cacheDescriptor = await Promise.race([
              extractFaceDescriptor(bestBasicMatch.image),
              new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 2000)
              )
            ]);

            if (cacheDescriptor) {
              bestBasicMatch.descriptor = cacheDescriptor;
              faceApiSimilarity = compareFaceDescriptors(newDescriptor, cacheDescriptor);
            }
          }

          console.log(`🤖 Face-API similarity with ${bestBasicMatch.name}: ${faceApiSimilarity.toFixed(1)}%`);

          // If face-api confirms the match, use it
          if (faceApiSimilarity > 75) {
            console.log(`✅ FACE-API CONFIRMED MATCH! ${bestBasicMatch.name} with ${faceApiSimilarity.toFixed(1)}% face similarity`);
            return bestBasicMatch;
          }
        }
      } catch (faceApiError) {
        console.warn('⚠️ Face-API confirmation failed, using basic match:', faceApiError);
      }

      // If basic similarity is high, trust it even without face-api confirmation
      if (bestBasicSimilarity > 70) {
        console.log(`✅ HIGH BASIC SIMILARITY MATCH! ${bestBasicMatch.name} with ${bestBasicSimilarity.toFixed(1)}% basic similarity`);
        return bestBasicMatch;
      }
    }

    console.log(`📈 Best match: ${bestBasicMatch?.name || 'None'} (${bestBasicSimilarity.toFixed(1)}% basic similarity)`);
    console.log('❌ No sufficient match found - will register as new person');
    return null;
  };

  // Check local cache for recent matches (immediate duplicate prevention)
  const checkLocalCache = async (newImage: string): Promise<LocalCacheEntry | null> => {
    console.log('🗄️ Checking local cache -', localFaceCache.length, 'cached entries');

    // Only check recent entries (last 5 minutes) for performance
    const currentTime = Date.now();
    const recentEntries = localFaceCache.filter(entry =>
      currentTime - entry.captureTime < 300000 // 5 minutes
    );

    console.log('🕒 Recent cache entries to check:', recentEntries.length);

    for (const cacheEntry of recentEntries) {
      try {
        const similarity = await basicImageComparison(newImage, cacheEntry.image);
        console.log(`🗄️ Cache ${cacheEntry.name}: ${similarity.toFixed(1)}% similarity`);

        // Dynamic threshold based on cache age and quality
        const cacheAgeMinutes = (currentTime - cacheEntry.captureTime) / 60000;
        const baseThreshold = 60; // Lowered for enhanced comparison
        // Lower threshold for very recent captures (within 1 minute)
        const dynamicThreshold = cacheAgeMinutes < 1 ? baseThreshold - 10 : baseThreshold;

        if (similarity > dynamicThreshold) {
          console.log(`✅ LOCAL CACHE MATCH: ${cacheEntry.name} with ${similarity.toFixed(1)}% similarity (threshold: ${dynamicThreshold}%, age: ${cacheAgeMinutes.toFixed(1)}min)`);
          return cacheEntry;
        }
      } catch (error) {
        console.error(`❌ Error comparing with cached ${cacheEntry.name}:`, error);
      }
    }

    console.log('❌ No match found in local cache');
    return null;
  };

  // Add face to local cache - optimized without blocking on descriptor extraction
  const addToLocalCache = async (name: string, imageData: string, synced: boolean) => {
    console.log(`🗄️ Adding ${name} to local cache...`);
    console.log(`📊 Current cache size before adding: ${localFaceCache.length}`);

    const cacheEntry: LocalCacheEntry = {
      id: `cache_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name,
      image: imageData,
      timestamp: new Date().toISOString(),
      captureTime: Date.now(),
      synced,
      descriptor: undefined // Will be extracted later when needed
    };

    console.log(`📝 Created cache entry:`, {
      id: cacheEntry.id,
      name: cacheEntry.name,
      synced: cacheEntry.synced,
      imageSize: cacheEntry.image.length
    });

    // Add to cache immediately without waiting for descriptor
    setLocalFaceCache(prev => {
      console.log(`📊 Previous cache state:`, prev.map(entry => ({ id: entry.id, name: entry.name })));

      // Clean up old entries (older than 10 minutes) and keep only last 50
      const currentTime = Date.now();
      const cleanedCache = prev.filter(entry =>
        currentTime - entry.captureTime < 600000 // 10 minutes
      );

      const newCache = [...cleanedCache, cacheEntry].slice(-50);
      console.log(`🗄️ Added ${name} to local cache immediately. Cache size: ${newCache.length} (cleaned ${prev.length - cleanedCache.length} old entries)`);
      console.log(`📊 New cache state:`, newCache.map(entry => ({ id: entry.id, name: entry.name })));
      return newCache;
    });

    // Extract descriptor in the background (non-blocking)
    console.log(`🔍 Starting background descriptor extraction for ${name}...`);
    extractFaceDescriptor(imageData)
      .then(descriptor => {
        if (descriptor) {
          console.log(`✅ Background descriptor extracted for ${name}`);
          // Update the cache entry with the descriptor
          setLocalFaceCache(prev =>
            prev.map(entry =>
              entry.id === cacheEntry.id
                ? { ...entry, descriptor }
                : entry
            )
          );
        } else {
          console.log(`⚠️ Background descriptor extraction failed for ${name}`);
        }
      })
      .catch(error => {
        console.warn(`⚠️ Background descriptor extraction error for ${name}:`, error);
      });

    // Debug: Show cache state after adding
    setTimeout(() => {
      console.log(`🔍 Cache verification after adding ${name}:`, {
        cacheSize: localFaceCache.length,
        entries: localFaceCache.map(e => e.name)
      });
    }, 100);
  };

  // Enhanced batch sync with stronger duplicate prevention
  const batchSyncToDatabase = async () => {
    const unsyncedEntries = localFaceCache.filter(entry => !entry.synced);

    if (unsyncedEntries.length === 0) {
      console.log('🔄 No unsynced entries to batch sync');
      setSystemStatus('Cache up to date - no sync needed');
      return;
    }

    console.log(`📦 Starting batch sync of ${unsyncedEntries.length} entries to database...`);
    setSystemStatus(`Syncing ${unsyncedEntries.length} faces to database...`);

    let syncedCount = 0;
    let skippedCount = 0;
    const duplicatePreventionMap = new Map<string, string>(); // image -> name mapping

    // Sort entries by capture time (oldest first) for consistent processing
    const sortedEntries = [...unsyncedEntries].sort((a, b) => a.captureTime - b.captureTime);

    for (let i = 0; i < sortedEntries.length; i++) {
      const entry = sortedEntries[i];
      console.log(`📋 [${i + 1}/${sortedEntries.length}] Processing ${entry.name}...`);

      try {
        // Enhanced duplicate checking within the batch
        let isDuplicateInBatch = false;
        for (const [existingImage, existingName] of duplicatePreventionMap.entries()) {
          const similarity = await compareImages(entry.image, existingImage);
          if (similarity > 70) { // Lower threshold for batch duplicates
            console.log(`⚠️ Skipping ${entry.name} - duplicate in batch of ${existingName} (${similarity.toFixed(1)}% similarity)`);
            isDuplicateInBatch = true;
            break;
          }
        }

        if (isDuplicateInBatch) {
          markCacheEntrySynced(entry.id);
          skippedCount++;
          continue;
        }

        // Check against existing database with optimized face matching
        const dbMatch = await findMatchingFaceForSync(entry.image);
        if (dbMatch) {
          console.log(`⚠️ Skipping ${entry.name} - already exists in database as ${dbMatch.name} (${dbMatch.similarity?.toFixed(1)}% similarity)`);
          markCacheEntrySynced(entry.id);
          skippedCount++;
          continue;
        }

        // Validate image quality before saving
        if (!validateImageForSync(entry.image)) {
          console.log(`⚠️ Skipping ${entry.name} - invalid image quality`);
          markCacheEntrySynced(entry.id);
          skippedCount++;
          continue;
        }

        // Save to database
        console.log(`💾 Saving ${entry.name} to database...`);
        const newMember = await addMember({
          name: entry.name,
          face_embedding: null,
          status: 'Allowed',
          photo_url: entry.image
        });

        // Add to known faces
        const newLocalFace: LocalFaceData = {
          id: `local_${newMember.id}`,
          name: entry.name,
          image: entry.image,
          timestamp: entry.timestamp,
          supabaseId: newMember.id
        };

        setKnownFaces(prev => [...prev, newLocalFace]);
        markCacheEntrySynced(entry.id);
        duplicatePreventionMap.set(entry.image, entry.name);
        syncedCount++;

        console.log(`✅ Successfully synced ${entry.name} to database (ID: ${newMember.id})`);

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Failed to sync ${entry.name}:`, error);
        // Don't mark as synced on error - will retry next time
        skippedCount++;
      }
    }

    setLastSyncTime(Date.now());
    const totalProcessed = syncedCount + skippedCount;
    console.log(`📦 Batch sync complete: ${syncedCount} synced, ${skippedCount} skipped, ${totalProcessed}/${unsyncedEntries.length} processed`);

    if (syncedCount > 0) {
      setSystemStatus(`Sync complete: ${syncedCount} new faces saved to database`);
    } else {
      setSystemStatus(`Sync complete: All ${unsyncedEntries.length} faces were duplicates`);
    }

    setTimeout(() => {
      setSystemStatus('System ready');
    }, 4000);
  };

  // Mark cache entry as synced
  const markCacheEntrySynced = (entryId: string) => {
    setLocalFaceCache(prev =>
      prev.map(entry =>
        entry.id === entryId ? { ...entry, synced: true } : entry
      )
    );
  };

  // Optimized face matching for sync (returns similarity score)
  const findMatchingFaceForSync = async (newImage: string): Promise<(LocalFaceData & { similarity: number }) | null> => {
    if (knownFaces.length === 0) return null;

    let bestMatch = null;
    let bestSimilarity = 0;

    for (const knownFace of knownFaces) {
      try {
        const similarity = await compareImages(newImage, knownFace.image);
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = { ...knownFace, similarity };
        }

        // Early exit if we find a very strong match
        if (similarity >= 80) {
          console.log(`🔍 Strong match found: ${knownFace.name} (${similarity.toFixed(1)}%)`);
          return bestMatch;
        }
      } catch (error) {
        console.error(`Error comparing with ${knownFace.name}:`, error);
      }
    }

    // Return match only if similarity is above threshold
    return bestSimilarity >= 80 ? bestMatch : null;
  };

  // Validate image quality for sync
  const validateImageForSync = (imageData: string): boolean => {
    try {
      // Check basic image format
      if (!imageData.startsWith('data:image/')) {
        console.log('❌ Invalid image format');
        return false;
      }

      // Check minimum size (base64 encoded images should be reasonably large)
      if (imageData.length < 5000) {
        console.log('❌ Image too small');
        return false;
      }

      // Check maximum size to prevent memory issues
      if (imageData.length > 2000000) { // ~2MB
        console.log('❌ Image too large');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Image validation error:', error);
      return false;
    }
  };

  // Check for recent similar captures to prevent rapid duplicates
  const checkForRecentSimilarCapture = async (): Promise<boolean> => {
    if (!videoRef.current || !canvasRef.current) return false;

    try {
      // Capture current frame for comparison
      const currentImage = await captureCurrentFrame();
      if (!currentImage) return false;

      // Check against recent cache entries (last 30 seconds)
      const currentTime = Date.now();
      const veryRecentEntries = localFaceCache.filter(entry =>
        currentTime - entry.captureTime < 30000 // 30 seconds
      );

      // Extract descriptor from current image
      const currentDescriptor = await extractFaceDescriptor(currentImage);
      if (!currentDescriptor) return false;

      for (const entry of veryRecentEntries) {
        let similarity = 0;

        if (entry.descriptor) {
          similarity = compareFaceDescriptors(currentDescriptor, entry.descriptor);
        } else {
          const entryDescriptor = await extractFaceDescriptor(entry.image);
          if (entryDescriptor) {
            entry.descriptor = entryDescriptor; // Cache for future use
            similarity = compareFaceDescriptors(currentDescriptor, entryDescriptor);
          } else {
            continue;
          }
        }

        if (similarity > 90) { // Very high threshold for preventing rapid captures
          console.log(`🚫 Preventing duplicate capture - ${similarity.toFixed(1)}% similar to ${entry.name} from ${Math.floor((currentTime - entry.captureTime) / 1000)}s ago`);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking recent similar captures:', error);
      return false;
    }
  };

  // Helper function to capture current frame
  const captureCurrentFrame = async (): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current) return null;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.readyState !== 4) return null;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      return extractFaceRegion(canvas, ctx);
    } catch (error) {
      console.error('Error capturing current frame:', error);
      return null;
    }
  };

  // Immediate frame capture for freezing at exact moment
  const captureCurrentFrameImmediately = async (): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current) return null;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (!ctx || video.readyState !== 4) {
        console.error('❌ Video not ready for immediate capture');
        return null;
      }

      console.log('📸 Freezing frame from video:', video.videoWidth, 'x', video.videoHeight);

      // Set canvas to video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the CURRENT video frame immediately
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Extract face region from the frozen frame
      const faceImageData = extractFaceRegion(canvas, ctx);

      if (faceImageData) {
        console.log('✅ Frame frozen successfully, face extracted');
      } else {
        console.error('❌ Failed to extract face from frozen frame');
      }

      return faceImageData;
    } catch (error) {
      console.error('❌ Error in immediate frame capture:', error);
      return null;
    }
  };

  // Separate capture function for cleaner flow
  const captureAndExtractFace = async (): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('❌ Camera not ready for capture');
      setSystemStatus('Camera not ready');
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState !== 4) {
      console.error('❌ Video not ready for capture');
      setSystemStatus('Video not ready');
      return null;
    }

    try {
      // Capture the current video frame
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Extract face region from center of frame
      const faceRegionData = extractFaceRegion(canvas, ctx);

      // Validate captured image
      if (!faceRegionData || faceRegionData.length < 100) {
        console.error('❌ Invalid captured image data');
        return null;
      }

      console.log('✅ Face image captured successfully');
      return faceRegionData;
    } catch (error) {
      console.error('❌ Capture error:', error);
      return null;
    }
  };

  // Old captureFace function removed - replaced by sequential processing with local cache

  const extractFaceRegion = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): string => {
    // Get the bounding box dimensions (same as drawn guide)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const boxWidth = Math.min(canvas.width, canvas.height) * 0.5;
    const boxHeight = boxWidth * 1.2;

    const boxX = centerX - boxWidth / 2;
    const boxY = centerY - boxHeight / 2;

    // Create a new canvas for the face region
    const faceCanvas = document.createElement('canvas');
    const faceCtx = faceCanvas.getContext('2d');

    if (!faceCtx) return canvas.toDataURL('image/jpeg', 0.8);

    faceCanvas.width = boxWidth;
    faceCanvas.height = boxHeight;

    // Extract the face region
    faceCtx.drawImage(
      canvas,
      boxX, boxY, boxWidth, boxHeight,
      0, 0, boxWidth, boxHeight
    );

    return faceCanvas.toDataURL('image/jpeg', 0.8);
  };

  const findMatchingFace = async (newImage: string): Promise<LocalFaceData | null> => {
    console.log('🔍 ✨ STARTING FACE MATCHING PROCESS ✨');
    console.log('📁 Database has', knownFaces.length, 'known faces to compare against');

    // Log all known face names for debugging
    if (knownFaces.length > 0) {
      console.log('👥 Known faces:', knownFaces.map(f => f.name).join(', '));
    }

    if (knownFaces.length === 0) {
      console.log('❌ NO KNOWN FACES IN DATABASE - will auto-register as new person');
      return null;
    }

    setSystemStatus(`Comparing against ${knownFaces.length} known faces...`);

    let bestMatch = null;
    let bestSimilarity = 0;

    // Compare against ALL known faces and find the best match
    for (let i = 0; i < knownFaces.length; i++) {
      const knownFace = knownFaces[i];
      console.log(`🔍 [${i+1}/${knownFaces.length}] Comparing with: ${knownFace.name}`);

      try {
        const similarity = await compareImages(newImage, knownFace.image);
        console.log(`📈 Similarity with ${knownFace.name}: ${similarity.toFixed(1)}%`);

        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = knownFace;
        }

        // Optimized threshold for base64 image comparison - 80% minimum for matches
        if (similarity >= 80) {
          console.log(`✅ MATCH FOUND! ${knownFace.name} with ${similarity.toFixed(1)}% similarity`);
          setSystemStatus(`Match found: ${knownFace.name} (${similarity.toFixed(1)}% similarity)`);
          return knownFace;
        }
      } catch (error) {
        console.error(`❌ Error comparing with ${knownFace.name}:`, error);
      }
    }

    console.log(`📈 BEST MATCH: ${bestMatch?.name || 'None'} with ${bestSimilarity.toFixed(1)}% similarity`);
    console.log('❌ NO SUFFICIENT MATCH FOUND (need >70%) - will auto-register as new person');
    setSystemStatus(`Best match: ${bestMatch?.name || 'None'} (${bestSimilarity.toFixed(1)}%) - registering as new`);
    return null;
  };

  // Extract face descriptor from image using face-api.js with timeout
  const extractFaceDescriptor = async (imageData: string): Promise<Float32Array | null> => {
    try {
      console.log('🔍 Starting face descriptor extraction...');

      const result = await Promise.race([
        new Promise<Float32Array | null>((resolve) => {
          const img = new Image();

          const cleanup = () => {
            img.onload = null;
            img.onerror = null;
          };

          img.onload = async () => {
            try {
              console.log('📷 Image loaded, extracting descriptor...');

              // Create canvas to draw the image
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                cleanup();
                resolve(null);
                return;
              }

              canvas.width = Math.min(img.width, 640); // Limit size for performance
              canvas.height = Math.min(img.height, 480);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

              // Use face-api.js to detect and get descriptor with shorter timeout
              const detectionPromise = faceApiService.detectFaces(canvas as any);
              const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Face detection timeout')), 3000) // Reduced to 3 seconds
              );

              const detections = await Promise.race([detectionPromise, timeoutPromise]);

              if (detections.length > 0 && detections[0].descriptor) {
                console.log('✅ Face descriptor extracted successfully');
                cleanup();
                resolve(detections[0].descriptor);
              } else {
                console.log('❌ No face descriptor found in image');
                cleanup();
                resolve(null);
              }
            } catch (error) {
              console.error('Error extracting face descriptor:', error);
              cleanup();
              resolve(null);
            }
          };

          img.onerror = () => {
            console.error('Error loading image for descriptor extraction');
            cleanup();
            resolve(null);
          };

          // Set source after event handlers
          img.src = imageData;
        }),

        // Overall timeout for the entire extraction
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Descriptor extraction timeout')), 10000)
        )
      ]);

      return result;
    } catch (error) {
      console.error('Face descriptor extraction error:', error);
      return null;
    }
  };

  // Compare face descriptors using face-api.js
  const compareFaceDescriptors = (descriptor1: Float32Array, descriptor2: Float32Array): number => {
    try {
      // Use face-api.js euclidean distance for proper face comparison
      const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
      const similarity = (1 - distance) * 100; // Convert to percentage

      console.log(`🔍 Face descriptor comparison: distance=${distance.toFixed(4)}, similarity=${similarity.toFixed(1)}%`);
      return Math.max(0, similarity);
    } catch (error) {
      console.error('Face descriptor comparison error:', error);
      return 0;
    }
  };

  // Enhanced basic image comparison with better face detection
  const basicImageComparison = async (image1: string, image2: string): Promise<number> => {
    try {
      const canvas1 = document.createElement('canvas');
      const canvas2 = document.createElement('canvas');
      const ctx1 = canvas1.getContext('2d');
      const ctx2 = canvas2.getContext('2d');

      if (!ctx1 || !ctx2) return 0;

      const size = 128; // Larger for better accuracy
      canvas1.width = canvas1.height = size;
      canvas2.width = canvas2.height = size;

      const img1 = new Image();
      const img2 = new Image();

      return new Promise<number>((resolve) => {
        let loadedCount = 0;
        const timeout = setTimeout(() => resolve(0), 3000); // Increased timeout

        const checkCompletion = () => {
          loadedCount++;
          if (loadedCount === 2) {
            clearTimeout(timeout);
            try {
              ctx1.drawImage(img1, 0, 0, size, size);
              ctx2.drawImage(img2, 0, 0, size, size);

              const data1 = ctx1.getImageData(0, 0, size, size).data;
              const data2 = ctx2.getImageData(0, 0, size, size).data;

              // Enhanced comparison with multiple metrics
              let colorDiff = 0;
              let brightnessMatch = 0;
              let edgeSimilarity = 0;
              let centerWeightedDiff = 0;

              // Face regions with different weights
              const faceRegions = [
                { startY: Math.floor(size * 0.2), endY: Math.floor(size * 0.5), weight: 3 }, // Eye region
                { startY: Math.floor(size * 0.4), endY: Math.floor(size * 0.7), weight: 2 }, // Nose region
                { startY: Math.floor(size * 0.6), endY: Math.floor(size * 0.9), weight: 2 }  // Mouth region
              ];

              for (const region of faceRegions) {
                for (let y = region.startY; y < region.endY; y++) {
                  for (let x = 0; x < size; x++) {
                    const i = (y * size + x) * 4;

                    const r1 = data1[i], g1 = data1[i+1], b1 = data1[i+2];
                    const r2 = data2[i], g2 = data2[i+1], b2 = data2[i+2];

                    // Color difference
                    const pixelColorDiff = Math.abs(r1-r2) + Math.abs(g1-g2) + Math.abs(b1-b2);
                    colorDiff += pixelColorDiff * region.weight;

                    // Brightness similarity
                    const bright1 = (r1 + g1 + b1) / 3;
                    const bright2 = (r2 + g2 + b2) / 3;
                    brightnessMatch += (255 - Math.abs(bright1 - bright2)) * region.weight;

                    // Center-weighted comparison (faces usually centered)
                    const centerX = size / 2;
                    const centerY = size / 2;
                    const distFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
                    const centerWeight = (1 - distFromCenter / maxDist) * region.weight;

                    centerWeightedDiff += pixelColorDiff * centerWeight;
                  }
                }
              }

              // Calculate edge similarity using gradients
              for (let y = 1; y < size - 1; y++) {
                for (let x = 1; x < size - 1; x++) {
                  const i = (y * size + x) * 4;
                  const rightI = (y * size + x + 1) * 4;
                  const bottomI = ((y + 1) * size + x) * 4;

                  // Calculate gradients for both images
                  const grad1X = Math.abs((data1[i] + data1[i+1] + data1[i+2]) - (data1[rightI] + data1[rightI+1] + data1[rightI+2]));
                  const grad1Y = Math.abs((data1[i] + data1[i+1] + data1[i+2]) - (data1[bottomI] + data1[bottomI+1] + data1[bottomI+2]));
                  const edge1 = Math.sqrt(grad1X * grad1X + grad1Y * grad1Y);

                  const grad2X = Math.abs((data2[i] + data2[i+1] + data2[i+2]) - (data2[rightI] + data2[rightI+1] + data2[rightI+2]));
                  const grad2Y = Math.abs((data2[i] + data2[i+1] + data2[i+2]) - (data2[bottomI] + data2[bottomI+1] + data2[bottomI+2]));
                  const edge2 = Math.sqrt(grad2X * grad2X + grad2Y * grad2Y);

                  edgeSimilarity += Math.max(0, 100 - Math.abs(edge1 - edge2));
                }
              }

              // Normalize values
              const totalPixels = size * size;
              const totalRegionWeight = faceRegions.reduce((sum, region) =>
                sum + ((region.endY - region.startY) * size * region.weight), 0
              );

              const colorSimilarity = Math.max(0, 100 - (colorDiff / (totalRegionWeight * 3 * 255)) * 100);
              const brightnessSimilarity = (brightnessMatch / (totalRegionWeight * 255)) * 100;
              const centerSimilarity = Math.max(0, 100 - (centerWeightedDiff / (totalPixels * 3 * 255 * 2)) * 100);
              const normalizedEdgeSimilarity = edgeSimilarity / ((size - 2) * (size - 2));

              // Weighted combination focusing on facial features
              const finalSimilarity = (
                colorSimilarity * 0.35 +
                brightnessSimilarity * 0.25 +
                centerSimilarity * 0.25 +
                normalizedEdgeSimilarity * 0.15
              );

              console.log(`🔍 Enhanced comparison - Color: ${colorSimilarity.toFixed(1)}%, Brightness: ${brightnessSimilarity.toFixed(1)}%, Center: ${centerSimilarity.toFixed(1)}%, Edge: ${normalizedEdgeSimilarity.toFixed(1)}%, Final: ${finalSimilarity.toFixed(1)}%`);

              resolve(Math.max(0, Math.min(100, finalSimilarity)));
            } catch (error) {
              console.error('Basic comparison error:', error);
              resolve(0);
            }
          }
        };

        img1.onload = img2.onload = checkCompletion;
        img1.onerror = img2.onerror = () => {
          clearTimeout(timeout);
          resolve(0);
        };

        img1.src = image1;
        img2.src = image2;
      });
    } catch (error) {
      console.error('Basic image comparison error:', error);
      return 0;
    }
  };

  // Removed old registerNewFace function - using autoRegisterNewPerson instead

  // Removed saveImageLocally - automatic registration handles storage


  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #1e40af 0%, #3730a3 50%, #581c87 100%)', '--color': 'white', '--border-width': '0', '--min-height': '70px' }}>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12  rounded-xl flex items-center justify-center backdrop-blur-sm shadow-lg">
                <span className="text-2xl"> {organization?.name}</span>
              </div>
             
            </div>
          
            <div className="flex items-center space-x-3">
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 shadow-md">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-white text-sm font-semibold">
                    ACTIVE
                  </span>
                </div>
              </div>

             
            </div>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ '--padding-top': '8px', '--padding-bottom': '8px', '--padding-start': '12px', '--padding-end': '12px' }}>
        {/* Full-Screen Loading Overlay */}
        {isLoading && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-blue-50 to-indigo-100"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9999,
              backgroundColor: 'rgba(59, 130, 246, 0.05)',
              backdropFilter: 'blur(8px)'
            }}
          >
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 border border-white/20">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>

                <h3 className="text-2xl font-bold text-gray-800 mb-3">
                  🚀 Initializing FaceCheck
                </h3>
                <p className="text-gray-600 mb-6 text-base">
                  {systemStatus}
                </p>

                <div className="space-y-3">
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-300 shadow-sm"
                      style={{ width: '85%' }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 font-medium">
                    🤖 Loading AI face recognition models...
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Please wait while we prepare the camera and AI systems
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Main Camera Interface - Only show when not loading */}
        {!isLoading && (
          <>
            {/* Compact Face Quality Indicator */}
            {isScanning && (
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-3 mb-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-xl">🎯</span>
                <div>
                  <div className="text-sm font-semibold text-gray-800">Face Detection</div>
                  <div className={`text-xs font-medium ${
                    faceQuality > 78 ? 'text-green-600' : faceQuality > 58 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {faceQuality}% {qualityStatus}
                  </div>
                </div>
              </div>
              <div className="w-16">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(5, faceQuality)}%`,
                      backgroundColor: faceQuality > 78 ? '#10b981' : faceQuality > 58 ? '#f59e0b' : '#ef4444'
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Compact Status Panel */}
        <div className="mb-3">
          <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-lg">🤖</span>
                <div>
                  <div className="text-sm font-semibold text-gray-800">AI System</div>
                  <div className="text-xs text-gray-500">{localFaceCache.length} Members</div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                  <span className="text-xs text-gray-600">{isScanning ? 'Active' : 'Standby'}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${localFaceCache.filter(e => !e.synced).length === 0 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span className="text-xs text-gray-600">DB</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Camera Interface */}
        <div className="relative mb-3">
          <div className="bg-gradient-to-b from-gray-50 to-gray-100 p-3 rounded-xl shadow-md border border-gray-200">

            {/* Camera Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse shadow-lg"></div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Live Recognition Feed</h3>
                  <p className="text-sm text-gray-600">AI-Powered Face Detection</p>
                </div>
              </div>

              <div className="bg-white px-4 py-2 rounded-lg border shadow-sm">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Quality</div>
                <div className="text-sm font-mono text-blue-600">
                  {Math.round(faceQuality)}%
                </div>
              </div>
            </div>

            {/* Camera Container */}
            <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl">
              <video
                ref={videoRef}
                width="480"
                height="320"
                autoPlay
                muted
                className="w-full h-auto transform scale-x-[-1] bg-black"
                style={{ maxHeight: '240px' }}
              />

              <canvas
                ref={canvasRef}
                width="480"
                height="320"
                className="absolute top-0 left-0 w-full h-auto transform scale-x-[-1] pointer-events-none z-10"
                style={{ maxHeight: '240px' }}
              />

              {/* Modern Overlay UI */}
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
                <div className="text-white text-sm font-medium">
                  {detectedPerson ? (
                    <span className="text-green-400">● {detectedPerson}</span>
                  ) : (
                    <span className="text-blue-400">● Scanning...</span>
                  )}
                </div>
              </div>

              {/* Processing Indicator */}
              {(processingState !== 'idle' || processingLock) && (
                <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2">
                  <div className="flex items-center space-x-2 text-white text-sm">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                    <span>Processing...</span>
                  </div>
                </div>
              )}

              {/* Status Bar */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="flex items-center justify-between text-white">
                  <div className="text-sm">
                    {systemStatus}
                  </div>
                  <div className="text-xs text-gray-300">
                    {isScanning ? 'LIVE' : 'STANDBY'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Manual Capture Button - Mobile Optimized */}
        <div className="mt-4 flex justify-center px-4">
          <IonButton
            onClick={handleManualCapture}
            disabled={isCaptureMode || !isScanning || processingLock}
            className="capture-button"
            style={{
              '--background': isCaptureMode ? '#ef4444' : '#3b82f6',
              '--background-hover': isCaptureMode ? '#dc2626' : '#2563eb',
              '--color': 'white',
              '--border-radius': '12px',
              '--padding-start': '1.5rem',
              '--padding-end': '1.5rem',
              '--height': '3rem',
              '--box-shadow': '0 8px 20px rgba(0, 0, 0, 0.15)',
              'width': '100%',
              'max-width': '280px'
            }}
          >
            <div className="flex items-center space-x-2">
              <span className="text-xl">
                {isCaptureMode ? '🔄' : '📸'}
              </span>
              <span className="font-semibold text-base">
                {isCaptureMode ? 'Processing...' : 'Scan'}
              </span>
            </div>
          </IonButton>
        </div>

        {/* Alatiris Logo */}
        <div className="mt-8 flex justify-center px-4">
          <div className="flex flex-col items-center space-y-2">
            <p className="text-xs text-gray-500 font-medium">Powered by</p>
            <div className="flex items-center space-x-3">
              <img
                src="/alatiris_logo.png"
                alt="Alatiris"
                className="h-16 opacity-75 hover:opacity-90 transition-all duration-300"
                style={{ maxWidth: '140px' }}
              />
              <div className="text-left">
                <div className="text-lg font-bold text-gray-700">Volt5</div>
                <div className="text-xs text-gray-500">Team</div>
              </div>
            </div>
          </div>
        </div>


        {/* Registration Prompt Dialog - Mobile Optimized */}
        {showRegistrationPrompt && (
          <IonCard className="registration-dialog" style={{ position: 'fixed', top: '12%', left: '3%', right: '3%', zIndex: 1000, maxHeight: '76vh', overflow: 'auto', boxShadow: '0 0 20px rgba(0,0,0,0.5)', borderRadius: '12px' }}>
            <IonCardContent>
              <div className="text-center">
                <div className="mb-3">
                  <span className="text-3xl">👤</span>
                </div>
                <h3 className="text-base font-bold mb-2">Face Not Recognized</h3>

                {capturedFaceImage && (
                  <div className="mb-3">
                    <img
                      src={capturedFaceImage}
                      alt="Captured face"
                      style={{ maxWidth: '100px', maxHeight: '100px', borderRadius: '8px', border: '2px solid #ccc', margin: '0 auto' }}
                    />
                  </div>
                )}

                <p className="text-gray-600 mb-3 text-sm px-2">
                  This face is not in our database. Register as new member?
                </p>

                {/* Name Input Field - Mobile Optimized */}
                <div className="mb-4 px-2">
                  <IonItem style={{ '--background': 'white', '--border-radius': '8px', '--border': '1px solid #e5e7eb' }}>
                    <IonLabel position="stacked" className="text-gray-700 font-medium text-sm">Member Name</IonLabel>
                    <IonInput
                      value={newMemberName}
                      onIonInput={(e) => setNewMemberName(e.detail.value!)}
                      placeholder="Enter full name"
                      clearInput={true}
                      style={{
                        '--color': '#374151',
                        '--placeholder-color': '#9ca3af',
                        '--padding-start': '8px',
                        '--padding-end': '8px',
                        'font-size': '14px',
                      'min-height': '40px'
                      }}
                    />
                  </IonItem>
                </div>

                <div className="flex flex-col gap-3 px-2">
                  <button
                    onClick={handleNewMemberRegistration}
                    disabled={!newMemberName.trim()}
                    className={`px-4 py-3 rounded-lg font-medium transition-colors text-sm ${
                      newMemberName.trim()
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    ➕ Register New Member
                  </button>
                  <button
                    onClick={() => {
                      setShowRegistrationPrompt(false);
                      setNewMemberName('');
                      resetCaptureState();
                    }}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium text-sm"
                  >
                    ❌ Cancel
                  </button>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        )}

        {/* Member Match Display */}


        {/* Manual Analysis Dialog - COMMENTED OUT FOR AUTOMATION */}
        {false && showAnalysisDialog && analysisResults && (
          <IonCard className="analysis-dialog" style={{ position: 'fixed', top: '10%', left: '5%', right: '5%', zIndex: 1000, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}>
            <IonCardContent>
              <div className="text-center">
                <div className="mb-2 p-2 bg-blue-100 rounded text-sm text-blue-700">
                  📸 Camera paused while dialog is open
                </div>
                <h3 className="text-lg font-bold mb-4">Face Analysis Results</h3>

                {/* Captured Image */}
                <div className="mb-4">
                  <img
                    src={analysisResults.capturedImage}
                    alt="Captured face"
                    style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', border: '2px solid #ccc' }}
                  />
                </div>

                {/* Recommendation */}
                <div className="mb-4 p-3 bg-blue-50 rounded">
                  <strong>Recommendation:</strong><br/>
                  <span className="text-sm">{analysisResults.recommendation}</span>
                </div>

                {/* Current Cache Contents */}
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Current Cache ({localFaceCache.length} faces):</h4>
                  {localFaceCache.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mb-4 justify-center">
                      {localFaceCache.map((cached, index) => (
                        <div key={index} className="text-center">
                          <img
                            src={cached.image}
                            alt={cached.name}
                            style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                          <div className="text-xs mt-1">{cached.name}</div>
                          <div className="text-xs text-gray-500">{cached.synced ? 'DB' : 'Cache'}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 text-sm mb-4">
                      No faces in cache - this explains why no matches were found!
                    </div>
                  )}
                </div>

                {/* Matches */}
                <div className="mb-4">
                  <h4 className="font-semibold mb-2">Analysis Results:</h4>
                  <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {analysisResults.matches.length > 0 ? analysisResults.matches.map((match, index) => (
                      <div
                        key={index}
                        className={`flex items-center p-2 mb-2 rounded ${match.isMatch ? 'bg-green-100' : 'bg-gray-100'}`}
                      >
                        <img
                          src={match.image}
                          alt={match.name}
                          style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '12px', objectFit: 'cover' }}
                        />
                        <div className="flex-1 text-left">
                          <div className="font-medium">{match.name}</div>
                          <div className={`text-sm ${match.isMatch ? 'text-green-700' : 'text-gray-600'}`}>
                            {(match.similarity * 100).toFixed(1)}% similarity
                            {match.distance !== undefined && (
                              <span className="text-xs"> (dist: {match.distance.toFixed(4)})</span>
                            )}
                            {match.isMatch ? ' ✅ MATCH' : ' ❌ NO MATCH'}
                          </div>
                        </div>
                        {match.isMatch && (
                          <button
                            onClick={() => handleMarkAsExisting(match.name)}
                            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                          >
                            Select
                          </button>
                        )}
                      </div>
                    )) : (
                      <div className="text-center text-gray-500 text-sm">
                        No comparison results - check cache contents above
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={handleRegisterAsNew}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Register as New Person
                  </button>
                  <button
                    onClick={handleDialogClose}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Close
                  </button>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        )}

        {/* Registration is now automatic - no dialog needed */}
          </>
        )}

        {/* Access Granted Dialog for Allowed Members */}
        {showAccessGrantedDialog && currentMatchedMember && (
          <IonCard className="access-granted-dialog" style={{
            position: 'fixed',
            top: '20%',
            left: '5%',
            right: '5%',
            zIndex: 1000,
            maxHeight: '60vh',
            borderRadius: '16px',
            boxShadow: '0 0 30px rgba(34, 197, 94, 0.4)',
            border: '2px solid #22c55e'
          }}>
            <IonCardContent style={{ padding: '32px' }}>
              <div className="text-center">
                {/* Success Animation */}
                <div className="mb-6">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <span className="text-4xl">✅</span>
                  </div>
                  <h2 className="text-2xl font-bold text-green-800 mb-2">Access Granted</h2>
                  <p className="text-green-600">Welcome! Entry approved</p>
                </div>

                {/* Member Info */}
                <div className="bg-green-50 p-6 rounded-xl border border-green-200 mb-4">
                  <div className="text-center">
                    {/* Member Photo */}
                    {currentMatchedMember.photo_url && (
                      <img
                        src={currentMatchedMember.photo_url}
                        alt={currentMatchedMember.name}
                        className="w-20 h-20 rounded-full object-cover border-4 border-green-300 mx-auto mb-3"
                      />
                    )}
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{currentMatchedMember.name}</h3>
                    <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800 mb-2">
                      🟢 {currentMatchedMember.status}
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {(currentMatchedMember.confidence * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">Match Confidence</div>
                  </div>
                </div>

                {/* Auto-close notice */}
                <div className="text-sm text-gray-500">
                  This dialog will close automatically in 5 seconds...
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        )}

        {/* Banned Dialog with Warning - Focused on Ban Details */}
        {showBannedDialog && currentMatchedMember && (
          <IonCard className="banned-dialog" style={{
            position: 'fixed',
            top: '20%',
            left: '5%',
            right: '5%',
            zIndex: 1000,
            maxHeight: '60vh',
            borderRadius: '16px',
            boxShadow: '0 0 30px rgba(239, 68, 68, 0.5)',
            border: '2px solid #ef4444',
            backgroundColor: '#fef2f2'
          }}>
            <IonCardContent style={{ padding: '24px' }}>
              <div className="text-center">
                {/* Warning Animation */}
                <div className="mb-4">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse border-4 border-red-300">
                    <span className="text-4xl">🚫</span>
                  </div>
                  <h2 className="text-2xl font-bold text-red-800 mb-2">ACCESS DENIED</h2>
                  <p className="text-red-600 font-semibold">This member is banned from entry</p>
                </div>

                {/* Member Info with Ban Details */}
                <div className="bg-red-100 p-4 rounded-xl border-2 border-red-300 mb-4">
                  <div className="text-center">
                    {/* Member Photo */}
                    {currentMatchedMember.photo_url && (
                      <img
                        src={currentMatchedMember.photo_url}
                        alt={currentMatchedMember.name}
                        className="w-16 h-16 rounded-full object-cover border-3 border-red-400 mx-auto mb-3 grayscale"
                      />
                    )}
                    <h3 className="text-xl font-bold text-red-800 mb-2">{currentMatchedMember.name}</h3>
                    <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-red-200 text-red-900 mb-3">
                      🚫 BANNED
                    </div>

                    {/* Ban Details - Prominent Display */}
                    {currentMatchedMember.details ? (
                      <div className="mt-3 p-3 bg-red-50 border border-red-300 rounded-lg">
                        <h4 className="font-bold text-red-800 text-sm mb-2">⚠️ Ban Reason:</h4>
                        <p className="text-sm text-red-700 font-medium">{currentMatchedMember.details}</p>
                      </div>
                    ) : (
                      <div className="mt-3 p-3 bg-red-50 border border-red-300 rounded-lg">
                        <p className="text-sm text-red-700 font-medium">⚠️ Member access has been revoked</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        )}

        {/* VIP Dialog with Special Treatment - Simplified for Android */}
        {showVIPDialog && currentMatchedMember && (
          <IonCard className="vip-dialog" style={{
            position: 'fixed',
            top: '20%',
            left: '5%',
            right: '5%',
            zIndex: 1000,
            maxHeight: '60vh',
            borderRadius: '16px',
            boxShadow: '0 0 30px rgba(147, 51, 234, 0.5)',
            border: '2px solid #a855f7',
            background: 'linear-gradient(135deg, #fef3c7, #ede9fe)'
          }}>
            <IonCardContent style={{ padding: '24px' }}>
              <div className="text-center">
                {/* VIP Animation */}
                <div className="mb-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-yellow-200 to-purple-200 rounded-full flex items-center justify-center mx-auto mb-3 border-4 border-yellow-400 animate-pulse">
                    <span className="text-4xl">👑</span>
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-600 to-purple-600 bg-clip-text text-transparent mb-2">VIP ACCESS</h2>
                  <p className="text-purple-600 font-semibold">Welcome, distinguished member!</p>
                </div>

                {/* VIP Member Info - Compact */}
                <div className="bg-gradient-to-r from-yellow-50 to-purple-50 p-4 rounded-xl border-2 border-purple-300 mb-4">
                  <div className="text-center">
                    {/* VIP Member Photo */}
                    {currentMatchedMember.photo_url && (
                      <img
                        src={currentMatchedMember.photo_url}
                        alt={currentMatchedMember.name}
                        className="w-16 h-16 rounded-full object-cover border-3 border-yellow-400 mx-auto mb-3"
                      />
                    )}
                    <h3 className="text-xl font-bold bg-gradient-to-r from-yellow-700 to-purple-700 bg-clip-text text-transparent mb-2">{currentMatchedMember.name}</h3>
                    <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold bg-gradient-to-r from-yellow-200 to-purple-200 text-purple-900 mb-3">
                      ⭐ VIP MEMBER ⭐
                    </div>
                    <div className="text-lg font-bold bg-gradient-to-r from-yellow-600 to-purple-600 bg-clip-text text-transparent">
                      {(currentMatchedMember.confidence * 100).toFixed(1)}% Match
                    </div>
                  </div>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        )}

      </IonContent>
    </IonPage>
  );
};

export default SimpleFaceScanner;