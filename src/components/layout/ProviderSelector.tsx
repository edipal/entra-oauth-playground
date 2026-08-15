"use client";

import { Dropdown } from "primereact/dropdown";
import { useTranslations } from "next-intl";
import { useActiveProvider } from "@/hooks/useActiveProvider";
import type { ProviderAppId } from "@/lib/providerRegistry";

type Props = {
  variant?: "sidebar" | "topbar";
  inputId?: string;
};

type ProviderOption = { label: string; value: ProviderAppId };

// The icon carries the meaning of the control, so no visible caption is needed.
const withIcon = (label: string) => (
  <span className="provider-selector-option">
    <i className="pi pi-id-card" aria-hidden="true" />
    <span>{label}</span>
  </span>
);

export default function ProviderSelector({
  variant = "sidebar",
  inputId = "providerSelector",
}: Readonly<Props>) {
  const t = useTranslations("ProviderSelector");
  const { activeProviderId, providerOptions, setActiveProviderId } =
    useActiveProvider();

  const localizedOptions: ProviderOption[] = providerOptions.map((option) => ({
    label: t(`options.${option.labelKey}`),
    value: option.value,
  }));

  return (
    <div className={`provider-selector provider-selector-${variant}`}>
      <label className="sr-only-label" htmlFor={inputId}>
        {t("label")}
      </label>
      <Dropdown
        inputId={inputId}
        value={activeProviderId}
        options={localizedOptions}
        onChange={(event) => setActiveProviderId(event.value as ProviderAppId)}
        valueTemplate={(option: ProviderOption | undefined) =>
          withIcon(option?.label ?? "")
        }
        itemTemplate={(option: ProviderOption) => withIcon(option.label)}
        aria-label={t("label")}
        className="provider-selector-dropdown"
      />
    </div>
  );
}
