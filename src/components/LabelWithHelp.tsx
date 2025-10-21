"use client";
import React, { useId } from 'react';
import { Tooltip } from 'primereact/tooltip';

type Props = { id?: string; text: string; help: string };

export default function LabelWithHelp({ id, text, help }: Props) {
  const generatedId = useId();
  const iconId = id ? `${id}-help-icon` : `label-help-${generatedId}`;

  return (
    <>
      <label htmlFor={id} className="block mb-2 p-d-flex p-ai-center">
        {text}
        <i
          id={iconId}
          className="pi pi-info-circle p-ml-3"
          aria-label={help}
          role="img"
          style={{ color: '#0ea5e9', fontSize: '1rem', marginLeft: '0.6rem' }}
        />
      </label>
      <Tooltip target={`#${iconId}`} content={help} />
    </>
  );
}
