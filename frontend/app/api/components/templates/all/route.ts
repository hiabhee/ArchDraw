import { NextResponse } from 'next/server';
import { getAllComponentTemplates } from '@/lib/db';

export async function GET() {
  try {
    const templates = await getAllComponentTemplates();
    return NextResponse.json(templates);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
