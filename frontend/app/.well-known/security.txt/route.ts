export const runtime = 'nodejs';

export function GET() {
  const body = `Contact: https://github.com/hiabhee/ArchDraw/security/advisories/new
Contact: https://github.com/hiabhee/ArchDraw/issues
Expires: 2027-09-02T00:00:00.000Z
Acknowledgments: https://github.com/hiabhee/ArchDraw#security
Preferred-Languages: en
Canonical: https://archdraw.hiabhee.online/.well-known/security.txt
Policy: https://github.com/hiabhee/ArchDraw/blob/main/SECURITY.md
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
    },
  });
}
