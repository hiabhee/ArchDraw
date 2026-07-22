import { auth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    return await auth.handler(request);
  } catch (error) {
    console.error('[Auth Route] GET Error:', error);
    return new Response(JSON.stringify({ error: 'Auth handler error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(request: Request) {
  try {
    return await auth.handler(request);
  } catch (error) {
    console.error('[Auth Route] POST Error:', error);
    return new Response(JSON.stringify({ error: 'Auth handler error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
