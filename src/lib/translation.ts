export class TranslationUtils {
  /**
   * Return a literal i18n string even if it contains {tenant} by attempting
   * to call t with a dummy tenant interpolation to avoid runtime errors.
   */
  static safeT(t: any, key: string): string {
    try {
      const anyT = t as any;
      if (typeof anyT?.has === 'function' && !anyT.has(key)) {
        return '';
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

  /**
   * Return a safe translation string with a fallback when the key is missing.
   */
  static safeTWithFallback(t: any, key: string, fallback = ''): string {
    const value = TranslationUtils.safeT(t, key);
    return value && typeof value === 'string' ? value : fallback;
  }

  /**
   * Return a translation if present; otherwise return the fallback.
   * This avoids missing-message errors and key echoing.
   */
  static maybeT(t: any, key: string, fallback = ''): string {
    try {
      const anyT = t as any;
      if (typeof anyT?.has === 'function' && !anyT.has(key)) {
        return fallback;
      }
    } catch {
      // ignore
    }
    try {
      const v = t(key as any);
      if (!v || typeof v !== 'string' || v.indexOf(key) !== -1) return fallback;
      return v;
    } catch {
      return fallback;
    }
  }
}
