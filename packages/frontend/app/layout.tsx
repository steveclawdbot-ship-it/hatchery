import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hatchery Dashboard',
  description: 'AI Startup in a Box — real-time dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        fontFamily: '"Press Start 2P", monospace, system-ui',
        backgroundColor: '#0a0a1a',
        color: '#e0e0e0',
      }}>
        <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
        {children}
      </body>
    </html>
  );
}
