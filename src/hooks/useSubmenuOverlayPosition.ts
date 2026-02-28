import type { UseSubmenuOverlayPositionProps } from "@/types";
import { DomHandler } from "primereact/utils";
import { useContext, useEffect } from "react";
import { LayoutContext } from "../context/layoutcontext";
import { MenuContext } from "../context/menucontext";

export const useSubmenuOverlayPosition = ({
  targetRef,
  overlayRef,
  when,
}: UseSubmenuOverlayPositionProps) => {
  const { isSlim, isSlimPlus, isHorizontal, setLayoutState } =
    useContext(LayoutContext);
  const { activeMenu } = useContext(MenuContext);

  useEffect(() => {
    if (!when) return;

    const target = targetRef.current;
    const container = target?.closest(".layout-menu-container") as
      | HTMLElement
      | null;
    if (!container) return;

    const onScroll = () => {
      setLayoutState((prevLayoutState) => ({
        ...prevLayoutState,
        overlayMenuActive: false,
        overlaySubmenuActive: false,
        staticMenuMobileActive: false,
        menuHoverActive: false,
        resetMenu: true,
      }));
    };

    container.addEventListener("scroll", onScroll);
    return () => {
      container.removeEventListener("scroll", onScroll);
    };
  }, [setLayoutState, targetRef, when]);

  useEffect(() => {
    if (!when) return;

    const target = targetRef.current;
    const overlay = overlayRef.current;
    const container = target?.closest(".layout-menu-container") as
      | HTMLElement
      | null;
    if (overlay && target) {
      const { left, top } = target.getBoundingClientRect();
      const { width: vWidth, height: vHeight } = DomHandler.getViewport();
      const [oWidth, oHeight] = [overlay.offsetWidth, overlay.offsetHeight];
      const scrollbarWidth = DomHandler.calculateScrollbarWidth(
        container as HTMLElement,
      );

      // reset
      const style = overlay.style;
      style.top = "";
      style.left = "";

      if (isHorizontal()) {
        const width = left + oWidth + scrollbarWidth;
        style.left =
          vWidth < width ? `${left - (width - vWidth)}px` : `${left}px`;
      } else if (isSlim() || isSlimPlus()) {
        const height = top + oHeight;
        style.top =
          vHeight < height ? `${top - (height - vHeight)}px` : `${top}px`;
      }
    }
  }, [activeMenu, isHorizontal, isSlim, isSlimPlus, overlayRef, targetRef, when]);
};
