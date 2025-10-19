"use client";
import {useEffect} from 'react';

export default function CallbackAuthCodePage() {
  useEffect(() => {
    try {
      if (window.opener) {
        window.opener.postMessage({
          type: 'oauth_callback',
          href: window.location.href
        }, window.location.origin);
      }
    } catch (e) {
      // ignore
    } finally {
      window.close();
    }
  }, []);
  return null;
}
