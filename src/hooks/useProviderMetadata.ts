"use client";
import { useEffect, useMemo, useState } from "react";
import {
  buildProviderMetadataUrl,
  type IdentityProviderId,
  type OidcDiscoveryMetadata,
} from "@/lib/identityProvider";

const metadataCache = new Map<string, OidcDiscoveryMetadata>();

type MetadataState = {
  metadataUrl: string;
  metadata: OidcDiscoveryMetadata | null;
  error: string;
};

export function useProviderMetadata(
  providerId: IdentityProviderId,
  issuerUrl: string,
) {
  const metadataUrl = useMemo(
    () => buildProviderMetadataUrl(providerId, issuerUrl),
    [providerId, issuerUrl],
  );

  const [state, setState] = useState<MetadataState>({
    metadataUrl: "",
    metadata: null,
    error: "",
  });

  const cachedMetadata = metadataUrl
    ? metadataCache.get(metadataUrl)
    : undefined;
  const isCurrentState = state.metadataUrl === metadataUrl;
  const metadata = cachedMetadata || (isCurrentState ? state.metadata : null);
  const error = isCurrentState ? state.error : "";
  const loading = !!metadataUrl && !cachedMetadata && !metadata && !error;

  useEffect(() => {
    if (!metadataUrl || metadataCache.has(metadataUrl)) {
      return;
    }

    const controller = new AbortController();

    fetch(metadataUrl, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const json = (await response.json()) as OidcDiscoveryMetadata;
        if (!json.authorization_endpoint || !json.token_endpoint) {
          throw new Error("metadata_missing_endpoints");
        }

        metadataCache.set(metadataUrl, json);
        setState({ metadataUrl, metadata: json, error: "" });
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          metadataUrl,
          metadata: null,
          error: caught instanceof Error ? caught.message : String(caught),
        });
      });

    return () => controller.abort();
  }, [metadataUrl]);

  return { metadata, metadataUrl, loading, error };
}
