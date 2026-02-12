import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/db/data-access';

export async function GET() {
  try {
    const result = await testConnection();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Connection test failed:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
