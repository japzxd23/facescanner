// Scanner Settings Service
// Manages all configurable parameters for the face recognition system

// Legacy organization UUID for backward compatibility
export const LEGACY_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001';

export interface ScannerSettings {
  // Face Detection & Quality Thresholds
  faceQualityThreshold: number;          // 0.65 - Minimum quality to trigger processing
  faceMatchThreshold: number;            // 0.91 - Minimum similarity for face matching
  faceDetectionConfidence: number;       // 0.5 - MediaPipe face detection confidence
  keypointMinCount: number;              // 6 - Minimum keypoints required
  keypointSpreadThreshold: number;       // 0.35 - Minimum keypoint spread
  aspectRatioMin: number;                // 0.75 - Minimum face aspect ratio
  aspectRatioMax: number;                // 1.3 - Maximum face aspect ratio

  // Cooldown & Timing Settings
  faceProcessingCooldown: number;        // 5000ms - Cooldown after face processing starts
  detectionCooldown: number;             // 3000ms - General detection cooldown
  postRecognitionCooldown: number;       // 3000ms - Additional cooldown for same person
  stabilityTimeout: number;              // 2000ms - Time window for stable detection
  requiredStableFrames: number;          // 1 - Number of stable frames required

  // Camera & Video Settings
  cameraResolutionWidth: number;         // 640 - Camera width
  cameraResolutionHeight: number;        // 480 - Camera height
  cameraFrameRate: number;               // 60 - Target FPS
  mirrorCamera: boolean;                 // true - Mirror front-facing camera

  // Processing & Performance
  maxFacesDetection: number;             // 5 - Maximum faces to detect simultaneously
  embedDimensions: number;               // 468 - Face embedding dimensions
  processingQueueSize: number;           // 1 - Maximum concurrent processing
  scanningInterval: number;              // 100ms - Face scanning interval

  // UI & Feedback Settings
  debugMode: boolean;                    // true - Show debug information
  soundEnabled: boolean;                 // true - Enable audio feedback
  statusFlashDuration: number;           // 1500ms - Success/error flash duration

  // Advanced Face Recognition
  samPersonThreshold: number;            // 0.85 - Similarity threshold for same person detection
  livenessTolerance: number;             // 0.6 - Minimum liveness score
  qualityScoreWeights: {
    size: number;                        // 0.15 - Weight for size score
    position: number;                    // 0.25 - Weight for position score
    keypoints: number;                   // 0.2 - Weight for keypoints score
    aspect: number;                      // 0.2 - Weight for aspect ratio score
    area: number;                        // 0.2 - Weight for face area score
  };

  // Database & Performance
  batchSizeLimit: number;                // 100 - Max members to load at once
  cacheExpirationTime: number;          // 300000ms - Cache expiration (5 minutes)
  maxRetryAttempts: number;              // 3 - Max retries for failed operations

  // Organization & Multi-tenancy
  organizationId: string;                // Organization identifier
  createdAt: string;                     // Settings creation timestamp
  updatedAt: string;                     // Settings last update timestamp
  createdBy: string;                     // User who created settings
  updatedBy: string;                     // User who last updated settings
}

