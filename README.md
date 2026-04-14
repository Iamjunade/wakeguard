# 👁️ WakeGuard - Advanced AI Driver Safety System

<div align="center">

**A Multi-Modal Safety Co-Pilot for Drowsiness & Distraction Detection**

[![Made with Python](https://img.shields.io/badge/Python-3.7+-blue?logo=python&logoColor=white)](https://python.org)
[![Web App](https://img.shields.io/badge/Web-MediaPipe-green?logo=google&logoColor=white)](https://mediapipe.dev)
[![AI Engine](https://img.shields.io/badge/AI-Groq%20%7C%20YOLOv8-red)](https://groq.com)
[![Deployment](https://img.shields.io/badge/Deployment-Vercel%20%7C%20Local-black)](https://vercel.com)

**Team META MINDS** | Team Lead: Mohd Junaid Pasha
Under guidance of **Dr. K Sampath**

[Features](#-key-capabilities) • [Architecture](#-the-bridge-architecture) • [Getting Started](#-getting-started) • [Tech Stack](#-the-engine-room)

</div>

---

## 🚀 Mission & Impact
WakeGuard is designed to eliminate road accidents caused by **Microsleep** and **Distraction**. Unlike traditional passive buzzers, WakeGuard is a proactive **Safety Co-Pilot** that engages the driver personally and notifies their emergency circle in real-time.

---

## 🌟 Key Capabilities

### 👁️ Precision Drowsiness Detection
Utilizes **MediaPipe Face Mesh** to monitor 468 facial landmarks. The system calculates **Eye Aspect Ratio (EAR)** and **Mouth Aspect Ratio (MAR)** with sub-second precision to detect sleep onset or excessive yawning.

### 📱 AI Distraction Detection (YOLOv8)
Standard systems only check eyes; WakeGuard identifies **WHY** you are distracted. Using **YOLOv8 (Desktop)** and **COCO-SSD (Web)**, it specifically detects "Cell Phone Use" and triggers immediate intervention.

### 🎙️ AI Voice Co-Pilot
Powered by **Groq Cloud (Llama 3)**, the assistant speaks directly to the driver (**John**) with personalized alerts. It doesn't just beep; it breaks the mental fog with conversational engagement.

### 📲 Multi-Channel Remote Alerts
When a high-risk event occurs, WakeGuard automatically dispatches:
- **WhatsApp Messages**: Full media alerts with "Evidence Photos" captured during the event.
- **SMS Notifications**: Real-time alerts with time, date, and GPS location via **TextBee**.

### 🌙 Software Night Vision
Integrated **CLAHE (Contrast Limited Adaptive Histogram Equalization)** algorithms electronically enhance low-light cabin video, allowing landmarks to be tracked even in dim driving conditions.

---

## 🏗️ The Bridge Architecture: Vercel-to-Local
WakeGuard features a unique **Cloud-Local Hybrid Deployment**:
1. **Cloud Interface**: The dashboard is hosted on **Vercel** for global monitoring.
2. **Local Hardware Proxy**: A Node.js backend runs on the driver's machine to interface with local hardware (Webcam/WhatsApp).
3. **The Tunnel**: Using **Localtunnel**, the cloud dashboard bypasses CORS and security barriers to trigger physical hardware actions on the driver's computer.

---

## 🛠️ The Engine Room

| Layer | Technology |
|:--- | :--- |
| **Frontend** | HTML5, Vanilla CSS3 (Glassmorphism), JavaScript (ES6+) |
| **Vision** | MediaPipe, TensorFlow.js, OpenCV (Python), Dlib |
| **Object Detection** | **YOLOv8n** (Ultralytics), COCO-SSD |
| **AI (LLM)** | Groq API (Cloud), Ollama (Local Fallback) |
| **Messaging** | WhatsApp-web.js, TextBee API |
| **Deployment** | Vercel, Localtunnel, Python HTTP Server |

---

## 🚦 Getting Started

### 1. The All-In-One Launcher (Recommended)
We have provided a "Full Power" batch script to launch the entire ecosystem for presentations:
- Double-click **`WAKEGUARD_ALL_IN_ONE.bat`**
- This will automatically start the WhatsApp Server, Web Dashboard, and Localtunnel Bridge.

### 2. Desktop Detector (Python)
Perfect for high-performance local monitoring:
```bash
python drowsiness_detect.py
```
- **Key 'Q'**: Quit
- **Key 'N'**: Toggle **Night Vision Mode**

### 3. Web Dashboard (Live)
Visit: [wakeguard.vercel.app](https://wakeguard.vercel.app)

---

## 🔒 Private Configuration
Type the secret code **`pasha123`** anywhere on the dashboard to access the **Vault**:
- Configure **Emergency Contact Numbers**.
- Set your **WhatsApp Proxy URL** (the Localtunnel link).

---

## 🛣️ Future Roadmap: Interactive Dialogue
The next phase of WakeGuard will implement **Two-Way AI Dialogue**, allowing the driver to talk back to the assistant. This will involve:
- **Speech-to-Text (STT)**: Using whisper-1.
- **Cognitive Assessment**: AI asking the driver "Are you okay?" and waiting for a verbal confirmation.

---

## 👥 Team META MINDS

| Role | Name |
|:--- | :--- |
| **Team Lead** | Mohd Junaid Pasha |
| **Core Developer** | Mohd Saif Patel |
| **Research Lead** | Farjana Shaikh |
| **Guidance** | **Dr. K Sampath** |

---

<div align="center">

**Made with ❤️ by Team META MINDS**
*Keeping drivers safe, one blink at a time.*

</div>
