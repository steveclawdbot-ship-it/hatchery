'use client';

import { PITCH_ROUNDS } from '@/lib/pitch/prompts';

interface RoundProgressProps {
  currentRound: number;
  status: string;
}

export default function RoundProgress({ currentRound, status }: RoundProgressProps) {
  const totalRounds = PITCH_ROUNDS.length;
  const currentFocus = PITCH_ROUNDS[currentRound - 1]?.focus || '';

  // For synthesis/approval/generation/completed, show all rounds complete
  const displayRound = status === 'in_progress' ? currentRound : totalRounds;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 24px',
        background: '#0f0f25',
        borderBottom: '1px solid #1a1a3a',
      }}
    >
      {/* Round indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: '#7a7a92' }}>
          {status === 'in_progress' ? `Round ${currentRound}/${totalRounds}` : getStatusLabel(status)}
        </span>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: totalRounds }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: i < displayRound ? '#7c5cff' : '#2a2a5a',
                transition: 'background 0.3s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: '#2a2a5a' }} />

      {/* Current focus */}
      {status === 'in_progress' && currentFocus && (
        <span style={{ fontSize: 13, color: '#7c5cff' }}>{currentFocus}</span>
      )}

      {status !== 'in_progress' && (
        <span
          style={{
            fontSize: 13,
            color: getStatusColor(status),
          }}
        >
          {getStatusDescription(status)}
        </span>
      )}
    </div>
  );
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'synthesis':
      return 'Synthesis';
    case 'approval':
      return 'Review';
    case 'generation':
      return 'Generation';
    case 'completed':
      return 'Complete';
    default:
      return status;
  }
}

function getStatusDescription(status: string): string {
  switch (status) {
    case 'synthesis':
      return 'Synthesizing your revised pitch...';
    case 'approval':
      return 'Review and approve the revised pitch';
    case 'generation':
      return 'Generating your AI agent team...';
    case 'completed':
      return 'Your AI startup is ready!';
    default:
      return '';
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'synthesis':
    case 'approval':
      return '#FF9800';
    case 'generation':
      return '#2196F3';
    case 'completed':
      return '#4CAF50';
    default:
      return '#7a7a92';
  }
}
