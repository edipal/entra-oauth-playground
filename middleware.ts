import createMiddleware from 'next-intl/middleware';
import {locales, defaultLocale} from './i18n';
import {NextResponse} from 'next/server';
import type {NextRequest} from 'next/server';

const nextIntlMiddleware = createMiddleware({
  locales: Array.from(locales),
  defaultLocale
});

// small helper: pick best match from Accept-Language header
function pickLocale(acceptLanguageHeader: string | null, supported: string[], fallback: string) {
  if (!acceptLanguageHeader) return fallback;
  const parts = acceptLanguageHeader.split(',').map(p => p.split(';')[0].trim().toLowerCase());
  for (const p of parts) {
    const base = p.split('-')[0];
    if (supported.includes(p)) return p;
    if (supported.includes(base)) return base;
  }
  return fallback;
}

export default function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  // If request is the root (/) without locale, redirect based on Accept-Language
  if (pathname === '/') {
    const acceptLang = req.headers.get('accept-language');
    const best = pickLocale(acceptLang, Array.from(locales), defaultLocale);
    // Redirect to the best-matched locale (always prefix)
    url.pathname = `/${best}` + url.pathname;
    return NextResponse.redirect(url);
  }

  // Let next-intl handle locale rewrites for other routes
  return nextIntlMiddleware(req);
}

export const config = {
  // Skip all paths that should not be internationalized
  matcher: ['/((?!_next|.*\\..*|api|favicon.ico).*)']
};
