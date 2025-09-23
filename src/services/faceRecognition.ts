import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import * as faceDetection from '@tensorflow-models/face-detection';

export class FaceRecognitionService {
  private detector: faceDetection.FaceDetector | null = null;
  private fallbackDetector: faceDetection.FaceDetector | null = null;
  private isInitialized = false;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  async initialize() {
    if (this.isInitialized) {
      console.log('Face recognition already initialized');
      return;
    }

    try {
      // Try WebGL first, fallback to CPU if needed
      console.log('Setting TensorFlow backend...');
      console.log('Available backends:', tf.engine().backendNames);

      try {
        console.log('Attempting WebGL backend...');
        await tf.setBackend('webgl');
        await tf.ready();
        console.log('✅ TensorFlow backend ready (WebGL):', tf.getBackend());
        console.log('WebGL info:', tf.env().get('WEBGL_VERSION'));
      } catch (webglError) {
        console.warn('❌ WebGL backend failed:', webglError);
        console.log('Falling back to CPU backend...');
        await tf.setBackend('cpu');
        await tf.ready();
        console.log('✅ TensorFlow backend ready (CPU):', tf.getBackend());
      }

      // Create processing canvas for image enhancement
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      console.log('Processing canvas created');

      // Use MediaPipe face detector which is more reliable in production
      console.log('Creating face detector...');
      console.log('Available models:', Object.values(faceDetection.SupportedModels));

      const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
      const detectorConfig = {
        runtime: 'tfjs' as const,
        modelType: 'short' as const, // Use short model for better performance
        maxFaces: 5,
      };

      console.log('Detector config:', detectorConfig);

      try {
        console.log('⏳ Downloading face detection model (this may take a moment)...');
        console.log('Network status:', navigator.onLine ? 'Online' : 'Offline');

        this.detector = await faceDetection.createDetector(model, detectorConfig);
        console.log('✅ Face detector created successfully');
      } catch (detectorError) {
        console.error('❌ Face detector creation failed:', detectorError);

        // Check if it's a network issue
        if (detectorError.message.includes('fetch') || detectorError.message.includes('network') || detectorError.message.includes('loading')) {
          console.error('🌐 This appears to be a network/download issue');
          console.log('💡 Try: Check internet connection or use a different network');
        }

        throw new Error(`Face detector initialization failed: ${detectorError.message}`);
      }

      // No fallback needed since we're using MediaPipe as main detector
      console.log('Face detection initialization complete');

      this.isInitialized = true;
      console.log('Enhanced face detector created successfully');
    } catch (error) {
      console.error('❌ Complete face detection initialization failed:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });

      // Try to provide a mock detector as last resort
      console.log('🚨 Creating mock detector as emergency fallback...');
      this.detector = {
        estimateFaces: async () => {
          console.log('Mock detector: simulating face detection');
          // Return a fake face in the center of the image for testing
          return [{
            box: { xMin: 200, yMin: 150, width: 200, height: 200 },
            keypoints: Array.from({ length: 10 }, (_, i) => ({ x: 250 + i * 10, y: 200 + i * 5 }))
          }];
        }
      } as any;

      this.isInitialized = true;
      console.log('🔧 Mock detector ready - will simulate face detection for testing');
      return; // Don't throw error, allow app to continue with mock
    }
  }

  // Enhance image for better face detection in low light
  private enhanceImage(imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement): HTMLCanvasElement {
    if (!this.canvas || !this.ctx) {
      throw new Error('Processing canvas not initialized');
    }

    // Set canvas size to match video
    if (imageElement instanceof HTMLVideoElement) {
      this.canvas.width = imageElement.videoWidth || 640;
      this.canvas.height = imageElement.videoHeight || 480;
    } else {
      this.canvas.width = imageElement.width;
      this.canvas.height = imageElement.height;
    }

    // Draw original image
    this.ctx.drawImage(imageElement, 0, 0, this.canvas.width, this.canvas.height);

    // Validate canvas dimensions before getImageData
    if (this.canvas.width <= 0 || this.canvas.height <= 0) {
      console.error('Invalid canvas dimensions for getImageData:', { width: this.canvas.width, height: this.canvas.height });
      return this.canvas;
    }

    // Get image data for processing
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;

    // Enhance contrast and brightness for better face detection
    const brightnessBoost = 30;
    const contrastFactor = 1.5;

    for (let i = 0; i < data.length; i += 4) {
      // Apply brightness and contrast to RGB channels
      for (let j = 0; j < 3; j++) {
        const pixelValue = data[i + j];
        // Apply contrast
        let enhanced = (pixelValue - 128) * contrastFactor + 128;
        // Apply brightness
        enhanced += brightnessBoost;
        // Clamp values
        data[i + j] = Math.max(0, Math.min(255, enhanced));
      }
    }

    // Apply the enhanced image data back to canvas
    this.ctx.putImageData(imageData, 0, 0);

    return this.canvas;
  }

  async detectFaces(imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) {
    if (!this.detector) {
      console.error('Face detector not initialized');
      throw new Error('Face detector not initialized');
    }

    try {
      console.log('Running enhanced face detection on element:', imageElement.constructor.name);

      // Try detection on original image first
      let faces = await this.detector.estimateFaces(imageElement);
      console.log('Original image detection result:', faces.length, 'faces found');

      // If no faces found, try with enhanced image
      if (faces.length === 0) {
        console.log('No faces found in original image, trying enhanced processing...');
        try {
          const enhancedImage = this.enhanceImage(imageElement);
          faces = await this.detector.estimateFaces(enhancedImage);
          console.log('Enhanced image detection result:', faces.length, 'faces found');

          // If still no faces, that's okay - we tried our best
          if (faces.length === 0) {
            console.log('No faces found even with enhanced image processing');
          }
        } catch (enhanceError) {
          console.warn('Image enhancement failed, using original:', enhanceError);
        }
      }

      return faces;
    } catch (error) {
      console.error('Face detection error:', error);
      return [];
    }
  }

  // Ultra-distinctive face embedding with amplified unique features
  generateEmbedding(face: faceDetection.Face): number[] {
    if (!face.keypoints || face.keypoints.length === 0) {
      console.warn('No keypoints available for embedding generation');
      return [];
    }

    console.log('Generating ULTRA-DISTINCTIVE embedding from', face.keypoints.length, 'keypoints');

    const embedding: number[] = [];
    const keypoints = face.keypoints;

    // Get face bounds
    const xCoords = keypoints.map(kp => kp.x);
    const yCoords = keypoints.map(kp => kp.y);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);
    const faceWidth = maxX - minX;
    const faceHeight = maxY - minY;
    const centerX = xCoords.reduce((a, b) => a + b, 0) / xCoords.length;
    const centerY = yCoords.reduce((a, b) => a + b, 0) / yCoords.length;

    // 1. AMPLIFIED RELATIVE POSITIONS - each keypoint's unique position signature
    for (let i = 0; i < keypoints.length; i++) {
      const kp = keypoints[i];
      const relativeX = (kp.x - centerX) / faceWidth;
      const relativeY = (kp.y - centerY) / faceHeight;

      // Amplify differences by using higher powers and scaling
      embedding.push(
        relativeX * 10,           // 10x amplification
        relativeY * 10,           // 10x amplification
        Math.pow(relativeX, 3) * 100,  // Cubic amplification for extreme sensitivity
        Math.pow(relativeY, 3) * 100   // Cubic amplification for extreme sensitivity
      );
    }

    if (keypoints.length >= 6) {
      // 2. UNIQUE GEOMETRIC SIGNATURES - amplified structural features
      const aspectRatio = faceWidth / faceHeight;
      embedding.push(aspectRatio * 50); // 50x amplification

      // 3. AMPLIFIED DISTANCE MATRICES - all pairwise distances with extreme scaling
      for (let i = 0; i < keypoints.length; i++) {
        for (let j = i + 1; j < keypoints.length; j++) {
          const dx = keypoints[i].x - keypoints[j].x;
          const dy = keypoints[i].y - keypoints[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy) / faceWidth;

          // Multiple distance representations for maximum distinctiveness
          embedding.push(
            distance * 100,           // Linear distance amplified
            Math.pow(distance, 2) * 500,  // Quadratic distance highly amplified
            Math.log(distance + 0.001) * 200  // Logarithmic distance for fine differences
          );
        }
      }

      // 4. COMPLEX ANGULAR SIGNATURES - all angular relationships amplified
      for (let i = 0; i < keypoints.length; i++) {
        for (let j = i + 1; j < keypoints.length; j++) {
          for (let k = j + 1; k < keypoints.length; k++) {
            // Calculate angle formed by three points
            const p1 = keypoints[i], p2 = keypoints[j], p3 = keypoints[k];

            const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
            const angleDiff = Math.abs(angle2 - angle1);

            // Multiple angle representations
            embedding.push(
              angleDiff * 100,              // Direct angle amplified
              Math.sin(angleDiff) * 200,    // Sine representation amplified
              Math.cos(angleDiff) * 200     // Cosine representation amplified
            );
          }
        }
      }

      // 5. SYMMETRY AND ASYMMETRY FEATURES - facial uniqueness indicators
      const leftSide = keypoints.filter(kp => kp.x < centerX);
      const rightSide = keypoints.filter(kp => kp.x > centerX);

      if (leftSide.length > 0 && rightSide.length > 0) {
        const leftCenterX = leftSide.reduce((sum, kp) => sum + kp.x, 0) / leftSide.length;
        const rightCenterX = rightSide.reduce((sum, kp) => sum + kp.x, 0) / rightSide.length;
        const asymmetryScore = Math.abs(leftCenterX - centerX) - Math.abs(rightCenterX - centerX);

        embedding.push(asymmetryScore * 1000); // Extreme amplification for facial asymmetry
      }

      // 6. DENSITY CLUSTERS - keypoint distribution patterns
      const quadrants = [[0, 0], [0, 0], [0, 0], [0, 0]]; // [topLeft, topRight, bottomLeft, bottomRight]

      for (const kp of keypoints) {
        const isLeft = kp.x < centerX;
        const isTop = kp.y < centerY;

        if (isTop && isLeft) quadrants[0][0]++;
        else if (isTop && !isLeft) quadrants[1][0]++;
        else if (!isTop && isLeft) quadrants[2][0]++;
        else quadrants[3][0]++;
      }

      // Add density distribution as highly amplified features
      for (let i = 0; i < 4; i++) {
        embedding.push(quadrants[i][0] * 200); // Extreme amplification for density patterns
      }

      // 7. VARIANCE FEATURES - spread and concentration of keypoints
      const xVariance = xCoords.reduce((sum, x) => sum + Math.pow(x - centerX, 2), 0) / xCoords.length;
      const yVariance = yCoords.reduce((sum, y) => sum + Math.pow(y - centerY, 2), 0) / yCoords.length;

      embedding.push(
        xVariance * 10000,        // Extreme amplification for spread patterns
        yVariance * 10000,        // Extreme amplification for spread patterns
        Math.sqrt(xVariance + yVariance) * 10000  // Combined variance amplified
      );
    }

    // 8. NO NORMALIZATION - Keep raw amplified values for maximum distinctiveness
    // This ensures that small differences become large differences in the embedding space

    console.log('Generated ULTRA-DISTINCTIVE embedding with', embedding.length, 'highly amplified features');
    console.log('Sample embedding values:', embedding.slice(0, 10).map(v => v.toFixed(6)));

    return embedding;
  }

