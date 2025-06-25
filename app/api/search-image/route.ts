import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    
    if (!query || query.trim() === '') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      {
        headers: {
          'Authorization': process.env.PEXELS_API_KEY || '',
        },
      }
    );

    const data = await response.json();
    
    if (data.photos && data.photos.length > 0) {
      return NextResponse.json({ 
        imageUrl: data.photos[0].src.medium 
      });
    } else {
      return NextResponse.json({ imageUrl: null });
    }
  } catch (error) {
    console.error('Pexels API error:', error);
    return NextResponse.json({ imageUrl: null });
  }
}