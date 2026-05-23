import { ImageResponse } from 'next/og';

export const contentType = 'image/png';
export const size = { width: 512, height: 512 };

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#059669' }}>
        <div style={{ width: '78%', height: '78%', borderRadius: '9999px', background: '#0ea5a4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 172, fontWeight: 800 }}>
          SW
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
