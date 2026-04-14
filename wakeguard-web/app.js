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
    EAR_THRESHOLD: 0.26,

    // MAR threshold - mouth considered "yawning" above this value
    MAR_THRESHOLD: 0.60,

    // Alarm trigger delay in milliseconds (1.5 seconds for faster detection)
    ALARM_DELAY_MS: 1500,

    // SMS Configuration (Securely handled via Vercel Proxy)
    SMS_RECIPIENTS: ["+917780643862"],
    SMS_COOLDOWN_MS: 60000, // 60 seconds between SMS

    // MediaPipe Eye Landmark Indices (from 468 landmarks)
    // Right Eye
    RIGHT_EYE: [33, 160, 158, 133, 153, 144],
    // Left Eye  
    LEFT_EYE: [362, 385, 387, 263, 373, 380],

    // AI Voice Configuration
    DRIVER_NAME: 'Junaid',           // Driver's name for personalized alerts
    AI_VOICE_COOLDOWN_MS: 30000,     // 30 seconds between voice alerts
    AI_VOICE_ENABLED: true,          // Toggle AI voice on/off
    WHATSAPP_SERVER_URL: 'http://localhost:3000', // Default local URL
};

// ═══════════════════════════════════════════════════════════════════════════════
//                         AI VOICE ALERT STATE
// ═══════════════════════════════════════════════════════════════════════════════
let lastAiVoiceTime = 0;
let isSpeaking = false;

// ═══════════════════════════════════════════════════════════════════════════════
//                              STATE VARIABLES
// ═══════════════════════════════════════════════════════════════════════════════

let faceMesh = null;
let camera = null;
let isRunning = false;
let frameCounter = 0;
let closedEyeCounter = 0;
let yawnCounter = 0;
let eyeCloseStartTime = 0;
let yawnStartTime = 0;
let alarmOn = false;
let lastSmsTime = 0;
let fpsCounter = 0;
let lastFpsTime = performance.now();
let currentFps = 0;

// Distraction Detection (COCO-SSD)
let cocoSsdModel = null;
let phoneDetected = false;
let phoneBoxes = [];
let lastDetectionTime = 0;

// DOM Elements
const webcamElement = document.getElementById('webcam');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const earValueElement = document.getElementById('earValue');
const fpsValueElement = document.getElementById('fpsValue');
const earTargetValueElement = document.getElementById('earTargetValue');
const marValueElement = document.getElementById('marValue');
const eventLogList = document.getElementById('eventLogList');
const fatigueIndexValue = document.getElementById('fatigueIndexValue');
const alertOverlay = document.getElementById('alertOverlay');
const loadingOverlay = document.getElementById('loadingOverlay');
const statusBadge = document.getElementById('statusBadge');
const statusDot = statusBadge.querySelector('.status-dot');
const statusText = statusBadge.querySelector('.status-text');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const alarmSound = document.getElementById('alarmSound');
const instantAlertsToggle = document.getElementById('instantAlertsToggle');
const smsToggle = document.getElementById('smsToggle');
const earScoreSlider = document.getElementById('earScoreSlider');
const earSliderValue = document.getElementById('earSliderValue');
const nightModeToggle = document.getElementById('nightModeToggle');

// Chart data arrays
const timeData = Array(60).fill(''); 
const earDataList = Array(60).fill(0.3);
const marDataList = Array(60).fill(0.1);

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
 * Get current coordinates using Geolocation API
 */
async function getCurrentLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            console.warn('[GPS] Geolocation not supported');
            resolve(null);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                resolve(`https://www.google.com/maps?q=${latitude},${longitude}`);
            },
            (err) => {
                console.warn('[GPS] Error getting location:', err.message);
                resolve(null);
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    });
}

/**
 * Extract eye landmark coordinates from face mesh results
 */
function getEyeLandmarks(landmarks, eyeIndices) {
    return eyeIndices.map(idx => landmarks[idx]);
}

/**
 * Send SMS alert via Secure Vercel Proxy
 */
