import type { MenuModel } from "@/types";
import AppSubMenu from "./AppSubMenu";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useActiveProvider } from "@/hooks/useActiveProvider";
import { PROVIDER_APPS, getProviderRoutePath } from "@/lib/providerRegistry";

const AppMenu = () => {
  const t = useTranslations("Menu");
  const { activeProviderId } = useActiveProvider();

  const model: MenuModel[] = useMemo(() => {
    const providerApp = PROVIDER_APPS[activeProviderId];
    const publicFlows = providerApp.flows.filter(
      (flow) => flow.group === "public",
    );
    const confidentialFlows = providerApp.flows.filter(
      (flow) => flow.group === "confidential",
    );

    return [
      {
        label: t("Home"),
        items: [
          {
            label: t(providerApp.labelKey),
            icon: "pi pi-fw pi-home",
            to: providerApp.landingPath,
          },
        ],
      },
      {
        label: t("PublicClients"),
        items: publicFlows.map((flow) => ({
          label: t(flow.labelKey),
          icon: flow.icon,
          to: getProviderRoutePath(activeProviderId, flow.pathSuffix),
        })),
      },
      {
        label: t("ConfidentialClients"),
        items: confidentialFlows.map((flow) => ({
          label: t(flow.labelKey),
          icon: flow.icon,
          to: getProviderRoutePath(activeProviderId, flow.pathSuffix),
        })),
      },
      {
        label: t("Tools"),
        items: [
          {
            label: t("JwtDecoder"),
            icon: "pi pi-fw pi-file-edit",
            to: "/tools/jwt-decoder",
          },
        ],
      },
    ];
  }, [activeProviderId, t]);

  return <AppSubMenu model={model} />;
};

export default AppMenu;
