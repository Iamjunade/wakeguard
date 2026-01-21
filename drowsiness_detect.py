"""
WakeGuard - Driver Drowsiness Detection System
===============================================
A real-time drowsiness detection system using webcam, facial landmarks,
and Eye Aspect Ratio (EAR) analysis to keep drivers safe.

Prerequisites:
    pip install opencv-python dlib imutils scipy pygame

Required Files:
    - shape_predictor_68_face_landmarks.dat (facial landmark model)
    - alarm.wav (alert sound file)
"""

import cv2
import dlib
import imutils
from imutils import face_utils
from scipy.spatial import distance as dist
import pygame
import time
import os
import sys
import numpy as np
import requests

# ═══════════════════════════════════════════════════════════════════════════════
#                              CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# EAR threshold - if EAR drops below this value, eyes are considered "closed"
# Typical values: 0.20-0.30 (adjust based on individual eye shape)
EYE_ASPECT_RATIO_THRESHOLD = 0.25

# Number of consecutive frames eyes must be closed to trigger alarm
# At ~20 FPS, 48 frames ≈ 2-3 seconds of closed eyes
EYE_ASPECT_RATIO_CONSEC_FRAMES = 48

# Yawn detection threshold (optional feature)
MOUTH_ASPECT_RATIO_THRESHOLD = 0.6
YAWN_CONSEC_FRAMES = 20

# Display settings
WINDOW_WIDTH = 700
DISPLAY_FPS = True
SHOW_LANDMARKS = False  # Set True to visualize all 68 facial landmarks

# Colors (BGR format)
COLOR_GREEN = (0, 255, 0)
COLOR_RED = (0, 0, 255)
COLOR_YELLOW = (0, 255, 255)
COLOR_WHITE = (255, 255, 255)

# HTTPSMS Configuration for SMS Alerts
HTTPSMS_API_KEY = "uk_o1t_xX-X-lVBbWEFAzNslxgmY1byQf2wmNc1DNTw0FAjmG9V9Ee4fi7Ed9IY66ob"
HTTPSMS_SENDER_NUMBER = "+917780643862"
SMS_RECIPIENT_NUMBER = "+917780643862"
SMS_COOLDOWN_SECONDS = 60  # Minimum time between SMS alerts to avoid spam


# ═══════════════════════════════════════════════════════════════════════════════
#                          ASPECT RATIO FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def eye_aspect_ratio(eye):
    """
    Calculate the Eye Aspect Ratio (EAR).
    
    The EAR is calculated using the formula:
    EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
    
    Where p1-p6 are the 6 landmark points around the eye.
    
    Args:
        eye: numpy array of 6 (x, y) coordinates representing eye landmarks
        
    Returns:
        float: The eye aspect ratio value
    """
    # Compute euclidean distances between vertical eye landmarks
    A = dist.euclidean(eye[1], eye[5])  # p2 to p6
    B = dist.euclidean(eye[2], eye[4])  # p3 to p5

    # Compute euclidean distance between horizontal eye landmarks
    C = dist.euclidean(eye[0], eye[3])  # p1 to p4

    # Calculate and return EAR
    ear = (A + B) / (2.0 * C)
    return ear


def mouth_aspect_ratio(mouth):
    """
    Calculate the Mouth Aspect Ratio (MAR) for yawn detection.
    
    Args:
        mouth: numpy array of mouth landmark coordinates
        
    Returns:
        float: The mouth aspect ratio value
    """
    # Vertical mouth landmarks
    A = dist.euclidean(mouth[2], mouth[10])  # 51, 59
    B = dist.euclidean(mouth[4], mouth[8])   # 53, 57
    
    # Horizontal mouth landmark
    C = dist.euclidean(mouth[0], mouth[6])   # 49, 55
    
    mar = (A + B) / (2.0 * C)
    return mar


# ═══════════════════════════════════════════════════════════════════════════════
#                            SMS ALERT FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

# Track last SMS sent time to implement cooldown
last_sms_time = 0

