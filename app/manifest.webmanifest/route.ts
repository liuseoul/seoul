export const runtime = 'edge'

export async function GET() {
  const manifest = {
    name: 'Deheng Seoul',
    short_name: 'Deheng',
    description: 'Deheng Seoul team project management platform',
    start_url: '/projects',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f0fdfa',
    theme_color: '#0d9488',
    lang: 'zh-CN',
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

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
