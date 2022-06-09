import { buildICS } from './lib'

import defaultHTMLPage from './index.html'

const usernameKey = 'username'

async function handleRequest (username: string): Promise<Response> {
  const init = {
    status: 200,
    headers: {
      'cache-control': 'public, max-age=86400',
      'content-type': 'text/plain;charset=UTF-8',
    },
  }

  try {
    console.log(`try to fetch calendar for ${username}`)
    const cacheKey = `calendar-v6-${username}`
    const cachedCalendar = await BANGUMI_CALENDAR.get(cacheKey, { cacheTtl: 86400 })
    if (cachedCalendar) {
      console.log('calendar cached')
      return new Response(cachedCalendar, init)
    }

    console.log('calendar not cached')
    const calendar = await buildICS(username)

    await BANGUMI_CALENDAR.put(cacheKey, calendar, { expirationTtl: 86400 })
    return new Response(calendar, init)
  } catch (e: any) {
    return new Response(e.stack.toString(), { status: 500 })
  }
}

addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/favicon.ico')) {
    return event.respondWith(new Response('', { status: 404 }))
  }

  const username = url.searchParams.get(usernameKey)
  if (!username || username === 'null') {
    return event.respondWith(new Response(defaultHTMLPage, {
        status: 400,
        headers: { 'content-type': 'text/html' }
      }
    ))
  }
  return event.respondWith(handleRequest(username))
})
