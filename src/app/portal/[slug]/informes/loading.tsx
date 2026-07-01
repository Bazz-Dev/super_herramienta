export default function Loading() {
  return (
    <div style={{ padding: '20px 24px' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{
          height: 88, background: '#f8f7f5', borderRadius: 14,
          marginBottom: 10, animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
    </div>
  )
}
