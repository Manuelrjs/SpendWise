import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SpendFlow Planner',
    short_name: 'SpendFlow',
    description: 'Gastos, cuotas y compromisos futuros',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0F0F14',
    theme_color: '#0F0F14',
    icons: [
      { src: '/icon', sizes: '192x192', type: 'image/png' },
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
    share_target: {
      action: '/compartir',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        url: 'url',
        files: [
          {
            name: 'comprobante',
            accept: ['image/*', 'application/pdf'],
          },
        ],
      },
    },
  };
}
