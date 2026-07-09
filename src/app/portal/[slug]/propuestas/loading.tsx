export default function Loading() {
  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ height: 72, borderRadius: 14, background: '#e5e7eb', marginBottom: 18, animation: 'pulse 1.5s infinite' }} />
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ height: 80, borderRadius: 14, background: '#f3f4f6', marginBottom: 10, animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  )
}
