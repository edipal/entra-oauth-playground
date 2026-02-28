"use client";

import { useContext } from "react";
import { LayoutContext } from "@/context/layoutcontext";

export default function ThemeLink() {
  const { layoutConfig } = useContext(LayoutContext);
  const href = `/theme/theme-${layoutConfig.colorScheme}/${layoutConfig.theme}/theme.css`;

  return (
    <link id="theme-link" rel="stylesheet" href={href} />
  );
}
