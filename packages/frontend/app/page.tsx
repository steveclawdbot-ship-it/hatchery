'use client';

import { useState } from 'react';
import PixelOffice from '@/components/office/pixel-office';
import SignalFeed from '@/components/dashboard/signal-feed';
import MissionList from '@/components/dashboard/mission-list';
import RelationshipGraph from '@/components/dashboard/relationship-graph';
import MemoryBrowser from '@/components/dashboard/memory-browser';

type Tab = 'office' | 'feed' | 'missions' | 'relationships' | 'memories';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('office');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'office', label: 'Office' },
    { id: 'feed', label: 'Feed' },
    { id: 'missions', label: 'Missions' },
    { id: 'relationships', label: 'Graph' },
    { id: 'memories', label: 'Memory' },
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
        <span style={{ fontSize: 8, color: '#666' }}>AI Startup Dashboard</span>
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
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              fontSize: 8,
              background: activeTab === tab.id ? '#1a1a3a' : 'transparent',
              color: activeTab === tab.id ? '#7c5cff' : '#666',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #7c5cff' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ padding: 24 }}>
        {activeTab === 'office' && <PixelOffice />}
        {activeTab === 'feed' && <SignalFeed />}
        {activeTab === 'missions' && <MissionList />}
        {activeTab === 'relationships' && <RelationshipGraph />}
        {activeTab === 'memories' && <MemoryBrowser />}
      </main>
    </div>
  );
}
