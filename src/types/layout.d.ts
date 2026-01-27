import React, {
    Dispatch,
    SetStateAction,
    HTMLAttributeAnchorTarget,
    ReactNode,
    MutableRefObject,
} from "react";

/* Exported types */
export type MenuMode =
    | "static"
    | "overlay"
    | "horizontal"
    | "slim"
    | "slim-plus"
    | "reveal"
    | "drawer";

export type ColorScheme = "light" | "dark" | "dim";

export type MenuColorScheme = "colorScheme" | "primaryColor" | "transparent";

/* Breadcrumb Types */
export interface AppBreadcrumbProps {
    className?: string;
}

export interface Breadcrumb {
    labels?: string[];
    to?: string;
}

export interface BreadcrumbItem {
    label: string;
    to?: string;
    items?: BreadcrumbItem[];
}

/* Context Types */
export type LayoutState = {
    staticMenuDesktopInactive: boolean;
    overlayMenuActive: boolean;
    profileSidebarVisible: boolean;
    overlaySubmenuActive: boolean;
    configSidebarVisible: boolean;
    staticMenuMobileActive: boolean;
    menuHoverActive: boolean;
    resetMenu: boolean;
    sidebarActive: boolean;
    anchored: boolean;
};

export type LayoutConfig = {
    ripple: boolean;
    inputStyle: string;
    menuMode: MenuMode;
    menuTheme: MenuColorScheme;
    colorScheme: ColorScheme;
    theme: string;
    scale: number;
};

export interface LayoutContextProps {
    layoutConfig: LayoutConfig;
    setLayoutConfig: Dispatch<SetStateAction<LayoutConfig>>;
    layoutState: LayoutState;
    setLayoutState: Dispatch<SetStateAction<LayoutState>>;
    onMenuToggle: () => void;
    showConfigSidebar: () => void;
    showProfileSidebar: () => void;
    isSlim: () => boolean;
    isSlimPlus: () => boolean;
    isHorizontal: () => boolean;
    isDesktop: () => boolean;
    breadcrumbs?: Breadcrumb[];
    setBreadcrumbs: Dispatch<SetStateAction<Breadcrumb[]>>;
}

export interface MenuContextProps {
    activeMenu: string;
    setActiveMenu: Dispatch<SetStateAction<string>>;
}

/* AppConfig Types */
export interface AppConfigProps {
    minimal?: boolean;
}

/* AppTopbar Types */
export type NodeRef = MutableRefObject<ReactNode>;
export interface AppTopbarRef {
    menubutton?: HTMLButtonElement | null;
    topbarmenu?: HTMLDivElement | null;
    topbarmenubutton?: HTMLButtonElement | null;
}

/* AppMenu Types */
type CommandProps = {
    originalEvent: React.MouseEvent<HTMLAnchorElement, MouseEvent>;
    item: AppMenuItem;
};

export interface MenuProps {
    model: MenuModel[];
}

export interface MenuModel {
    label: string;
    icon?: string;
    items?: MenuModel[];
    to?: string;
    url?: string;
    target?: HTMLAttributeAnchorTarget;
    seperator?: boolean;
}

export interface UseSubmenuOverlayPositionProps {
    target: HTMLElement | null;
    overlay: HTMLElement | null;
    container: HTMLElement | null;
    when?: any;
}

export interface AppMenuItem extends MenuModel {
    items?: AppMenuItem[];
    badge?: "updated" | "new";
    badgeClass?: string;
    class?: string;
    preventExact?: boolean;
    visible?: boolean;
    disabled?: boolean;
    replaceUrl?: boolean;
    command?: ({ originalEvent, item }: CommandProps) => void;
}

export interface AppMenuItemProps {
    item?: AppMenuItem;
    parentKey?: string;
    index?: number;
    root?: boolean;
    className?: string;
}
