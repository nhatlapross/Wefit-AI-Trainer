import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { CheckCircle, Maximize2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
// Safely check for browser environment
const isBrowser = typeof window !== 'undefined';

const findAngle = (p1, p2, p3) => {
  const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) -
    Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
};

const AdvancedSquatCounter = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [correctSquats, setCorrectSquats] = useState(0);
  const [incorrectSquats, setIncorrectSquats] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [windowWidth, setWindowWidth] = useState(640);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [successAnimation, setSuccessAnimation] = useState(false);
  const videoContainerRef = useRef(null);
  const router = useRouter();

  // State tracking
  const stateRef = useRef({
    stateSeq: [],
    currentState: null,
    prevState: null,
    incorrectPosture: false
  });

  // Thresholds (unchanged from original)
  const THRESHOLDS = {
    HIP_KNEE_VERT: {
      NORMAL: [0, 45],
      TRANS: [45, 90],
      PASS: [90, 135]
    },
    HIP_THRESH: [60, 120],
    KNEE_THRESH: [50, 100, 130],
    ANKLE_THRESH: 80,
    OFFSET_THRESH: 30
  };

  const handleSuccessSquat = () => {
    setSuccessAnimation(true);
    setTimeout(() => setSuccessAnimation(false), 1500);
  };

  useEffect(() => {
    const handleResize = () => {
      // Change the aspect ratio multiplier from 0.75 to a larger value, like 0.9
      const width = isBrowser
        ? Math.min(window.innerWidth * 0.95, 640)
        : 640;
      setWindowWidth(width);
    };

    // Initial setup
    handleResize();

    // Add resize listener
    if (isBrowser) {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Camera permission request function
  const requestCameraPermission = async () => {
    if (!isBrowser) return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: windowWidth },
          height: { ideal: Math.floor(windowWidth * 0.75) }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasPermission(true);
      return true;
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Camera access denied. Please grant permission to use this feature.');
      setHasPermission(false);
      setIsLoading(false);
      return false;
    }
  };

  const getSquatState = (kneeAngle) => {
    if (THRESHOLDS.HIP_KNEE_VERT.NORMAL[0] <= kneeAngle &&
      kneeAngle <= THRESHOLDS.HIP_KNEE_VERT.NORMAL[1]) {
      return 's1';
    } else if (THRESHOLDS.HIP_KNEE_VERT.TRANS[0] <= kneeAngle &&
      kneeAngle <= THRESHOLDS.HIP_KNEE_VERT.TRANS[1]) {
      return 's2';
    } else if (THRESHOLDS.HIP_KNEE_VERT.PASS[0] <= kneeAngle &&
      kneeAngle <= THRESHOLDS.HIP_KNEE_VERT.PASS[1]) {
      return 's3';
    }
    return null;
  };

  const updateStateSequence = (state) => {
    const stateTracker = stateRef.current;

    if (state === 's2') {
      if ((!stateTracker.stateSeq.includes('s3') &&
        stateTracker.stateSeq.filter(s => s === 's2').length === 0) ||
        (stateTracker.stateSeq.includes('s3') &&
          stateTracker.stateSeq.filter(s => s === 's2').length === 1)) {
        stateTracker.stateSeq.push(state);
      }
    } else if (state === 's3') {
      if (!stateTracker.stateSeq.includes(state) &&
        stateTracker.stateSeq.includes('s2')) {
        stateTracker.stateSeq.push(state);
      }
    }
  };

  const checkSquat = (landmarks) => {
    if (!landmarks) return;

    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];
    const leftAnkle = landmarks[27];
    const rightAnkle = landmarks[28];

    // Calculate vertical angles
    const leftKneeAngle = findAngle(
      leftHip,
      leftKnee,
      { x: leftKnee.x, y: 0 }
    );

    const rightKneeAngle = findAngle(
      rightHip,
      rightKnee,
      { x: rightKnee.x, y: 0 }
    );

    const kneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
    const currentState = getSquatState(kneeAngle);

    // Update state sequence
    if (currentState) {
      updateStateSequence(currentState);
    }

    // Check if squat is complete
    if (currentState === 's1') {
      const stateTracker = stateRef.current;

      if (stateTracker.stateSeq.length === 3 &&
        !stateTracker.incorrectPosture) {
        setCorrectSquats(prev => prev + 1);
        setFeedback('Perfect squat! 🎉');
        handleSuccessSquat();
      } else if (stateTracker.incorrectPosture ||
        (stateTracker.stateSeq.includes('s2') &&
          stateTracker.stateSeq.length === 1)) {
        setIncorrectSquats(prev => prev + 1);
        setFeedback('Incorrect form! Check your posture.');
      }

      // Reset state
      stateTracker.stateSeq = [];
      stateTracker.incorrectPosture = false;
    } else {
      // Check form issues
      const hipAngle = findAngle(
        leftShoulder,
        leftHip,
        leftKnee
      );

      const ankleAngle = findAngle(
        leftKnee,
        leftAnkle,
        { x: leftAnkle.x, y: 0 }
      );

      if (hipAngle > THRESHOLDS.HIP_THRESH[1]) {
        setFeedback('Keep your back straight!');
        stateRef.current.incorrectPosture = true;
      } else if (ankleAngle > THRESHOLDS.ANKLE_THRESH) {
        setFeedback('Knees going too far over toes!');
        stateRef.current.incorrectPosture = true;
      } else if (kneeAngle > THRESHOLDS.KNEE_THRESH[2]) {
        setFeedback('Squat too deep!');
        stateRef.current.incorrectPosture = true;
      }
    }

    stateRef.current.prevState = currentState;
  };

  const toggleFullScreen = () => {
    const container = videoContainerRef.current;
    
    if (!isFullScreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.mozRequestFullScreen) {
        container.mozRequestFullScreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  useEffect(() => {
    let camera;
    let isComponentMounted = true;
    const currentVideo = videoRef.current;

    const setupPose = async () => {
      // Dynamically import dependencies only in browser
      if (!isBrowser) return;

      try {
        // First request camera permission
        const permissionGranted = await requestCameraPermission();
        if (!permissionGranted) return;

        // Dynamically import libraries
        const [
          tf,
          tfBackend,
          mediapipePose,
          mediapipeCamera,
          mediapipeDrawing
        ] = await Promise.all([
          import('@tensorflow/tfjs-core'),
          import('@tensorflow/tfjs-backend-webgl'),
          import('@mediapipe/pose'),
          import('@mediapipe/camera_utils'),
          import('@mediapipe/drawing_utils')
        ]);

        // Debug logging
        console.log('Mediapipe Pose Import:', mediapipePose);
        console.log('Window Pose:', window.Pose);

        // Ensure TensorFlow is ready
        await tf.ready();
        await tf.setBackend('webgl');

        // Create Pose instance using global Pose constructor or direct import
        const PoseCtor = window.Pose || mediapipePose.Pose;

        if (typeof PoseCtor !== 'function') {
          throw new Error('Pose constructor not found');
        }

        const pose = new PoseCtor({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
          }
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        pose.onResults((results) => {
          if (isComponentMounted) {
            drawPose(results);
            checkSquat(results.poseLandmarks);
          }
        });

        // Initialize camera 
        const CameraModule = mediapipeCamera.Camera || window.Camera;

        if (CameraModule && hasPermission && currentVideo) {
          camera = new CameraModule(currentVideo, {
            onFrame: async () => {
              if (currentVideo && isComponentMounted) {
                await pose.send({ image: currentVideo });
              }
            },
            width: 640,
            height: 480
          });

          try {
            await camera.start();
            setIsLoading(false);
          } catch (cameraError) {
            console.error('Error starting camera:', cameraError);
            setError('Failed to start camera. Please refresh and try again.');
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('Error setting up pose detection:', error);
        setError(`Failed to initialize: ${error.message}`);
        setIsLoading(false);
      }
    };

    // Add script to load MediaPipe globally
    const loadMediaPipeScript = () => {
      if (isBrowser && !window.Pose) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
        script.async = true;
        script.onload = setupPose;
        document.body.appendChild(script);
      } else {
        setupPose();
      }
    };

    if (isBrowser) {
      loadMediaPipeScript();
    }

    return () => {
      isComponentMounted = false;
      if (camera) {
        camera.stop();
      }
      if (currentVideo?.srcObject) {
        const tracks = currentVideo.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [hasPermission, isLoading]);

  const drawPose = (results) => {
    const canvas = canvasRef.current;
    if (!canvas || !results.poseLandmarks) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw landmarks
    for (const landmark of results.poseLandmarks) {
      const x = landmark.x * canvas.width;
      const y = landmark.y * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#00ffff';
      ctx.fill();
    }

    // Draw connecting lines for legs and torso
    const connections = [
      [11, 13, 15], // left arm
      [12, 14, 16], // right arm
      [11, 23, 25, 27], // left leg
      [12, 24, 26, 28], // right leg
      [11, 12], // shoulders
      [23, 24]  // hips
    ];

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;

    for (const connection of connections) {
      for (let i = 0; i < connection.length - 1; i++) {
        const start = results.poseLandmarks[connection[i]];
        const end = results.poseLandmarks[connection[i + 1]];

        ctx.beginPath();
        ctx.moveTo(start.x * canvas.width, start.y * canvas.height);
        ctx.lineTo(end.x * canvas.width, end.y * canvas.height);
        ctx.stroke();
      }
    }
  };

  const getReady = () => {
    setIsLoading(!isLoading);
    setCorrectSquats(0);
    setIncorrectSquats(0);
  }

  useEffect(() => {
    if (correctSquats > 10) {
      window.alert("Your mission success!");
      router.push('/mission');
    }
    if (correctSquats + incorrectSquats == 50) {
      window.alert("Your mission failed!");
      router.push('/mission');
    }

  }, [correctSquats, incorrectSquats])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 p-4 bg-gray-900 min-h-screen w-full">
      {successAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-green-500 bg-opacity-50 animate-ping">
          <CheckCircle
            size={200}
            className="text-white animate-bounce"
          />
        </div>
      )}
      <div className="flex items-center justify-center w-full max-w-[640px] mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-white text-center">Squat with AI trainer</h1>
        {/* <button 
          onClick={toggleFullScreen} 
          className="text-white bg-blue-500 p-2 rounded-lg hover:bg-blue-600"
        >
          {isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
        </button> */}
      </div>
      <div className="w-full max-w-[640px] px-4">
        <button
          className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 transition"
          onClick={() => setIsLoading(!isLoading)}
        >
          {isLoading ? 'Start Exercise' : 'Restart'}
        </button>
      </div>

      {/* <div className="flex justify-center gap-8 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-green-400">
          Correct: {correctSquats}
        </h2>
        <h2 className="text-xl sm:text-2xl font-bold text-red-400">
          Incorrect: {incorrectSquats}
        </h2>
      </div> */}

      {feedback && (
        <h2 className={`text-2xl sm:text-3xl font-semibold mb-4 text-center ${feedback.includes('Perfect') ? 'text-green-400' : 'text-yellow-400'}`}>
          {feedback}
        </h2>
      )}

      {error && (
        <div className="text-red-400 text-lg sm:text-xl mb-4 text-center">
          Error: {error}
        </div>
      )}

{!isLoading && (
        <div
          ref={videoContainerRef}
          className={`relative w-full max-w-[640px] aspect-video ${isFullScreen ? 'fullscreen-container' : ''}`}
          style={{ maxHeight: isFullScreen ? '100vh' : '600px' }}
        >
          {/* Fullscreen Overlay for Scores and Feedback */}
          {isFullScreen && (
            <div className="absolute top-4 left-0 right-0 z-20 px-4">
              <div className="flex justify-between items-center bg-black/50 rounded-lg p-2">
                <div className="flex gap-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-green-400">
                    Correct: {correctSquats}
                  </h2>
                  <h2 className="text-xl sm:text-2xl font-bold text-red-400">
                    Incorrect: {incorrectSquats}
                  </h2>
                </div>
                {feedback && (
                  <h2 className={`text-xl sm:text-2xl font-semibold text-center ${feedback.includes('Perfect') ? 'text-green-400' : 'text-yellow-400'}`}>
                    {feedback}
                  </h2>
                )}
              </div>
            </div>
          )}

          <button 
            onClick={toggleFullScreen} 
            className="absolute top-2 right-2 z-10 bg-white/30 rounded-full p-2 hover:bg-white/50 transition"
          >
            <Maximize2 className="text-white" />
          </button>

          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover rounded-lg"
            style={{ transform: 'scaleX(-1)' }}
            playsInline
            muted
            autoPlay
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            width={windowWidth}
            height={Math.floor(windowWidth * 0.9)}
            style={{
              transform: 'scaleX(-1)',
              zIndex: 1
            }}
          />
        </div>
      )}

      {/* Non-fullscreen version outside of fullscreen mode */}
      {!isFullScreen && !isLoading && (
        <>
          <div className="flex justify-center gap-8 mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-green-400">
              Correct: {correctSquats}
            </h2>
            <h2 className="text-xl sm:text-2xl font-bold text-red-400">
              Incorrect: {incorrectSquats}
            </h2>
          </div>
          {feedback && (
            <h2 className={`text-2xl sm:text-3xl font-semibold mb-4 text-center ${feedback.includes('Perfect') ? 'text-green-400' : 'text-yellow-400'}`}>
              {feedback}
            </h2>
          )}
        </>
      )}

      {/* Global fullscreen styles */}
      <style jsx global>{`
        .fullscreen-container {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          z-index: 9999 !important;
          background: black !important;
        }
      `}</style>

      <div className="mt-4 text-gray-300 text-center px-4">
        <p className="text-sm sm:text-base">Stand in front of the camera where your full body is visible.</p>
        <p className="text-sm sm:text-base">Perform squats with proper form to increase your count!</p>
      </div>
    </div>
  );
};

export default dynamic(() => Promise.resolve(AdvancedSquatCounter), {
  ssr: false
});