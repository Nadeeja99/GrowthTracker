import { ImageResponse } from 'next/og'

// Link-preview image, rendered once at build time.
export const alt = 'GrowthTracker: plan the week, do the day, see what moves your goals'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const blocks = [
  { label: 'AWS study', time: '07:00', color: '#3B82F6', width: 420 },
  { label: 'Practice exam 2', time: '14:00', color: '#3B82F6', width: 380 },
  { label: 'Easy run', time: '18:00', color: '#10B981', width: 330 },
]

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#fafaf9', padding: 72, fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 560 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 30, height: 30, borderRadius: 999, border: '5px solid white', display: 'flex' }} />
            </div>
            <div style={{ fontSize: 44, fontWeight: 700, color: '#121214' }}>GrowthTracker</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ fontSize: 58, fontWeight: 700, color: '#121214', lineHeight: 1.1 }}>Plan the week. Do the day. See what moves your goals.</div>
            <div style={{ fontSize: 28, color: '#52525b' }}>Goals, time blocks, habits, focus timer and an AI coach that reads your own data.</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22, marginLeft: 48, flex: 1 }}>
          {blocks.map(b => (
            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'white', border: '2px solid #e4e4e7', borderRadius: 18, padding: '20px 24px', width: b.width }}>
              <div style={{ width: 10, height: 44, borderRadius: 999, background: b.color, display: 'flex' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 26, fontWeight: 600, color: '#121214' }}>{b.label}</div>
                <div style={{ fontSize: 20, color: '#6b6b74' }}>{b.time}</div>
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#eff6ff', border: '2px solid #bfdbfe', borderRadius: 18, padding: '18px 24px', width: 420, fontSize: 22, color: '#1d4ed8' }}>
            Coach: “Book the run tomorrow at 18:00, your evening is free.”
          </div>
        </div>
      </div>
    ),
    size
  )
}
