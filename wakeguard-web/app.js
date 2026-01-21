/**
 * WakeGuard Web - Driver Drowsiness Detection System
 * ===================================================
 * Browser-based real-time drowsiness detection using MediaPipe Face Mesh
 * 
 * Team: META MINDS
 * Guidance: Dr. K Sampath
 */

// ═══════════════════════════════════════════════════════════════════════════════
//                              CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
    // EAR threshold - eyes considered "closed" below this value
    EAR_THRESHOLD: 0.22,

    // Consecutive frames with closed eyes to trigger alarm
    // At ~10-15 FPS (browser), 20 frames ≈ 2 seconds
    CONSEC_FRAMES_THRESHOLD: 20,

    // SMS Configuration
    HTTPSMS_API_KEY: "uk_o1t_xX-X-lVBbWEFAzNslxgmY1byQf2wmNc1DNTw0FAjmG9V9Ee4fi7Ed9IY66ob",
    HTTPSMS_SENDER: "+917780643862",
    SMS_RECIPIENT: "+917780643862",
    SMS_COOLDOWN_MS: 60000, // 60 seconds between SMS

    // MediaPipe Eye Landmark Indices (from 468 landmarks)
    // Right Eye
    RIGHT_EYE: [33, 160, 158, 133, 153, 144],
    // Left Eye  
    LEFT_EYE: [362, 385, 387, 263, 373, 380]
};

// ═══════════════════════════════════════════════════════════════════════════════
//                              STATE VARIABLES
// ═══════════════════════════════════════════════════════════════════════════════

let faceMesh = null;
let camera = null;
let isRunning = false;
let frameCounter = 0;
let closedEyeCounter = 0;
let alarmOn = false;
let lastSmsTime = 0;
let fpsCounter = 0;
let lastFpsTime = performance.now();
let currentFps = 0;

// DOM Elements
const webcamElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const earValueElement = document.getElementById('earValue');
const fpsValueElement = document.getElementById('fpsValue');
const alertOverlay = document.getElementById('alertOverlay');
const statusBadge = document.getElementById('statusBadge');
const statusDot = statusBadge.querySelector('.status-dot');
const statusText = statusBadge.querySelector('.status-text');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const alarmSound = document.getElementById('alarmSound');

// ═══════════════════════════════════════════════════════════════════════════════
//                              WEB AUDIO ALARM
// ═══════════════════════════════════════════════════════════════════════════════

let audioContext = null;
let alarmOscillator = null;
let alarmGain = null;
let alarmInterval = null;

/**
 * Initialize Web Audio Context (must be called after user interaction)
 */
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('[AUDIO] AudioContext initialized');
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

/**
 * Start the alarm beep sound using Web Audio API
 */
function startAlarmSound() {
    if (!audioContext) {
        initAudioContext();
    }

    if (!audioContext) return;

    // Resume if suspended
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    // Stop any existing alarm
    stopAlarmSound();

    let beepOn = true;

    // Create beeping pattern (on/off every 250ms)
    alarmInterval = setInterval(() => {
        if (beepOn) {
            try {
                alarmOscillator = audioContext.createOscillator();
                alarmGain = audioContext.createGain();

                alarmOscillator.type = 'square';
                alarmOscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                alarmGain.gain.setValueAtTime(0.5, audioContext.currentTime);

                alarmOscillator.connect(alarmGain);
                alarmGain.connect(audioContext.destination);
                alarmOscillator.start();
            } catch (e) {
                console.error('[AUDIO] Error:', e);
            }
        } else {
            if (alarmOscillator) {
                try {
                    alarmOscillator.stop();
                    alarmOscillator.disconnect();
                } catch (e) { }
                alarmOscillator = null;
            }
        }
        beepOn = !beepOn;
    }, 250);

    console.log('[AUDIO] Alarm started');
}

/**
 * Stop the alarm sound
 */
