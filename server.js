require('dotenv').config();
const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const Groq = require('groq');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Groq client
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'"],
            "style-src": ["'self'", "'unsafe-inline'"],
            "img-src": ["'self'", 'data:', 'blob:'],
            "media-src": ["'self'", 'blob:', 'data:'],
        },
    },
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    extensions: ['html']
}));

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Vision API endpoint to extract meter reading from image
app.post('/api/extract-reading', async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        
        if (!imageBase64) {
            return res.status(400).json({ error: 'Image data is required' });
        }

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

        res.json(result);
    } catch (error) {
        console.error('Error processing image:', error);
        res.status(500).json({ error: 'Failed to process image', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`GWCL Bill Calculator running on http://localhost:${PORT}`);
});


