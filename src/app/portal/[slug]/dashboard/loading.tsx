export default function Loading() {
  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Welcome banner skeleton */}
      <div className="pcard" style={{ padding: '28px 32px', marginBottom: '24px' }}>
        <div style={{ width: '220px', height: '22px', background: 'var(--p-bd)', borderRadius: '6px', marginBottom: '10px' }} className="pulse" />
        <div style={{ width: '340px', height: '13px', background: 'var(--p-bd)', borderRadius: '4px', marginBottom: '20px' }} className="pulse" />
        <div style={{ width: '160px', height: '36px', background: 'var(--p-bd)', borderRadius: '8px' }} className="pulse" />
      </div>

      {/* KPI cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="pcard" style={{ padding: '18px 20px' }}>
            <div style={{ width: '36px', height: '28px', background: 'var(--p-bd)', borderRadius: '6px', marginBottom: '8px' }} className="pulse" />
            <div style={{ width: '90px', height: '11px', background: 'var(--p-bd)', borderRadius: '4px' }} className="pulse" />
          </div>
        ))}
      </div>

      {/* Recent tickets skeleton */}
      <div style={{ width: '140px', height: '11px', background: 'var(--p-bd)', borderRadius: '4px', marginBottom: '12px' }} className="pulse" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="pcard" style={{ padding: '14px 18px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
            <div style={{ width: '70px', height: '10px', background: 'var(--p-bd)', borderRadius: '4px' }} className="pulse" />
            <div style={{ width: '55px', height: '10px', background: 'var(--p-bd)', borderRadius: '10px' }} className="pulse" />
          </div>
          <div style={{ width: '65%', height: '14px', background: 'var(--p-bd)', borderRadius: '4px' }} className="pulse" />
        </div>
      ))}

      <style>{`
        .pulse { animation: pulse 1.4s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}
