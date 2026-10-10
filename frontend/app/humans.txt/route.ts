export const runtime = 'nodejs';

/* TEAM */
export function GET() {
  const body = `/* TEAM */
Developer: ArchDraw Team
Contact: https://github.com/hiabhee/ArchDraw
Location: Remote
Site: https://archdraw.hiabhee.online

/* THANKS */
Thanks to our contributors, testers, and early users who helped shape ArchDraw's canvas, AI pipeline, and MCP server.
Built with Next.js, React Flow, Dagre, Groq, Prisma, Supabase, better-auth, Tailwind.

/* SITE */
Last update: 2026-09-02
Standards: llmstxt.org
Do Not Track: n/a — see /privacy
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
    },
  });
}
