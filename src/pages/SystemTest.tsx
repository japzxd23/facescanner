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
  IonText,
  IonBadge,
  IonProgressBar
} from '@ionic/react';
import { faceRecognitionService } from '../services/faceRecognition';
import { robustBlazingFastScanner } from '../services/robustBlazingFastScanner';

const SystemTest: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [currentSystemStatus, setCurrentSystemStatus] = useState<string>('Not tested');
  const [robustSystemStatus, setRobustSystemStatus] = useState<string>('Not tested');
  const [isTesting, setIsTesting] = useState<boolean>(false);

  const testCurrentSystem = async () => {
    setIsTesting(true);
    setCurrentSystemStatus('Testing...');

    try {
      console.log('🔬 Testing current face recognition system...');

      // Initialize
      await faceRecognitionService.initialize();
      console.log('✅ Current system initialized');

      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      // Test face detection
      const faces = await faceRecognitionService.detectFaces(videoRef.current);
      console.log(`Current system detected ${faces.length} faces`);

      if (faces.length > 0) {
        // Test embedding generation
        const embedding = faceRecognitionService.generateEmbedding(faces[0]);
        console.log(`Generated embedding with ${embedding.length} features`);

        setCurrentSystemStatus(`✅ Working! Detected ${faces.length} faces, ${embedding.length} features`);
      } else {
        setCurrentSystemStatus('⚠️ No faces detected, but system is working');
      }

    } catch (error) {
      console.error('❌ Current system test failed:', error);
      setCurrentSystemStatus(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const testRobustSystem = async () => {
    setIsTesting(true);
    setRobustSystemStatus('Testing...');

    try {
      console.log('🔬 Testing robust blazing fast system...');

      // Initialize
      await robustBlazingFastScanner.initialize();
      console.log('✅ Robust system initialized');

      const systemInfo = robustBlazingFastScanner.getSystemInfo();
      console.log('System info:', systemInfo);

      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      // Test capture
      const captureResult = await robustBlazingFastScanner.captureFaceForRegistration(videoRef.current);

      if (captureResult) {
        setRobustSystemStatus(`✅ Working! Method: ${captureResult.method}, ${captureResult.embedding.length} features, ${captureResult.processingTime.toFixed(1)}ms`);
      } else {
        setRobustSystemStatus('⚠️ No face captured, but system is working');
      }

    } catch (error) {
      console.error('❌ Robust system test failed:', error);
      setRobustSystemStatus(`❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('❌ Camera failed:', error);
    }
  };

  useEffect(() => {
    startCamera();
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>🔬 System Diagnostics</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonCard>
          <IonCardContent>
            <IonText>
              <h2>System Test</h2>
              <p>This page tests both face recognition systems to identify any issues.</p>
            </IonText>

            {/* Video Feed */}
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                maxHeight: '300px',
                objectFit: 'cover',
                borderRadius: '8px',
                marginBottom: '16px'
              }}
            />

            {isTesting && <IonProgressBar type="indeterminate" />}

            {/* Test Results */}
            <div style={{ marginBottom: '16px' }}>
              <h3>Current Face Recognition System:</h3>
              <IonBadge color={
                currentSystemStatus.includes('✅') ? 'success' :
                currentSystemStatus.includes('❌') ? 'danger' : 'medium'
              }>
                {currentSystemStatus}
              </IonBadge>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <h3>Robust Blazing Fast System:</h3>
              <IonBadge color={
                robustSystemStatus.includes('✅') ? 'success' :
                robustSystemStatus.includes('❌') ? 'danger' : 'medium'
              }>
                {robustSystemStatus}
              </IonBadge>
            </div>

            {/* Test Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <IonButton
                expand="block"
                color="primary"
                onClick={testCurrentSystem}
                disabled={isTesting}
              >
                Test Current System
              </IonButton>

              <IonButton
                expand="block"
                color="secondary"
                onClick={testRobustSystem}
                disabled={isTesting}
              >
                Test Robust System
              </IonButton>
            </div>

            <div style={{ marginTop: '16px' }}>
              <IonText color="medium">
                <p><strong>How to use:</strong></p>
                <ol>
                  <li>Allow camera access</li>
                  <li>Position your face in the camera</li>
                  <li>Click "Test Current System" to test your existing face recognition</li>
                  <li>Click "Test Robust System" to test the new robust system</li>
                </ol>
                <p>Both systems should detect your face and generate embeddings. Check the console for detailed logs.</p>
              </IonText>
            </div>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default SystemTest;