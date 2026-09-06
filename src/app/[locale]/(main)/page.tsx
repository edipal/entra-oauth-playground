"use client";
import React from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/navigation";
import {
  PROVIDER_APPS,
  getProviderRoutePath,
  getRouteProvider,
} from "@/lib/providerRegistry";

// Serves the shared landing page at "/" and the per-provider landing pages that
// re-export it at "/entra" and "/auth0".
export default function Page() {
  const t = useTranslations("HomePage");
  const tMenu = useTranslations("Menu");
  const pathname = usePathname();
  const providerId = getRouteProvider(pathname);

  if (!providerId) {
    return (
      <div className="grid">
        <div className="col-12">
          <div className="card">
            <h4>{t("title")}</h4>
            <p>{t("description")}</p>
          </div>
        </div>
      </div>
    );
  }

  const provider = PROVIDER_APPS[providerId];
  const groups: { id: "public" | "confidential"; labelKey: string }[] = [
    { id: "public", labelKey: "PublicClients" },
    { id: "confidential", labelKey: "ConfidentialClients" },
  ];

  return (
    <div className="grid">
      <div className="col-12">
        <div className="card">
          <h4>{t(`workspace.${providerId}.title`)}</h4>
          <p>{t(`workspace.${providerId}.description`)}</p>

          <h5 className="mt-4 mb-2">{t("flowsTitle")}</h5>
          {groups.map((group) => {
            const flows = provider.flows.filter(
              (flow) => flow.group === group.id,
            );
            if (!flows.length) return null;

            return (
              <div key={group.id} className="mb-3">
                <p className="m-0 mb-1 text-sm opacity-75">
                  {tMenu(group.labelKey)}
                </p>
                <ul className="m-0 pl-3">
                  {flows.map((flow) => (
                    <li key={flow.id}>
                      <Link
                        href={getProviderRoutePath(providerId, flow.pathSuffix)}
                      >
                        {tMenu(flow.labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <h5 className="mt-4 mb-2">{t("toolsTitle")}</h5>
          <ul className="m-0 pl-3">
            <li>
              <Link href="/tools/jwt-decoder">{tMenu("JwtDecoder")}</Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
