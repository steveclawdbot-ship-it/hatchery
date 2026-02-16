'use client';

import { useState } from 'react';
import Link from 'next/link';
import SignalFeed from '@/components/dashboard/signal-feed';
import ControlPanel from '@/components/dashboard/control-panel';
import PixelOffice from '@/components/office/pixel-office';
import RelationshipGraph from '@/components/dashboard/relationship-graph';
import MemoryBrowser from '@/components/dashboard/memory-browser';
import InterventionQueue from '@/components/dashboard/intervention-queue';

type Tab = 'control' | 'feed' | 'interventions' | 'office' | 'graph' | 'memory';

export default function DashboardHome() {
  const [activeTab, setActiveTab] = useState<Tab>('control');

  const tabs: Array<{ id: Tab; label: string; enabled: boolean }> = [
    { id: 'control', label: 'Control Panel', enabled: true },
    { id: 'feed', label: 'Mission Feed', enabled: true },
    { id: 'interventions', label: 'Interventions', enabled: true },
    { id: 'office', label: 'Pixel Office', enabled: true },
    { id: 'graph', label: 'Relationship Graph', enabled: true },
    { id: 'memory', label: 'Memory Browser', enabled: true },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>
      <header
        style={{
          padding: '16px 24px',
          borderBottom: '2px solid #1a1a3a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontSize: 24, margin: 0, color: '#7c5cff' }}>
            HATCHERY
          </h1>
          <span style={{ fontSize: 12, color: '#666' }}>Spawn and run an autonomous startup team</span>
        </div>
        <Link
          href="/pitch"
          style={{
            fontSize: 12,
            color: '#9aa0ff',
            textDecoration: 'none',
            border: '1px solid #2a2a5a',
            borderRadius: 4,
            padding: '6px 10px',
            background: '#111129',
          }}
        >
          Open Pitch Meeting
        </Link>
      </header>

      <nav
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '2px solid #1a1a3a',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.enabled) setActiveTab(tab.id);
            }}
            style={{
              padding: '12px 20px',
              fontSize: 12,
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

      <main style={{ padding: 24 }}>
        {activeTab === 'control' && <ControlPanel />}
        {activeTab === 'feed' && <SignalFeed />}
        {activeTab === 'interventions' && <InterventionQueue />}
        {activeTab === 'office' && <PixelOffice />}
        {activeTab === 'graph' && <RelationshipGraph />}
        {activeTab === 'memory' && <MemoryBrowser />}
      </main>
    </div>
  );
}
