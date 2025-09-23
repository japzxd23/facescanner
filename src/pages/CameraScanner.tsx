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
import {
  getMembers,
  addAttendanceLog,
  addMember,
  hasAttendedToday,
  Member,
  setOrganizationContext,
  clearOrganizationContext
} from '../services/supabaseClient';
import { useOrganization } from '../contexts/OrganizationContext';

// 🎛️ CONFIGURATION
const MIRROR_CAMERA = true; // Set to false to disable camera mirroring

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
      console.log('Initializing face recognition service...');
      await faceRecognitionService.initialize();
      console.log('Face recognition service initialized successfully');

      console.log('📋 Loading members for organization...');
      const membersData = await getMembers();
      console.log('✅ Members loaded:', membersData.length, 'members');
      console.log('📊 Members data:', membersData.map(m => ({ name: m.name, status: m.status, org_id: m.organization_id })));
      setMembers(membersData);

      // If no members exist, let's add a test member for debugging
      if (membersData.length === 0) {
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

  // Refresh members cache
  const refreshMembersCache = async () => {
    try {
      console.log('🔄 Refreshing members cache...');
      const freshMembers = await getMembers();
      setMembers(freshMembers);
      setLastCacheRefresh(Date.now());
      console.log('✅ Members cache refreshed:', freshMembers.length, 'members');
      return freshMembers;
    } catch (error) {
      console.error('❌ Failed to refresh members cache:', error);
      return members; // Return existing cache if refresh fails
    }
  };

  // Check if cache needs refresh and do it periodically
  const checkAndRefreshCache = async () => {
    const now = Date.now();
    if (now - lastCacheRefresh > CACHE_REFRESH_INTERVAL) {
      return await refreshMembersCache();
    }
    return members;
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
      const faces = await faceRecognitionService.detectFaces(videoRef.current);
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
        // Clear match state when no faces are detected
        if (lastMatch) {
          console.log('🧹 No faces detected - clearing previous match state');
          setLastMatch(null);
        }
      }

      if (faces.length > 0) {
        const face = faces[0]; // Use the first detected face

        console.log('👤 Processing detected face...');

        // Validate face quality before processing
        const videoElement = videoRef.current;
        const quality = faceRecognitionService.validateFaceQuality(
          face,
          videoElement.videoWidth,
          videoElement.videoHeight
        );

        console.log('Face quality check:', quality);
        setFaceQuality(quality);

        if (!quality.isValid) {
          console.log('⚠️ REJECTED FACE - Not valid:', quality.reason);
          console.log('🚫 This detection was rejected - likely hand, object, or poor quality face');
          // Clear detection results for poor quality
          setDetectedFaces([]);
          setLastMatch(null);
          // Continue scanning faster when rejecting poor quality faces
          setTimeout(() => {
            scanForFaces();
          }, 300);
          return;
        }

        console.log('✅ Processing high-quality face:', quality.reason);

        // 🛑 PAUSE SCANNING to process this face properly
        console.log('🛑 PAUSING scanning to process detected face...');
        setIsProcessingFace(true);

        // 🚀 IMMEDIATE CAPTURE: Crop face image right now before any delays
        console.log('📸 Capturing face image immediately to avoid movement delays...');
        const immediatelycroppedFace = faceRecognitionService.cropFaceFromVideo(videoElement, face);
        console.log('📸 IMMEDIATE CAPTURE RESULT:', !!immediatelycroppedFace ? 'SUCCESS' : 'FAILED');

        const embedding = faceRecognitionService.generateEmbedding(face);
        console.log('Generated embedding length:', embedding.length);

        // 🆔 CHECK IF DIFFERENT PERSON: Compare embeddings to detect new person
        let isDifferentPerson = true;
        let similarityScore = 0;

        if (lastEmbedding.length > 0 && embedding.length > 0) {
          similarityScore = faceRecognitionService.calculateSimilarity(embedding, lastEmbedding);
          // Very strict threshold for different person detection - must be significantly different
          isDifferentPerson = similarityScore < 0.80; // Increased to 0.80 for much stricter person distinction
          console.log('Face similarity with last detection:', similarityScore.toFixed(3), '- Different person:', isDifferentPerson);
        }

        // 🚫 MANDATORY DELAY for fast switching: Always wait at least 1.5 seconds between different people
        const currentTime = Date.now();
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
        }

        // Store current embedding for next comparison
        setLastEmbedding(embedding);

        if (embedding.length > 0) {
          // Refresh cache periodically to ensure we have latest member data
          const currentMembers = await checkAndRefreshCache();

          // Convert stored members to the format expected by matchFace
          const storedEmbeddings = currentMembers
            .filter(member => member.face_embedding && member.face_embedding.length > 0)
            .map(member => ({
              id: member.id,
              name: member.name,
              status: member.status,
              embedding: member.face_embedding as number[]
            }));

          // Use higher threshold for more accurate matching (0.75 instead of default 0.70)
          const match = await faceRecognitionService.matchFace(embedding, storedEmbeddings, 0.75);

          const currentTime = Date.now();

          console.log('🔍 FACE MATCHING RESULT:', {
            embeddingLength: embedding.length,
            storedMembersCount: storedEmbeddings.length,
            matchFound: !!match,
            matchDetails: match ? { name: match.name, confidence: match.confidence } : 'No match'
          });

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
            console.log('▶️ RESUMING scanning after processing match for:', match.name);
            setIsProcessingFace(false);
            setTimeout(() => {
              scanForFaces();
            }, 2000);
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

            console.log('🚨 Processing unrecognized face for registration');

            console.log('🚨 Unrecognized face detected - starting registration process');
            setLastDetectionTime(currentTime);

            // Trigger yellow flash and sound for unrecognized face
            triggerStatusFlash('warning');
            playSound('unregistered');

            // Use the immediately captured face image (no delay!)
            if (immediatelycroppedFace) {
              console.log('📸 Processing face for registration');

              // 🔍 VALIDATE: Make sure we captured a face, not a body
              console.log('🔍 Validating captured image contains actual face...');
              const isValidFace = await faceRecognitionService.validateCapturedFace(immediatelycroppedFace);
              console.log('🔍 FACE VALIDATION RESULT:', isValidFace ? 'VALID' : 'INVALID');

              if (isValidFace) {
                console.log('✅ Captured image validation passed - showing registration');
                const unrecognizedFaceData = { embedding, imageData: immediatelycroppedFace };
                setUnrecognizedFace(unrecognizedFaceData);
                setLastUnrecognizedFace(unrecognizedFaceData); // Store for re-triggering

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
              const fallbackCroppedFace = faceRecognitionService.cropFaceFromVideo(videoElement, face);
              console.log('🔄 FALLBACK CAPTURE RESULT:', !!fallbackCroppedFace ? 'SUCCESS' : 'FAILED');
              if (fallbackCroppedFace) {
                console.log('⚠️ Using fallback face capture - validating...');
                const isValidFallback = await faceRecognitionService.validateCapturedFace(fallbackCroppedFace);

                if (isValidFallback) {
                  console.log('✅ Fallback capture validation passed');
                  const fallbackUnrecognizedFaceData = { embedding, imageData: fallbackCroppedFace };
                  setUnrecognizedFace(fallbackUnrecognizedFaceData);
                  setLastUnrecognizedFace(fallbackUnrecognizedFaceData); // Store for re-triggering
                  setShowRegistrationPrompt(true);
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
                setUnrecognizedFace(emergencyUnrecognizedFaceData);
                setLastUnrecognizedFace(emergencyUnrecognizedFaceData);
                setShowRegistrationPrompt(true);
                console.log('🎬 EMERGENCY REGISTRATION PROMPT SET TO TRUE');
                return;
              }

              // Continue scanning if all captures failed or were invalid
            }

            // ▶️ RESUME SCANNING after failed face processing
            console.log('▶️ RESUMING scanning after failed face processing');
            setIsProcessingFace(false);
            setTimeout(() => {
              scanForFaces();
            }, 300); // Slightly faster retry for unrecognized faces
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

        setTimeout(() => {
          scanForFaces();
        }, 100); // Very fast scanning when no faces detected for pass-by detection
      }
    } catch (error) {
      console.error('Scanning error:', error);
      setTimeout(() => {
        scanForFaces();
      }, 1000);
    }
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
        organizationMode: isLegacyMode ? 'legacy' : 'multi-tenant',
        organizationId: organization?.id
      });

      const newMember = await addMember({
        name: newMemberName.trim(),
        face_embedding: unrecognizedFace.embedding,
        status: newMemberStatus,
        photo_url: unrecognizedFace.imageData
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

      // ▶️ RESUME SCANNING after successful registration
      console.log('▶️ RESUMING scanning after successful registration');
      setIsProcessingFace(false);
      setTimeout(() => {
        setLastMatch(null);
        scanForFaces();
      }, 1500);

    } catch (error) {
      console.error('Failed to register member:', error);
      setError('Failed to register new member');
      // ▶️ RESUME SCANNING even on registration error
      console.log('▶️ RESUMING scanning after registration error');
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

    // ▶️ RESUME SCANNING after registration rejection
    console.log('▶️ RESUMING scanning after registration rejection');
    setIsProcessingFace(false);
    setTimeout(() => {
      scanForFaces();
    }, 200);
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
        <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
          <video
            ref={videoRef}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              background: '#000',
              transform: MIRROR_CAMERA ? 'scaleX(-1)' : 'none'
            }}
            autoPlay
            muted
            playsInline
          />
          <canvas
            ref={canvasRef}
            style={{ display: 'none' }}
          />

          {/* Status Flash Overlay */}
          {statusFlash && (
            <div className={`status-flash status-flash-${statusFlash}`} />
          )}

          {/* Immersive Scanner Frame - Only when no faces detected */}
          {isScanning && detectedFaces.length === 0 && (
            <div className="scanner-frame" />
          )}

          {/* Live Head Movement Tracking */}
          {detectedFaces.length > 0 && detectedFaces.map((face, index) => {
            if (!videoRef.current || !face.box) return null;

            const videoElement = videoRef.current;
            const videoRect = videoElement.getBoundingClientRect();

            if (!videoElement.videoWidth || !videoElement.videoHeight) return null;

            const scaleX = videoRect.width / videoElement.videoWidth;
            const scaleY = videoRect.height / videoElement.videoHeight;

            // Create dynamic head tracking overlay that follows the face
            // Account for camera mirroring and device-specific adjustments
            let faceX = face.box.xMin * scaleX;
            const faceY = face.box.yMin * scaleY;
            const faceWidth = face.box.width * scaleX;
            const faceHeight = face.box.height * scaleY;

            // Flip X coordinate if camera is mirrored
            if (MIRROR_CAMERA) {
              faceX = videoRect.width - (faceX + faceWidth);
            }

            // Device-specific head tracker adjustments
            const userAgent = navigator.userAgent;
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
            const isTablet = /iPad|Android.*tablet|tablet/i.test(userAgent);
            const isPhone = isMobile && !isTablet;

            // Adjust head tracker size based on device
            const trackerPadding = isPhone ? 30 : isTablet ? 25 : 20;
            const trackerRadius = isPhone ? '60% 60% 50% 50%' : isTablet ? '55% 55% 45% 45%' : '50% 50% 40% 40%';
            const borderWidth = isPhone ? 4 : isTablet ? 3 : 3;
            const fontSize = isPhone ? '14px' : isTablet ? '13px' : '12px';

            return (
              <div
                key={`head-track-${index}`}
                style={{
                  position: 'absolute',
                  left: `${faceX - trackerPadding}px`,
                  top: `${faceY - trackerPadding * 2}px`,
                  width: `${faceWidth + trackerPadding * 2}px`,
                  height: `${faceHeight + trackerPadding * 2.5}px`,
                  borderRadius: trackerRadius,
                  border: positioningGuide === 'perfect' ? `${borderWidth}px solid #059669` :
                          positioningGuide === 'too-close' ? `${borderWidth}px solid #f59e0b` : `${borderWidth}px solid #dc2626`,
                  background: positioningGuide === 'perfect' ? 'rgba(5, 150, 105, 0.1)' :
                             positioningGuide === 'too-close' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(220, 38, 38, 0.1)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  pointerEvents: 'none',
                  zIndex: 8,
                  transition: 'all 0.3s ease-out',
                  boxShadow: positioningGuide === 'perfect' ? `0 0 ${trackerPadding}px rgba(5, 150, 105, 0.4)` :
                            positioningGuide === 'too-close' ? `0 0 ${trackerPadding}px rgba(245, 158, 11, 0.4)` : `0 0 ${trackerPadding}px rgba(220, 38, 38, 0.4)`
                }}
              >
                {/* Dynamic positioning message that follows the head */}
                <div style={{
                  position: 'absolute',
                  top: '-40px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: positioningGuide === 'perfect' ? 'rgba(5, 150, 105, 0.9)' :
                             positioningGuide === 'too-close' ? 'rgba(245, 158, 11, 0.9)' : 'rgba(220, 38, 38, 0.9)',
                  color: 'white',
                  padding: isPhone ? '8px 16px' : isTablet ? '7px 14px' : '6px 12px',
                  borderRadius: isPhone ? '25px' : isTablet ? '22px' : '20px',
                  fontSize: fontSize,
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}>
                  {positioningGuide === 'perfect' && '✨ Perfect!'}
                  {positioningGuide === 'too-close' && '👇 Step back'}
                  {positioningGuide === 'too-far' && '👆 Come closer'}
                </div>
              </div>
            );
          })}

          {/* Scanning Animation Overlay */}
          {isScanning && (
            <div className="scanning-overlay">
              <div className="scanning-grid" />
              <div className="scanning-line" />
              <div className="scanning-corners">
                <div className="corner top-left" />
                <div className="corner top-right" />
                <div className="corner bottom-left" />
                <div className="corner bottom-right" />
              </div>
            </div>
          )}

          {/* Facial Features Tracking */}
          {facialFeatures.length > 0 && (
            <div className="facial-features">
              {facialFeatures.map((feature, index) => (
                <div
                  key={index}
                  className={`feature-point ${feature.type}`}
                  style={{
                    left: `${feature.x}px`,
                    top: `${feature.y}px`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Face Detection Boxes */}
          {detectedFaces.map((face, index) => {
            if (!videoRef.current || !face.box) return null;

            const videoElement = videoRef.current;
            const videoRect = videoElement.getBoundingClientRect();

            // Check if video dimensions are available
            if (!videoElement.videoWidth || !videoElement.videoHeight) return null;

            const scaleX = videoRect.width / videoElement.videoWidth;
            const scaleY = videoRect.height / videoElement.videoHeight;

            // Account for camera mirroring in face detection boxes
            let boxX = face.box.xMin * scaleX;
            const boxY = face.box.yMin * scaleY;
            const boxWidth = face.box.width * scaleX;
            const boxHeight = face.box.height * scaleY;

            // Flip X coordinate if camera is mirrored
            if (MIRROR_CAMERA) {
              boxX = videoRect.width - (boxX + boxWidth);
            }

            console.log('Rendering face box:', {
              face: face.box,
              videoRect,
              scales: { scaleX, scaleY },
              videoDimensions: { width: videoElement.videoWidth, height: videoElement.videoHeight },
              mirrored: MIRROR_CAMERA
            });

            return (
              <div
                key={index}
                className="face-detection-box"
                style={{
                  position: 'absolute',
                  left: `${boxX}px`,
                  top: `${boxY}px`,
                  width: `${boxWidth}px`,
                  height: `${boxHeight}px`,
                  border: lastMatch
                    ? (lastMatch.status === 'Banned' ? '3px solid #ef4444' : '3px solid #10b981')
                    : '3px solid #fbbf24',
                  borderRadius: '8px',
                  boxShadow: lastMatch
                    ? (lastMatch.status === 'Banned' ? '0 0 20px rgba(239, 68, 68, 0.5)' : '0 0 20px rgba(16, 185, 129, 0.5)')
                    : '0 0 20px rgba(251, 191, 36, 0.5)',
                  zIndex: 1000,
                }}
              />
            );
          })}
          
          {/* Match result overlay */}
          {lastMatch && (
            <div className="camera-overlay">
              <IonText color={
                lastMatch.status === 'VIP' ? 'tertiary' :
                lastMatch.status === 'Banned' ? 'danger' : 'success'
              }>
                <h2>{lastMatch.name}</h2>
                <p className={`status-${lastMatch.status.toLowerCase()}`}>
                  {lastMatch.status}
                </p>
                <p style={{ fontSize: '0.9em', opacity: 0.7 }}>
                  Confidence: {(lastMatch.confidence * 100).toFixed(1)}%
                </p>
              </IonText>
            </div>
          )}

          {/* Loading overlay */}
          {!isInitialized && (
            <div className="camera-overlay">
              <IonSpinner />
              <p>Initializing face recognition...</p>
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="camera-overlay">
              <IonText color="danger">
                <p>{error}</p>
              </IonText>
            </div>
          )}

          {/* Distance Indicator */}
          {detectedFaces.length > 0 && (
            <div className={`distance-indicator ${positioningGuide}`}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                📏 Distance: {positioningGuide.toUpperCase()}
              </div>
              <div style={{ fontSize: '10px', opacity: 0.8 }}>
                {positioningGuide === 'too-far' && 'Move closer to camera'}
                {positioningGuide === 'too-close' && 'Step back from camera'}
                {positioningGuide === 'perfect' && 'Perfect positioning!'}
              </div>
            </div>
          )}

          {/* Enterprise Status Panel */}
          <div style={{
            position: 'absolute',
            top: '24px',
            left: '24px',
            background: 'rgba(26, 29, 41, 0.9)',
            backdropFilter: 'blur(15px)',
            color: '#e2e8f0',
            padding: '20px',
            borderRadius: '16px',
            fontSize: '14px',
            fontFamily: '"Segoe UI", system-ui, sans-serif',
            fontWeight: '500',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.15)',
            minWidth: '320px'
          }}>
            <p style={{ margin: 0 }}>
              🎯 Members: {members.length} | 📡 Status: {
                !isScanning ? '🔴 OFFLINE' :
                isProcessingFace ? '⏸️ PROCESSING FACE' :
                '🟢 LIVE SCANNING'
              }
            </p>
            <p style={{ margin: '5px 0 0 0', color: '#64b5f6', fontSize: '0.8em' }}>
              🪞 Mirror: {MIRROR_CAMERA ? 'ON' : 'OFF'}
            </p>
            {detectedFaces.length > 0 && (
              <p style={{ margin: '5px 0 0 0', color: '#fbbf24' }}>
                👤 Faces Detected: {detectedFaces.length}
              </p>
            )}
            {faceQuality && (
              <p style={{
                margin: '5px 0 0 0',
                color: faceQuality.isValid ? '#10b981' : '#ef4444',
                fontSize: '0.8em'
              }}>
                {faceQuality.isValid ? '✅ VALID FACE' : '❌ REJECTED'} - {Math.round(faceQuality.score * 100)}%
                {!faceQuality.isValid && (
                  <span style={{ display: 'block', fontSize: '0.7em', marginTop: '2px' }}>
                    Reason: {faceQuality.reason}
                  </span>
                )}
              </p>
            )}
            {lastMatch && (
              <p style={{ margin: '5px 0 0 0', color: lastMatch.status === 'Banned' ? '#ef4444' : '#10b981' }}>
                ✅ Last: {lastMatch.name} ({lastMatch.status})
              </p>
            )}
            <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '0.8em' }}>
              🚀 Fully Automated Detection
            </p>
          </div>

          {/* Register Face Button - Shows when unregistered face was detected but modal dismissed */}
          {!showRegistrationPrompt && lastUnrecognizedFace && !lastMatch && (
            <div style={{
              position: 'absolute',
              bottom: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000
            }}>
              <IonButton
                color="warning"
                fill="solid"
                onClick={handleRetriggerRegistration}
                style={{
                  '--background': '#f59e0b',
                  '--color': '#ffffff',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  padding: '12px 24px',
                  borderRadius: '25px',
                  boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)',
                  animation: 'pulse 2s ease-in-out infinite'
                }}
              >
                👤 Register This Face
              </IonButton>
            </div>
          )}

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
              {unrecognizedFace?.imageData && (
                <img
                  src={unrecognizedFace.imageData}
                  alt="Captured face"
                  style={{
                    maxWidth: '200px',
                    maxHeight: '200px',
                    borderRadius: '8px',
                    border: '2px solid #ccc'
                  }}
                />
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