"use client";
import React from "react";
import { Button } from "primereact/button";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("HomePage");

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
