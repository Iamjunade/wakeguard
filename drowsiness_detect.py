"""
WakeGuard - Driver Drowsiness Detection System
===============================================
A real-time drowsiness detection system using webcam, facial landmarks,
and Eye Aspect Ratio (EAR) analysis to keep drivers safe.

Prerequisites:
    pip install opencv-python dlib imutils scipy pygame ultralytics
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
import datetime
from ultralytics import YOLO

# ═══════════════════════════════════════════════════════════════════════════════
#                              CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# EAR threshold - if EAR drops below this value, eyes are considered "closed"
EYE_ASPECT_RATIO_THRESHOLD = 0.26

# Time threshold eyes must be closed to trigger alarm (in seconds)
EYE_CLOSED_SECONDS_THRESHOLD = 1.5

# Yawn detection threshold
MOUTH_ASPECT_RATIO_THRESHOLD = 0.6
YAWN_SECONDS_THRESHOLD = 2.0

# Display settings
WINDOW_WIDTH = 700
DISPLAY_FPS = True

# Colors (BGR format)
COLOR_GREEN = (0, 255, 0)
COLOR_RED = (0, 0, 255)
COLOR_YELLOW = (0, 255, 255)
COLOR_WHITE = (255, 255, 255)

# TextBee Configuration for SMS Alerts
TEXT_BEE_API_KEY = "257cd9a4-2ea6-4171-b1f9-95837eecc032"
TEXT_BEE_DEVICE_ID = "699bf9c78afaf7aa2c339a1f"
SMS_RECIPIENT_NUMBER = "+917780643862"
SMS_COOLDOWN_SECONDS = 60

# ═══════════════════════════════════════════════════════════════════════════════
#                          ASPECT RATIO FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def eye_aspect_ratio(eye):
    A = dist.euclidean(eye[1], eye[5])
    B = dist.euclidean(eye[2], eye[4])
    C = dist.euclidean(eye[0], eye[3])
    return (A + B) / (2.0 * C)

def mouth_aspect_ratio(mouth):
    A = dist.euclidean(mouth[2], mouth[10])
    B = dist.euclidean(mouth[4], mouth[8])
    C = dist.euclidean(mouth[0], mouth[6])
    return (A + B) / (2.0 * C)

# ═══════════════════════════════════════════════════════════════════════════════
#                            SMS ALERT FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

last_sms_time = 0

def get_ip_location():
    try:
        response = requests.get("https://ipapi.co/json/", timeout=5)
        if response.status_code == 200:
            data = response.json()
            lat = data.get("latitude")
            lon = data.get("longitude")
            if lat and lon:
                return f"https://www.google.com/maps?q={lat},{lon}"
    except Exception:
        pass
    return None

def send_sms_alert(frame=None):
    global last_sms_time
    current_time = time.time()
    
    if current_time - last_sms_time < SMS_COOLDOWN_SECONDS:
        return False
        
    location = get_ip_location()
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %I:%M %p")
    
    message = f"⚠️ WAKEGUARD ALERT: Driver attention required!\nTime: {now_str}\n"
    if location:
        message += f"📍 Location: {location}\n"
        
    if frame is not None:
        cv2.imwrite("alert_frame.jpg", frame)
        try:
            with open("alert_frame.jpg", "rb") as f:
                r = requests.post("https://catbox.moe/user/api.php", 
                                  data={"reqtype": "fileupload"}, files={"fileToUpload": f}, timeout=10)
            if r.status_code == 200 and r.text.startswith("http"):
                message += f"\n📷 Evidence: {r.text.strip()}"
        except Exception:
            pass
            
    try:
        url = f"https://api.textbee.dev/api/v1/gateway/devices/{TEXT_BEE_DEVICE_ID}/send-sms"
        headers = {"x-api-key": TEXT_BEE_API_KEY, "Content-Type": "application/json"}
        payload = {"recipients": [SMS_RECIPIENT_NUMBER], "message": message}
        response = requests.post(url, json=payload, headers=headers, timeout=5)
        if response.status_code == 200:
            last_sms_time = current_time
            return True
    except Exception:
        pass
    return False

# ═══════════════════════════════════════════════════════════════════════════════
#                            INITIALIZATION
# ═══════════════════════════════════════════════════════════════════════════════

def initialize_audio():
    pygame.mixer.init()
    alarm_path = os.path.join(os.path.dirname(__file__), "alarm.wav")
    if os.path.exists(alarm_path):
        pygame.mixer.music.load(alarm_path)
        return True
    return False

def initialize_detector():
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    eye_cascade_path = cv2.data.haarcascades + "haarcascade_eye_tree_eyeglasses.xml"
    face_cascade = cv2.CascadeClassifier(cascade_path)
    eye_cascade = cv2.CascadeClassifier(eye_cascade_path)
    
    predictor_path = os.path.join(os.path.dirname(__file__), "shape_predictor_68_face_landmarks.dat")
    predictor = dlib.shape_predictor(predictor_path) if os.path.exists(predictor_path) else None
    
    try:
        yolo_model = YOLO('yolov8n.pt')
    except Exception:
        yolo_model = None
        
    return face_cascade, eye_cascade, predictor, yolo_model

# ═══════════════════════════════════════════════════════════════════════════════
#                              MAIN PROGRAM
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("\nWakeGuard - System Starting...")
    audio_enabled = initialize_audio()
    detector, eye_cascade, predictor, yolo_model = initialize_detector()
    
    lStart, lEnd = face_utils.FACIAL_LANDMARKS_IDXS["left_eye"]
    rStart, rEnd = face_utils.FACIAL_LANDMARKS_IDXS["right_eye"]
    mStart, mEnd = face_utils.FACIAL_LANDMARKS_IDXS["mouth"]
    
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    eyes_closed_start_time = None
    yawn_start_time = None
    ALARM_ON = False
    
    fps_start_time = time.time()
    fps_counter = 0
    current_fps = 0
    
    phone_detected = False
    phone_boxes = []
    frame_count = 0
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None: break
            
            frame_count += 1
            frame = imutils.resize(frame, width=WINDOW_WIDTH)
            (H, W) = frame.shape[:2]
            
            # YOLO Distraction Detection (Every 10 frames)
            if yolo_model and frame_count % 10 == 0:
                phone_detected = False
                phone_boxes = []
                results = yolo_model(frame, stream=True, verbose=False, imgsz=320)
                for r in results:
                    for box in r.boxes:
                        if int(box.cls[0]) == 67 and float(box.conf[0]) > 0.5:
                            phone_detected = True
                            phone_boxes.append(box.xyxy[0].cpu().numpy().astype(int))
            
            for b in phone_boxes:
                cv2.rectangle(frame, (b[0], b[1]), (b[2], b[3]), COLOR_YELLOW, 2)
                cv2.putText(frame, "PHONE", (b[0], b[1] - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, COLOR_YELLOW, 2)

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            faces = detector.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))
            rects = [dlib.rectangle(int(x), int(y), int(x+w), int(y+h)) for (x, y, w, h) in faces]
            
            is_drowsy = False
            is_yawning = False

            for rect in rects:
                try:
                    shape = predictor(gray, rect)
                    shape = face_utils.shape_to_np(shape)
                    
                    ear = (eye_aspect_ratio(shape[lStart:lEnd]) + eye_aspect_ratio(shape[rStart:rEnd])) / 2.0
                    mar = mouth_aspect_ratio(shape[mStart:mEnd])
                    
                    cv2.drawContours(frame, [cv2.convexHull(shape[lStart:lEnd])], -1, COLOR_GREEN, 1)
                    cv2.drawContours(frame, [cv2.convexHull(shape[rStart:rEnd])], -1, COLOR_GREEN, 1)
                    cv2.drawContours(frame, [cv2.convexHull(shape[mStart:mEnd])], -1, COLOR_GREEN, 1)
                    
                    if ear < EYE_ASPECT_RATIO_THRESHOLD:
                        if eyes_closed_start_time is None: eyes_closed_start_time = time.time()
                    else: eyes_closed_start_time = None
                        
                    if mar > MOUTH_ASPECT_RATIO_THRESHOLD:
                        if yawn_start_time is None: yawn_start_time = time.time()
                    else: yawn_start_time = None

                    is_drowsy = eyes_closed_start_time is not None and (time.time() - eyes_closed_start_time) >= EYE_CLOSED_SECONDS_THRESHOLD
                    is_yawning = yawn_start_time is not None and (time.time() - yawn_start_time) >= YAWN_SECONDS_THRESHOLD
                    
                    cv2.putText(frame, f"EAR: {ear:.3f}", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLOR_GREEN if ear >= EYE_ASPECT_RATIO_THRESHOLD else COLOR_RED, 2)
                    cv2.putText(frame, f"MAR: {mar:.3f}", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLOR_GREEN if mar <= MOUTH_ASPECT_RATIO_THRESHOLD else COLOR_RED, 2)
                except Exception:
                    pass

            if is_drowsy or is_yawning or phone_detected:
                if not ALARM_ON:
                    ALARM_ON = True
                    if audio_enabled: pygame.mixer.music.play(-1)
                    send_sms_alert(frame)
                
                cv2.rectangle(frame, (0, 0), (W, H), COLOR_RED, 5)
                msg = "PHONE USE!" if phone_detected else ("WAKE UP!" if is_drowsy else "YAWNING!")
                cv2.putText(frame, f"!!! {msg} !!!", (W//2-150, H//2), cv2.FONT_HERSHEY_SIMPLEX, 1.2, COLOR_RED, 4)
            else:
                if ALARM_ON:
                    ALARM_ON = False
                    if audio_enabled: pygame.mixer.music.stop()

            fps_counter += 1
            if (time.time() - fps_start_time) > 1:
                current_fps = fps_counter / (time.time() - fps_start_time)
                fps_counter = 0
                fps_start_time = time.time()
            
            if len(rects) == 0:
                cv2.putText(frame, "No Face Detected", (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLOR_YELLOW, 2)
            cv2.putText(frame, f"FPS: {current_fps:.1f}", (W-100, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLOR_WHITE, 2)
            
            cv2.imshow("WakeGuard", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"): break
            
    except Exception as e:
        print(f"[ERROR] {e}")
    finally:
        cv2.destroyAllWindows()
        cap.release()
        if audio_enabled: pygame.mixer.quit()

if __name__ == "__main__":
    main()
