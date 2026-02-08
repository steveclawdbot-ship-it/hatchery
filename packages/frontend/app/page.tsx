'use client';

import { useState } from 'react';
import SignalFeed from '@/components/dashboard/signal-feed';
import ControlPanel from '@/components/dashboard/control-panel';

type Tab = 'control' | 'feed' | 'office' | 'graph' | 'memory';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('control');

  const tabs: Array<{ id: Tab; label: string; enabled: boolean }> = [
    { id: 'control', label: 'Control Panel', enabled: true },
    { id: 'feed', label: 'Mission Feed', enabled: true },
    { id: 'office', label: 'Pixel Office', enabled: false },
    { id: 'graph', label: 'Relationship Graph', enabled: false },
    { id: 'memory', label: 'Memory Browser', enabled: false },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{
        padding: '16px 24px',
        borderBottom: '2px solid #1a1a3a',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}>
        <h1 style={{ fontSize: 14, margin: 0, color: '#7c5cff' }}>
          HATCHERY
        </h1>
        <span style={{ fontSize: 8, color: '#666' }}>Spawn and run an autonomous startup team</span>
      </header>

      {/* Tab bar */}
      <nav style={{
        display: 'flex',
        gap: 0,
        borderBottom: '2px solid #1a1a3a',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.enabled) setActiveTab(tab.id);
            }}
            style={{
              padding: '12px 20px',
              fontSize: 8,
              background: activeTab === tab.id ? '#1a1a3a' : 'transparent',
              color: tab.enabled
                ? activeTab === tab.id ? '#7c5cff' : '#666'
                : '#4a4a6a',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #7c5cff' : '2px solid transparent',
              cursor: tab.enabled ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              opacity: tab.enabled ? 1 : 0.65,
            }}
            disabled={!tab.enabled}
          >
            {tab.label}
            {!tab.enabled ? ' (soon)' : ''}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ padding: 24 }}>
        {activeTab === 'control' && <ControlPanel />}
        {activeTab === 'feed' && <SignalFeed />}
        {activeTab !== 'control' && activeTab !== 'feed' && (
          <div style={{
            border: '1px solid #2a2a5a',
            borderRadius: 6,
            padding: 20,
            fontSize: 8,
            color: '#777',
            maxWidth: 640,
          }}>
            This module is intentionally disabled for MVP. It will return in a later release.
          </div>
        )}
      </main>
    </div>
  );
}
