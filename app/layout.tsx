import type {Metadata} from 'next';
import './globals.css';
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';

export const metadata: Metadata = {
  title: 'App Root',
  description: 'Root layout for redirect route',
  icons: {
    icon: '/logo.png'
  }
};



export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
