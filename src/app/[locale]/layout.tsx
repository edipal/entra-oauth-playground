import { LayoutProvider } from "@/context/layoutcontext";
import { PrimeReactProvider } from "primereact/api";
import "@/styles/layout/layout.scss"; // Import global styles here
import "primereact/resources/primereact.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.css";
import "flag-icons/css/flag-icons.min.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import ThemeLink from "@/components/ThemeLink";
import { SettingsProvider } from "@/components/SettingsContext";

export const metadata: Metadata = {
    title: "Entra OAuth Playground",
    description: "Entra OAuth Playground with Next.js and PrimeReact",
};

export default async function RootLayout({ children, params }: { children: React.ReactNode, params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    // Validate that the incoming `locale` parameter is valid
    if (!['en', 'de'].includes(locale as any)) notFound();

    const messages = await getMessages();

    return (
        <html lang={locale}>
            <body>
                <NextIntlClientProvider messages={messages}>
                    <SettingsProvider>
                        <PrimeReactProvider>
                            <LayoutProvider>
                                <ThemeLink />
                                {children}
                            </LayoutProvider>
                        </PrimeReactProvider>
                    </SettingsProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}