// Default Settings Configuration
export const DEFAULT_SCANNER_SETTINGS: ScannerSettings = {
  // Face Detection & Quality Thresholds
  faceQualityThreshold: 0.65,
  faceMatchThreshold: 0.93, // SECURITY UPDATE: Raised from 0.91 to prevent family member false positives
  faceDetectionConfidence: 0.5,
  keypointMinCount: 6,
  keypointSpreadThreshold: 0.35,
  aspectRatioMin: 0.75,
  aspectRatioMax: 1.3,

  // Cooldown & Timing Settings
  faceProcessingCooldown: 5000,
  detectionCooldown: 3000,
  postRecognitionCooldown: 3000,
  stabilityTimeout: 2000,
  requiredStableFrames: 1,

  // Camera & Video Settings
  cameraResolutionWidth: 640,
  cameraResolutionHeight: 480,
  cameraFrameRate: 60,
  mirrorCamera: true,

  // Processing & Performance
  maxFacesDetection: 5,
  embedDimensions: 468,
  processingQueueSize: 1,
  scanningInterval: 100,

  // UI & Feedback Settings
  debugMode: true,
  soundEnabled: true,
  statusFlashDuration: 1500,

  // Advanced Face Recognition
  samPersonThreshold: 0.85,
  livenessTolerance: 0.6,
  qualityScoreWeights: {
    size: 0.15,
    position: 0.25,
    keypoints: 0.2,
    aspect: 0.2,
    area: 0.2
  },

  // Database & Performance
  batchSizeLimit: 100,
  cacheExpirationTime: 300000,
  maxRetryAttempts: 3,

  // Organization & Multi-tenancy (will be set dynamically)
  organizationId: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: '',
  updatedBy: ''
};

// Settings validation rules
export const SETTINGS_VALIDATION = {
  faceQualityThreshold: { min: 0.1, max: 1.0, step: 0.05 },
  faceMatchThreshold: { min: 0.5, max: 0.99, step: 0.01 },
  faceDetectionConfidence: { min: 0.1, max: 1.0, step: 0.05 },
  keypointMinCount: { min: 3, max: 20, step: 1 },
  keypointSpreadThreshold: { min: 0.1, max: 0.8, step: 0.05 },
  aspectRatioMin: { min: 0.5, max: 1.0, step: 0.05 },
  aspectRatioMax: { min: 1.0, max: 2.0, step: 0.05 },

  faceProcessingCooldown: { min: 1000, max: 30000, step: 500 },
  detectionCooldown: { min: 500, max: 10000, step: 250 },
  postRecognitionCooldown: { min: 1000, max: 15000, step: 500 },
  stabilityTimeout: { min: 500, max: 5000, step: 250 },
  requiredStableFrames: { min: 1, max: 10, step: 1 },

  cameraResolutionWidth: { min: 320, max: 1920, step: 32 },
  cameraResolutionHeight: { min: 240, max: 1080, step: 24 },
  cameraFrameRate: { min: 15, max: 120, step: 5 },

  maxFacesDetection: { min: 1, max: 20, step: 1 },
  processingQueueSize: { min: 1, max: 5, step: 1 },
  scanningInterval: { min: 50, max: 1000, step: 50 },

  statusFlashDuration: { min: 500, max: 5000, step: 250 },

  samPersonThreshold: { min: 0.5, max: 0.95, step: 0.05 },
  livenessTolerance: { min: 0.1, max: 0.9, step: 0.05 },

  batchSizeLimit: { min: 10, max: 500, step: 10 },
  cacheExpirationTime: { min: 60000, max: 1800000, step: 30000 },
  maxRetryAttempts: { min: 1, max: 10, step: 1 }
};

// Settings categories for UI organization
export const SETTINGS_CATEGORIES = {
  'Face Recognition': [
    'faceQualityThreshold',
    'faceMatchThreshold',
    'faceDetectionConfidence',
    'samPersonThreshold',
    'livenessTolerance'
  ],
  'Face Validation': [
    'keypointMinCount',
    'keypointSpreadThreshold',
    'aspectRatioMin',
    'aspectRatioMax'
  ],
  'Timing & Cooldowns': [
    'faceProcessingCooldown',
    'detectionCooldown',
    'postRecognitionCooldown',
    'stabilityTimeout',
    'requiredStableFrames'
  ],
  'Camera Settings': [
    'cameraResolutionWidth',
    'cameraResolutionHeight',
    'cameraFrameRate',
    'mirrorCamera'
  ],
  'Performance': [
    'maxFacesDetection',
    'processingQueueSize',
    'scanningInterval',
    'batchSizeLimit',
    'cacheExpirationTime',
    'maxRetryAttempts'
  ],
  'User Interface': [
    'debugMode',
    'soundEnabled',
    'statusFlashDuration'
  ]
};

