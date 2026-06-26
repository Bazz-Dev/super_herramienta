export default function Loading() {
  return (
    <div style={{ padding: '24px 28px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Stepper skeleton */}
        <div className="pcard" style={{ padding: '20px 22px' }}>
          <div style={{ width: '140px', height: '10px', background: 'var(--p-bd)', borderRadius: '4px', marginBottom: '18px' }} className="pulse" />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--p-bd)' }} className="pulse" />
                <div style={{ width: '50px', height: '10px', background: 'var(--p-bd)', borderRadius: '4px' }} className="pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Content skeleton */}
        {[180, 240, 300].map((h, i) => (
          <div key={i} className="pcard" style={{ padding: '16px 18px', height: h }}>
            <div style={{ width: '80px', height: '10px', background: 'var(--p-bd)', borderRadius: '4px', marginBottom: '14px' }} className="pulse" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[...Array(3)].map((_, j) => (
                <div key={j} style={{ height: '14px', background: 'var(--p-bd)', borderRadius: '4px', width: `${[95, 75, 60][j]}%` }} className="pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[80, 200].map((h, i) => (
          <div key={i} className="pcard" style={{ height: h }} />
        ))}
      </div>

      <style>{`
        .pulse { animation: pulse 1.4s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}
