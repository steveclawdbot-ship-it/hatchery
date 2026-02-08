'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function PitchLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sessionId = pathname.match(/\/pitch\/([a-f0-9-]+)/)?.[1];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header
        style={{
          padding: '20px 32px',
          borderBottom: '2px solid #1a1a3a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#0a0a1a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link
            href="/pitch"
            style={{
              fontSize: 20,
              margin: 0,
              color: '#7c5cff',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 24 }}>🐣</span>
            HATCHERY
          </Link>
          <span style={{ fontSize: 13, color: '#666' }}>The Pitch Meeting</span>
        </div>

        {sessionId && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: '#7a7a92',
                padding: '6px 12px',
                background: '#1a1a3a',
                borderRadius: 4,
                fontFamily: 'monospace',
              }}
            >
              Session: {sessionId.slice(0, 8)}...
            </span>
          </div>
        )}
      </header>

      {/* Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</main>
    </div>
  );
}