function stopAlarmSound() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
    if (alarmOscillator) {
        try {
            alarmOscillator.stop();
            alarmOscillator.disconnect();
        } catch (e) { }
        alarmOscillator = null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//                              UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate Euclidean distance between two points
 */
function distance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

/**
 * Calculate Eye Aspect Ratio (EAR) from 6 eye landmarks
 */
function calculateEAR(eyeLandmarks) {
    const A = distance(eyeLandmarks[1], eyeLandmarks[5]);
    const B = distance(eyeLandmarks[2], eyeLandmarks[4]);
    const C = distance(eyeLandmarks[0], eyeLandmarks[3]);
    const ear = (A + B) / (2.0 * C);
    return ear;
}

/**
 * Extract eye landmark coordinates from face mesh results
 */
function getEyeLandmarks(landmarks, eyeIndices) {
    return eyeIndices.map(idx => landmarks[idx]);
}

/**
 * Send SMS alert via HTTPSMS API
 */
async function sendSmsAlert() {
    const now = Date.now();

    if (now - lastSmsTime < CONFIG.SMS_COOLDOWN_MS) {
        console.log('[SMS] Cooldown active, skipping...');
        return;
    }

    try {
        const response = await fetch('https://api.httpsms.com/v1/messages/send', {
            method: 'POST',
            headers: {
                'x-api-key': CONFIG.HTTPSMS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: CONFIG.HTTPSMS_SENDER,
                to: CONFIG.SMS_RECIPIENT,
                content: '⚠️ WAKEGUARD ALERT: Drowsiness detected! Please take a break and rest. - Team META MINDS'
            })
        });

        if (response.ok) {
            lastSmsTime = now;
            console.log('[SMS] Alert sent successfully!');
        } else {
            console.error('[SMS] Failed:', await response.text());
        }
    } catch (error) {
        console.error('[SMS] Error:', error);
    }
}

/**
 * Update status display
 */
function updateStatus(status, type = 'normal') {
    statusText.textContent = status;
    statusDot.classList.remove('active', 'alert');

    if (type === 'active') {
        statusDot.classList.add('active');
    } else if (type === 'alert') {
        statusDot.classList.add('alert');
    }
}

/**
 * Trigger drowsiness alarm
 */
function triggerAlarm() {
    if (!alarmOn) {
        alarmOn = true;
        alertOverlay.classList.add('active');
        updateStatus('DROWSINESS DETECTED!', 'alert');

        // Play alarm sound
        startAlarmSound();

        // Send SMS
        sendSmsAlert();
    }
}

/**
 * Stop drowsiness alarm
 */
