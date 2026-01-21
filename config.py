"""
WakeGuard Configuration File
============================
Centralized settings for the drowsiness detection system.
Modify these values to customize the behavior.
"""

# ═══════════════════════════════════════════════════════════════════════════════
#                          DETECTION THRESHOLDS
# ═══════════════════════════════════════════════════════════════════════════════

# Eye Aspect Ratio (EAR) Settings
# Lower values = more sensitive (may cause false positives)
# Higher values = less sensitive (may miss some detections)
EAR_THRESHOLD = 0.25

# Number of consecutive frames with closed eyes before triggering alarm
# At 20 FPS: 48 frames ≈ 2.4 seconds
EAR_CONSEC_FRAMES = 48

# Mouth Aspect Ratio (MAR) Settings for Yawn Detection
MAR_THRESHOLD = 0.6
YAWN_CONSEC_FRAMES = 20


# ═══════════════════════════════════════════════════════════════════════════════
#                            DISPLAY SETTINGS
# ═══════════════════════════════════════════════════════════════════════════════

# Video window width (height is calculated automatically)
WINDOW_WIDTH = 700

# Show FPS counter
SHOW_FPS = True

# Show all 68 facial landmarks (useful for debugging)
SHOW_ALL_LANDMARKS = False

# Show eye contours
SHOW_EYE_CONTOURS = True

# Show mouth contours
SHOW_MOUTH_CONTOURS = True


# ═══════════════════════════════════════════════════════════════════════════════
#                              FILE PATHS
# ═══════════════════════════════════════════════════════════════════════════════

# Facial landmark predictor model
LANDMARK_MODEL = "shape_predictor_68_face_landmarks.dat"

# Alarm sound file
ALARM_SOUND = "alarm.wav"


# ═══════════════════════════════════════════════════════════════════════════════
#                              ALERT SETTINGS
# ═══════════════════════════════════════════════════════════════════════════════

# Enable audio alerts
AUDIO_ENABLED = True

# Enable visual alerts (screen flash, text overlay)
VISUAL_ALERTS_ENABLED = True


# ═══════════════════════════════════════════════════════════════════════════════
#                               COLORS (BGR)
# ═══════════════════════════════════════════════════════════════════════════════

COLORS = {
    "green": (0, 255, 0),
    "red": (0, 0, 255),
    "yellow": (0, 255, 255),
    "white": (255, 255, 255),
    "blue": (255, 0, 0),
    "orange": (0, 165, 255),
}


# ═══════════════════════════════════════════════════════════════════════════════
#                           SENSITIVITY PROFILES
# ═══════════════════════════════════════════════════════════════════════════════

PROFILES = {
    "default": {
        "ear_threshold": 0.25,
        "ear_frames": 48,
    },
    "sensitive": {
        "ear_threshold": 0.28,
        "ear_frames": 30,
    },
    "relaxed": {
        "ear_threshold": 0.22,
        "ear_frames": 60,
    },
}
