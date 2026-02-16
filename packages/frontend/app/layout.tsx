import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hatchery Dashboard',
  description: 'AI Startup in a Box — real-time dashboard',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{
        margin: 0,
        fontFamily: 'var(--hatch-font-body)',
        backgroundColor: 'var(--hatch-bg-deep)',
        color: 'var(--hatch-text-primary)',
        minHeight: '100vh',
        overflowX: 'hidden',
      }}>
        {children}
      </body>
    </html>
  );
}
