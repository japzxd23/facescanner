import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import * as faceDetection from '@tensorflow-models/face-detection';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import { faceEmbeddingCache, CachedFaceEmbedding } from './faceEmbeddingCache';
import { supabase } from './supabaseClient';

export interface TensorFlowFaceDetectionResult {
  detected: boolean;
  confidence: number;
  box?: { x: number; y: number; width: number; height: number };
  keypoints?: Array<{ x: number; y: number; name?: string }>;
  embedding?: number[];
  qualityScore: number;
}

export interface FaceMatchResult {
  matched: boolean;
  person?: CachedFaceEmbedding;
  similarity: number;
  confidence: number;
}

class TensorFlowFaceDetectionService {
  private detector: faceDetection.FaceDetector | null = null;
  private landmarkDetector: faceLandmarksDetection.FaceLandmarksDetector | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  // Configuration
  private readonly MAX_FACES = 3;
  private readonly MIN_CONFIDENCE = 0.5;
  private readonly SIMILARITY_THRESHOLD = 0.90; // SECURITY UPDATE: Raised from 0.85 to prevent false positives with children/family

  async initialize(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    if (this.isInitialized) {
      return;
    }

    this.initializationPromise = this._performInitialization();
    await this.initializationPromise;
  }

  private async _performInitialization(): Promise<void> {
    try {
      console.log('🚀 Initializing TensorFlow.js Face Detection...');

      // Set up TensorFlow backend with optimal configuration
      await this._setupTensorFlowBackend();

      // Create optimized face detector
      await this._createFaceDetector();

      // Create face landmarks detector for enhanced accuracy
      await this._createLandmarksDetector();

      this.isInitialized = true;
      console.log('✅ TensorFlow Face Detection initialized successfully');
    } catch (error) {
      console.error('❌ TensorFlow Face Detection initialization failed:', error);
      this.initializationPromise = null;
      throw error;
    }
  }

  private async _setupTensorFlowBackend(): Promise<void> {
    console.log('🔧 Setting up TensorFlow backend...');
    console.log('Available backends:', tf.engine().backendNames);

    try {
      // Try WebGL first for best performance
      console.log('Attempting WebGL backend...');
      await tf.setBackend('webgl');
      await tf.ready();

      // Configure WebGL for optimal performance
      tf.env().set('WEBGL_CPU_FORWARD', false);
      tf.env().set('WEBGL_PACK', true);
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', false);
      tf.env().set('WEBGL_RENDER_FLOAT32_CAPABLE', true);

      console.log('✅ WebGL backend initialized');
      console.log('WebGL version:', tf.env().get('WEBGL_VERSION'));
      console.log('Memory info:', tf.memory());
    } catch (webglError) {
      console.warn('⚠️ WebGL failed, falling back to CPU:', webglError);
      await tf.setBackend('cpu');
      await tf.ready();
      console.log('✅ CPU backend initialized');
    }
  }

