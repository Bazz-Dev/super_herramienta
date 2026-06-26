export default function Loading() {
  return (
    <div style={{ padding: '24px 28px' }}>
      {/* KPI skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '28px' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="pcard" style={{ padding: '16px 18px' }}>
            <div style={{ width: '40px', height: '26px', background: 'var(--p-bd)', borderRadius: '6px', marginBottom: '6px' }} className="pulse" />
            <div style={{ width: '60px', height: '10px', background: 'var(--p-bd)', borderRadius: '4px' }} className="pulse" />
          </div>
        ))}
      </div>

      {/* Ticket card skeletons */}
      <div style={{ marginBottom: '10px', width: '80px', height: '10px', background: 'var(--p-bd)', borderRadius: '4px' }} className="pulse" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="pcard" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '80px', height: '10px', background: 'var(--p-bd)', borderRadius: '4px' }} className="pulse" />
              <div style={{ width: '60px', height: '10px', background: 'var(--p-bd)', borderRadius: '12px' }} className="pulse" />
            </div>
            <div style={{ width: '60%', height: '14px', background: 'var(--p-bd)', borderRadius: '4px', marginBottom: '8px' }} className="pulse" />
            <div style={{ width: '40%', height: '11px', background: 'var(--p-bd)', borderRadius: '4px' }} className="pulse" />
          </div>
        ))}
      </div>

      <style>{`
        .pulse { animation: pulse 1.4s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}
