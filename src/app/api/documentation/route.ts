import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    const docsDir = path.join(process.cwd(), 'docs');

    const [businessDoc, technicalDoc] = await Promise.all([
      readFile(path.join(docsDir, 'optimizer-logic-business.md'), 'utf-8'),
      readFile(path.join(docsDir, 'optimizer-logic-technical.md'), 'utf-8'),
    ]);

    return NextResponse.json({
      business: businessDoc,
      technical: technicalDoc,
    });
  } catch (error) {
    console.error('Failed to read documentation files:', error);
    return NextResponse.json(
      { error: 'Failed to load documentation' },
      { status: 500 }
    );
  }
}
