export default function Loading() {
  return (
    <div className="pg">
      {/* KPIs skeleton */}
      <div className="pw-kpi" style={{ marginBottom: '20px' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="kpi-card animate-pulse">
            <div style={{ height: '28px', width: '40px', background: '#e5e7eb', borderRadius: '6px', margin: '0 auto 6px' }} />
            <div style={{ height: '11px', width: '72px', background: '#f3f4f6', borderRadius: '4px', margin: '0 auto' }} />
          </div>
        ))}
      </div>
      {/* Month group skeleton */}
      {[...Array(2)].map((_, mi) => (
        <div key={mi} style={{ marginBottom: '28px' }}>
          <div style={{ height: '10px', width: '80px', background: '#f3f4f6', borderRadius: '4px', marginBottom: '12px' }} className="animate-pulse" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[...Array(3)].map((_, ci) => (
              <div key={ci} className="pcard animate-pulse" style={{ padding: '14px 18px', minHeight: '68px' }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
