const Groq = require('groq');

// Helper function to parse JSON body from request
async function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(new Error('Invalid JSON in request body'));
            }
        });
        req.on('error', reject);
    });
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Parse the request body - Vercel may or may not parse it automatically
        let body;
        if (req.body && typeof req.body === 'object') {
            // Body already parsed (some Vercel configurations)
            body = req.body;
        } else {
            // Parse manually from stream
            body = await parseJsonBody(req);
        }
        const { imageBase64 } = body;
        
        if (!imageBase64) {
            return res.status(400).json({ error: 'Image data is required' });
        }

        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ error: 'Groq API key not configured' });
        }

        // Initialize Groq client
        const groq = new Groq({
            apiKey: process.env.GROQ_API_KEY,
        });

        // Remove data URL prefix if present
        const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

        const completion = await groq.chat.completions.create({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "This is a water meter reading. Please extract the numeric reading value from this image. The reading is typically displayed as a number with decimal places (e.g., 84.000 or 76.000). Return ONLY the numeric value as a JSON object with a 'reading' field containing the number. If you cannot clearly see the reading, return null for the reading field. Example: {\"reading\": 84.000}"
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Data}`,
                            },
                        },
                    ],
                },
            ],
            temperature: 0.1,
            max_tokens: 256,
            response_format: { type: "json_object" },
        });

        const responseContent = completion.choices[0].message.content;
        let result;
        
        try {
            result = JSON.parse(responseContent);
        } catch (e) {
            // Try to extract number from text if JSON parsing fails
            const numberMatch = responseContent.match(/[\d.]+/);
            if (numberMatch) {
                result = { reading: parseFloat(numberMatch[0]) };
            } else {
                result = { reading: null, error: "Could not extract reading from response" };
            }
        }

        res.status(200).json(result);
    } catch (error) {
        console.error('Error processing image:', error);
        res.status(500).json({ error: 'Failed to process image', details: error.message });
    }
};

