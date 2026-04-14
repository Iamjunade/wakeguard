/**
 * Vercel Serverless Function: AI Chat Proxy (Powered by Groq + Llama 3)
 * =======================================================================
 * Securely generates compassionate driver alert messages using the Groq API.
 * The GROQ_API_KEY is stored as a Vercel environment variable - never exposed.
 */

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { alertType, driverName } = request.body;
    const name = driverName || 'Driver';

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        console.error('[AI] Missing GROQ_API_KEY environment variable');
        return response.status(500).json({ error: 'Server configuration error' });
    }

    let scenario = '';
    if (alertType === 'DROWSINESS') {
        scenario = `The driver named ${name} has closed their eyes for 1.5 seconds while driving. They are showing clear signs of drowsiness and microsleep.`;
    } else if (alertType === 'YAWNING') {
        scenario = `The driver named ${name} has been yawning repeatedly at the wheel. They are showing signs of serious fatigue.`;
    } else {
        scenario = `The driver named ${name} appears to be fatigued while driving.`;
    }

    const systemPrompt = `You are WakeGuard, a compassionate AI co-pilot built into a car safety system.
Your ONLY job is to generate a single, short, spoken alert message to wake up and engage a drowsy driver.
Rules:
- Speak directly to the driver. Address them by their first name.
- Be warm, firm, and genuinely concerned — NOT robotic or generic.
- Keep the message to 1-3 short sentences MAXIMUM.
- Suggest one concrete, actionable step (pull over, take a break, open the window, drink water, rest).
- Do NOT use asterisks, markdown, or bullet points. Plain spoken English only.`;

    try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Situation: ${scenario}\nGenerate the spoken alert message now.` }
                ],
                max_tokens: 80,
                temperature: 0.8
            })
        });

        if (!groqResponse.ok) {
            const errText = await groqResponse.text();
            console.error('[AI] Groq API error:', errText);
            throw new Error(`Groq API responded with ${groqResponse.status}`);
        }

        const groqData = await groqResponse.json();
        const aiMessage = groqData.choices?.[0]?.message?.content?.trim() || '';

        console.log(`[AI] Generated message for ${name}: "${aiMessage}"`);
        return response.status(200).json({ success: true, message: aiMessage });

    } catch (error) {
        console.error('[AI] Error calling Groq API:', error.message);
        // Fallback messages if Groq has any issue
        const fallbacks = {
            'DROWSINESS': `${name}, wake up! You closed your eyes while driving. Please pull over and take a short rest right now.`,
            'YAWNING': `${name}, you are clearly exhausted. Please find a safe spot to stop and rest before continuing your journey.`
        };
        const fallback = fallbacks[alertType] || `${name}, please pull over safely and take a break. Your safety matters.`;
        return response.status(200).json({ success: true, message: fallback, fallback: true });
    }
}
