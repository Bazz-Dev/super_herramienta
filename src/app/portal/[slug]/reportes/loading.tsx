export default function Loading() {
  return (
    <div style={{ padding: '24px 28px' }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '24px' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="pcard" style={{ padding: '16px 18px' }}>
            <div style={{ width: '40px', height: '26px', background: 'var(--p-bd)', borderRadius: '6px', marginBottom: '6px' }} className="pulse" />
            <div style={{ width: '72px', height: '10px', background: 'var(--p-bd)', borderRadius: '4px' }} className="pulse" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="pcard" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ width: '160px', height: '12px', background: 'var(--p-bd)', borderRadius: '4px', marginBottom: '20px' }} className="pulse" />
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
          {[40,60,35,80,55,70,45,65,50,90,30,75].map((h, i) => (
            <div key={i} className="pulse" style={{ flex: 1, height: `${h}%`, background: 'var(--p-bd)', borderRadius: '4px 4px 0 0' }} />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="pcard" style={{ padding: '16px 18px' }}>
        <div style={{ width: '140px', height: '11px', background: 'var(--p-bd)', borderRadius: '4px', marginBottom: '14px' }} className="pulse" />
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--p-bd)' : 'none' }}>
            <div style={{ flex: 2, height: '12px', background: 'var(--p-bd)', borderRadius: '4px' }} className="pulse" />
            <div style={{ width: '60px', height: '12px', background: 'var(--p-bd)', borderRadius: '10px' }} className="pulse" />
            <div style={{ width: '50px', height: '12px', background: 'var(--p-bd)', borderRadius: '4px' }} className="pulse" />
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
