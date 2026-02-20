import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Ad Platform',
  description: 'MVP dashboard scaffold'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
