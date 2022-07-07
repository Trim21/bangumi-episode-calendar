export default {
  async fetch (request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/favicon.ico')) {
      return new Response('', { status: 404 })
    }

    const username = url.searchParams.get('username')
    if (!username || username === 'null') {
      return new Response('', {
        status: 301,
        headers: {
          'location': 'https://workers.trim21.cn/episode-calendar'
        },
      })
    }

    return new Response('', {
      status: 301,
      headers: {
        'location': `https://workers.trim21.cn/episode-calendar?username=${username}`
      },
    })
  },
}
