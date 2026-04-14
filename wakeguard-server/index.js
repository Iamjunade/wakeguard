const express = require('express');
const cors = require('cors');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();

// Enhanced CORS configuration for Vercel -> Local Tunneling
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Bypass-Tunnel-Reminder'],
    credentials: true
}));

// Explicitly handle Preflight requests
app.options('*', cors());

app.use(express.json({ limit: '50mb' })); // Increased limit for high-res photos
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const PORT = 3000;

console.log("Initializing WhatsApp Client...");

// Initialize WhatsApp Client with Local Session Storage
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

let isClientReady = false;

// Generate QR Code for Authentication
client.on('qr', (qr) => {
    console.log('\n=============================================');
    console.log('SCAN THIS QR CODE WITH YOUR WHATSAPP APP');
    console.log('=============================================\n');
    qrcode.generate(qr, { small: true });
});

// Client Authentication Ready
client.on('ready', () => {
    isClientReady = true;
    console.log('\n=============================================');
    console.log('✓ WHATSAPP CLIENT IS READY');
    console.log('=============================================\n');
});

client.on('auth_failure', () => {
    console.error('Authentication failure! Please restart the server and scan the QR core again.');
});

// Initialize Client
client.initialize();

// API Endpoint to Send Alerts
app.post('/api/alert/whatsapp', async (req, res) => {
    try {
        if (!isClientReady) {
            return res.status(503).json({ error: 'WhatsApp client is not ready yet. Please ensure you have scanned the QR code.' });
        }

        const { number, message, image } = req.body;
        
        if (!number || !message) {
            return res.status(400).json({ error: 'Number and message are required in the request body.' });
        }

        // Clean up number and append @c.us suffix
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const chatId = sanitizedNumber.includes('@') ? sanitizedNumber : `${sanitizedNumber}@c.us`;

        console.log(`[WhatsApp] Attempting alert to: ${chatId}`);

        // Double check if registered
        const isRegistered = await client.isRegisteredUser(chatId);
        if (!isRegistered) {
            console.warn(`[WhatsApp] Number ${sanitizedNumber} does not appear to be registered on WhatsApp!`);
            return res.status(400).json({ error: 'Number is not registered on WhatsApp. Please check the prefix (e.g., 91 for India).' });
        }

        let result;
        if (image) {
            console.log(`[WhatsApp] Image data detected. Preparing media message...`);
            
            // Auto-strip data URI prefix if present (e.g., "data:image/jpeg;base64,")
            const base64Data = image.includes('base64,') ? image.split('base64,')[1] : image;
            
            const media = new MessageMedia('image/jpeg', base64Data);
            result = await client.sendMessage(chatId, media, { caption: message });
        } else {
            console.log(`[WhatsApp] No image. Sending text-only alert...`);
            result = await client.sendMessage(chatId, message);
        }

        console.log(`[WhatsApp] Success! Message ID: ${result.id._serialized}`);
        return res.status(200).json({ success: true, message: 'WhatsApp alert sent successfully!', id: result.id._serialized });

    } catch (error) {
        console.error('[WhatsApp] CRITICAL ERROR:', error);
        return res.status(500).json({ error: 'Failed to send WhatsApp message.', details: error.toString() });
    }
});

// AI Conversational Alert Endpoint (Powered by Local Ollama)
app.post('/api/ai/chat', async (req, res) => {
    try {
        const { alertType, driverName } = req.body;
        const name = driverName || 'Driver';

        let scenario = '';
        if (alertType === 'DROWSINESS') {
            scenario = `The driver named ${name} has closed their eyes for 1.5 seconds while driving. They are showing signs of drowsiness.`;
        } else if (alertType === 'YAWNING') {
            scenario = `The driver named ${name} has been yawning repeatedly at the wheel. They are showing signs of fatigue.`;
        } else {
            scenario = `The driver named ${name} appears to be fatigued.`;
        }

        const systemPrompt = `You are WakeGuard, a compassionate AI co-pilot built into a car safety system. 
Your ONLY job is to generate a single, short, spoken alert message to wake up and engage a drowsy driver.
Rules:
- Speak directly to the driver. Address them by their name.
- Be warm, firm, and concerned — NOT robotic.
- Keep the message to 1-3 short sentences MAX.
- Suggest one concrete action (pull over, take a break, open window, drink water).
- Do NOT use asterisks, markdown, or bullet points. Plain spoken English only.`;

        const userPrompt = `Situation: ${scenario}
Generate the spoken alert message now.`;

        console.log(`[AI] Querying local Ollama model for ${alertType} alert...`);

        const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'gpt-oss:20b',
                prompt: `${systemPrompt}\n\n${userPrompt}`,
                stream: false,
                options: {
                    temperature: 0.8,
                    num_predict: 80
                }
            })
        });

        if (!ollamaResponse.ok) {
            throw new Error(`Ollama API returned status ${ollamaResponse.status}`);
        }

        const ollamaData = await ollamaResponse.json();
        const aiMessage = (ollamaData.response || '').trim();

        console.log(`[AI] Generated message: "${aiMessage}"`);
        return res.status(200).json({ success: true, message: aiMessage });

    } catch (error) {
        console.error('[AI] Error querying Ollama:', error.message);
        // Fallback message if Ollama is not running
        const fallbacks = {
            'DROWSINESS': 'Hey, wake up! Your eyes were closed. Please pull over safely and take a short break.',
            'YAWNING': 'You seem very tired. Find a safe spot to stop, rest for 20 minutes before continuing.'
        };
        const fallback = fallbacks[req.body?.alertType] || 'Please pull over and rest. Your safety is critical.';
        return res.status(200).json({ success: true, message: fallback, fallback: true });
    }
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`Command Center API listening at http://localhost:${PORT}`);
});
