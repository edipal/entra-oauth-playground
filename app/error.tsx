"use client";
import {useEffect, useMemo} from 'react';
import {Button} from 'primereact/button';
import {Card} from 'primereact/card';
import {Tag} from 'primereact/tag';
import {Divider} from 'primereact/divider';
import {Message} from 'primereact/message';
import {usePathname} from 'next/navigation';
import en from '@/messages/en.json';
import de from '@/messages/de.json';

type ErrorPageProps = {
  error: Error & {digest?: string};
  reset: () => void;
};

function shouldLogThisOnce(key: string) {
  if (typeof window === 'undefined') return true;
  if (process.env.NODE_ENV !== 'development') return true;
  const w = window as unknown as {__loggedErrorKeys?: Set<string>};
  if (!w.__loggedErrorKeys) w.__loggedErrorKeys = new Set<string>();
  if (w.__loggedErrorKeys.has(key)) return false;
  w.__loggedErrorKeys.add(key);
  return true;
}

async function logClientError(body: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.error('[DevClientError]', body);
    return;
  }
  try {
    await fetch('/api/log-error', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
  } catch {
    // ignore
  }
}

export default function GlobalError({error, reset}: ErrorPageProps) {
  const pathname = usePathname() || '';
  const locale = useMemo(() => {
    const seg = pathname.split('/').filter(Boolean)[0];
    return seg === 'de' ? 'de' : 'en';
  }, [pathname]);

  const t = useMemo(() => {
    const dict: any = locale === 'de' ? de : en;
    const ns = dict?.Error || {};
    return {
      title: ns.title || 'Something went wrong.',
      description: ns.description || 'We hit an unexpected error. You can try to recover.',
      tryAgain: ns.tryAgain || 'Try again'
    };
  }, [locale]);

  useEffect(() => {
    const data = {
      message: error?.message,
      stack: error?.stack,
      digest: error?.digest,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    };
    const key = `${data.digest ?? ''}|${data.message ?? ''}|${(data.stack as string | undefined)?.slice(0, 120) ?? ''}|${typeof window !== 'undefined' ? window.location.pathname : ''}`;
    if (shouldLogThisOnce(key)) {
      void logClientError(data);
    }
  }, [error]);

  return (
    <Card className="p-mx-auto" style={{maxWidth: 820, margin: '4rem auto', minHeight: '60vh', background: 'var(--red-50)', boxShadow: 'none', border: 0}}>
      <Tag severity="danger" value={t.title} icon="pi pi-times-circle" style={{fontSize: '1.75rem', padding: '0.5rem 0.75rem', fontWeight: 700}} />
      <Divider />
      <Message severity="error" text={t.description} />
      <Divider />
      <Button label={t.tryAgain} icon="pi pi-refresh" onClick={() => reset()} />
    </Card>
  );
}
