'use client';

import { type CSSProperties, useState } from 'react';
import Link from 'next/link';

export type Section = 'home' | 'feed' | 'missions' | 'interventions' | 'graph' | 'memory' | 'settings';

interface SidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
}

const NAV_ITEMS: Array<{ id: Section; icon: string; label: string }> = [
  { id: 'home', icon: '\u2302', label: 'Overview' },
  { id: 'feed', icon: '\u26A1', label: 'Signal Feed' },
  { id: 'missions', icon: '\u2691', label: 'Missions' },
  { id: 'interventions', icon: '\u26A0', label: 'Alerts' },
  { id: 'graph', icon: '\u25C8', label: 'Relationships' },
  { id: 'memory', icon: '\u29BE', label: 'Memory' },
  { id: 'settings', icon: '\u2699', label: 'Settings' },
];

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <nav style={sidebarStyle}>
      {/* Logo */}
      <div style={logoStyle}>H</div>

      {/* Navigation items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          const isHovered = hoveredId === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              title={item.label}
              style={{
                ...navButtonStyle,
                background: isActive
                  ? 'var(--hatch-bg-elevated)'
                  : isHovered
                    ? 'var(--hatch-bg-surface)'
                    : 'transparent',
                borderLeft: isActive
                  ? '3px solid var(--hatch-accent-primary)'
                  : '3px solid transparent',
                color: isActive
                  ? 'var(--hatch-accent-primary)'
                  : isHovered
                    ? 'var(--hatch-text-primary)'
                    : 'var(--hatch-text-muted)',
                boxShadow: isActive
                  ? 'inset 0 0 12px rgba(124, 92, 255, 0.1)'
                  : 'none',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
            </button>
          );
        })}
      </div>

      {/* Pitch link at bottom */}
      <Link
        href="/pitch"
        title="Pitch Meeting"
        style={pitchLinkStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--hatch-bg-surface)';
          e.currentTarget.style.color = 'var(--hatch-accent-warm)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--hatch-text-muted)';
        }}
      >
        <span style={{ fontSize: 16 }}>&#x1F4AC;</span>
      </Link>
    </nav>
  );
}

const sidebarStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  top: 0,
  bottom: 0,
  width: 'var(--hatch-sidebar-width)',
  background: 'var(--hatch-bg-base)',
  borderRight: '1px solid var(--hatch-border-subtle)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '12px 0',
  gap: 12,
  zIndex: 100,
  animation: 'slideInLeft 0.3s ease-out',
};

const logoStyle: CSSProperties = {
  fontFamily: 'var(--hatch-font-display)',
  fontSize: 18,
  color: 'var(--hatch-accent-primary)',
  textShadow: '0 0 8px rgba(124, 92, 255, 0.5)',
  padding: '8px 0 12px',
  cursor: 'default',
  userSelect: 'none',
};

const navButtonStyle: CSSProperties = {
  width: 44,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 150ms ease',
};

const pitchLinkStyle: CSSProperties = {
  width: 44,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
  textDecoration: 'none',
  color: 'var(--hatch-text-muted)',
  transition: 'all 150ms ease',
};
