import Link from "next/link";
import { useContext } from "react";
import pkg from '../../../package.json';
import AppMenu from "./AppMenu";
import { LayoutContext } from "@/context/layoutcontext";
import { MenuProvider } from "@/context/menucontext";
import { LayoutState } from "@/types/layout";
import { usePathname, useRouter } from "@/navigation";
import Image from 'next/image';

const AppSidebar = () => {
    const { setLayoutState } = useContext(LayoutContext);
    const router = useRouter();
    const pathname = usePathname();

    const anchor = () => {
        setLayoutState((prevLayoutState: LayoutState) => ({
            ...prevLayoutState,
            anchored: !prevLayoutState.anchored,
        }));
    };

    const changeLanguage = (locale: string) => {
        router.replace(pathname, { locale });
    };

    return (
        <>
            <div className="sidebar-header sidebar-header-flex">
                <div className="app-logo">
                  <Image src="/logo.png" alt="OAuth Playground logo" width={45} height={45} priority />
                </div>
                <div className="sidebar-logo-text-col">
                  <span className="sidebar-logo-text layout-menuitem-text sidebar-logo-playground">Entra OAuth Playground</span>
                </div>
            </div>

            <div className="layout-menu-container">
                <MenuProvider>
                    <AppMenu />
                </MenuProvider>
            </div>

            <div className="flex align-items-center justify-content-center gap-3 pb-4">
                <button type="button" className="p-link inline-flex justify-content-center align-items-center w-3rem h-3rem border-circle hover:bg-primary transition-all transition-duration-200" onClick={() => changeLanguage('en')}>
                    <span className="fi fi-us text-2xl border-1 border-white-alpha-10 border-round-xs"></span>
                </button>
                <button type="button" className="p-link inline-flex justify-content-center align-items-center w-3rem h-3rem border-circle hover:bg-primary transition-all transition-duration-200" onClick={() => changeLanguage('de')}>
                    <span className="fi fi-de text-2xl border-1 border-white-alpha-10 border-round-xs"></span>
                </button>
            </div>
            <div className="text-center text-sm font-medium pb-4" style={{ color: 'var(--menuitem-text-color, var(--text-color, #fff))' }}>v{pkg.version}</div>
        </>
    );
};

export default AppSidebar;