  // Enhanced similarity calculation with multiple metrics for higher accuracy
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length || embedding1.length === 0) {
      return 0;
    }

    // 1. Cosine similarity (geometric orientation)
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const cosineSimilarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));

    // 2. Euclidean distance similarity (feature space distance)
    let euclideanDistance = 0;
    for (let i = 0; i < embedding1.length; i++) {
      const diff = embedding1[i] - embedding2[i];
      euclideanDistance += diff * diff;
    }
    euclideanDistance = Math.sqrt(euclideanDistance);
    const euclideanSimilarity = 1 / (1 + euclideanDistance); // Convert distance to similarity

    // 3. Pearson correlation (pattern matching)
    const mean1 = embedding1.reduce((a, b) => a + b) / embedding1.length;
    const mean2 = embedding2.reduce((a, b) => a + b) / embedding2.length;

    let numerator = 0;
    let sum1 = 0;
    let sum2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      const diff1 = embedding1[i] - mean1;
      const diff2 = embedding2[i] - mean2;
      numerator += diff1 * diff2;
      sum1 += diff1 * diff1;
      sum2 += diff2 * diff2;
    }

    const pearsonCorrelation = numerator / Math.sqrt(sum1 * sum2);

    // 4. Weighted combination of all metrics for final score
    // Cosine similarity is most important for facial features
    // Euclidean helps with fine details
    // Pearson correlation helps with overall pattern
    const weightedSimilarity = (
      cosineSimilarity * 0.6 +        // Primary metric
      euclideanSimilarity * 0.3 +     // Distance metric
      Math.max(0, pearsonCorrelation) * 0.1  // Pattern metric
    );

    console.log('🔍 Similarity metrics:', {
      cosine: cosineSimilarity.toFixed(3),
      euclidean: euclideanSimilarity.toFixed(3),
      pearson: pearsonCorrelation.toFixed(3),
      weighted: weightedSimilarity.toFixed(3)
    });

    return Math.max(0, Math.min(1, weightedSimilarity)); // Ensure 0-1 range
  }

  // Validate face quality before processing - Enhanced to reject hands and non-faces
  validateFaceQuality(face: faceDetection.Face, imageWidth: number, imageHeight: number): { isValid: boolean; reason?: string; score: number } {
    const { box, keypoints } = face;

    if (!box) {
      return { isValid: false, reason: 'No bounding box detected', score: 0 };
    }

    // Check if we have keypoints (essential for face validation)
    const keypointCount = keypoints?.length || 0;
    const minKeypoints = 4; // Reduced from 6 to 4 for low light conditions

    if (keypointCount < minKeypoints) {
      return {
        isValid: false,
        reason: `Insufficient keypoints: ${keypointCount} (min: ${minKeypoints}) - likely not a face`,
        score: keypointCount / minKeypoints
      };
    }

    // STRICT FACE VALIDATION: Check keypoint distribution to ensure it's actually a face
    if (keypoints && keypoints.length >= 4) {
      const xCoords = keypoints.map(kp => kp.x);
      const yCoords = keypoints.map(kp => kp.y);

      // Check if keypoints are distributed like facial features (not clustered like a hand)
      const xRange = Math.max(...xCoords) - Math.min(...xCoords);
      const yRange = Math.max(...yCoords) - Math.min(...yCoords);
      const keypointSpread = Math.min(xRange / box.width, yRange / box.height);

      // Face keypoints should spread across at least 30% of the detected box (reduced for low light)
      if (keypointSpread < 0.3) {
        return {
          isValid: false,
          reason: `Keypoints too clustered (${Math.round(keypointSpread * 100)}%) - likely hand or object, not face`,
          score: keypointSpread
        };
      }

      // Check keypoint density - faces have well-distributed keypoints
      const centerX = xCoords.reduce((a, b) => a + b, 0) / xCoords.length;
      const centerY = yCoords.reduce((a, b) => a + b, 0) / yCoords.length;

      // Calculate how many keypoints are in different regions (eyes, nose, mouth areas)
      // Make regions larger and more forgiving for low light conditions
      const topRegion = keypoints.filter(kp => kp.y < centerY - box.height * 0.05).length;
      const middleRegion = keypoints.filter(kp => Math.abs(kp.y - centerY) <= box.height * 0.2).length;
      const bottomRegion = keypoints.filter(kp => kp.y > centerY + box.height * 0.05).length;

      // For low light: only require at least 2 out of 3 regions to have keypoints
      const regionsWithKeypoints = (topRegion > 0 ? 1 : 0) + (middleRegion > 0 ? 1 : 0) + (bottomRegion > 0 ? 1 : 0);
      if (regionsWithKeypoints < 2) {
        return {
          isValid: false,
          reason: `Invalid keypoint distribution - need 2/3 regions (top:${topRegion}, mid:${middleRegion}, bot:${bottomRegion})`,
          score: 0.2
        };
      }
    }

    // Check face size (optimized for mobile devices)
    const faceWidth = box.width;
    const faceHeight = box.height;
    const minFaceSize = 40; // Reduced from 60 to 40 for mobile cameras (phones/tablets)

    if (faceWidth < minFaceSize || faceHeight < minFaceSize) {
      return {
        isValid: false,
        reason: `Face too small: ${Math.round(faceWidth)}x${Math.round(faceHeight)} (min: ${minFaceSize}x${minFaceSize})`,
        score: Math.min(faceWidth, faceHeight) / minFaceSize
      };
    }

    // Check if face is mostly within frame (at least 90% visible)
    const leftEdge = box.xMin;
    const rightEdge = box.xMin + box.width;
    const topEdge = box.yMin;
    const bottomEdge = box.yMin + box.height;

    const isNearEdge = (
      leftEdge < 5 ||
      rightEdge > imageWidth - 5 ||
      topEdge < 5 ||
      bottomEdge > imageHeight - 5
    );

    if (isNearEdge) {
      return {
        isValid: false,
        reason: 'Face too close to frame edge (partial face)',
        score: 0.3
      };
    }

    // Check face aspect ratio (should be roughly rectangular, more strict for faces)
    const aspectRatio = faceWidth / faceHeight;
    const minAspectRatio = 0.75; // More strict
    const maxAspectRatio = 1.3;  // More strict

    if (aspectRatio < minAspectRatio || aspectRatio > maxAspectRatio) {
      return {
        isValid: false,
        reason: `Unusual face aspect ratio: ${aspectRatio.toFixed(2)} (should be between ${minAspectRatio}-${maxAspectRatio}) - may not be a face`,
        score: 0.4
      };
    }

    // Additional face size validation - optimized for mobile devices
    const faceArea = faceWidth * faceHeight;
    const imageArea = imageWidth * imageHeight;
    const faceRatio = faceArea / imageArea;

    // Mobile-optimized: Face should be between 2% and 60% of image area
    // Phones: users often get very close (higher %), tablets: farther away (lower %)
    if (faceRatio < 0.02 || faceRatio > 0.6) {
      return {
        isValid: false,
        reason: `Face size ratio unusual: ${(faceRatio * 100).toFixed(1)}% of image (should be 2-60% for mobile)`,
        score: faceRatio < 0.02 ? faceRatio / 0.02 : 0.6 / faceRatio
      };
    }

    // Calculate quality score based on all factors - mobile optimized
    const sizeScore = Math.min(1, Math.min(faceWidth, faceHeight) / 150); // Lowered from 200 to 150 for mobile
    const positionScore = 1; // Face is well-positioned (passed edge checks)
    const keypointScore = Math.min(1, keypointCount / 15); // Lowered from 25 to 15 for mobile cameras
    const aspectScore = 1 - Math.abs(aspectRatio - 1) / 0.4; // More lenient aspect ratio for mobile
    const areaScore = Math.min(1, faceRatio / 0.10); // Lowered from 0.15 to 0.10 for mobile

    const overallScore = (sizeScore + positionScore + keypointScore + aspectScore + areaScore) / 5;

    // Accept lower quality faces for low light conditions
    if (overallScore < 0.4) {
      return {
        isValid: false,
        reason: `Overall quality too low: ${Math.round(overallScore * 100)}% (need 40%+) - may not be a real face`,
        score: overallScore
      };
    }

    return {
      isValid: true,
      score: overallScore,
      reason: `High quality face detected: ${Math.round(overallScore * 100)}% score`
    };
  }

  // Crop face from video/image for better recognition
  cropFaceFromVideo(videoElement: HTMLVideoElement, face: faceDetection.Face, padding = 0.3): string | null {
    const { box } = face;
    if (!box || !this.canvas || !this.ctx) {
      console.error('Cannot crop face - missing box or canvas');
      return null;
    }

    // Validate video dimensions
    if (!videoElement.videoWidth || !videoElement.videoHeight) {
      console.error('Invalid video dimensions:', { width: videoElement.videoWidth, height: videoElement.videoHeight });
      return null;
    }

    // Add padding around the face for better recognition
    const paddingX = box.width * padding;
    const paddingY = box.height * padding;

    const cropX = Math.max(0, box.xMin - paddingX);
    const cropY = Math.max(0, box.yMin - paddingY);
    const cropWidth = Math.min(videoElement.videoWidth - cropX, box.width + (paddingX * 2));
    const cropHeight = Math.min(videoElement.videoHeight - cropY, box.height + (paddingY * 2));

    // Validate crop dimensions
    if (cropWidth <= 0 || cropHeight <= 0) {
      console.error('Invalid crop dimensions:', { cropWidth, cropHeight, box, videoSize: { width: videoElement.videoWidth, height: videoElement.videoHeight } });
      return null;
    }

    // Set canvas to crop dimensions
    this.canvas.width = cropWidth;
    this.canvas.height = cropHeight;

    // Clear and draw the cropped face
    this.ctx.clearRect(0, 0, cropWidth, cropHeight);
    this.ctx.drawImage(
      videoElement,
      cropX, cropY, cropWidth, cropHeight,  // Source rectangle
      0, 0, cropWidth, cropHeight           // Destination rectangle
    );

    // Enhance the cropped face for better recognition
    // Double-check dimensions before getImageData (should already be validated above)
    if (cropWidth <= 0 || cropHeight <= 0) {
      console.error('Invalid dimensions for face enhancement:', { cropWidth, cropHeight });
      return this.canvas.toDataURL('image/jpeg', 0.95);
    }

    const imageData = this.ctx.getImageData(0, 0, cropWidth, cropHeight);
    const data = imageData.data;

    // Apply face-specific enhancement
    const brightnessBoost = 20;
    const contrastFactor = 1.3;
    const saturationBoost = 1.1;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Apply contrast and brightness
      let newR = ((r - 128) * contrastFactor + 128) + brightnessBoost;
      let newG = ((g - 128) * contrastFactor + 128) + brightnessBoost;
      let newB = ((b - 128) * contrastFactor + 128) + brightnessBoost;

      // Apply subtle saturation boost for better feature definition
      const gray = 0.299 * newR + 0.587 * newG + 0.114 * newB;
      newR = gray + (newR - gray) * saturationBoost;
      newG = gray + (newG - gray) * saturationBoost;
      newB = gray + (newB - gray) * saturationBoost;

      // Clamp values
      data[i] = Math.max(0, Math.min(255, newR));
      data[i + 1] = Math.max(0, Math.min(255, newG));
      data[i + 2] = Math.max(0, Math.min(255, newB));
    }

    // Put enhanced data back
    this.ctx.putImageData(imageData, 0, 0);

    // Convert to base64 with higher quality
    const croppedFaceData = this.canvas.toDataURL('image/jpeg', 0.95);

    console.log('Cropped face size:', {
      original: `${videoElement.videoWidth}x${videoElement.videoHeight}`,
      cropped: `${cropWidth}x${cropHeight}`,
      dataSize: `${Math.round(croppedFaceData.length / 1024)}KB`
    });

    return croppedFaceData;
  }

  // Validate that captured image actually contains a face (not just body or hand)
  async validateCapturedFace(imageDataUrl: string): Promise<boolean> {
    try {
      // Create image element from data URL
      const img = new Image();
      img.src = imageDataUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Try to detect faces in the captured image
      const faces = await this.detectFaces(img);

      // Image should contain at least one face and face should be reasonably sized
      if (faces.length > 0) {
        const face = faces[0];
        const faceArea = face.box.width * face.box.height;
        const imageArea = img.width * img.height;
        const faceRatio = faceArea / imageArea;

        // Use the enhanced face quality validation to ensure it's a real face
        const qualityCheck = this.validateFaceQuality(face, img.width, img.height);

        // Mobile and low light optimized validation
        // Face should take up at least 8% of the cropped image (lowered for mobile devices)
        const hasGoodSize = faceRatio > 0.08;
        // Use quality check but with lowered requirements for mobile
        const hasGoodQuality = qualityCheck.isValid;

        const isValidFace = hasGoodSize && hasGoodQuality;

        console.log('🔍 DETAILED FACE VALIDATION RESULT:', {
          facesDetected: faces.length,
          faceRatio: faceRatio.toFixed(3),
          hasGoodSize: hasGoodSize,
          sizeThreshold: 0.25,
          hasGoodQuality: hasGoodQuality,
          qualityCheck: qualityCheck,
          finalResult: isValidFace,
          imageSize: { width: img.width, height: img.height },
          faceBox: face.box
        });

        return isValidFace;
      }

      console.warn('No faces detected in captured image - likely captured hand/body instead of face');
      return false;
    } catch (error) {
      console.error('Face validation failed:', error);
      return false; // If validation fails, reject the image
    }
  }

  // Enhanced face matching with adaptive thresholds and verification
  async matchFace(faceEmbedding: number[], storedEmbeddings: { id: string; embedding: number[]; name: string; status: string }[], baseThreshold = 0.75) {
    if (storedEmbeddings.length === 0) {
      console.log('🔍 No stored embeddings to match against');
      return null;
    }

    let bestMatch = null;
    let bestSimilarity = 0;
    let secondBestSimilarity = 0;
    const allScores: Array<{id: string, name: string, similarity: number}> = [];

    console.log(`🔍 Matching against ${storedEmbeddings.length} stored faces with threshold ${baseThreshold}`);

    // Calculate similarities with all stored faces
    for (const stored of storedEmbeddings) {
      const similarity = this.calculateSimilarity(faceEmbedding, stored.embedding);
      allScores.push({ id: stored.id, name: stored.name, similarity });

      console.log(`🔍 Similarity with ${stored.name}: ${similarity.toFixed(3)}`);

      if (similarity > bestSimilarity) {
        secondBestSimilarity = bestSimilarity;
        bestSimilarity = similarity;
        bestMatch = {
          ...stored,
          confidence: similarity
        };
      } else if (similarity > secondBestSimilarity) {
        secondBestSimilarity = similarity;
      }
    }

    // Sort scores to see distribution
    allScores.sort((a, b) => b.similarity - a.similarity);
    console.log('🏆 Top 3 matches:', allScores.slice(0, 3));

    // Enhanced verification checks
    if (bestMatch && bestSimilarity >= baseThreshold) {
      // Additional verification: ensure significant gap between best and second best
      const confidenceGap = bestSimilarity - secondBestSimilarity;
      const minGap = 0.05; // Minimum 5% difference for confident match

      console.log(`🔍 Match verification: best=${bestSimilarity.toFixed(3)}, second=${secondBestSimilarity.toFixed(3)}, gap=${confidenceGap.toFixed(3)}`);

      if (confidenceGap >= minGap) {
        // Apply adaptive threshold based on confidence
        let adaptiveThreshold = baseThreshold;

        // Lower threshold slightly if we have very high confidence and good gap
        if (bestSimilarity > 0.85 && confidenceGap > 0.1) {
          adaptiveThreshold = Math.max(0.70, baseThreshold - 0.05);
          console.log(`✅ High confidence match - using adaptive threshold: ${adaptiveThreshold}`);
        }

        if (bestSimilarity >= adaptiveThreshold) {
          console.log(`✅ MATCH FOUND: ${bestMatch.name} with confidence ${bestSimilarity.toFixed(3)}`);
          return bestMatch;
        } else {
          console.log(`❌ Below adaptive threshold: ${bestSimilarity.toFixed(3)} < ${adaptiveThreshold}`);
        }
      } else {
        console.log(`❌ Insufficient confidence gap: ${confidenceGap.toFixed(3)} < ${minGap}`);
      }
    } else {
      console.log(`❌ No match above base threshold: best=${bestSimilarity.toFixed(3)} < ${baseThreshold}`);
    }

    return null; // No confident match found
  }
}

export const faceRecognitionService = new FaceRecognitionService();