async function sendSmsAlert(customMessage) {
    const now = Date.now();
    console.log('[ALERT] Dispatching alerts...', { customMessage });

    if (now - lastSmsTime < CONFIG.SMS_COOLDOWN_MS) {
        console.warn('[ALERT] Cooldown active, skipping API calls.');
        return;
    }

    const location = await getCurrentLocation();
    
    // Format date and time
    const checkDate = new Date();
    const timeOptions = { hour: 'numeric', minute: 'numeric', hour12: true, year: 'numeric', month: '2-digit', day: '2-digit' };
    const timeStr = checkDate.toLocaleString('en-US', timeOptions);

    // Capture high-quality composite frame (Face + AI Mesh) for WhatsApp
    let base64Image = null;
    try {
        if (webcamElement && canvasElement) {
            // Create a temporary offscreen canvas for the composite image
            const offscreen = document.createElement('canvas');
            offscreen.width = webcamElement.videoWidth;
            offscreen.height = webcamElement.videoHeight;
            const ctx = offscreen.getContext('2d');
            
            // 1. Draw the live camera feed
            ctx.drawImage(webcamElement, 0, 0, offscreen.width, offscreen.height);
            
            // 2. Draw the AI landmark mesh overlay on top
            ctx.drawImage(canvasElement, 0, 0, offscreen.width, offscreen.height);
            
            // 3. Export as high-quality JPEG
            const dataUrl = offscreen.toDataURL('image/jpeg', 0.9);
            base64Image = dataUrl.split(',')[1];
            console.log('[ALERT] High-quality composite frame captured for WhatsApp');
        }
    } catch (e) {
        console.error('[ALERT] Composite image capture failed:', e);
    }

    // Skip browser-side image upload (avoids CORS issues)
    let imageUrl = '';
    
    // Use passed message or default
    let alertText = customMessage || 'Drowsiness detected!';
    console.log('[ALERT] Preparing message:', alertText);
    let alertMessage = `⚠️ WAKEGUARD ALERT: ${alertText}\nTime: ${timeStr}`;
    if (location) {
        alertMessage += `\n📍 Approx. Location: ${location}`;
    }
    alertMessage += `\nPlease take a break and rest. - Team META MINDS`;

    try {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';

        let response;
        if (isLocal) {
            // Offline/Local Mode: Bypass missing Vercel and hit TextBee directly
            console.log('[SMS] Local offline mode detected. Bypassing Vercel proxy...');
            const TEXTBEE_API_KEY = "257cd9a4-2ea6-4171-b1f9-95837eecc032";
            const TEXTBEE_DEVICE_ID = "699bf9c78afaf7aa2c339a1f";
            
            response = await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${TEXTBEE_DEVICE_ID}/send-sms`, {
                method: 'POST',
                headers: {
                    'x-api-key': TEXTBEE_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipients: CONFIG.SMS_RECIPIENTS,
                    message: alertMessage
                })
            });
        } else {
            // Production Vercel Mode: Use secure proxy
            response = await fetch('/api/send-sms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipients: CONFIG.SMS_RECIPIENTS,
                    message: alertMessage,
                    location: location
                })
            });
        }

        if (response.ok || response.status === 201) {
            lastSmsTime = now;
            console.log('[SMS] Alert queued/sent successfully!');
        } else {
            console.error('[SMS] Failed:', await response.text());
        }
    } catch (error) {
        console.error('[SMS] Error:', error);
    }

    // Also send WhatsApp alert to all recipients with image attachment
    CONFIG.SMS_RECIPIENTS.forEach(recipient => {
        try {
            console.log(`[WhatsApp] Dispatching media alert to ${recipient} via ${CONFIG.WHATSAPP_SERVER_URL}...`);
            fetch(`${CONFIG.WHATSAPP_SERVER_URL}/api/alert/whatsapp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Bypass-Tunnel-Reminder': 'true'
                },
                body: JSON.stringify({
                    number: recipient,
                    message: alertMessage,
                    image: base64Image // Send the high-quality base64 frame
                })
            }).then(res => res.json()).then(data => {
                if (data.success) {
                    console.log(`[WhatsApp] Alert successfully sent to ${recipient}:`, data.id);
                } else {
                    console.error(`[WhatsApp] Server error for ${recipient}:`, data.error);
                }
            }).catch(e => console.error(`[WhatsApp] Network failed for ${recipient}:`, e));
        } catch (w_error) {
            console.error(`[WhatsApp] Exception for ${recipient}:`, w_error);
        }
    });
}

/**
 * Speak a message aloud using the browser's SpeechSynthesis API
 */
