/**
 * Test page for office canvas
 * Temporary page for development/testing
 */

'use client';

import { useState } from 'react';
import OfficeCanvas from '@/components/office/office-canvas';

export default function OfficeTestPage() {
  const [selectedDesk, setSelectedDesk] = useState<number | null>(null);
  const [time, setTime] = useState(new Date());

  // Update time every minute for day/night cycle
  useState(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  });

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#0a0a1a',
      padding: 40,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <h1 style={{ 
        color: '#7c5cff', 
        fontSize: 16,
        fontFamily: '"Press Start 2P", monospace',
        marginBottom: 24,
      }}>
        HATCHERY OFFICE TEST
      </h1>
      
      <OfficeCanvas 
        time={time}
        onDeskClick={(deskId) => setSelectedDesk(deskId)}
      />
      
      {selectedDesk && (
        <div style={{
          marginTop: 24,
          padding: 16,
          backgroundColor: '#1a1a3a',
          border: '2px solid #2a2a5a',
          borderRadius: 4,
          color: '#ccc',
          fontFamily: 'monospace',
          fontSize: 12,
        }}>
          Selected Desk: {selectedDesk}
        </div>
      )}
      
      <div style={{
        marginTop: 24,
        color: '#666',
        fontSize: 10,
        fontFamily: 'monospace',
      }}>
        Time: {time.toLocaleTimeString()} | Click desks to select
      </div>
    </div>
  );
}
