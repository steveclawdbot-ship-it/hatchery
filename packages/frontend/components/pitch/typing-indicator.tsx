'use client';

export default function TypingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      <div style={{ display: 'flex', gap: 5 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: 'var(--hatch-accent-primary)',
              animation: `bounce 1.4s infinite ease-in-out both`,
              animationDelay: `${i * 0.16}s`,
              boxShadow: '0 0 6px rgba(124, 92, 255, 0.4)',
            }}
          />
        ))}
      </div>
      <span style={{
        fontSize: 13,
        fontFamily: 'var(--hatch-font-body)',
        color: 'var(--hatch-text-muted)',
        marginLeft: 10,
      }}>
        Strategy guide is thinking...
      </span>
    </div>
  );
}