function speakMessage(text) {
    if (!text || isSpeaking) return;
    window.speechSynthesis.cancel(); // Cancel any ongoing speech
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;    // Slightly slower — easier to understand in a car
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Prefer a natural-sounding voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang === 'en-US' && (v.name.includes('Google') || v.name.includes('Natural')));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => { isSpeaking = true; console.log('[VOICE] Speaking:', text); };
    utterance.onend = () => { isSpeaking = false; };
    utterance.onerror = (e) => { isSpeaking = false; console.error('[VOICE] Speech error:', e); };

    window.speechSynthesis.speak(utterance);
}

/**
 * Query AI for a compassionate alert message and speak it
 * - On Vercel: calls /api/ai-chat (Groq Llama-3, cloud)
 * - On Local:  calls http://localhost:3000/api/ai/chat (Ollama, offline)
 */
async function fetchAndSpeakAI(alertType) {
    const now = Date.now();
    if (!CONFIG.AI_VOICE_ENABLED) return;
    if (now - lastAiVoiceTime < CONFIG.AI_VOICE_COOLDOWN_MS) {
        console.log('[VOICE] AI voice cooldown active, skipping...');
        return;
    }
    lastAiVoiceTime = now;

    // Immediately speak a quick fallback while waiting for the AI
    const quickAlerts = {
        'DROWSINESS': `${CONFIG.DRIVER_NAME}, wake up! You are falling asleep.`,
        'YAWNING': `${CONFIG.DRIVER_NAME}, you look exhausted. Please take a break.`
    };
    speakMessage(quickAlerts[alertType] || 'Please pull over and rest.');

    // Detect environment: Vercel (production) vs Local
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' || 
                    window.location.protocol === 'file:';
    
    const aiEndpoint = isLocal 
        ? `${CONFIG.WHATSAPP_SERVER_URL}/api/ai/chat` 
        : '/api/ai-chat';                        // Groq via Vercel (online)

    console.log(`[AI] Fetching personalised alert from ${isLocal ? 'Ollama (local)' : 'Groq (Vercel)'}...`);

    // Then query the AI for a richer message (async)
    try {
        const response = await fetch(aiEndpoint, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'true'
            },
            body: JSON.stringify({
                alertType: alertType,
                driverName: CONFIG.DRIVER_NAME
            })
        });

        if (!response.ok) throw new Error(`Server responded with ${response.status}`);

        const data = await response.json();
        if (data.success && data.message) {
            const source = data.fallback ? 'fallback' : 'AI';
            console.log(`[AI] Received ${source} message: "${data.message}"`);
            // Speak the AI message with a small delay to not overlap with quick alert
            setTimeout(() => speakMessage(data.message), 4000);
        }
    } catch (err) {
        console.warn('[AI] Could not reach AI server. Using quick alert only.', err.message);
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
 * Trigger drowsiness/yawn alarm
 */
function triggerAlarm(message = 'DROWSINESS DETECTED!') {
    if (!alarmOn) {
        alarmOn = true;
        alertOverlay.classList.add('active');
        updateStatus(message, 'alert');

        // Determine alert type for AI
        const alertType = message.includes('YAWN') ? 'YAWNING' : 'DROWSINESS';

        // 1. Speak AI-powered conversational alert
        fetchAndSpeakAI(alertType);

        // 2. Play alarm sound if instant alerts are enabled
        if (instantAlertsToggle && instantAlertsToggle.checked) {
            startAlarmSound();
        }

        // 3. Send SMS & WhatsApp if notifications are enabled
        if (smsToggle && smsToggle.checked) {
            console.log('[TRIGGER] Notifying emergency contacts...');
            sendSmsAlert(message);
        } else {
            console.warn('[TRIGGER] SMS Notification is toggled OFF. Skipping alerts.');
        }
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

let earChartInstance = null;
let marChartInstance = null;
let marChart2Instance = null;
let fatigueGaugeInstance = null;

function addLogEvent(message, type) {
    const li = document.createElement('li');
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const dotColor = type === 'alert' ? '#ff3333' : (type === 'warning' ? '#ff9900' : '#00ff66');
    li.innerHTML = `<span class="time">${time}</span> <span class="dot" style="color:${dotColor}">●</span> <span>${message}</span>`;
    eventLogList.prepend(li);
    if(eventLogList.children.length > 20) {
        eventLogList.removeChild(eventLogList.lastChild);
    }
}

function updateCharts(ear, mar) {
    if(!earChartInstance) return;
    
    timeData.push('');
    timeData.shift();
    earDataList.push(ear);
    earDataList.shift();
    marDataList.push(mar);
    marDataList.shift();
    
    earChartInstance.update('none');
    marChartInstance.update('none');
    marChart2Instance.update('none');
    
    let fatigue = 100;
    if (ear > 0.3) fatigue = 0;
    else if (ear < 0.2) fatigue = 100;
    else fatigue = Math.round(((0.3 - ear) / 0.1) * 100);
    
    // Smooth gauge update
    const currentGauge = fatigueGaugeInstance.data.datasets[0].data[0];
    const newGauge = currentGauge + (fatigue - currentGauge) * 0.1;
    
    fatigueGaugeInstance.data.datasets[0].data = [newGauge, 100 - newGauge];
    fatigueGaugeInstance.update('none');
    fatigueIndexValue.textContent = Math.round(newGauge) + '%';
}

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

    // Apply Night Mode / Low Light Boost
    if (nightModeToggle && nightModeToggle.checked) {
        // Boost brightness and contrast for detection visibility
        canvasCtx.filter = 'brightness(1.5) contrast(1.2) hue-rotate(80deg) saturate(1.5)';
        
        // Add a digital "scanline" or green overlay effect
        canvasCtx.fillStyle = 'rgba(0, 255, 100, 0.05)';
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Label
        canvasCtx.fillStyle = '#00ff66';
        canvasCtx.font = 'bold 14px Inter';
        canvasCtx.fillText('NIGHT VISION ACTIVE', 20, canvasElement.height - 20);
    }

    // AI Distraction Detection (Every 15 frames)
    if (cocoSsdModel && isRunning && frameCounter % 15 === 0) {
        cocoSsdModel.detect(webcamElement).then(predictions => {
            phoneDetected = false;
            phoneBoxes = [];
            predictions.forEach(prediction => {
                if (prediction.class === 'cell phone' && prediction.score > 0.6) {
                    phoneDetected = true;
                    phoneBoxes.push(prediction);
                }
            });

            if (phoneDetected) {
                addLogEvent('DISTRACTION: Phone use detected!', 'alert');
                if (!alarmOn) triggerAlarm('PHONE USE DETECTED!');
                fetchAndSpeakAI('distraction');
            }
        });
    }

    // Overlay distracton boxes
    phoneBoxes.forEach(box => {
        canvasCtx.strokeStyle = '#ffcc00';
        canvasCtx.lineWidth = 4;
        canvasCtx.strokeRect(...box.bbox);
        canvasCtx.fillStyle = '#ffcc00';
        canvasCtx.font = 'bold 16px Inter';
        canvasCtx.fillText('PHONE USE', box.bbox[0], box.bbox[1] > 20 ? box.bbox[1] - 5 : 20);
    });

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];

        const rightEyeLandmarks = getEyeLandmarks(landmarks, CONFIG.RIGHT_EYE);
        const leftEyeLandmarks = getEyeLandmarks(landmarks, CONFIG.LEFT_EYE);
        
        // Basic MAR calculation based on lip landmarks
        const topLip = landmarks[13];
        const bottomLip = landmarks[14];
        const leftLip = landmarks[78];
        const rightLip = landmarks[308];
        
        const marHeight = distance(topLip, bottomLip);
        const marWidth = distance(leftLip, rightLip);
        const mar = marWidth > 0 ? marHeight / marWidth : 0;

        const rightEAR = calculateEAR(rightEyeLandmarks);
        const leftEAR = calculateEAR(leftEyeLandmarks);
        const avgEAR = (rightEAR + leftEAR) / 2;

        earValueElement.textContent = avgEAR.toFixed(3);
        if(earTargetValueElement) earTargetValueElement.textContent = avgEAR.toFixed(3);
        if(marValueElement) marValueElement.textContent = mar.toFixed(3);
        
        if(frameCounter % 3 === 0) {
            updateCharts(avgEAR, mar);
        }
        frameCounter++;

        // Eye detection logic
        if (avgEAR < CONFIG.EAR_THRESHOLD) {
            if(closedEyeCounter === 0) {
                addLogEvent("Fatigue Index: drowsiness detected", "warning");
                eyeCloseStartTime = now;
            }
            closedEyeCounter++;
            earValueElement.classList.add('warning');
        } else {
            if(closedEyeCounter > 0) addLogEvent("Fatigue Index: driver alert", "normal");
            closedEyeCounter = 0;
            eyeCloseStartTime = 0;
            earValueElement.classList.remove('warning');
        }

        // Yawn detection logic
        if (mar > CONFIG.MAR_THRESHOLD) {
            if(yawnCounter === 0) {
                addLogEvent("Fatigue Index: yawning detected", "warning");
                yawnStartTime = now;
            }
            yawnCounter++;
            if(marValueElement) marValueElement.classList.add('warning');
        } else {
            yawnCounter = 0;
            yawnStartTime = 0;
            if(marValueElement) marValueElement.classList.remove('warning');
        }

        // Alarm triggering
        let eyeTimeElapsed = (eyeCloseStartTime > 0) ? (now - eyeCloseStartTime) : 0;
        let yawnTimeElapsed = (yawnStartTime > 0) ? (now - yawnStartTime) : 0;

        if (eyeTimeElapsed >= CONFIG.ALARM_DELAY_MS) {
            if(!alarmOn) { // Only log once when alarm goes off
                addLogEvent("Event log: ALARM TRIGGERED (SLEEPING)", "alert");
            }
            triggerAlarm('DROWSINESS DETECTED!');
        } else if (yawnTimeElapsed >= CONFIG.ALARM_DELAY_MS) {
            if(!alarmOn) {
                addLogEvent("Event log: ALARM TRIGGERED (YAWNING)", "alert");
            }
            triggerAlarm('YAWNING DETECTED!');
        } else {
            stopAlarm();
        }

        canvasCtx.globalAlpha = 0.6;
        for (const landmarks of results.multiFaceLandmarks) {
            if(window.drawConnectors) {
                drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {color: '#00e5ff', lineWidth: 1});
            } else {
                // Fallback to simpler drawing if drawing_utils not loaded yet
                const eyeColor = avgEAR < CONFIG.EAR_THRESHOLD ? '#ff4444' : '#00ff88';
                const drawEye = (eyeLandmarks, color) => {
                    canvasCtx.beginPath();
                    eyeLandmarks.forEach((point, index) => {
                        const x = point.x * canvasElement.width;
                        const y = point.y * canvasElement.height;
                        if (index === 0) canvasCtx.moveTo(x, y);
                        else canvasCtx.lineTo(x, y);
                    });
                    canvasCtx.closePath();
                    canvasCtx.strokeStyle = color;
                    canvasCtx.lineWidth = 2;
                    canvasCtx.stroke();
                };
                drawEye(rightEyeLandmarks, eyeColor);
                drawEye(leftEyeLandmarks, eyeColor);
            }
        }
        canvasCtx.globalAlpha = 1.0;

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

    // Load COCO-SSD for distraction detection
    try {
        updateStatus('Loading AI Models...', 'normal');
        cocoSsdModel = await cocoSsd.load();
        console.log('[INFO] COCO-SSD model loaded');
    } catch (error) {
        console.error('[ERROR] Failed to load COCO-SSD:', error);
    }
}

