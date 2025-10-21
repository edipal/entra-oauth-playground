export class TranslationUtils {
  /**
   * Return a literal i18n string even if it contains {tenant} by attempting
   * to read the raw key when available, otherwise call t with a dummy tenant
   * interpolation to avoid runtime errors.
   */
  static safeT(t: any, key: string): string {
    try {
      const anyT = t as any;
      if (typeof anyT.raw === 'function') {
        const raw = anyT.raw(key);
        if (typeof raw === 'string') return raw;
      }
    } catch {
      // ignore
    }
    try {
      return t(key as any, { tenant: '{tenant}' } as any);
    } catch {
      return '';
    }
  }
}
