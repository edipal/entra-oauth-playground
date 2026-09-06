"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JWK } from "jose";
import {
  calculateDPoPThumbprint,
  exportDPoPPublicJWK,
  generateDPoPKeyPair,
  type DPoPKeyPair,
} from "@/lib/dpop";

export type DPoPKeyMaterial = {
  keyPair: DPoPKeyPair;
  publicJwk: JWK;
  jkt: string;
};

type Options = {
  /**
   * Whether this flow should hold a key at all: DPoP is Auth0-only here, so an
   * Entra flow never generates one even when the stored config says enabled.
   */
  enabled: boolean;
  /** Whether the flow runtime already holds a key pair. */
  hasKeyPair: boolean;
  /** Stores the generated material in the flow runtime. */
  onGenerated: (material: DPoPKeyMaterial) => void;
};

/**
 * The browser-held DPoP key for one flow.
 *
 * Generation is asynchronous, so the two callers that need the key — the
 * settings effect that produces one up front and a request path that finds none
 * — can otherwise race and mint two key pairs, binding the authorization request
 * to a thumbprint the token request no longer proves. `generate` therefore hands
 * every concurrent caller the same in-flight promise, and only `regenerate`
 * (the user asking for a fresh key) deliberately starts a new one.
 *
 * A failure is kept rather than swallowed: Web Crypto failing leaves DPoP
 * enabled with nothing to sign, and every guarded request path then refuses
 * silently unless the screen can say why.
 */
export function useDpopKeyPair({ enabled, hasKeyPair, onGenerated }: Options) {
  const [error, setError] = useState("");
  const inFlightRef = useRef<Promise<DPoPKeyMaterial | null> | null>(null);

  // Read at call time so a caller passing a fresh closure each render neither
  // restarts the effect below nor writes through a stale setter. Synced in an
  // effect rather than during render, and declared before the effect that
  // generates so the callback is current by the time either can run.
  const onGeneratedRef = useRef(onGenerated);
  useEffect(() => {
    onGeneratedRef.current = onGenerated;
  }, [onGenerated]);

  const generate = useCallback(async (): Promise<DPoPKeyMaterial | null> => {
    if (inFlightRef.current) return inFlightRef.current;

    const promise = (async () => {
      try {
        const keyPair = await generateDPoPKeyPair();
        const publicJwk = await exportDPoPPublicJWK(keyPair.publicKey);
        const jkt = await calculateDPoPThumbprint(publicJwk);
        const material: DPoPKeyMaterial = { keyPair, publicJwk, jkt };
        onGeneratedRef.current(material);
        setError("");
        return material;
      } catch (err) {
        console.error("Failed to generate DPoP key pair", err);
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    })();

    inFlightRef.current = promise;
    // Cleared outside the body so a synchronous throw cannot leave a settled
    // promise cached, and only by the attempt that owns it, so a regenerate
    // started mid-flight is not un-cached by the attempt it replaced.
    void promise.finally(() => {
      if (inFlightRef.current === promise) inFlightRef.current = null;
    });

    return promise;
  }, []);

  const regenerate = useCallback(async (): Promise<DPoPKeyMaterial | null> => {
    inFlightRef.current = null;
    return generate();
  }, [generate]);

  useEffect(() => {
    if (enabled && !hasKeyPair) {
      void generate();
    }
  }, [enabled, hasKeyPair, generate]);

  return { generate, regenerate, error };
}
