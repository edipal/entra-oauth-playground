"use client";
import { useTranslations } from "next-intl";

type Props = {
  flowIntro?: string;
  flowDiagram?: string;
};

export default function StepOverview({ flowIntro, flowDiagram }: Props) {
  const t = useTranslations("StepOverview");
  const introText = flowIntro || t("sections.settings.flowIntro");
  const diagramText = flowDiagram || t("sections.settings.flowDiagram");

  return (
    <section>
      <p className="mb-3">{introText}</p>
      <pre style={{ whiteSpace: "pre-wrap" }}>{diagramText}</pre>
    </section>
  );
}
