# WakeGuard - Driver Drowsiness Detection System

WakeGuard is a real-time computer vision application that detects driver drowsiness and yawning to prevent accidents. It uses facial landmarks to monitor eye aspect ratio (EAR) and mouth aspect ratio (MAR).

## Features
- **Real-time Face Tracking**: Uses robust OpenCV face detection.
- **Drowsiness Detection**: trigger alarm if eyes are closed for ~2 seconds.
- **Yawn Detection**: Alert if yawning is detected.
- **Fallback Mode**: Automatically switches to simplified detection if your hardware has compatibility issues.
- **Non-Intrusive**: Works with any standard webcam.

## Prerequisites
1.  **Python 3.7+**: [Download Python](https://www.python.org/downloads/) (Ensure you check "Add Python to PATH" during installation).

## Installation
1.  **Unzip the project** to a folder.
2.  **Open a terminal** (Command Prompt/PowerShell) in that folder.
3.  **Install dependencies**:
    ```powershell
    pip install -r requirements.txt
    ```
    *Note: Installing `dlib` might require CMake. If `pip install dlib` fails, try installing the pre-built wheel or install Visual Studio C++ Build Tools.*

4.  **Download the Model**:
    The app requires `shape_predictor_68_face_landmarks.dat`.
    - Download it from: [http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2](http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2)
    - Extract the `.dat` file and place it in this project folder.

## How to Run
Double-click `run_wakeguard.bat` 
OR 
Run command:
```powershell
python drowsiness_detect.py
```

## Controls
- **q**: Quit the application.

## Troubleshooting
- **"Dlib Error"**: The app has automatically switched to Fallback Mode. It will still detect drowsiness but using a simpler method.
- **No Alarm**: Make sure your volume is up and `alarm.wav` is present in the folder.
