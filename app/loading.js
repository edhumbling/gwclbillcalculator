export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg, #0b1020)',
      color: 'var(--text, #e2e8f0)'
    }}>
      <div>Loading...</div>
    </div>
  )
}