function stopAlarm() {
    if (alarmOn) {
        alarmOn = false;
        alertOverlay.classList.remove('active');
        updateStatus('Monitoring...', 'active');
        stopAlarmSound();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
//                              MEDIAPIPE PROCESSING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process face mesh results
 */
function onResults(results) {
    fpsCounter++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
        currentFps = fpsCounter;
        fpsCounter = 0;
        lastFpsTime = now;
        fpsValueElement.textContent = currentFps;
    }

    canvasElement.width = webcamElement.videoWidth;
    canvasElement.height = webcamElement.videoHeight;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        const rightEyeLandmarks = getEyeLandmarks(landmarks, CONFIG.RIGHT_EYE);
        const leftEyeLandmarks = getEyeLandmarks(landmarks, CONFIG.LEFT_EYE);

        const rightEAR = calculateEAR(rightEyeLandmarks);
        const leftEAR = calculateEAR(leftEyeLandmarks);
        const avgEAR = (rightEAR + leftEAR) / 2;

        earValueElement.textContent = avgEAR.toFixed(3);

        if (avgEAR < CONFIG.EAR_THRESHOLD) {
            closedEyeCounter++;
            earValueElement.classList.add('warning');
        } else {
            closedEyeCounter = 0;
            earValueElement.classList.remove('warning');
        }

        if (closedEyeCounter >= CONFIG.CONSEC_FRAMES_THRESHOLD) {
            triggerAlarm();
        } else {
            stopAlarm();
        }

        const drawEye = (eyeLandmarks, color) => {
            canvasCtx.beginPath();
            eyeLandmarks.forEach((point, index) => {
                const x = point.x * canvasElement.width;
                const y = point.y * canvasElement.height;
                if (index === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
            });
            canvasCtx.closePath();
            canvasCtx.strokeStyle = color;
            canvasCtx.lineWidth = 2;
            canvasCtx.stroke();
        };

        const eyeColor = avgEAR < CONFIG.EAR_THRESHOLD ? '#ff4444' : '#00ff88';
        drawEye(rightEyeLandmarks, eyeColor);
        drawEye(leftEyeLandmarks, eyeColor);

    } else {
        earValueElement.textContent = '---';
        earValueElement.classList.remove('warning');
        if (!alarmOn) {
            updateStatus('No face detected', 'normal');
        }
    }

    canvasCtx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════════
//                              INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

async function initializeFaceMesh() {
    faceMesh = new FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    faceMesh.onResults(onResults);
    console.log('[INFO] MediaPipe Face Mesh initialized');
}

async function startDetection() {
    updateStatus('Starting camera...', 'normal');

    // Initialize audio context
    initAudioContext();

    try {
        if (!faceMesh) {
            await initializeFaceMesh();
        }

        camera = new Camera(webcamElement, {
            onFrame: async () => {
                if (isRunning) {
                    await faceMesh.send({ image: webcamElement });
                }
            },
            width: 640,
            height: 480
        });

        await camera.start();
        isRunning = true;

        startBtn.disabled = true;
        stopBtn.disabled = false;
        updateStatus('Monitoring...', 'active');

        console.log('[INFO] Detection started');

    } catch (error) {
        console.error('[ERROR] Failed to start:', error);
        updateStatus('Camera access denied', 'normal');
        alert('Could not access camera. Please allow camera permissions and try again.');
    }
}

function stopDetection() {
    isRunning = false;

    if (camera) {
        camera.stop();
    }

    stopAlarm();
    closedEyeCounter = 0;

    startBtn.disabled = false;
    stopBtn.disabled = true;
    updateStatus('Ready - Click Start', 'normal');
    earValueElement.textContent = '0.000';
    fpsValueElement.textContent = '0';

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    console.log('[INFO] Detection stopped');
}

// ═══════════════════════════════════════════════════════════════════════════════
//                              EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════════════════════

startBtn.addEventListener('click', startDetection);
stopBtn.addEventListener('click', stopDetection);

// ═══════════════════════════════════════════════════════════════════════════════
//                         SECRET SETTINGS (Type "wakeguard777")
// ═══════════════════════════════════════════════════════════════════════════════

const SECRET_CODE = 'pasha123';
let typedKeys = '';
const settingsModal = document.getElementById('settingsModal');
const settingsClose = document.getElementById('settingsClose');
const smsRecipientInput = document.getElementById('smsRecipient');
const saveSettingsBtn = document.getElementById('saveSettings');
const settingsStatus = document.getElementById('settingsStatus');

// Load saved recipient number on startup
function loadSavedSettings() {
    const savedRecipient = localStorage.getItem('wakeguard_sms_recipient');
    if (savedRecipient) {
        CONFIG.SMS_RECIPIENT = savedRecipient;
        console.log('[SETTINGS] Loaded saved SMS recipient');
    }
}

// Detect secret code typing
document.addEventListener('keydown', (e) => {
    // Don't detect if user is typing in an input field
    if (e.target.tagName === 'INPUT') return;

    typedKeys += e.key.toLowerCase();

    // Keep only last N characters where N is the secret code length
    if (typedKeys.length > SECRET_CODE.length) {
        typedKeys = typedKeys.slice(-SECRET_CODE.length);
    }

    // Check if secret code was typed
    if (typedKeys === SECRET_CODE) {
        openSettings();
        typedKeys = '';
    }
});

// Open settings modal
function openSettings() {
    settingsModal.classList.add('active');
    smsRecipientInput.value = CONFIG.SMS_RECIPIENT;
    settingsStatus.className = 'settings-status';
    settingsStatus.textContent = '';
    console.log('[SETTINGS] Secret panel opened');
}

// Close settings modal
function closeSettings() {
    settingsModal.classList.remove('active');
    typedKeys = '';
}

settingsClose.addEventListener('click', closeSettings);

// Close on backdrop click
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        closeSettings();
    }
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsModal.classList.contains('active')) {
        closeSettings();
    }
});

// Save settings
saveSettingsBtn.addEventListener('click', () => {
    const newRecipient = smsRecipientInput.value.trim();

    // Validate phone number (basic check)
    if (!newRecipient || newRecipient.length < 10) {
        settingsStatus.className = 'settings-status error';
        settingsStatus.textContent = '❌ Please enter a valid phone number';
        return;
    }

    // Add + prefix if missing
    const formattedNumber = newRecipient.startsWith('+') ? newRecipient : '+' + newRecipient;

    // Save to config and localStorage
    CONFIG.SMS_RECIPIENT = formattedNumber;
    localStorage.setItem('wakeguard_sms_recipient', formattedNumber);

    settingsStatus.className = 'settings-status success';
    settingsStatus.textContent = '✅ Settings saved! SMS alerts will be sent to: ' + formattedNumber;

    console.log('[SETTINGS] SMS recipient updated to:', formattedNumber);

    // Auto close after 2 seconds
    setTimeout(() => {
        closeSettings();
    }, 2000);
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('========================================');
    console.log('  WakeGuard Web - Drowsiness Detection  ');
    console.log('  Team: META MINDS                      ');
    console.log('  Guidance: Dr. K Sampath               ');
    console.log('  Type "wakeguard777" for settings      ');
    console.log('========================================');

    // Load saved settings
    loadSavedSettings();

    updateStatus('Ready - Click Start', 'normal');
});
