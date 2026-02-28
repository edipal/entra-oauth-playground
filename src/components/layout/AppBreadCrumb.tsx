import type { AppBreadcrumbProps, Breadcrumb } from "@/types";
import { usePathname } from "@/navigation";
import { ObjectUtils } from "primereact/utils";
import React, { useContext, useMemo } from "react";
import { LayoutContext } from "@/context/layoutcontext";

const AppBreadcrumb = (props: AppBreadcrumbProps) => {
  const pathname = usePathname();
  const { breadcrumbs } = useContext(LayoutContext);

  const breadcrumb = useMemo(() => {
    const filteredBreadcrumbs = breadcrumbs?.find((crumb: Breadcrumb) => {
      return crumb.to?.replace(/\/$/, "") === pathname.replace(/\/$/, "");
    });
    return filteredBreadcrumbs ?? null;
  }, [pathname, breadcrumbs]);

  return (
    <div className={props.className}>
      <nav className="layout-breadcrumb">
        <ol>
          {ObjectUtils.isNotEmpty(breadcrumb) ? (
            breadcrumb?.labels?.map((label, index) => {
              return (
                <React.Fragment key={index}>
                  {index !== 0 && (
                    <li className="layout-breadcrumb-chevron"> / </li>
                  )}
                  <li key={index}>{label}</li>
                </React.Fragment>
              );
            })
          ) : (
            <>{pathname === "/" && <li key={"home"}>Home</li>}</>
          )}
        </ol>
      </nav>
    </div>
  );
};

export default AppBreadcrumb;