async function startDetection() {
    updateStatus('Starting camera...', 'normal');

    // Show loading spinner
    loadingOverlay.classList.add('active');

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

        // Hide loading spinner
        loadingOverlay.classList.remove('active');

        startBtn.disabled = true;
        stopBtn.disabled = false;
        updateStatus('Monitoring...', 'active');

        console.log('[INFO] Detection started');

    } catch (error) {
        console.error('[ERROR] Failed to start:', error);
        loadingOverlay.classList.remove('active');
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
    yawnCounter = 0;

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

if (earScoreSlider) {
    earScoreSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        if(earSliderValue) earSliderValue.textContent = val + '%';
        // Convert 0-100 to EAR threshold (e.g. 0.15 to 0.35 max)
        // 45% = 0.22, 0% = 0.15, 100% = 0.35
        const newThreshold = 0.15 + (val / 100) * 0.20;
        CONFIG.EAR_THRESHOLD = newThreshold;
    });
}

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

// Load saved recipient numbers on startup
function loadSavedSettings() {
    const savedRecipients = localStorage.getItem('wakeguard_sms_recipients');
    if (savedRecipients) {
        CONFIG.SMS_RECIPIENTS = savedRecipients.split(',').map(s => s.trim()).filter(Boolean);
        console.log('[SETTINGS] Loaded saved SMS recipients:', CONFIG.SMS_RECIPIENTS);
    }
    const savedWhatsAppUrl = localStorage.getItem('wakeguard_whatsapp_url');
    if (savedWhatsAppUrl) {
        CONFIG.WHATSAPP_SERVER_URL = savedWhatsAppUrl;
        console.log('[SETTINGS] Loaded saved WhatsApp Proxy URL:', savedWhatsAppUrl);
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
    smsRecipientInput.value = CONFIG.SMS_RECIPIENTS.join(', ');
    document.getElementById('whatsappProxyUrl').value = CONFIG.WHATSAPP_SERVER_URL;
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
    const inputVal = smsRecipientInput.value.trim();
    const proxyUrl = document.getElementById('whatsappProxyUrl').value.trim();

    // 1. Handle WhatsApp Proxy URL
    if (proxyUrl) {
        if (proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://')) {
            CONFIG.WHATSAPP_SERVER_URL = proxyUrl.replace(/\/$/, ""); 
            localStorage.setItem('wakeguard_whatsapp_url', CONFIG.WHATSAPP_SERVER_URL);
        } else {
            settingsStatus.className = 'settings-status error';
            settingsStatus.textContent = '❌ Invalid Proxy URL. Must start with http:// or https://';
            return;
        }
    }

    // 2. Handle SMS Recipients
    if (!inputVal) {
        settingsStatus.className = 'settings-status error';
        settingsStatus.textContent = '❌ Please enter at least one valid phone number';
        return;
    }

    let recipientsArray = inputVal.split(',').map(s => s.trim()).filter(Boolean);
    recipientsArray = recipientsArray.map(num => {
        if (!num.startsWith('+')) return '+91' + num;
        return num;
    });

    CONFIG.SMS_RECIPIENTS = recipientsArray;
    localStorage.setItem('wakeguard_sms_recipients', recipientsArray.join(','));

    settingsStatus.className = 'settings-status success';
    settingsStatus.textContent = '✅ Settings saved successfully!';
    
    setTimeout(() => {
        closeSettings();
    }, 1500);
});

