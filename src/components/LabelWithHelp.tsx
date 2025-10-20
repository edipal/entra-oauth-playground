"use client";
import React from 'react';

type Props = { id?: string; text: string; help: string };

export default function LabelWithHelp({ id, text, help }: Props) {
  return (
    <label htmlFor={id} className="block mb-2">
      {text}
      <span className="pi pi-question-circle ml-2" title={help} aria-label={help} />
    </label>
  );
}
