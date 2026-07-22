import { auth } from '@/lib/auth';

export async function GET(request: Request, context: RouteContext<'/api/auth/[...all]'>) {
  console.log('[Auth Route] GET request:', request.url);
  console.log('[Auth Route] Context params:', await context.params);
  console.log('[Auth Route] Auth handler exists:', !!auth.handler);
  
  try {
    const response = await auth.handler(request);
    console.log('[Auth Route] Response status:', response.status);
    return response;
  } catch (error) {
    console.error('[Auth Route] Error:', error);
    return new Response(JSON.stringify({ error: 'Auth handler error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(request: Request, context: RouteContext<'/api/auth/[...all]'>) {
  console.log('[Auth Route] POST request:', request.url);
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
