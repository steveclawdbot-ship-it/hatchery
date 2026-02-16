import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const HEARTBEAT_PATH = '/api/heartbeat';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cron endpoint uses bearer auth in-route; do not double-gate with basic auth middleware.
  if (pathname === HEARTBEAT_PATH) {
    return NextResponse.next();
  }

  const expectedUser = process.env.HATCHERY_BASIC_AUTH_USER;
  const expectedPass = process.env.HATCHERY_BASIC_AUTH_PASS;

  if (!expectedUser || !expectedPass) {
    return NextResponse.json(
      { error: 'Basic auth is not configured (HATCHERY_BASIC_AUTH_USER/PASS).' },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get('authorization');
  const valid = isValidBasicAuth(authHeader, expectedUser, expectedPass);

  if (!valid) {
    const response = new NextResponse('Authentication required', { status: 401 });
    response.headers.set('WWW-Authenticate', 'Basic realm="Hatchery Internal Alpha"');
    return response;
  }

  return NextResponse.next();
}

function isValidBasicAuth(
  authHeader: string | null,
  expectedUser: string,
  expectedPass: string,
): boolean {
  if (!authHeader?.startsWith('Basic ')) return false;

  const encoded = authHeader.slice('Basic '.length).trim();
  if (!encoded) return false;

  try {
    const decoded = decodeBase64(encoded);
    const sep = decoded.indexOf(':');
    if (sep < 0) return false;
    const user = decoded.slice(0, sep);
    const pass = decoded.slice(sep + 1);
    return user === expectedUser && pass === expectedPass;
  } catch {
    return false;
  }
}

function decodeBase64(value: string): string {
  return atob(value);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
