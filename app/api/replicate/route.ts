import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    console.log('Received request:', req);

    const body = await req.json();
    console.log('Request body:', body);

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait',
      },
      body: JSON.stringify(body),
    });

    console.log('Replicate API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Replicate API error:', errorText);
      throw new Error(`Replicate API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Replicate API response data:', data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error processing image:', error);
    return NextResponse.json(
      { error: 'Failed to process image' },
      { status: 500 }
    );
  }
}