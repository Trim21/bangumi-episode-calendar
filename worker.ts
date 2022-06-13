import { buildICS } from "./lib";

import defaultHTMLPage from "./index.html";

const usernameKey = "username";

async function handleRequest(
  username: string,
  kv: KVNamespace,
  context: EventContext<ENV, any, any>
): Promise<Response> {
  const init = {
    status: 200,
    headers: {
      "cache-control": "public, max-age=86400",
      "content-type": "text/plain;charset=UTF-8",
    },
  };

  // try {
  console.log(`try to fetch calendar for ${username}`);
  const cacheKey = `calendar-v10-${username}`;
  const cachedCalendar = await kv.get(cacheKey, { cacheTtl: 86400 });
  if (cachedCalendar) {
    console.log("calendar cached");
    return new Response(cachedCalendar, init);
  }

  console.log("calendar not cached");
  const calendar = await buildICS(kv, username);
  // wait in the background, won't block responding
  context.waitUntil(kv.put(cacheKey, calendar, { expirationTtl: 86400 }));

  return new Response(calendar, init);

  // } catch (e: any) {
  //   return new Response(e.stack.toString(), { status: 500 })
  // }
}

type ENV = { BANGUMI_CALENDAR: KVNamespace<string> };

export default {
  async fetch(
    request: Request,
    { BANGUMI_CALENDAR }: ENV,
    context: EventContext<ENV, any, any>
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/favicon.ico")) {
      return new Response("", { status: 404 });
    }

    const username = url.searchParams.get(usernameKey);
    if (!username || username === "null") {
      return new Response(defaultHTMLPage, {
        status: 400,
        headers: { "content-type": "text/html" },
      });
    }

    return await handleRequest(username, BANGUMI_CALENDAR, context);
  },
};
