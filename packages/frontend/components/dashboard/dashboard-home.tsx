'use client';

import { useState } from 'react';
import Sidebar, { type Section } from '@/components/dashboard/sidebar';
import PixelOffice from '@/components/office/pixel-office';
import SignalFeed from '@/components/dashboard/signal-feed';
import ControlPanel from '@/components/dashboard/control-panel';
import RelationshipGraph from '@/components/dashboard/relationship-graph';
import MemoryBrowser from '@/components/dashboard/memory-browser';
import InterventionQueue from '@/components/dashboard/intervention-queue';
import MissionList from '@/components/dashboard/mission-list';
import OperationsSummary from '@/components/dashboard/operations-summary';

export default function DashboardHome() {
  const [activeSection, setActiveSection] = useState<Section>('home');

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />

      <div style={{
        flex: 1,
        marginLeft: 'var(--hatch-sidebar-width)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        {/* Pixel Office — always visible hero */}
        <div style={{
          width: '100%',
          height: 'var(--hatch-office-height)',
          position: 'relative',
          borderBottom: '2px solid var(--hatch-border-subtle)',
          flexShrink: 0,
        }}>
          <PixelOffice />
        </div>

        {/* Content area */}
        <main style={{
          flex: 1,
          padding: 24,
          overflowY: 'auto',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          {activeSection === 'home' && <OverviewSection />}
          {activeSection === 'feed' && <SignalFeed />}
          {activeSection === 'missions' && <MissionList />}
          {activeSection === 'interventions' && <InterventionQueue />}
          {activeSection === 'graph' && <RelationshipGraph />}
          {activeSection === 'memory' && <MemoryBrowser />}
          {activeSection === 'settings' && <ControlPanel />}
        </main>
      </div>
    </div>
  );
}

function OverviewSection() {
  return (
    <div style={{ animation: 'slideUp 0.4s ease-out' }}>
      <h2 style={{
        fontSize: 14,
        fontFamily: 'var(--hatch-font-display)',
        color: 'var(--hatch-accent-primary)',
        margin: '0 0 20px 0',
        textShadow: '0 0 8px rgba(124, 92, 255, 0.3)',
      }}>
        COMMAND CENTER
      </h2>
      <div style={{
        display: 'grid',
        gap: 20,
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
      }}>
        <div className="glass-card" style={{ padding: 20 }}>
          <OperationsSummary />
        </div>
        <div className="glass-card" style={{ padding: 20 }}>
          <SignalFeed compact />
        </div>
      </div>
    </div>
  );
}
