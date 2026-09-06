import type { AppTopbarRef } from "@/types";
import { forwardRef, useContext, useImperativeHandle, useRef } from "react";
import AppBreadcrumb from "./AppBreadCrumb";
import { LayoutContext } from "@/context/layoutcontext";
import ProviderSelector from "./ProviderSelector";

const AppTopbar = forwardRef<AppTopbarRef>((props, ref) => {
  const { onMenuToggle } = useContext(LayoutContext);
  const menubuttonRef = useRef(null);

  useImperativeHandle(ref, () => ({
    menubutton: menubuttonRef.current,
  }));

  return (
    <div className="layout-topbar">
      <div className="topbar-start">
        <button
          ref={menubuttonRef}
          type="button"
          className="topbar-menubutton p-link p-trigger"
          onClick={onMenuToggle}
        >
          <i className="pi pi-bars"></i>
        </button>

        <AppBreadcrumb className="topbar-breadcrumb"></AppBreadcrumb>
      </div>

      {/* The workspace switcher lives in the sidebar; this copy only appears in the
          sidebar layouts that are too narrow to hold it. */}
      <div className="topbar-end">
        <ProviderSelector variant="topbar" inputId="providerSelectorTopbar" />
      </div>
    </div>
  );
});

AppTopbar.displayName = "AppTopbar";

export default AppTopbar;
