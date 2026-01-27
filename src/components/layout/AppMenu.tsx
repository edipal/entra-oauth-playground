
import type { MenuModel } from "@/types";
import AppSubMenu from "./AppSubMenu";
import { useTranslations } from "next-intl";


const AppMenu = () => {
    const t = useTranslations("Menu");
    const model: MenuModel[] = [
        {
            label: t("Home"),
            items: [
                {
                    label: t("GettingStarted"),
                    icon: "pi pi-fw pi-home",
                    to: "/",
                },
            ],
        },
        {
            label: t("PublicClients"),
            items: [
                {
                    label: t("AuthorizationCodeFlow"),
                    icon: "pi pi-fw pi-desktop",
                    to: "/authorization-code/public-client",
                },
            ],
        },
        {
            label: t("ConfidentialClients"),
            items: [
                {
                    label: t("AuthorizationCodeFlow"),
                    icon: "pi pi-fw pi-server",
                    to: "/authorization-code/confidential-client",
                },
                {
                    label: t("ClientCredentialsFlow"),
                    icon: "pi pi-fw pi-key",
                    to: "/client-credentials",
                },
            ],
        },
    ];

    return <AppSubMenu model={model} />;
};

export default AppMenu;
