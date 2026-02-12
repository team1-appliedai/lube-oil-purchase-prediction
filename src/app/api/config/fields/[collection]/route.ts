import { NextResponse } from 'next/server';
import { getCollectionFields } from '@/lib/db/data-access';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collection: string }> }
) {
  try {
    const { collection } = await params;
    const fields = await getCollectionFields(collection);
    return NextResponse.json({ fields });
  } catch (error) {
    console.error('Failed to get fields:', error);
    return NextResponse.json({ error: 'Failed to get fields' }, { status: 500 });
  }
}
