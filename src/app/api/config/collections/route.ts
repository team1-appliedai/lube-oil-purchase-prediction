import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/db/data-access';

export async function GET() {
  try {
    const { ok, collections } = await testConnection();
    if (!ok) {
      return NextResponse.json({ error: 'Failed to connect' }, { status: 500 });
    }
    return NextResponse.json({ collections });
  } catch (error) {
    console.error('Failed to list collections:', error);
    return NextResponse.json({ error: 'Failed to list collections' }, { status: 500 });
  }
}
