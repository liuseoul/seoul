import type { MetadataRoute } from 'next'

export const runtime = 'edge'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Deheng Seoul',
    short_name: 'Deheng',
    description: 'Deheng Seoul team project management platform',
    start_url: '/projects',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f0fdfa',
    theme_color: '#0d9488',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
