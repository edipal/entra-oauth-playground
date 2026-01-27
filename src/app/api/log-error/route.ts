import {NextResponse} from 'next/server';

// Ensure this runs on the Node.js runtime so console output reaches Vercel logs
export const runtime = 'nodejs';

type ClientErrorPayload = {
  message?: string;
  stack?: string;
  digest?: string;
  url?: string;
  locale?: string;
  userAgent?: string;
  additional?: Record<string, unknown>;
};

export async function POST(request: Request) {
  let payload: ClientErrorPayload | undefined;
  try {
    payload = (await request.json()) as ClientErrorPayload;
  } catch (e) {
    // Bad JSON; continue with undefined payload
  }

  const ua = request.headers.get('user-agent') || undefined;
  const referer = request.headers.get('referer') || undefined;

  // Structure the log entry for easier filtering in Vercel logs
  const logEntry = {
    type: 'client-error',
    timestamp: new Date().toISOString(),
    userAgent: payload?.userAgent || ua,
    referer,
    url: payload?.url,
    locale: payload?.locale,
    message: payload?.message,
    digest: payload?.digest,
    stack: payload?.stack,
    additional: payload?.additional
  };

  // Send to server logs; Vercel will capture console.error
  // Intentionally avoid throwing from this endpoint; it should be fire-and-forget
  // eslint-disable-next-line no-console
  console.error('[AppError]', JSON.stringify(logEntry));

  return NextResponse.json({ok: true});
}

export function GET() {
  // Explicitly disallow GET to avoid crawlers/prefetch noise
  return NextResponse.json({error: 'Method Not Allowed'}, {status: 405});
}