// Setting labels and descriptions
export const SETTINGS_META = {
  faceQualityThreshold: {
    label: 'Face Quality Threshold',
    description: 'Minimum quality score (0-1) required to process a detected face',
    unit: '%'
  },
  faceMatchThreshold: {
    label: 'Face Match Threshold',
    description: 'Minimum similarity score (0-1) required to consider faces as matching',
    unit: '%'
  },
  faceDetectionConfidence: {
    label: 'Detection Confidence',
    description: 'MediaPipe confidence threshold for face detection',
    unit: '%'
  },
  keypointMinCount: {
    label: 'Minimum Keypoints',
    description: 'Minimum number of facial keypoints required for processing'
  },
  keypointSpreadThreshold: {
    label: 'Keypoint Spread Threshold',
    description: 'Minimum spread of keypoints across face area (prevents clustered features)',
    unit: '%'
  },
  aspectRatioMin: {
    label: 'Min Aspect Ratio',
    description: 'Minimum acceptable face aspect ratio (width/height)'
  },
  aspectRatioMax: {
    label: 'Max Aspect Ratio',
    description: 'Maximum acceptable face aspect ratio (width/height)'
  },
  faceProcessingCooldown: {
    label: 'Processing Cooldown',
    description: 'Cooldown period after face processing starts (prevents repeated triggers)',
    unit: 'ms'
  },
  detectionCooldown: {
    label: 'Detection Cooldown',
    description: 'General cooldown between face detections',
    unit: 'ms'
  },
  postRecognitionCooldown: {
    label: 'Recognition Cooldown',
    description: 'Additional cooldown after recognizing the same person',
    unit: 'ms'
  },
  stabilityTimeout: {
    label: 'Stability Timeout',
    description: 'Maximum time window for stable face detection',
    unit: 'ms'
  },
  requiredStableFrames: {
    label: 'Stable Frames Required',
    description: 'Number of consecutive stable frames required before processing'
  },
  cameraResolutionWidth: {
    label: 'Camera Width',
    description: 'Camera resolution width in pixels',
    unit: 'px'
  },
  cameraResolutionHeight: {
    label: 'Camera Height',
    description: 'Camera resolution height in pixels',
    unit: 'px'
  },
  cameraFrameRate: {
    label: 'Frame Rate',
    description: 'Target camera frame rate',
    unit: 'fps'
  },
  mirrorCamera: {
    label: 'Mirror Camera',
    description: 'Mirror the camera feed horizontally (for front-facing cameras)'
  },
  maxFacesDetection: {
    label: 'Max Faces',
    description: 'Maximum number of faces to detect simultaneously'
  },
  processingQueueSize: {
    label: 'Processing Queue Size',
    description: 'Maximum number of concurrent face processing operations'
  },
  scanningInterval: {
    label: 'Scanning Interval',
    description: 'Time interval between face detection scans',
    unit: 'ms'
  },
  debugMode: {
    label: 'Debug Mode',
    description: 'Show detailed debug information and metrics'
  },
  soundEnabled: {
    label: 'Sound Enabled',
    description: 'Enable audio feedback for recognition events'
  },
  statusFlashDuration: {
    label: 'Status Flash Duration',
    description: 'Duration of success/error status flash',
    unit: 'ms'
  },
  samPersonThreshold: {
    label: 'Same Person Threshold',
    description: 'Similarity threshold for detecting the same person in consecutive frames',
    unit: '%'
  },
  livenessTolerance: {
    label: 'Liveness Tolerance',
    description: 'Minimum liveness score to accept as real face (vs photo)',
    unit: '%'
  },
  batchSizeLimit: {
    label: 'Batch Size Limit',
    description: 'Maximum number of members to load in a single database query'
  },
  cacheExpirationTime: {
    label: 'Cache Expiration',
    description: 'How long to cache member data before refreshing',
    unit: 'ms'
  },
  maxRetryAttempts: {
    label: 'Max Retry Attempts',
    description: 'Maximum number of retry attempts for failed operations'
  }
};