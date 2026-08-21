import { auth } from '@/lib/auth';
import logger from '@/lib/logger';

export async function GET(request: Request) {
  try {
    return await auth.handler(request);
  } catch (error) {
    logger.error('[Auth Route] GET Error:', error);
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
    logger.error('[Auth Route] POST Error:', error);
    return new Response(JSON.stringify({ error: 'Auth handler error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
