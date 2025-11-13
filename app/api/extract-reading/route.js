import { NextResponse } from 'next/server';
import Groq from 'groq';

export async function POST(request) {
    try {
        const body = await request.json();
        const { imageBase64 } = body;
        
        if (!imageBase64) {
            return NextResponse.json(
                { error: 'Image data is required' },
                { status: 400 }
            );
        }

        // Ensure imageBase64 is a string and convert if needed
        let imageBase64String;
        if (typeof imageBase64 === 'string') {
            imageBase64String = imageBase64;
        } else if (imageBase64 && typeof imageBase64.toString === 'function') {
            imageBase64String = String(imageBase64);
        } else {
            return NextResponse.json(
                { error: 'Image data must be a string' },
                { status: 400 }
            );
        }

        // Validate API key exists and is a string
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
            return NextResponse.json(
                { error: 'Groq API key not configured' },
                { status: 500 }
            );
        }

        // Initialize Groq client
        const groq = new Groq({
            apiKey: apiKey.trim(),
        });

        // Remove data URL prefix if present and get base64 data
        // Ensure we're working with a string primitive
        const base64Data = String(imageBase64String).replace(/^data:image\/[a-z]+;base64,/, '');
        
        // Validate image size (Groq limit: 4MB for base64 encoded images)
        // Base64 is ~33% larger than binary, so we check the base64 string size
        const base64SizeMB = (base64Data.length * 3) / 4 / 1024 / 1024;
        if (base64SizeMB > 4) {
            return NextResponse.json(
                { 
                    error: 'Image too large', 
                    details: `Image size is ${base64SizeMB.toFixed(2)}MB. Maximum allowed is 4MB. Please use a smaller image.` 
                },
                { status: 413 }
            );
        }

        // Create the image URL with proper data URI format as per Groq docs
        const imageUrl = `data:image/jpeg;base64,${base64Data}`;

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
                                url: imageUrl,
                            },
                        },
                    ],
                },
            ],
            temperature: 0.1,
            max_tokens: 256,
            response_format: { type: "json_object" },
        });

        const responseContent = completion.choices[0]?.message?.content;
        let result;
        
        // Ensure responseContent is a string
        if (!responseContent || typeof responseContent !== 'string') {
            return NextResponse.json(
                { reading: null, error: "Invalid response from AI model" },
                { status: 500 }
            );
        }
        
        try {
            result = JSON.parse(responseContent);
        } catch (parseError) {
            // Try to extract number from text if JSON parsing fails
            const numberMatch = responseContent.match(/[\d.]+/);
            if (numberMatch) {
                result = { reading: parseFloat(numberMatch[0]) };
            } else {
                result = { reading: null, error: "Could not extract reading from response" };
            }
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error processing image:', error);
        return NextResponse.json(
            { error: 'Failed to process image', details: error.message },
            { status: 500 }
        );
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

