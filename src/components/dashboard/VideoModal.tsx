interface Props {
  videoId: string
  title: string
  onClose: () => void
}

export default function VideoModal({ videoId, title, onClose }: Props) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'var(--s2)', border: '1px solid var(--b2)', borderRadius: '12px', padding: '14px', width: '100%', maxWidth: '700px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)', letterSpacing: '1px' }}>VIDEO MONITOR</div>
          <button onClick={onClose} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', background: 'var(--s3)', border: '1px solid var(--b1)', color: 'var(--t1)', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}>✕ CLOSE</button>
        </div>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          style={{ width: '100%', aspectRatio: '16/9', borderRadius: '7px', border: 'none', display: 'block' }}
          allowFullScreen
        />
        <div style={{ fontSize: '10px', color: 'var(--t2)', marginTop: '8px', fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1.5 }}>{title}</div>
      </div>
    </div>
  )
}