  private async _createFaceDetector(): Promise<void> {
    console.log('🎯 Creating MediaPipe Face Detector...');

    const detectorConfig: faceDetection.MediaPipeFaceDetectorTfjsConfig = {
      runtime: 'tfjs', // Use tfjs runtime for better compatibility
      modelType: 'short', // Faster than 'full', good for real-time
      maxFaces: this.MAX_FACES,
      refineLandmarks: true, // Enable for better keypoint accuracy
    };

    console.log('Detector configuration:', detectorConfig);

    try {
      // Add timeout for model loading
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Model loading timeout (30s)')), 30000)
      );

      const loadPromise = faceDetection.createDetector(
        faceDetection.SupportedModels.MediaPipeFaceDetector,
        detectorConfig
      );

      this.detector = await Promise.race([loadPromise, timeoutPromise]) as faceDetection.FaceDetector;
      console.log('✅ MediaPipe Face Detector created successfully');
    } catch (error) {
      console.error('❌ Failed to create face detector:', error);
      throw new Error(`Face detector creation failed: ${error.message}`);
    }
  }

  private async _createLandmarksDetector(): Promise<void> {
    console.log('🎯 Creating Face Landmarks Detector for 468-point precision...');

    const landmarkConfig: faceLandmarksDetection.MediaPipeFaceMeshTfjsConfig = {
      runtime: 'tfjs',
      refineLandmarks: true,    // More accurate landmarks
      maxFaces: 1,             // Single face for performance
      detectorModelUrl: undefined, // Use default model
      landmarkModelUrl: undefined  // Use default model
    };

    console.log('🎯 Landmarks detector config:', landmarkConfig);

    try {
      // Add timeout for model loading
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Landmarks model loading timeout (30s)')), 30000)
      );

      const loadPromise = faceLandmarksDetection.createDetector(
        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
        landmarkConfig
      );

      this.landmarkDetector = await Promise.race([loadPromise, timeoutPromise]) as faceLandmarksDetection.FaceLandmarksDetector;
      console.log('✅ Face Landmarks Detector created successfully (468 landmarks)');
    } catch (error) {
      console.error('❌ Failed to create landmarks detector:', error);
      throw new Error(`Landmarks detector creation failed: ${error.message}`);
    }
  }

  async detectFaces(imageElement: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<TensorFlowFaceDetectionResult[]> {
    if (!this.isInitialized || !this.detector || !this.landmarkDetector) {
      throw new Error('TensorFlow Face Detection not initialized');
    }

    try {
      console.log('🔍 Detecting faces with enhanced landmarks...');
      const startTime = performance.now();

      // 1. Perform basic face detection
      const predictions = await this.detector.estimateFaces(imageElement);

      // 2. Get detailed 468-point landmarks for enhanced accuracy
      const landmarks = await this.landmarkDetector.estimateFaces(imageElement);

      const endTime = performance.now();
      console.log(`Enhanced face detection completed in ${(endTime - startTime).toFixed(2)}ms`);

      if (!predictions || predictions.length === 0) {
        console.log('No faces detected');
        return [];
      }

      console.log('🔥 Enhanced Detection Results:', {
        basicFaces: predictions.length,
        landmarkFaces: landmarks.length,
        totalLandmarks: landmarks.reduce((sum, face) => sum + (face.keypoints?.length || 0), 0)
      });

      // Log first face details for debugging
      if (predictions.length > 0) {
        console.log(`Face 0 basic:`, {
          box: predictions[0].box,
          keypoints: predictions[0].keypoints?.length || 0
        });
      }

      if (landmarks.length > 0) {
        console.log(`Face 0 landmarks:`, {
          keypoints: landmarks[0].keypoints?.length || 0,
          boundingBox: landmarks[0].box
        });
      }

      // Process results with enhanced landmark data
      const results: TensorFlowFaceDetectionResult[] = [];

      for (let i = 0; i < predictions.length; i++) {
        const prediction = predictions[i];
        const faceLandmarks = landmarks[i] || null; // Match face with its landmarks

        const result = this._processFaceDetectionWithLandmarks(prediction, faceLandmarks, imageElement);
        if (result.confidence >= this.MIN_CONFIDENCE) {
          results.push(result);
        }
      }

      console.log(`Processed ${results.length} valid faces with 468-point landmarks from ${predictions.length} detections`);
      return results;
    } catch (error) {
      console.error('Face detection error:', error);
      return [];
    }
  }

  private _processFaceDetectionWithLandmarks(
    face: faceDetection.Face,
    landmarks: faceLandmarksDetection.Face | null,
    imageElement: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ): TensorFlowFaceDetectionResult {
    // Extract bounding box
    const box = face.box;
    const confidence = 1.0; // MediaPipe doesn't provide confidence scores

    // 🚀 ENHANCED: Use 468-point landmarks for ultimate accuracy
    let keypoints: Array<{ x: number; y: number; name?: string }> = [];
    let hasDetailedLandmarks = false;

    if (landmarks && landmarks.keypoints && landmarks.keypoints.length > 0) {
      console.log('✨ Using 468-point facial landmarks for maximum hand vs face distinction');
      hasDetailedLandmarks = true;

      // Process 468 detailed landmarks - these are impossible for hands to replicate
      keypoints = landmarks.keypoints.map((kp, index) => ({
        x: kp.x || 0,
        y: kp.y || 0,
        z: kp.z || 0, // 3D landmark depth
        name: this._getLandmarkName(index) // Anatomical names like 'left_eye_inner', 'nose_tip'
      }));

      console.log('🎯 468-point landmarks processed:', {
        totalLandmarks: keypoints.length,
        faceMeshBox: landmarks.box,
        sample: keypoints.slice(0, 5).map(kp => `${kp.name}: (${kp.x.toFixed(1)}, ${kp.y.toFixed(1)})`)
      });

    } else if (face.keypoints && face.keypoints.length > 0) {
      console.log('📍 Fallback: Using basic MediaPipe keypoints (less accurate)');

      // Fallback to basic keypoints
      keypoints = face.keypoints.map((kp, index) => {
        let x = 0, y = 0, name = 'unknown';

        if (typeof kp === 'object' && kp !== null) {
          x = kp.x || kp.X || kp[0] || 0;
          y = kp.y || kp.Y || kp[1] || 0;
          name = kp.name || kp.Name || this._getKeypointName(index);
        } else if (Array.isArray(kp) && kp.length >= 2) {
          x = kp[0];
          y = kp[1];
          name = this._getKeypointName(index);
        }

        return { x, y, name };
      });

      console.log('🎯 Basic keypoints processed:', keypoints.length, 'points');
    } else {
      console.warn('❌ No keypoints found in face detection - this will likely fail validation');
    }

    // Calculate quality score
    const qualityScore = this._calculateQualityScore(face, imageElement);

    // Generate enhanced embedding using 468 landmarks or fallback to basic
    const embedding = hasDetailedLandmarks ?
      this._generateAdvancedEmbeddingFrom468Landmarks(landmarks!, keypoints) :
      this._generateEmbedding(face);

    console.log('🧠 Embedding generated using:', hasDetailedLandmarks ? '468 landmarks' : 'basic keypoints', `(${embedding.length} dimensions)`);

    return {
      detected: true,
      confidence,
      box: {
        x: box.xMin,
        y: box.yMin,
        width: box.width,
        height: box.height
      },
      keypoints,
      embedding,
      qualityScore
    };
  }

  private _calculateQualityScore(
    face: faceDetection.Face,
    imageElement: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
  ): number {
    const box = face.box;
    const keypoints = face.keypoints || [];

    // Get image dimensions
    let imageWidth: number, imageHeight: number;
    if (imageElement instanceof HTMLVideoElement) {
      imageWidth = imageElement.videoWidth || imageElement.width;
      imageHeight = imageElement.videoHeight || imageElement.height;
    } else {
      imageWidth = imageElement.width;
      imageHeight = imageElement.height;
    }

    // STRICT SIZE QUALITY: Face should be 8-40% of image area
    const faceArea = box.width * box.height;
    const imageArea = imageWidth * imageHeight;
    const faceRatio = faceArea / imageArea;

    let sizeQuality = 0;
    if (faceRatio < 0.08) {
      sizeQuality = 0; // Too small - reject
    } else if (faceRatio > 0.4) {
      sizeQuality = 0; // Too large - reject
    } else if (faceRatio >= 0.12 && faceRatio <= 0.25) {
      sizeQuality = 1.0; // Perfect size range
    } else {
      sizeQuality = 0.6; // Acceptable but not ideal
    }

    // STRICT POSITION QUALITY: Face must be well-centered
    const centerX = box.xMin + box.width / 2;
    const centerY = box.yMin + box.height / 2;
    const imageCenterX = imageWidth / 2;
    const imageCenterY = imageHeight / 2;

    const distanceFromCenter = Math.sqrt(
      Math.pow(centerX - imageCenterX, 2) + Math.pow(centerY - imageCenterY, 2)
    );
    const maxDistance = Math.sqrt(Math.pow(imageCenterX, 2) + Math.pow(imageCenterY, 2));
    const centerDistance = distanceFromCenter / maxDistance;

    let positionQuality = 0;
    if (centerDistance > 0.3) {
      positionQuality = 0; // Too far from center - reject
    } else if (centerDistance <= 0.15) {
      positionQuality = 1.0; // Well centered
    } else {
      positionQuality = 0.7; // Acceptable position
    }

    // STRICT KEYPOINT QUALITY: Must have good keypoints
    let keypointQuality = 0;
    if (keypoints.length < 4) {
      keypointQuality = 0; // Too few keypoints - reject
    } else if (keypoints.length >= 6) {
      keypointQuality = 1.0; // Good keypoint detection
    } else {
      keypointQuality = 0.6; // Acceptable keypoints
    }

    // STRICT EDGE QUALITY: Face must not be cut off
    const edgeMargin = 20; // Larger margin for stricter validation
    const isNearEdge = (
      box.xMin < edgeMargin ||
      box.yMin < edgeMargin ||
      (box.xMin + box.width) > (imageWidth - edgeMargin) ||
      (box.yMin + box.height) > (imageHeight - edgeMargin)
    );
    const edgeQuality = isNearEdge ? 0 : 1.0; // Strict: reject if near edge

    // ASPECT RATIO QUALITY: Face should have reasonable proportions
    const aspectRatio = box.width / box.height;
    let aspectQuality = 0;
    if (aspectRatio < 0.6 || aspectRatio > 1.4) {
      aspectQuality = 0; // Bad aspect ratio - reject
    } else if (aspectRatio >= 0.8 && aspectRatio <= 1.2) {
      aspectQuality = 1.0; // Good face proportions
    } else {
      aspectQuality = 0.7; // Acceptable proportions
    }

    // ALL CRITERIA MUST PASS - if any is 0, overall quality is 0
    if (sizeQuality === 0 || positionQuality === 0 || keypointQuality === 0 || edgeQuality === 0 || aspectQuality === 0) {
      return 0;
    }

    // Combine quality metrics with stricter weighting
    const overallQuality = (
      sizeQuality * 0.25 +
      positionQuality * 0.25 +
      keypointQuality * 0.25 +
      edgeQuality * 0.15 +
      aspectQuality * 0.10
    );

    console.log('🔍 Face Quality Breakdown:', {
      faceRatio: faceRatio.toFixed(3),
      centerDistance: centerDistance.toFixed(3),
      keypoints: keypoints.length,
      nearEdge: isNearEdge,
      aspectRatio: aspectRatio.toFixed(2),
      sizeQ: sizeQuality.toFixed(2),
      posQ: positionQuality.toFixed(2),
      keypQ: keypointQuality.toFixed(2),
      edgeQ: edgeQuality.toFixed(2),
      aspectQ: aspectQuality.toFixed(2),
      overall: overallQuality.toFixed(3)
    });

    return Math.max(0, Math.min(1, overallQuality));
  }

  // Extract advanced facial features for robust face vs hand distinction
  private _extractAdvancedFacialFeatures(keypoints: any[], faceWidth: number, faceHeight: number, centerX: number, centerY: number) {
    console.log('🔍 Extracting advanced facial features...');

    // MediaPipe Face Detection provides keypoints in a specific order
    // We need to identify eye, nose, and mouth regions based on position patterns

    const features = {
      eyes: { detected: false, leftX: 0, leftY: 0, rightX: 0, rightY: 0, distance: 0, angle: 0, symmetryScore: 0 },
      nose: { detected: false, tipX: 0, tipY: 0, bridgeX: 0, bridgeY: 0, width: 0, prominence: 0 },
      mouth: { detected: false, centerX: 0, centerY: 0, width: 0, height: 0, cornerDistance: 0 },
      proportions: { eyeToEyeRatio: 0, eyeToNoseRatio: 0, noseToMouthRatio: 0, faceAspectRatio: 0, faceCompactness: 0, isValidFace: false },
      symmetry: { score: 0, leftRightBalance: 0, topBottomBalance: 0 },
      density: { centerConcentration: 0, peripheralSpread: 0, verticalDistribution: 0 }
    };

    if (keypoints.length < 4) {
      console.log('❌ Too few keypoints for facial feature extraction');
      return features;
    }

    // Convert keypoints to relative positions
    const relativeKeypoints = keypoints.map(kp => ({
      x: (kp.x - centerX) / faceWidth,
      y: (kp.y - centerY) / faceHeight,
      absX: kp.x,
      absY: kp.y
    }));

    // 1. EYE DETECTION: Eyes are typically in the upper 40% and horizontally separated
    const upperKeypoints = relativeKeypoints.filter(kp => kp.y >= -0.3 && kp.y <= 0.1); // Upper face region

    if (upperKeypoints.length >= 2) {
      // Find two keypoints that could be eyes (horizontally separated)
      const eyeCandidates = upperKeypoints.filter(kp => Math.abs(kp.x) < 0.4); // Not too far to sides

      if (eyeCandidates.length >= 2) {
        // Sort by X coordinate to get left and right
        eyeCandidates.sort((a, b) => a.x - b.x);

        const leftEye = eyeCandidates[0];
        const rightEye = eyeCandidates[eyeCandidates.length - 1];

        // Validate eye spacing (eyes should be reasonably spaced)
        const eyeDistance = Math.sqrt((leftEye.x - rightEye.x)**2 + (leftEye.y - rightEye.y)**2);

        if (eyeDistance > 0.2 && eyeDistance < 0.8) { // Reasonable eye spacing
          features.eyes.detected = true;
          features.eyes.leftX = leftEye.x;
          features.eyes.leftY = leftEye.y;
          features.eyes.rightX = rightEye.x;
          features.eyes.rightY = rightEye.y;
          features.eyes.distance = eyeDistance;
          features.eyes.angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

          // Eye symmetry (should be roughly horizontal)
          const eyeLevelDiff = Math.abs(leftEye.y - rightEye.y);
          features.eyes.symmetryScore = Math.max(0, 1 - eyeLevelDiff * 5); // Penalty for uneven eyes

          console.log('👁️ Eyes detected:', features.eyes);
        }
      }
    }

    // 2. NOSE DETECTION: Nose is typically in the center, between eyes and mouth
    const centerKeypoints = relativeKeypoints.filter(kp =>
      Math.abs(kp.x) < 0.2 && kp.y > -0.1 && kp.y < 0.3 // Center region, middle vertically
    );

    if (centerKeypoints.length >= 1) {
      // Find the most central keypoint as nose tip
      const noseTip = centerKeypoints.reduce((closest, kp) => {
        const currentDistance = Math.sqrt(kp.x * kp.x + kp.y * kp.y);
        const closestDistance = Math.sqrt(closest.x * closest.x + closest.y * closest.y);
        return currentDistance < closestDistance ? kp : closest;
      });

      features.nose.detected = true;
      features.nose.tipX = noseTip.x;
      features.nose.tipY = noseTip.y;

      // Try to find nose bridge (above nose tip)
      const bridgeCandidates = relativeKeypoints.filter(kp =>
        Math.abs(kp.x - noseTip.x) < 0.1 && kp.y < noseTip.y && kp.y > noseTip.y - 0.2
      );

      if (bridgeCandidates.length > 0) {
        const bridge = bridgeCandidates[0];
        features.nose.bridgeX = bridge.x;
        features.nose.bridgeY = bridge.y;
        features.nose.prominence = Math.abs(noseTip.y - bridge.y);
      }

      // Estimate nose width from nearby keypoints
      const noseRegion = relativeKeypoints.filter(kp =>
        Math.abs(kp.y - noseTip.y) < 0.1 && Math.abs(kp.x - noseTip.x) < 0.15
      );

      if (noseRegion.length > 1) {
        const leftMost = Math.min(...noseRegion.map(kp => kp.x));
        const rightMost = Math.max(...noseRegion.map(kp => kp.x));
        features.nose.width = rightMost - leftMost;
      }

      console.log('👃 Nose detected:', features.nose);
    }

    // 3. MOUTH DETECTION: Mouth is typically in the lower face region
    const lowerKeypoints = relativeKeypoints.filter(kp => kp.y > 0.1 && kp.y < 0.5); // Lower face region

    if (lowerKeypoints.length >= 1) {
      // Find keypoints that could represent mouth area
      const mouthCandidates = lowerKeypoints.filter(kp => Math.abs(kp.x) < 0.3); // Not too far to sides

      if (mouthCandidates.length >= 1) {
        // Find the most central bottom keypoint as mouth center
        const mouthCenter = mouthCandidates.reduce((lowest, kp) => {
          return kp.y > lowest.y ? kp : lowest;
        });

        features.mouth.detected = true;
        features.mouth.centerX = mouthCenter.x;
        features.mouth.centerY = mouthCenter.y;

        // Estimate mouth dimensions from nearby keypoints
        const mouthRegion = relativeKeypoints.filter(kp =>
          Math.abs(kp.y - mouthCenter.y) < 0.08 && Math.abs(kp.x - mouthCenter.x) < 0.2
        );

        if (mouthRegion.length > 1) {
          const leftMost = Math.min(...mouthRegion.map(kp => kp.x));
          const rightMost = Math.max(...mouthRegion.map(kp => kp.x));
          const topMost = Math.min(...mouthRegion.map(kp => kp.y));
          const bottomMost = Math.max(...mouthRegion.map(kp => kp.y));

          features.mouth.width = rightMost - leftMost;
          features.mouth.height = bottomMost - topMost;
          features.mouth.cornerDistance = features.mouth.width;
        }

        console.log('👄 Mouth detected:', features.mouth);
      }
    }

    // 4. FACIAL PROPORTIONS: Calculate golden ratio and typical facial proportions
    if (features.eyes.detected && features.nose.detected && features.mouth.detected) {
      features.proportions.eyeToEyeRatio = features.eyes.distance;
      features.proportions.eyeToNoseRatio = Math.abs(features.eyes.leftY - features.nose.tipY);
      features.proportions.noseToMouthRatio = Math.abs(features.nose.tipY - features.mouth.centerY);
      features.proportions.faceAspectRatio = faceWidth / faceHeight;

      // Face compactness: how well features fit together
      const featureSpread = Math.max(
        Math.abs(features.eyes.leftY - features.mouth.centerY),
        features.eyes.distance
      );
      features.proportions.faceCompactness = 1 / (1 + featureSpread);

      // Check if proportions match typical face ratios
      const isValidEyeSpacing = features.proportions.eyeToEyeRatio > 0.2 && features.proportions.eyeToEyeRatio < 0.6;
      const isValidVerticalSpacing = features.proportions.eyeToNoseRatio > 0.05 && features.proportions.noseToMouthRatio > 0.05;

      features.proportions.isValidFace = isValidEyeSpacing && isValidVerticalSpacing;

      console.log('📐 Proportions calculated:', features.proportions);
    }

    // 5. SYMMETRY ANALYSIS: Faces are bilaterally symmetric
    const leftSideKeypoints = relativeKeypoints.filter(kp => kp.x < -0.05);
    const rightSideKeypoints = relativeKeypoints.filter(kp => kp.x > 0.05);

    if (leftSideKeypoints.length > 0 && rightSideKeypoints.length > 0) {
      features.symmetry.leftRightBalance = Math.min(leftSideKeypoints.length, rightSideKeypoints.length) /
                                          Math.max(leftSideKeypoints.length, rightSideKeypoints.length);

      // Calculate symmetry score based on feature positions
      if (features.eyes.detected) {
        const eyeBalance = 1 - Math.abs(Math.abs(features.eyes.leftX) - Math.abs(features.eyes.rightX));
        features.symmetry.score = eyeBalance * features.symmetry.leftRightBalance;
      } else {
        features.symmetry.score = features.symmetry.leftRightBalance * 0.5; // Lower score without eyes
      }

      console.log('⚖️ Symmetry calculated:', features.symmetry);
    }

    // 6. DENSITY ANALYSIS: How keypoints are distributed
    const centerRegion = relativeKeypoints.filter(kp => Math.abs(kp.x) < 0.3 && Math.abs(kp.y) < 0.3);
    const peripheralRegion = relativeKeypoints.filter(kp => Math.abs(kp.x) > 0.3 || Math.abs(kp.y) > 0.3);

    features.density.centerConcentration = centerRegion.length / relativeKeypoints.length;
    features.density.peripheralSpread = peripheralRegion.length / relativeKeypoints.length;

    // Vertical distribution
    const upperRegion = relativeKeypoints.filter(kp => kp.y < -0.1);
    const middleRegion = relativeKeypoints.filter(kp => kp.y >= -0.1 && kp.y <= 0.2);
    const lowerRegion = relativeKeypoints.filter(kp => kp.y > 0.2);

    const regions = [upperRegion.length, middleRegion.length, lowerRegion.length];
    const maxRegion = Math.max(...regions);
    const minRegion = Math.min(...regions);

    features.density.verticalDistribution = maxRegion > 0 ? minRegion / maxRegion : 0;

    console.log('📊 Density calculated:', features.density);

    return features;
  }

  private _generateEmbedding(face: faceDetection.Face): number[] {
    const box = face.box;
    const keypoints = face.keypoints || [];

    if (keypoints.length === 0) {
      console.warn('No keypoints available for embedding generation');
      return [];
    }

    console.log('🧠 Generating ADVANCED embedding for face vs hand distinction...');
    console.log('Keypoints available:', keypoints.length);

    const embedding: number[] = [];

    // Get face bounds for normalization
    const faceWidth = box.width;
    const faceHeight = box.height;
    const centerX = box.xMin + faceWidth / 2;
    const centerY = box.yMin + faceHeight / 2;

    // MediaPipe Face Detection provides facial landmarks
    // Extract sophisticated facial features that hands can't replicate:
    const facialFeatures = this._extractAdvancedFacialFeatures(keypoints, faceWidth, faceHeight, centerX, centerY);

    console.log('🎯 Facial features extracted:', {
      hasEyes: facialFeatures.eyes.detected,
      hasNose: facialFeatures.nose.detected,
      hasMouth: facialFeatures.mouth.detected,
      facialSymmetry: facialFeatures.symmetry.score,
      facialProportions: facialFeatures.proportions.isValidFace
    });

    // 1. EYES: Critical for face vs hand distinction
    if (facialFeatures.eyes.detected) {
      // Eye positions and spacing (hands don't have eyes!)
      embedding.push(
        facialFeatures.eyes.leftX, facialFeatures.eyes.leftY,
        facialFeatures.eyes.rightX, facialFeatures.eyes.rightY,
        facialFeatures.eyes.distance, facialFeatures.eyes.angle,
        facialFeatures.eyes.symmetryScore
      );
    } else {
      // If no eyes detected, this is likely NOT a face - add distinctive pattern
      embedding.push(0, 0, 0, 0, 0, 0, -1); // Negative symmetry indicates no eyes
    }

    // 2. NOSE: Another critical facial feature
    if (facialFeatures.nose.detected) {
      embedding.push(
        facialFeatures.nose.tipX, facialFeatures.nose.tipY,
        facialFeatures.nose.bridgeX, facialFeatures.nose.bridgeY,
        facialFeatures.nose.width, facialFeatures.nose.prominence
      );
    } else {
      embedding.push(0, 0, 0, 0, 0, -1); // Negative prominence indicates no nose
    }

    // 3. MOUTH: Third critical feature
    if (facialFeatures.mouth.detected) {
      embedding.push(
        facialFeatures.mouth.centerX, facialFeatures.mouth.centerY,
        facialFeatures.mouth.width, facialFeatures.mouth.height,
        facialFeatures.mouth.cornerDistance
      );
    } else {
      embedding.push(0, 0, 0, 0, -1); // Negative distance indicates no mouth
    }

    // 4. FACIAL GEOMETRY: Unique facial proportions
    embedding.push(
      facialFeatures.proportions.eyeToEyeRatio,
      facialFeatures.proportions.eyeToNoseRatio,
      facialFeatures.proportions.noseToMouthRatio,
      facialFeatures.proportions.faceAspectRatio,
      facialFeatures.proportions.faceCompactness
    );

    // 5. SYMMETRY ANALYSIS: Faces are symmetric, hands are not
    embedding.push(
      facialFeatures.symmetry.score,
      facialFeatures.symmetry.leftRightBalance,
      facialFeatures.symmetry.topBottomBalance
    );

    // 6. FEATURE DENSITY: How features are distributed
    embedding.push(
      facialFeatures.density.centerConcentration,
      facialFeatures.density.peripheralSpread,
      facialFeatures.density.verticalDistribution
    );

    // 7. ADVANCED: Raw keypoint patterns for additional uniqueness
    // Only add these if we have valid facial features above
    if (facialFeatures.eyes.detected || facialFeatures.nose.detected || facialFeatures.mouth.detected) {
      // Add limited keypoint positions for additional discrimination
      const maxKeypoints = Math.min(keypoints.length, 6); // Limit to prevent overfitting
      for (let i = 0; i < maxKeypoints; i++) {
        const kp = keypoints[i];
        const relativeX = (kp.x - centerX) / faceWidth;
        const relativeY = (kp.y - centerY) / faceHeight;
        embedding.push(relativeX, relativeY);
      }
    } else {
      // If no facial features detected, this is definitely not a face
      // Add a distinctive "not-a-face" signature
      for (let i = 0; i < 12; i++) {
        embedding.push(-999); // Very distinctive non-face signature
      }
    }

    // 8. L2 Normalize the entire embedding for better comparison
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const normalizedEmbedding = magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;

    console.log('🧠 Advanced embedding generated:', {
      totalDimensions: normalizedEmbedding.length,
      hasEyeFeatures: facialFeatures.eyes.detected,
      hasNoseFeatures: facialFeatures.nose.detected,
      hasMouthFeatures: facialFeatures.mouth.detected,
      embeddingMagnitude: magnitude.toFixed(4),
      isValidFace: facialFeatures.proportions.isValidFace
    });

    console.log(`Generated ${normalizedEmbedding.length}-dimensional normalized embedding from ${keypoints.length} keypoints`);
    return normalizedEmbedding;
  }

  // 🚀 ADVANCED: Generate ultra-precise embedding from 468 facial landmarks
  private _generateAdvancedEmbeddingFrom468Landmarks(
    landmarks: faceLandmarksDetection.Face,
    keypoints: Array<{ x: number; y: number; name?: string }>
  ): number[] {
    console.log('🚀 Generating ULTRA-PRECISE embedding from 468 facial landmarks...');

    const embedding: number[] = [];
    const box = landmarks.box;
    const faceWidth = box.width;
    const faceHeight = box.height;
    const centerX = box.xMin + faceWidth / 2;
    const centerY = box.yMin + faceHeight / 2;

    // 1. PRECISE EYE ANALYSIS using specific landmark indices
    const leftEyeLandmarks = this._extractEyeLandmarks(keypoints, 'left');
    const rightEyeLandmarks = this._extractEyeLandmarks(keypoints, 'right');

    if (leftEyeLandmarks.length > 0 && rightEyeLandmarks.length > 0) {
      // Eye distances, angles, and shapes
      const eyeDistance = Math.sqrt(
        Math.pow(leftEyeLandmarks[0].x - rightEyeLandmarks[0].x, 2) +
        Math.pow(leftEyeLandmarks[0].y - rightEyeLandmarks[0].y, 2)
      );
      const eyeAngle = Math.atan2(
        rightEyeLandmarks[0].y - leftEyeLandmarks[0].y,
        rightEyeLandmarks[0].x - leftEyeLandmarks[0].x
      );

      embedding.push(
        eyeDistance / faceWidth,  // Normalized eye distance
        eyeAngle,                 // Eye angle
        leftEyeLandmarks.length,  // Eye complexity
        rightEyeLandmarks.length  // Eye complexity
      );

      console.log('👁️ Eyes: distance', (eyeDistance / faceWidth).toFixed(3), 'angle', eyeAngle.toFixed(3));
    } else {
      // No eyes detected - this is likely NOT a face!
      embedding.push(-1, -1, 0, 0);
      console.log('❌ No eyes detected in 468 landmarks - likely not a face!');
    }

    // 2. PRECISE NOSE ANALYSIS
    const noseLandmarks = this._extractNoseLandmarks(keypoints);
    if (noseLandmarks.length > 0) {
      // Nose tip, bridge, and nostril positions
      const noseTip = noseLandmarks[0];
      const noseWidth = noseLandmarks.length > 1 ?
        Math.abs(noseLandmarks[1].x - noseLandmarks[0].x) / faceWidth : 0;

      embedding.push(
        (noseTip.x - centerX) / faceWidth,   // Nose horizontal position
        (noseTip.y - centerY) / faceHeight,  // Nose vertical position
        noseWidth,                          // Nose width
        noseLandmarks.length               // Nose complexity
      );

      console.log('👃 Nose: pos', ((noseTip.x - centerX) / faceWidth).toFixed(3), 'width', noseWidth.toFixed(3));
    } else {
      embedding.push(0, 0, -1, 0);
      console.log('❌ No nose detected in landmarks');
    }

    // 3. EXPRESSION-INVARIANT MOUTH ANALYSIS (BONE STRUCTURE ONLY)
    const mouthLandmarks = this._extractMouthLandmarks(keypoints);
    if (mouthLandmarks.length >= 2) {
      // ONLY use the distance between outer mouth corners - this is anchored to bone structure
      const leftCorner = mouthLandmarks[0];
      const rightCorner = mouthLandmarks[1];
      const mouthWidth = Math.abs(rightCorner.x - leftCorner.x) / faceWidth;

      // Calculate stable vertical position (average of corners, not affected by mouth opening)
      const stableMouthY = ((leftCorner.y + rightCorner.y) / 2 - centerY) / faceHeight;

      embedding.push(
        0,                                      // REMOVED: Horizontal center (changes with expressions)
        stableMouthY,                          // Stable vertical position of mouth corners
        mouthWidth,                            // Corner-to-corner width (bone structure)
        2                                      // Fixed: only using 2 stable corner points
      );

      console.log('👄 Mouth: stable_y', stableMouthY.toFixed(3), 'corner_width', mouthWidth.toFixed(3));
    } else {
      embedding.push(0, 0, -1, 0);
      console.log('❌ No mouth corners detected in landmarks');
    }

    // 4. FACIAL CONTOUR ANALYSIS (jawline, cheeks, forehead)
    const contourLandmarks = this._extractFaceContour(keypoints);
    if (contourLandmarks.length > 10) {
      // Face shape descriptors
      const faceAspectRatio = faceWidth / faceHeight;
      const contourCompactness = contourLandmarks.length / 468; // Relative to total landmarks

      embedding.push(
        faceAspectRatio,
        contourCompactness,
        contourLandmarks.length
      );

      console.log('📐 Contour: aspect', faceAspectRatio.toFixed(3), 'compactness', contourCompactness.toFixed(3));
    } else {
      embedding.push(1.0, 0, 0);
    }

    // 5. LANDMARK DENSITY ANALYSIS
    const landmarkDensity = this._analyzeLandmarkDensity(keypoints, faceWidth, faceHeight);
    embedding.push(
      landmarkDensity.centerDensity,
      landmarkDensity.peripheralDensity,
      landmarkDensity.verticalDistribution
    );

    // 6. DISTINCTIVE LANDMARK RATIOS (impossible for hands)
    const distinctiveRatios = this._calculateDistinctiveFacialRatios(keypoints);
    embedding.push(...distinctiveRatios);

    // L2 Normalize for consistent comparison
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const normalizedEmbedding = magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;

    console.log('🚀 468-landmark embedding generated:', {
      dimensions: normalizedEmbedding.length,
      magnitude: magnitude.toFixed(4),
      hasEyes: leftEyeLandmarks.length > 0 && rightEyeLandmarks.length > 0,
      hasNose: noseLandmarks.length > 0,
      hasMouth: mouthLandmarks.length > 0,
      totalLandmarks: keypoints.length
    });

    return normalizedEmbedding;
  }

  // Get anatomical name for landmark index (468-point MediaPipe Face Mesh)
  private _getLandmarkName(index: number): string {
    // MediaPipe Face Mesh landmark indices (simplified mapping)
    const landmarkNames: Record<number, string> = {
      // Eyes
      33: 'right_eye_outer',
      133: 'right_eye_inner',
      362: 'left_eye_outer',
      263: 'left_eye_inner',
      159: 'right_eye_top',
      145: 'right_eye_bottom',
      386: 'left_eye_top',
      374: 'left_eye_bottom',

      // Nose
      1: 'nose_tip',
      2: 'nose_bottom',
      5: 'nose_top',
      19: 'nose_left',
      20: 'nose_right',

      // Mouth
      61: 'mouth_left',
      291: 'mouth_right',
      13: 'mouth_top',
      14: 'mouth_bottom',
      17: 'mouth_center',

      // Face contour
      10: 'forehead_center',
      151: 'chin_center',
      234: 'left_cheek',
      454: 'right_cheek'
    };

    return landmarkNames[index] || `landmark_${index}`;
  }

  // Extract eye landmarks from 468-point data (PERMANENT STRUCTURE ONLY)
  private _extractEyeLandmarks(keypoints: Array<{ x: number; y: number; name?: string }>, side: 'left' | 'right'): Array<{ x: number; y: number }> {
    // Focus on FIXED eye structure points (eye corners) - these don't change with expressions
    const eyeIndices = side === 'left' ?
      [362, 263] : // Left eye outer/inner corners ONLY (stable)
      [33, 133];   // Right eye outer/inner corners ONLY (stable)

    // REMOVED: Eye top/bottom points (386, 374, 159, 145) as they change with blinking/expressions

    return keypoints
      .filter((_, index) => eyeIndices.includes(index))
      .map(kp => ({ x: kp.x, y: kp.y }));
  }

  // Extract nose landmarks (PERMANENT BONE STRUCTURE ONLY)
  private _extractNoseLandmarks(keypoints: Array<{ x: number; y: number; name?: string }>): Array<{ x: number; y: number }> {
    // Focus on FIXED nose bone structure - these are permanent features
    const noseIndices = [1, 5]; // Nose tip and bridge ONLY (bone structure)

    // REMOVED: Nose bottom, sides (2, 19, 20) as they can change slightly with expressions

    return keypoints
      .filter((_, index) => noseIndices.includes(index))
      .map(kp => ({ x: kp.x, y: kp.y }));
  }

  // Extract mouth landmarks (PERMANENT BONE STRUCTURE ONLY)
  private _extractMouthLandmarks(keypoints: Array<{ x: number; y: number; name?: string }>): Array<{ x: number; y: number }> {
    // Focus ONLY on the outermost mouth corners - most stable points anchored to facial bone structure
    const mouthIndices = [61, 291]; // Outer left and right mouth corners - BONE STRUCTURE ANCHORS

    // COMPLETELY REMOVED: Any lip points, mouth center, upper/lower lip positions
    // These corners are anchored to facial bone structure and remain stable during:
    // - Mouth opening/closing, smiling/frowning, speech/expressions

    return keypoints
      .filter((_, index) => mouthIndices.includes(index))
      .map(kp => ({ x: kp.x, y: kp.y }));
  }

  // Extract face contour landmarks
  private _extractFaceContour(keypoints: Array<{ x: number; y: number; name?: string }>): Array<{ x: number; y: number }> {
    // Face boundary landmarks (simplified set)
    const contourIndices = [10, 151, 234, 454, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323];

    return keypoints
      .filter((_, index) => contourIndices.includes(index))
      .map(kp => ({ x: kp.x, y: kp.y }));
  }

  // Analyze landmark density patterns
  private _analyzeLandmarkDensity(keypoints: Array<{ x: number; y: number; name?: string }>, faceWidth: number, faceHeight: number): { centerDensity: number; peripheralDensity: number; verticalDistribution: number } {
    const centerRegion = keypoints.filter(kp =>
      Math.abs(kp.x) < faceWidth * 0.3 && Math.abs(kp.y) < faceHeight * 0.3
    );

    const peripheralRegion = keypoints.filter(kp =>
      Math.abs(kp.x) > faceWidth * 0.3 || Math.abs(kp.y) > faceHeight * 0.3
    );

    const upperRegion = keypoints.filter(kp => kp.y < faceHeight * 0.33);
    const middleRegion = keypoints.filter(kp => kp.y >= faceHeight * 0.33 && kp.y <= faceHeight * 0.67);
    const lowerRegion = keypoints.filter(kp => kp.y > faceHeight * 0.67);

    const regions = [upperRegion.length, middleRegion.length, lowerRegion.length];
    const maxRegion = Math.max(...regions);
    const minRegion = Math.min(...regions);

    return {
      centerDensity: centerRegion.length / keypoints.length,
      peripheralDensity: peripheralRegion.length / keypoints.length,
      verticalDistribution: maxRegion > 0 ? minRegion / maxRegion : 0
    };
  }

  // Calculate distinctive facial ratios that hands cannot replicate
  private _calculateDistinctiveFacialRatios(keypoints: Array<{ x: number; y: number; name?: string }>): number[] {
    if (keypoints.length < 10) return [0, 0, 0, 0];

    // Calculate various geometric ratios
    const ratios: number[] = [];

    // Inter-feature distances that are unique to faces
    const eyeNoseRatio = keypoints.length > 50 ?
      Math.sqrt(Math.pow(keypoints[33].x - keypoints[1].x, 2) + Math.pow(keypoints[33].y - keypoints[1].y, 2)) /
      Math.sqrt(Math.pow(keypoints[362].x - keypoints[1].x, 2) + Math.pow(keypoints[362].y - keypoints[1].y, 2)) : 1;

    const noseMouthRatio = keypoints.length > 100 ?
      Math.sqrt(Math.pow(keypoints[1].x - keypoints[17].x, 2) + Math.pow(keypoints[1].y - keypoints[17].y, 2)) /
      Math.sqrt(Math.pow(keypoints[17].x - keypoints[151].x, 2) + Math.pow(keypoints[17].y - keypoints[151].y, 2)) : 1;

    ratios.push(eyeNoseRatio, noseMouthRatio);

    // Facial symmetry ratios
    const leftRightSymmetry = keypoints.length > 200 ?
      Math.abs(keypoints[234].x - keypoints[454].x) / (keypoints[454].x - keypoints[234].x + 0.001) : 0;

    ratios.push(leftRightSymmetry, ratios.length > 0 ? ratios[0] / ratios[1] : 0);

    return ratios;
  }

  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length || embedding1.length === 0) {
      return 0;
    }

    // Enhanced similarity calculation with multiple metrics

    // 1. Cosine similarity (primary metric)
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

    const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);

    // 2. Euclidean distance (converted to similarity)
    let euclideanDistance = 0;
    for (let i = 0; i < embedding1.length; i++) {
      const diff = embedding1[i] - embedding2[i];
      euclideanDistance += diff * diff;
    }
    euclideanDistance = Math.sqrt(euclideanDistance);
    const euclideanSimilarity = 1 / (1 + euclideanDistance); // Convert to similarity

    // 3. Pearson correlation
    const mean1 = embedding1.reduce((sum, val) => sum + val, 0) / embedding1.length;
    const mean2 = embedding2.reduce((sum, val) => sum + val, 0) / embedding2.length;

    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      const diff1 = embedding1[i] - mean1;
      const diff2 = embedding2[i] - mean2;
      numerator += diff1 * diff2;
      denominator1 += diff1 * diff1;
      denominator2 += diff2 * diff2;
    }

    const pearsonCorr = denominator1 > 0 && denominator2 > 0 ?
      numerator / Math.sqrt(denominator1 * denominator2) : 0;

    // Combine metrics (weighted average)
    const combinedSimilarity = (
      cosineSimilarity * 0.5 +        // Primary metric
      euclideanSimilarity * 0.3 +     // Distance-based
      Math.abs(pearsonCorr) * 0.2     // Correlation-based
    );

    const finalSimilarity = Math.max(0, Math.min(1, combinedSimilarity));

    const similarityBreakdown = {
      cosine: cosineSimilarity.toFixed(3),
      euclidean: euclideanSimilarity.toFixed(3),
      pearson: pearsonCorr.toFixed(3),
      combined: finalSimilarity.toFixed(3)
    };

    console.log('🔍 Similarity Breakdown:', similarityBreakdown);

    // Store breakdown for UI debugging (attach to global for access)
    (window as any).lastSimilarityBreakdown = similarityBreakdown;

    return finalSimilarity;
  }

  async matchFace(embedding: number[], organizationId: string): Promise<FaceMatchResult> {
    try {
      // Load cached embeddings
      const cachedEmbeddings = await this._loadCachedEmbeddings(organizationId);

      if (cachedEmbeddings.length === 0) {
        console.log('No cached embeddings available for matching');
        return { matched: false, similarity: 0, confidence: 0 };
      }

      let bestMatch: CachedFaceEmbedding | null = null;
      let bestSimilarity = 0;
      const allSimilarities: Array<{name: string, similarity: number}> = [];

      console.log(`🔒 SECURE MATCHING: Comparing against ${cachedEmbeddings.length} cached faces with threshold ${this.SIMILARITY_THRESHOLD}`);

      // SECURITY FIX: Find the absolute best match first, then check threshold
      for (const cached of cachedEmbeddings) {
        const similarity = this.calculateSimilarity(embedding, cached.embedding);
        allSimilarities.push({ name: cached.name, similarity: similarity });

        console.log(`🔍 ${cached.name}: ${similarity.toFixed(4)}`);

        // Find the best match regardless of threshold (security fix)
        if (similarity > bestSimilarity) {
          bestMatch = cached;
          bestSimilarity = similarity;
        }
      }

      // Sort and log all matches for debugging
      allSimilarities.sort((a, b) => b.similarity - a.similarity);
      console.log(`🏆 All matches (sorted):`, allSimilarities.slice(0, 3));

      // SECURITY: Only accept the best match if it meets the minimum threshold
      if (bestMatch && bestSimilarity >= this.SIMILARITY_THRESHOLD) {
        console.log(`✅ SECURE MATCH CONFIRMED: ${bestMatch.name} (similarity: ${bestSimilarity.toFixed(4)} >= ${this.SIMILARITY_THRESHOLD})`);

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
      return { matched: false, similarity: bestSimilarity, confidence: 0 };
    } catch (error) {
      console.error('Face matching error:', error);
      return { matched: false, similarity: 0, confidence: 0 };
    }
  }

  async _loadCachedEmbeddings(organizationId: string): Promise<CachedFaceEmbedding[]> {
    // Try cache first
    const cached = faceEmbeddingCache.getCachedEmbeddings(organizationId);
    if (cached) {
      console.log(`Using ${cached.length} cached embeddings`);
      return cached;
    }

    // Load from database
    console.log('Loading embeddings from database...');
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
      console.log(`Loaded and cached ${embeddings.length} embeddings`);

      return embeddings;
    } catch (error) {
      console.error('Failed to load embeddings:', error);
      return [];
    }
  }

  async storeFaceEmbedding(memberId: string, embedding: number[], organizationId: string): Promise<void> {
    try {
      // Store in database
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

      console.log(`Face embedding stored for member ${memberId}`);
    } catch (error) {
      console.error('Failed to store face embedding:', error);
      throw error;
    }
  }

  isHighQuality(result: TensorFlowFaceDetectionResult): boolean {
    return result.detected &&
           result.qualityScore >= 0.6 &&
           result.embedding &&
           result.embedding.length > 0;
  }

  // Get performance metrics
  getPerformanceMetrics(): { backend: string; memory: any } {
    return {
      backend: tf.getBackend(),
      memory: tf.memory()
    };
  }

  // Draw face detection with keypoints
  drawFaceDetection(
    canvas: HTMLCanvasElement,
    videoElement: HTMLVideoElement,
    detections: TensorFlowFaceDetectionResult[]
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('❌ No canvas context available for drawing');
      return;
    }

    // Drawing keypoints at 60 FPS

    // FIXED SIZE APPROACH: Use standard 640x480 for reliable detection
    const videoWidth = 640;
    const videoHeight = 480;

    // Get video element display dimensions
    const videoRect = videoElement.getBoundingClientRect();
    const displayWidth = videoRect.width;
    const displayHeight = videoRect.height;

    // Set canvas to match display size exactly
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    // Calculate scaling from MediaPipe coordinates (640x480) to display size
    const scaleX = displayWidth / videoWidth;
    const scaleY = displayHeight / videoHeight;
    const offsetX = 0;
    const offsetY = 0;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const detection of detections) {
      if (!detection.detected) continue;

      // Draw bounding box with scaling and offset
      if (detection.box) {
        const scaledX = detection.box.x * scaleX + offsetX;
        const scaledY = detection.box.y * scaleY + offsetY;
        const scaledWidth = detection.box.width * scaleX;
        const scaledHeight = detection.box.height * scaleY;

        // Draw bounding box without labels
        ctx.strokeStyle = this.isHighQuality(detection) ? '#00ff00' : '#ffff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
      }

      // Draw keypoints with colored dots
      if (detection.keypoints && detection.keypoints.length > 0) {
        detection.keypoints.forEach((keypoint) => {
          // Scale keypoint coordinates with offset and mirror for camera view
          let scaledX = keypoint.x * scaleX + offsetX;
          const scaledY = keypoint.y * scaleY + offsetY;

          // Mirror X coordinate to match camera view
          scaledX = canvas.width - scaledX;

          // All keypoints with subtle colors and smaller sizes
          let color = 'rgba(255, 255, 255, 0.5)'; // White with 50% opacity
          let size = 2; // Smaller default size

          switch (keypoint.name) {
            case 'rightEye':
            case 'leftEye':
              size = 3; // Smaller for eyes
              color = 'rgba(0, 255, 0, 0.6)'; // Green with 60% opacity
              break;
            case 'noseTip':
            case 'mouthCenter':
              size = 2.5; // Smaller for nose and mouth
              color = 'rgba(255, 165, 0, 0.6)'; // Orange with 60% opacity
              break;
            case 'rightEarTragion':
            case 'leftEarTragion':
              size = 2; // Smaller for ears
              break;
            default:
              size = 1.5; // Smallest for unknown keypoints
          }

          // Draw keypoint dot with scaled coordinates
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(scaledX, scaledY, size, 0, 2 * Math.PI);
          ctx.fill();

          // Draw subtle keypoint outline
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        });

        // Keypoints only - no connections for clean look
      }
    }
  }

  private _drawFaceConnections(ctx: CanvasRenderingContext2D, keypoints: Array<{ x: number; y: number; name?: string }>, scaleX: number, scaleY: number, offsetX: number, offsetY: number): void {
    // Find keypoints by name for connections
    const getKeypoint = (name: string) => keypoints.find(kp => kp.name === name);

    const rightEye = getKeypoint('rightEye');
    const leftEye = getKeypoint('leftEye');
    const noseTip = getKeypoint('noseTip');
    const mouthCenter = getKeypoint('mouthCenter');
    const rightEar = getKeypoint('rightEarTragion');
    const leftEar = getKeypoint('leftEarTragion');

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;

    // Draw eye line
    if (rightEye && leftEye) {
      ctx.beginPath();
      ctx.moveTo(rightEye.x * scaleX + offsetX, rightEye.y * scaleY + offsetY);
      ctx.lineTo(leftEye.x * scaleX + offsetX, leftEye.y * scaleY + offsetY);
      ctx.stroke();
    }

    // Draw nose to mouth line
    if (noseTip && mouthCenter) {
      ctx.beginPath();
      ctx.moveTo(noseTip.x * scaleX + offsetX, noseTip.y * scaleY + offsetY);
      ctx.lineTo(mouthCenter.x * scaleX + offsetX, mouthCenter.y * scaleY + offsetY);
      ctx.stroke();
    }

    // Draw ear to eye connections
    if (rightEar && rightEye) {
      ctx.beginPath();
      ctx.moveTo(rightEar.x * scaleX + offsetX, rightEar.y * scaleY + offsetY);
      ctx.lineTo(rightEye.x * scaleX + offsetX, rightEye.y * scaleY + offsetY);
      ctx.stroke();
    }

    if (leftEar && leftEye) {
      ctx.beginPath();
      ctx.moveTo(leftEar.x * scaleX + offsetX, leftEar.y * scaleY + offsetY);
      ctx.lineTo(leftEye.x * scaleX + offsetX, leftEye.y * scaleY + offsetY);
      ctx.stroke();
    }
  }

  // Helper method to get keypoint names by index (MediaPipe order)
  private _getKeypointName(index: number): string {
    const keypointNames = [
      'rightEye',
      'leftEye',
      'noseTip',
      'mouthCenter',
      'rightEarTragion',
      'leftEarTragion'
    ];
    return keypointNames[index] || `keypoint_${index}`;
  }

  // Cleanup resources
  dispose(): void {
    if (this.detector) {
      // MediaPipe detector doesn't have explicit dispose method
      this.detector = null;
    }
    this.isInitialized = false;
    this.initializationPromise = null;
    console.log('TensorFlow Face Detection disposed');
  }
}

export const tensorflowFaceDetection = new TensorFlowFaceDetectionService();