"use client";
import {useTranslations} from 'next-intl';

export default function StepOverview({ fallbackFlowDiagram = '' }: { fallbackFlowDiagram?: string }) {
  const t = useTranslations('AuthorizationCode.PublicClient');
  return (
    <section>
      <p className="mb-3">{t('sections.settings.flowIntro')}</p>
      {(() => {
        const keyPath = 'sections.settings.flowDiagram';
        let value: string | undefined;
        try {
          const anyT = t as any;
          value = typeof anyT.raw === 'function' ? anyT.raw(keyPath) : t(keyPath as any);
        } catch {
          value = undefined;
        }
        const expectedPath = `AuthorizationCode.PublicClient.${keyPath}`;
        const text = value && value !== expectedPath ? value : fallbackFlowDiagram;
        return <pre style={{whiteSpace: 'pre-wrap'}}>{text}</pre>;
      })()}
    </section>
  );
}
