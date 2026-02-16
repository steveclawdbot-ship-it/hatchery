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
          borderBottom: '2px solid var(--hatch-border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--hatch-bg-deep)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Link
            href="/pitch"
            style={{
              fontSize: 16,
              fontFamily: 'var(--hatch-font-display)',
              margin: 0,
              color: 'var(--hatch-accent-primary)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textShadow: '0 0 12px rgba(124, 92, 255, 0.4)',
            }}
          >
            <span style={{ fontSize: 24 }}>🐣</span>
            HATCHERY
          </Link>
          <span style={{
            fontSize: 12,
            fontFamily: 'var(--hatch-font-body)',
            color: 'var(--hatch-text-muted)',
          }}>
            The Pitch Meeting
          </span>
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
                fontFamily: 'var(--hatch-font-body)',
                color: 'var(--hatch-text-muted)',
                padding: '6px 12px',
                background: 'var(--hatch-bg-surface)',
                border: '1px solid var(--hatch-border-default)',
                borderRadius: 4,
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
