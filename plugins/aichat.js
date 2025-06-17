const { Module } = require('../main');
const config = require('../config');
const axios = require('axios');

// This is the definitive "Always On" listener for local installation.
// It has NO pattern because it's an event listener. This is the correct way.
// Control it using the .setvar CHATBOT=on/off command.

Module({
    on: 'text',
    fromMe: false
}, async (message) => {
    // Check 1: Is the feature enabled via the CHATBOT environment variable?
    if (config.CHATBOT?.toLowerCase() !== 'on') {
        return;
    }
    // Check 2: Is the message a command for another plugin? If so, ignore it.
    if (message.message.startsWith(config.PREFIX)) {
        return;
    }
    // Check 3: If in a group, was the bot mentioned?
    if (message.isGroup && !message.mention.includes(message.client.user.id)) {
        return;
    }

    try {
        const userText = message.message;
        const GEMINI_API_KEY = "AIzaSyDTuSw2oa37jeYa1OENpLJKQOHZD09hcg8"; // Your key

        if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("REPLACE")) {
            throw new Error("Gemini API Key is not configured in the aichat.js file.");
        }

        // --- Step 1: Get AI Response ---
        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
                contents: [{ parts: [{ text: userText }] }]
            }
        );

        if (!geminiResponse.data.candidates || !geminiResponse.data.candidates[0]) {
            throw new Error("Invalid response from Gemini API. It might be a safety filter block.");
        }
        const aiText = geminiResponse.data.candidates[0].content.parts[0].text;
        if (!aiText) throw new Error("The AI returned an empty response.");

        // --- Step 2: Convert to Speech ---
        const getUrlResponse = await axios.post(
            'https://ttsmp3.com/makemp3_ai.php',
            `msg=${encodeURIComponent(aiText)}&lang=coral`,
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        if (!getUrlResponse.data || !getUrlResponse.data.URL) {
            throw new Error("ttsmp3.com did not return a valid audio URL.");
        }
        const mp3Url = getUrlResponse.data.URL;

        // --- Step 3: Send Audio ---
        const audioStreamResponse = await axios.get(mp3Url, { responseType: 'stream' });
        
        await message.client.sendMessage(message.jid, {
            audio: { stream: audioStreamResponse.data },
            mimetype: 'audio/mp4',
            ptt: true
        });

    } catch (error) {
        console.error("[AI_CHAT_PLUGIN] Error:", error.message);
        const errorMessage = `*AI Chat Plugin Error* ⚠️\n\n*Error:* ${error.message}`;
        const ownerJid = `${config.SUDO.split(',')[0]}@s.whatsapp.net`;
        await message.client.sendMessage(ownerJid, { text: errorMessage });
    }
});
