"use client";
import React, { useId } from "react";
import { Tooltip } from "primereact/tooltip";

type Props = { id?: string; text: string; help: string };

export default function LabelWithHelp({ id, text, help }: Props) {
  const generatedId = useId();
  const iconId = id ? `${id}-help-icon` : `label-help-${generatedId}`;

  return (
    // root div: vertical center, horizontal left alignment
    <div className="p-d-flex p-ai-center p-jc-start">
      <label
        htmlFor={id}
        className="mb-2 p-d-flex p-ai-center"
        style={{ margin: 0 }}
      >
        <span
          className="label-text"
          style={{
            display: "inline-flex",
            alignItems: "center",
            lineHeight: 1,
          }}
        >
          {text}
        </span>

        <i
          id={iconId}
          className="pi pi-question-circle p-ml-3"
          aria-label={help}
          role="img"
          style={{
            color: "#0ea5e9",
            fontSize: "1rem",
            marginLeft: "0.6rem",
            display: "inline-flex",
            alignItems: "center",
            verticalAlign: "middle",
            lineHeight: 1,
          }}
        />
      </label>

      <Tooltip
        target={`#${iconId}`}
        content={help}
        style={{ fontSize: "0.85rem" }}
      />
    </div>
  );
}
