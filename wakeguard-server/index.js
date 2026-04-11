const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

console.log("Initializing WhatsApp Client...");

// Initialize WhatsApp Client with Local Session Storage
const client = new Client({
    authStrategy: new LocalAuth()
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

        const { number, message } = req.body;
        
        if (!number || !message) {
            return res.status(400).json({ error: 'Number and message are required in the request body.' });
        }

        // Clean up number and append @c.us suffix
        const sanitizedNumber = number.replace(/[^0-9]/g, '');
        const chatId = `${sanitizedNumber}@c.us`;

        console.log(`[WhatsApp] Sending alert to ${sanitizedNumber}...`);
        await client.sendMessage(chatId, message);
        console.log(`[WhatsApp] Alert sent successfully!`);

        return res.status(200).json({ success: true, message: 'WhatsApp alert sent successfully!' });

    } catch (error) {
        console.error('[WhatsApp] Error sending message:', error);
        return res.status(500).json({ error: 'Failed to send WhatsApp message.', details: error.toString() });
    }
});

// Start Express Server
app.listen(PORT, () => {
    console.log(`Command Center API listening at http://localhost:${PORT}`);
});
