import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'App Root',
  description: 'Root layout for redirect route'
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
