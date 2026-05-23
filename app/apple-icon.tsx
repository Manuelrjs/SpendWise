import { ImageResponse } from 'next/og';

export const contentType = 'image/png';
export const size = { width: 180, height: 180 };

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#059669',
        }}
      >
        <div
          style={{
            width: '78%',
            height: '78%',
            borderRadius: '9999px',
            background: '#0ea5a4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 62,
            fontWeight: 800,
          }}
        >
          SW
        </div>
      </div>
    ),
    { width: 180, height: 180 },
  );
}
