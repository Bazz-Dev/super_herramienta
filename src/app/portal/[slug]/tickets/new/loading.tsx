export default function Loading() {
  return (
    <div style={{ padding: '24px 28px', maxWidth: '680px' }}>
      <div className="pcard" style={{ padding: '24px 26px' }}>
        {/* Field skeleton rows */}
        {[120, 160, 100, 80, 140].map((w, i) => (
          <div key={i} style={{ marginBottom: '20px' }}>
            <div style={{ width: `${w}px`, height: '10px', background: 'var(--p-bd)', borderRadius: '4px', marginBottom: '8px' }} className="pulse" />
            <div style={{ width: '100%', height: '40px', background: 'var(--p-bd)', borderRadius: '9px' }} className="pulse" />
          </div>
        ))}
        {/* Button skeleton */}
        <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
          <div style={{ flex: 1, height: '44px', background: 'var(--p-bd)', borderRadius: '9px' }} className="pulse" />
          <div style={{ width: '90px', height: '44px', background: 'var(--p-bd)', borderRadius: '9px' }} className="pulse" />
        </div>
      </div>
      <style>{`
        .pulse { animation: pulse 1.4s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}
