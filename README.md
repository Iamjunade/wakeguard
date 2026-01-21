# 👁️ WakeGuard - Driver Drowsiness Detection System

<div align="center">

**Real-time AI-powered drowsiness detection to keep drivers safe**

[![Made with Python](https://img.shields.io/badge/Python-3.7+-blue?logo=python&logoColor=white)](https://python.org)
[![Web App](https://img.shields.io/badge/Web-MediaPipe-green?logo=google&logoColor=white)](https://mediapipe.dev)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

**Team META MINDS** | Team Lead: Mohd Junaid Pasha

Under guidance of **Dr. K Sampath**

[Desktop App](#-desktop-version) • [Web App](#-web-version) • [Features](#-features) • [Demo](#-how-it-works)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 👁️ **Eye Tracking** | Real-time Eye Aspect Ratio (EAR) monitoring using facial landmarks |
| ⏱️ **2-Second Alert** | Alarm triggers if eyes closed for 2+ seconds |
| 🔔 **Audio Alarm** | Loud beeping alert to wake drowsy drivers |
| 📱 **SMS Notification** | Automatic emergency SMS via HTTPSMS API |
| 🌐 **Web Version** | Browser-based - works on any device with a webcam |
| 🖥️ **Desktop Version** | Python app with OpenCV + dlib |

---

## 🌐 Web Version

**Live Demo:** [wakeguard.vercel.app](https://wakeguard.vercel.app)

### How to Run Locally
```bash
cd wakeguard-web
python -m http.server 8000
```
Open: http://localhost:8000

### Tech Stack
- **MediaPipe Face Mesh** - 468 facial landmarks
- **Web Audio API** - Programmatic alarm sound
- **HTTPSMS API** - SMS alerts
- **Vanilla JS + CSS** - No frameworks needed

---

## 🖥️ Desktop Version

### Prerequisites
- Python 3.7+
- Webcam

### Installation
```bash
# Install dependencies
pip install -r requirements.txt

# Download the facial landmark model
# From: http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2
# Extract and place in project folder
```

### How to Run
```bash
# Option 1: Double-click
run_wakeguard.bat

# Option 2: Command line
python drowsiness_detect.py
```

### Controls
| Key | Action |
|-----|--------|
| `q` | Quit application |

---

## 🎯 How It Works

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Webcam    │───▶│  Face Mesh   │───▶│ EAR Calc    │
│   Frame     │    │  Detection   │    │ (Eye Ratio) │
└─────────────┘    └──────────────┘    └─────────────┘
                                              │
                                              ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  SMS Alert  │◀───│   Trigger    │◀───│ Eyes Closed │
│  (HTTPSMS)  │    │    Alarm     │    │ > 2 seconds │
└─────────────┘    └──────────────┘    └─────────────┘
```

**Eye Aspect Ratio (EAR) Formula:**
```
EAR = (||p2-p6|| + ||p3-p5||) / (2 × ||p1-p4||)
```
When EAR drops below threshold (0.22) → Eyes are closed

---

## 👥 Team META MINDS

| Role | Name |
|------|------|
| **Team Lead** | Mohd Junaid Pasha |
| **Member** | Mohd Saif Patel |
| **Member** | Farjana Shaikh |
| **Mentor** | Dr. K Sampath |

---

## 📁 Project Structure

```
WakeGuard/
├── drowsiness_detect.py     # Desktop Python app
├── requirements.txt         # Python dependencies
├── alarm.wav               # Alert sound file
├── run_wakeguard.bat       # Windows launcher
├── shape_predictor_68_face_landmarks.dat  # dlib model
└── wakeguard-web/          # Web version
    ├── index.html          # Main page
    ├── style.css           # Styling
    ├── app.js              # Detection logic
    └── package.json        # NPM config
```

---

## 🚀 Quick Start

### Web (Recommended for Demo)
1. Visit [wakeguard.vercel.app](https://wakeguard.vercel.app)
2. Click **Start Detection**
3. Allow camera access
4. Close eyes for 2 seconds to test alarm

### Desktop
1. Run `run_wakeguard.bat`
2. Face the camera
3. Close eyes to test detection

---

## 🔒 Secret Settings

Type `pasha123` anywhere on the web page to access hidden settings for configuring SMS recipient number.

---

## 📄 License

MIT License - Team META MINDS © 2026

---

<div align="center">

**Made with ❤️ by Team META MINDS**

*Keeping drivers safe, one blink at a time*

</div>
