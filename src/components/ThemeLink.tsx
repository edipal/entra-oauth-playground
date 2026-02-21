"use client";

import { useContext, useEffect, useState } from "react";
import { LayoutContext } from "@/context/layoutcontext";

export default function ThemeLink() {
  const { layoutConfig } = useContext(LayoutContext);
  const [currentHref, setCurrentHref] = useState<string>(
    `/theme/theme-${layoutConfig.colorScheme}/${layoutConfig.theme}/theme.css`,
  );
  const [nextHref, setNextHref] = useState<string | null>(null);

  useEffect(() => {
    const newHref = `/theme/theme-${layoutConfig.colorScheme}/${layoutConfig.theme}/theme.css`;
    if (newHref !== currentHref) {
      setNextHref(newHref);
    }
  }, [layoutConfig.colorScheme, layoutConfig.theme, currentHref]);

  return (
    <>
      <link id="theme-link" rel="stylesheet" href={currentHref} />
      {nextHref && (
        <link
          rel="stylesheet"
          href={nextHref}
          onLoad={() => {
            setCurrentHref(nextHref);
            setNextHref(null);
          }}
        />
      )}
    </>
  );
}
