import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

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
        let base64Data = String(imageBase64String);
        
        // Remove data URL prefix if present
        if (base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1] || base64Data;
        } else {
            // If no prefix, assume it's already base64
            base64Data = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
        }
        
        // Validate that base64Data is actually a string and not empty
        if (typeof base64Data !== 'string' || base64Data.trim() === '') {
            return NextResponse.json(
                { error: 'Invalid image data format' },
                { status: 400 }
            );
        }
        
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
        // Ensure the base64 string is clean (no whitespace, newlines, etc.)
        const cleanBase64 = base64Data.trim().replace(/\s/g, '').replace(/\n/g, '').replace(/\r/g, '');
        
        // Validate base64 format (basic check - should only contain base64 characters)
        if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
            return NextResponse.json(
                { error: 'Invalid base64 image data format' },
                { status: 400 }
            );
        }
        
        // Ensure cleanBase64 is not empty
        if (cleanBase64.length === 0) {
            return NextResponse.json(
                { error: 'Empty image data' },
                { status: 400 }
            );
        }
        
        const imageUrl = `data:image/jpeg;base64,${cleanBase64}`;

        let completion;
        try {
            completion = await groq.chat.completions.create({
                model: "meta-llama/llama-4-scout-17b-16e-instruct",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "This is a water meter reading. Focus ONLY on the black odometer-style digits in the central display (ignore the red rotary dials). They represent the whole cubic metres consumed. Return the reading as an integer value with no decimal places and without leading zeros (e.g. digits '00101' should be reported as 101). If the digits are unclear, return the reading as null. Reply strictly as JSON: {\"reading\": <number|null>}."
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: imageUrl,
                                    detail: 'high',
                                },
                            },
                        ],
                    },
                ],
                temperature: 0.1,
                max_tokens: 256,
                response_format: { type: "json_object" },
            });
        } catch (groqError) {
            const details =
                typeof groqError === 'object' && groqError !== null
                    ? {
                        message: groqError.message,
                        status: groqError.status,
                        data: groqError.response?.data,
                    }
                    : groqError;
            console.error('Groq API error:', details);
            return NextResponse.json(
                { 
                    error: 'Failed to process image with AI model', 
                    details: groqError?.message || groqError || 'Unknown error from Groq API' 
                },
                { status: 500 }
            );
        }

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

