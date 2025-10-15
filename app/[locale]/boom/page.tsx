// Server-side error trigger to test error boundary and logging
export const dynamic = 'force-dynamic';

export default function BoomPage() {
  throw new Error('Intentional server error from /[locale]/boom');
}