document.addEventListener('DOMContentLoaded', () => {
    console.log('========================================');
    console.log('  WakeGuard Web - Drowsiness Detection  ');
    console.log('  Team: META MINDS                      ');
    console.log('  Guidance: Dr. K Sampath               ');
    console.log('  Type "wakeguard777" for settings      ');
    console.log('========================================');

    // Initialize Charts
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        scales: {
            x: { display: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888', maxTicksLimit: 6 } },
            y: { display: true, min: 0, max: 0.8, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888' } }
        },
        plugins: { legend: { display: false } },
        elements: { point: { radius: 0 }, line: { tension: 0.4, borderWidth: 2 } }
    };

    if (document.getElementById('earChart')) {
        earChartInstance = new Chart(document.getElementById('earChart'), {
            type: 'line',
            data: { labels: timeData, datasets: [{ data: earDataList, borderColor: '#00e5ff', backgroundColor: 'rgba(0, 229, 255, 0.1)', fill: true }] },
            options: commonOptions
        });
    }

    if (document.getElementById('marChart')) {
        marChartInstance = new Chart(document.getElementById('marChart'), {
            type: 'line',
            data: { labels: timeData, datasets: [{ data: marDataList, borderColor: '#ff9900', backgroundColor: 'rgba(255, 153, 0, 0.1)', fill: true }] },
            options: commonOptions
        });
    }

    if (document.getElementById('marChart2')) {
        marChart2Instance = new Chart(document.getElementById('marChart2'), {
            type: 'line',
            data: { labels: timeData, datasets: [{ data: marDataList, borderColor: '#00e5ff', backgroundColor: 'rgba(0, 229, 255, 0.1)', fill: true }] },
            options: commonOptions
        });
    }

    if (document.getElementById('fatigueGauge')) {
        fatigueGaugeInstance = new Chart(document.getElementById('fatigueGauge'), {
            type: 'doughnut',
            data: {
                labels: ['Fatigue', 'Alert'],
                datasets: [{
                    data: [45, 55],
                    backgroundColor: ['#ff9900', '#1f2937'],
                    borderWidth: 0,
                    circumference: 180,
                    rotation: 270
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '80%',
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                animation: { duration: 0 }
            }
        });
    }

    // Add initial log
    addLogEvent("System Initialized", "normal");

    // Load saved settings
    loadSavedSettings();

    updateStatus('Ready - Click Start', 'normal');
});
