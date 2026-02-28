import type { Breadcrumb, BreadcrumbItem, MenuModel, MenuProps } from "@/types";
import { Tooltip } from "primereact/tooltip";
import { useContext, useEffect, useMemo, useRef } from "react";
import AppMenuitem from "./AppMenuitem";
import { LayoutContext } from "@/context/layoutcontext";
import { MenuProvider } from "@/context/menucontext";

const AppSubMenu = (props: MenuProps) => {
  const { layoutState, setBreadcrumbs } = useContext(LayoutContext);
  const tooltipRef = useRef<Tooltip | null>(null);
  const lastBreadcrumbsSignatureRef = useRef("");

  useEffect(() => {
    if (tooltipRef.current) {
      tooltipRef.current.hide();
      (tooltipRef.current as any).updateTargetEvents();
    }
  }, [layoutState.overlaySubmenuActive]);

  const generatedBreadcrumbs = useMemo(() => {
    let breadcrumbs: Breadcrumb[] = [];

    const getBreadcrumb = (item: BreadcrumbItem, labels: string[] = []) => {
      const { label, to, items } = item;

      label && labels.push(label);
      items?.forEach((_item) => {
        getBreadcrumb(_item, labels.slice());
      });
      to && breadcrumbs.push({ labels, to });
    };

    props.model.forEach((item: MenuModel) => {
      getBreadcrumb(item);
    });
    return breadcrumbs;
  }, [props.model]);

  const generatedBreadcrumbsSignature = useMemo(
    () => JSON.stringify(generatedBreadcrumbs),
    [generatedBreadcrumbs],
  );

  useEffect(() => {
    if (lastBreadcrumbsSignatureRef.current === generatedBreadcrumbsSignature) {
      return;
    }

    lastBreadcrumbsSignatureRef.current = generatedBreadcrumbsSignature;
    setBreadcrumbs(generatedBreadcrumbs);
  }, [generatedBreadcrumbs, generatedBreadcrumbsSignature, setBreadcrumbs]);

  return (
    <MenuProvider>
      <ul className="layout-menu">
        {props.model.map((item, i) => {
          return item.seperator ? (
            <li className="menu-separator"></li>
          ) : (
            <AppMenuitem item={item} root={true} index={i} key={item.label} />
          );
        })}
      </ul>
      <Tooltip
        ref={tooltipRef}
        target="li:not(.active-menuitem)>.tooltip-target"
      />
    </MenuProvider>
  );
};

export default AppSubMenu;