def send_sms_alert():
    """
    Send an SMS alert via HTTPSMS API when drowsiness is detected.
    Includes cooldown to prevent spam.
    """
    global last_sms_time
    
    current_time = time.time()
    
    # Check cooldown
    if current_time - last_sms_time < SMS_COOLDOWN_SECONDS:
        return False
    
    try:
        url = "https://api.httpsms.com/v1/messages/send"
        headers = {
            "x-api-key": HTTPSMS_API_KEY,
            "Content-Type": "application/json"
        }
        payload = {
            "from": HTTPSMS_SENDER_NUMBER,
            "to": SMS_RECIPIENT_NUMBER,
            "content": "⚠️ WAKEGUARD ALERT: Drowsiness detected! Please take a break and rest. - Team META MINDS"
        }
        
        response = requests.post(url, json=payload, headers=headers, timeout=5)
        
        if response.status_code == 200:
            last_sms_time = current_time
            print("[SMS] Alert sent successfully!")
            return True
        else:
            print(f"[SMS] Failed to send: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"[SMS] Error sending alert: {e}")
        return False


# ═══════════════════════════════════════════════════════════════════════════════
#                            INITIALIZATION
# ═══════════════════════════════════════════════════════════════════════════════

def initialize_audio():
    """Initialize pygame mixer and load alarm sound."""
    pygame.mixer.init()
    
    # Check for alarm sound file
    alarm_path = os.path.join(os.path.dirname(__file__), "alarm.wav")
    
    if os.path.exists(alarm_path):
        pygame.mixer.music.load(alarm_path)
        print("[INFO] Alarm sound loaded successfully")
        return True
    else:
        print("[WARNING] alarm.wav not found! Audio alert will be disabled.")
        print(f"[WARNING] Expected location: {alarm_path}")
        return False


def initialize_detector():
    """Initialize OpenCV face detector and dlib facial landmark predictor."""
    print("[INFO] Loading face detector and landmark predictor...")
    
    # Initialize OpenCV's Haar Cascade face detector (more reliable than dlib on some systems)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)
    
    # Initialize Eye Cascade for fallback
    eye_cascade_path = cv2.data.haarcascades + "haarcascade_eye_tree_eyeglasses.xml"
    eye_cascade = cv2.CascadeClassifier(eye_cascade_path)
    
    if face_cascade.empty() or eye_cascade.empty():
        print("[ERROR] Could not load Haar cascade classifiers!")
        sys.exit(1)
    
    print("[INFO] OpenCV detectors loaded successfully")
    
    # Check for dlib landmark predictor file
    predictor_path = os.path.join(
        os.path.dirname(__file__), 
        "shape_predictor_68_face_landmarks.dat"
    )
    
    if not os.path.exists(predictor_path):
        print("\n" + "="*70)
        print("ERROR: shape_predictor_68_face_landmarks.dat not found!")
        print("="*70)
        print("\nTo download:")
        print("1. Visit: http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2")
        print("2. Extract the .dat file")
        print("3. Place it in:", os.path.dirname(__file__))
        print("="*70 + "\n")
        sys.exit(1)
    
    try:
        predictor = dlib.shape_predictor(predictor_path)
        print("[INFO] Facial landmark predictor loaded successfully")
    except Exception as e:
        print(f"[WARNING] Dlib predictor failed to load: {e}")
        predictor = None
    
    return face_cascade, eye_cascade, predictor


# ═══════════════════════════════════════════════════════════════════════════════
#                              MAIN PROGRAM
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    """Main function to run the drowsiness detection system."""
    
    print("\n" + "="*60)
    print("        WakeGuard - Driver Drowsiness Detection System")
    print("="*60 + "\n")
    
    # Initialize components
    audio_enabled = initialize_audio()
    detector, eye_cascade, predictor = initialize_detector()
    
    # Get facial landmark indexes for eyes and mouth
    try:
        (lStart, lEnd) = face_utils.FACIAL_LANDMARKS_IDXS["left_eye"]
        (rStart, rEnd) = face_utils.FACIAL_LANDMARKS_IDXS["right_eye"]
        (mStart, mEnd) = face_utils.FACIAL_LANDMARKS_IDXS["mouth"]
    except:
        # Defaults if dlib missing
        lStart, lEnd = (0,0)
        rStart, rEnd = (0,0)
        mStart, mEnd = (0,0)
    
    # Initialize video capture
    print("[INFO] Starting video stream...")
    # Use DirectShow backend on Windows for better compatibility
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    
    # Set camera properties for consistent output format
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    if not cap.isOpened():
        print("[ERROR] Could not open video stream!")
        print("[INFO] Please check your webcam connection.")
        sys.exit(1)
    
    # Allow camera to warm up
    time.sleep(1.0)
    print("[INFO] Video stream started successfully")
    print("[INFO] Press 'q' to quit\n")
    
    # State variables
    COUNTER = 0         # Consecutive frames with closed eyes
    YAWN_COUNTER = 0    # Consecutive frames with open mouth (yawn)
    ALARM_ON = False
    YAWN_ALARM_ON = False
    
    # FPS calculation
    fps_start_time = time.time()
    fps_counter = 0
    current_fps = 0
    
    try:
        while True:
            # Read frame from camera
            ret, frame = cap.read()
            
            if not ret:
                print("[ERROR] Could not read frame from camera!")
                break
            
            # Ensure frame is valid
            if frame is None or frame.size == 0:
                print("[WARNING] Empty frame received, skipping...")
                continue
            
            # Debug: Print frame info on first frame only
            if fps_counter == 0 and fps_start_time == time.time():
                print(f"[DEBUG] Frame shape: {frame.shape}, dtype: {frame.dtype}")
            
            # Handle various camera output formats
            if len(frame.shape) == 2:
                # Already grayscale
                gray = frame
                frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
            elif frame.shape[2] == 4:
                # BGRA format (some webcams output this)
                frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            elif frame.shape[2] == 3:
                # Standard BGR format
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            else:
                print(f"[WARNING] Unexpected frame format: {frame.shape}")
                continue
            
            # Resize frame
            frame = imutils.resize(frame, width=WINDOW_WIDTH)
            
            # Create grayscale for OpenCV face detection and dlib predictor
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = np.ascontiguousarray(gray)
            
            # Get image dimensions
            (H, W) = gray.shape[:2]
            
            # Detect faces using OpenCV's Haar Cascade
            faces = detector.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30),
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            
            # Convert OpenCV face rectangles to dlib rectangle format with CLAMPING
            # Dlib crashes if the rectangle is even slightly outside the image
            rects = []
            for (x, y, w, h) in faces:
                # Clamp coordinates to image boundaries
                x = max(0, int(x))
                y = max(0, int(y))
                w = min(int(w), W - x)
                h = min(int(h), H - y)
                
                # Skip invalid or too small faces which can cause dlib errors
                if w < 20 or h < 20:
                    continue
                
                # Construct dlib rectangle correctly (right/bottom are inclusive)
                rects.append(dlib.rectangle(x, y, x + w - 1, y + h - 1))
            
            # Calculate FPS
            fps_counter += 1
            if (time.time() - fps_start_time) > 1:
                current_fps = fps_counter / (time.time() - fps_start_time)
                fps_counter = 0
                fps_start_time = time.time()
            
            # Display status bar background
            cv2.rectangle(frame, (0, 0), (frame.shape[1], 40), (0, 0, 0), -1)
            
            # Process each detected face
            for rect in rects:
                # Get coordinates for crop
                (x, y, w, h) = (rect.left(), rect.top(), rect.width(), rect.height())
                
                # Prepare crops
                face_crop_gray = gray[y:y+h, x:x+w]
                if face_crop_gray.size == 0: continue
                
                try:
                    # Try Dlib first (Primary Method)
                    face_crop_rgb = cv2.cvtColor(face_crop_gray, cv2.COLOR_GRAY2RGB)
                    face_crop_rgb = np.ascontiguousarray(face_crop_rgb, dtype=np.uint8)
                    (crop_h, crop_w) = face_crop_rgb.shape[:2]
                    crop_rect = dlib.rectangle(0, 0, crop_w - 1, crop_h - 1)
                    
                    if predictor is None: raise RuntimeError("Dlib not loaded")
                    
                    shape = predictor(face_crop_rgb, crop_rect)
                    shape = face_utils.shape_to_np(shape)
                    
                    # Offset landmarks back to global coordinates
                    shape += (x, y)
                    
                    # Extract eye and mouth coordinates
                    leftEye = shape[lStart:lEnd]
                    rightEye = shape[rStart:rEnd]
                    mouth = shape[mStart:mEnd]
                    
                    # Calculate aspect ratios
                    leftEAR = eye_aspect_ratio(leftEye)
                    rightEAR = eye_aspect_ratio(rightEye)
                    ear = (leftEAR + rightEAR) / 2.0
                    mar = mouth_aspect_ratio(mouth)
                    
                    # Draw eye and mouth contours
                    leftEyeHull = cv2.convexHull(leftEye)
                    rightEyeHull = cv2.convexHull(rightEye)
                    mouthHull = cv2.convexHull(mouth)
                    cv2.drawContours(frame, [leftEyeHull], -1, COLOR_GREEN, 1)
                    cv2.drawContours(frame, [rightEyeHull], -1, COLOR_GREEN, 1)
                    cv2.drawContours(frame, [mouthHull], -1, COLOR_GREEN, 1)
                    
                    # Check EAR for drowsiness
                    if ear < EYE_ASPECT_RATIO_THRESHOLD:
                        COUNTER += 1
                    else:
                        COUNTER = 0
                    
                    # Display metrics
                    ear_color = COLOR_GREEN if ear >= EYE_ASPECT_RATIO_THRESHOLD else COLOR_RED
                    cv2.putText(frame, f"EAR: {ear:.3f}", (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, ear_color, 2)
                    
                except RuntimeError as e:
                    # Fallback to OpenCV Eye Detection if dlib fails
                    cv2.putText(frame, "Fallback Mode", (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, COLOR_YELLOW, 2)
                    
                    # Detect eyes in the face crop
                    eyes = eye_cascade.detectMultiScale(face_crop_gray, scaleFactor=1.1, minNeighbors=10, minSize=(15, 15))
                    
                    # Draw detected eyes
                    for (ex, ey, ew, eh) in eyes:
                        cv2.rectangle(frame, (x+ex, y+ey), (x+ex+ew, y+ey+eh), COLOR_GREEN, 1)
                    
                    # HEURISTIC: If NO eyes detected, assume closed? (Very rough)
                    # Or fewer than 1 eye
                    if len(eyes) < 1:
                        COUNTER += 1
                        cv2.putText(frame, "Eyes: 0 (Closed?)", (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLOR_RED, 2)
                    else:
                        COUNTER = 0
                        cv2.putText(frame, f"Eyes: {len(eyes)}", (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLOR_GREEN, 2)

                # TRIGGER ALARM (Shared logic)
                if COUNTER >= EYE_ASPECT_RATIO_CONSEC_FRAMES:
                    if not ALARM_ON:
                        ALARM_ON = True
                        if audio_enabled:
                            pygame.mixer.music.play(-1)
                        # Send SMS Alert
                        send_sms_alert()
                    
                    cv2.rectangle(frame, (0, 40), (W, H), COLOR_RED, 4)
                    cv2.putText(frame, "!!! DROWSINESS ALERT !!!", 
                                (W//2 - 150, H//2), cv2.FONT_HERSHEY_SIMPLEX, 1.0, COLOR_RED, 3)
                    cv2.putText(frame, "WAKE UP!", 
                                (W//2 - 70, H//2 + 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, COLOR_RED, 3)
                else:
                    if ALARM_ON:
                        ALARM_ON = False
                        if audio_enabled:
                            pygame.mixer.music.stop()
                

            
            # Display "No Face Detected" if no faces found
            if len(rects) == 0:
                cv2.putText(frame, "No Face Detected", (10, 28),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLOR_YELLOW, 2)
            
            # Display FPS
            if DISPLAY_FPS:
                cv2.putText(frame, f"FPS: {current_fps:.1f}", 
                            (frame.shape[1] - 100, 28),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLOR_WHITE, 2)
            
            # Display Credits at the bottom of the frame
            credits_y = frame.shape[0] - 10  # 10 pixels from bottom
            cv2.rectangle(frame, (0, frame.shape[0] - 50), (frame.shape[1], frame.shape[0]), (0, 0, 0), -1)  # Dark background
            cv2.putText(frame, "Team: META MINDS", 
                        (10, credits_y - 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, COLOR_YELLOW, 1)
            cv2.putText(frame, "Guidance: Dr. K Sampath", 
                        (10, credits_y),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, COLOR_WHITE, 1)
            
            # Show the frame
            cv2.imshow("WakeGuard - Driver Safety System", frame)
            
            # Check for quit key
            key = cv2.waitKey(1) & 0xFF
            if key == ord("q"):
                print("\n[INFO] Quitting...")
                break
    
    except KeyboardInterrupt:
        print("\n[INFO] Interrupted by user")
    
    finally:
        # Cleanup
        print("[INFO] Cleaning up...")
        cv2.destroyAllWindows()
        cap.release()
        if audio_enabled:
            pygame.mixer.music.stop()
            pygame.mixer.quit()
        print("[INFO] WakeGuard terminated successfully\n")


# ═══════════════════════════════════════════════════════════════════════════════
#                              ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    main()
