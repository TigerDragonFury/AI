import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    platforms: [
      { name: 'TikTok', connected: false },
      { name: 'Facebook', connected: false },
      { name: 'Instagram', connected: false },
      { name: 'YouTube', connected: false },
      { name: 'X', connected: false },
      { name: 'LinkedIn', connected: false }
    ]
  });
}
