"use client";
import type {
  Breadcrumb,
  ChildContainerProps,
  LayoutConfig,
  LayoutContextProps,
  LayoutState,
} from "@/types";
import React, { useCallback, useMemo, useState } from "react";

export const LayoutContext = React.createContext({} as LayoutContextProps);

export const LayoutProvider = (props: ChildContainerProps) => {
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>({
    ripple: true,
    inputStyle: "outlined",
    menuMode: "static",
    menuTheme: "primaryColor",
    colorScheme: "dark", // NOTE: If you change this, you must also update the theme link in app/layout.tsx
    theme: "green", // NOTE: If you change this, you must also update the theme link in app/layout.tsx
    scale: 14,
  });

  const [layoutState, setLayoutState] = useState<LayoutState>({
    staticMenuDesktopInactive: false,
    overlayMenuActive: false,
    overlaySubmenuActive: false,
    profileSidebarVisible: false,
    configSidebarVisible: false,
    staticMenuMobileActive: false,
    menuHoverActive: false,
    resetMenu: false,
    sidebarActive: false,
    anchored: false,
  });

  const isOverlay = useCallback(() => {
    return layoutConfig.menuMode === "overlay";
  }, [layoutConfig.menuMode]);

  const isSlim = useCallback(() => {
    return layoutConfig.menuMode === "slim";
  }, [layoutConfig.menuMode]);

  const isSlimPlus = useCallback(() => {
    return layoutConfig.menuMode === "slim-plus";
  }, [layoutConfig.menuMode]);

  const isHorizontal = useCallback(() => {
    return layoutConfig.menuMode === "horizontal";
  }, [layoutConfig.menuMode]);

  const isDesktop = useCallback(() => {
    return window.innerWidth > 991;
  }, []);

  const onMenuToggle = useCallback(() => {
    if (isOverlay()) {
      setLayoutState((prevLayoutState) => ({
        ...prevLayoutState,
        overlayMenuActive: !prevLayoutState.overlayMenuActive,
      }));
    }

    if (isDesktop()) {
      setLayoutState((prevLayoutState) => ({
        ...prevLayoutState,
        staticMenuDesktopInactive: !prevLayoutState.staticMenuDesktopInactive,
      }));
    } else {
      setLayoutState((prevLayoutState) => ({
        ...prevLayoutState,
        staticMenuMobileActive: !prevLayoutState.staticMenuMobileActive,
      }));
    }
  }, [isDesktop, isOverlay]);

  const showConfigSidebar = useCallback(() => {
    setLayoutState((prevLayoutState) => ({
      ...prevLayoutState,
      configSidebarVisible: true,
    }));
  }, []);

  const showProfileSidebar = useCallback(() => {
    setLayoutState((prevLayoutState) => ({
      ...prevLayoutState,
      profileSidebarVisible: !prevLayoutState.profileSidebarVisible,
    }));
  }, []);

  const value = useMemo(
    () => ({
      layoutConfig,
      setLayoutConfig,
      layoutState,
      setLayoutState,
      onMenuToggle,
      showConfigSidebar,
      showProfileSidebar,
      isSlim,
      isSlimPlus,
      isHorizontal,
      isDesktop,
      breadcrumbs,
      setBreadcrumbs,
    }),
    [
      layoutConfig,
      layoutState,
      onMenuToggle,
      showConfigSidebar,
      showProfileSidebar,
      isSlim,
      isSlimPlus,
      isHorizontal,
      isDesktop,
      breadcrumbs,
    ],
  );

  return (
    <LayoutContext.Provider value={value}>
      <>{props.children}</>
    </LayoutContext.Provider>
  );
};
