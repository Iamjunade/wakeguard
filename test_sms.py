import requests

TEXTBEE_API_KEY = "257cd9a4-2ea6-4171-b1f9-95837eecc032"
TEXTBEE_DEVICE_ID = "699bf9c78afaf7aa2c339a1f"
SMS_RECIPIENT_NUMBER = "+917780643862"

url = f"https://api.textbee.dev/api/v1/gateway/devices/{TEXTBEE_DEVICE_ID}/send-sms"
headers = {
    "x-api-key": TEXTBEE_API_KEY,
    "Content-Type": "application/json"
}

payload = {
    "recipients": [SMS_RECIPIENT_NUMBER],
    "message": "Test Message from Debugger"
}

try:
    print(f"Sending to: {url}")
    response = requests.post(url, json=payload, headers=headers, timeout=10)
    print("Status:", response.status_code)
    print("Response:", response.text)
except Exception as e:
    print("Error:", e)
