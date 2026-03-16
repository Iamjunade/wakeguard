/**
 * Vercel Serverless Function: SMS Proxy for TextBee
 * =================================================
 * Securely forwards SMS requests to the TextBee API using 
 * environment variables to hide sensitive keys.
 */

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { recipients, message } = request.body;

    if (!recipients || !message) {
        return response.status(400).json({ error: 'Missing recipients or message' });
    }

    const apiKey = process.env.TEXTBEE_API_KEY;
    const deviceId = process.env.TEXTBEE_DEVICE_ID;

    if (!apiKey || !deviceId) {
        console.error('[SERVER] Missing Environment Variables: TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID');
        return response.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const textbeeUrl = `https://api.textbee.dev/api/v1/gateway/devices/${deviceId}/send-sms`;
        
        const textbeeResponse = await fetch(textbeeUrl, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipients,
                message
            })
        });

        const data = await textbeeResponse.json();

        if (textbeeResponse.ok) {
            return response.status(200).json(data);
        } else {
            console.error('[SERVER] TextBee Error:', data);
            return response.status(textbeeResponse.status).json(data);
        }
    } catch (error) {
        console.error('[SERVER] Proxy Error:', error);
        return response.status(500).json({ error: 'Failed to send SMS' });
    }
}
