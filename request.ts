import * as pkg from './package.json'
import { Collection, Episode, Paged, Subject } from './bangumi'

const KVReadOption = { cacheTtl: 86400 } as const
const cache = caches.default

export async function fetchWithCache (request: Request | string, init?: RequestInit | Request): Promise<Response> {
  const req = new Request(request, init)
  req.headers.set('user-agent', `trim21/bangumi-episode-ics/cf-workers/${pkg.version}`)

  const c = await cache.match(req.url)
  if (c) {
    return c
  }

  const res = await fetch(req)

  const cacheHeader = new Headers()
  res.headers.forEach((value, key) => {
    cacheHeader.set(key, value)
  })
  cacheHeader.set('Cache-Control', 'public, max-age=86400')

  const putResult = await cache.put(req.url, new Response(await res.clone().blob(), {
    status: res.status,
    statusText: res.statusText,
    headers: cacheHeader,
    url: res.url
  }))

  console.log(req.url, putResult)

  return res
}

export async function fetchAllUserCollection (username: string, pageSize: number = 50): Promise<Array<Collection>> {
  const data: Array<Collection> = []
  let offset: number = 0
  let res: Paged<Collection>

  do {
    const r = await fetchWithCache(`https://api.bgm.tv/v0/users/${username}/collections` + '?' + qs({
      type: '3', offset: offset.toString(), limit: pageSize.toString(),
    }))
    res = await r.json()

    if (!res || !res.data) {
      throw new Error('failed to fetch user collection')
    }

    data.push(...res.data)

    offset += pageSize
  } while (offset < res.total)

  return data
}

export async function getSubjectInfo (subjectID: number): Promise<Subject | null> {
  const key = `subject-${subjectID}`
  let value = await BANGUMI_CALENDAR.get(key, KVReadOption)
  if (value) {
    return JSON.parse(value)
  }

  const res = await fetchWithCache(`https://api.bgm.tv/v0/subjects/${subjectID}`)

  if (res.status >= 400) {
    return null
  }

  await BANGUMI_CALENDAR.put(key, await res.clone().text(), { expirationTtl: 86400 })

  return await res.json()
}

export async function fetchAllEpisode (subjectID: number): Promise<Array<Episode>> {
  const key = `episodes-${subjectID}`
  let value = await BANGUMI_CALENDAR.get(key, KVReadOption)
  if (value) {
    return JSON.parse(value)
  }

  const res = await _fetchAllEpisode(subjectID)

  await BANGUMI_CALENDAR.put(key, JSON.stringify(res), { expirationTtl: 86400 })

  return res
}

export async function _fetchAllEpisode (
  subjectID: number,
  pageSize: number = 200
): Promise<Array<Episode>> {
  const data: Array<Episode> = []
  let offset: number = 0
  let res: Paged<Episode>

  do {
    const r = await fetchWithCache(`https://api.bgm.tv/v0/episodes?` + qs({
      subject_id: subjectID,
      offset,
      limit: pageSize,
    }))
    res = await r.json()

    if (!res || !res.data) {
      throw new Error(`failed to fetch episodes for subject ${subjectID}`)
    }

    data.push(...res.data)

    offset += pageSize
  } while (offset < res.total)

  return data
}

function qs (params: Record<string, any>): string {
  const q: [string, string][] = Object.entries(params)
    .sort(([key1], [key2]) => key1.localeCompare(key2))
    .map(([key, value]) => [key, value.toString()])

  return (new URLSearchParams(q).toString())
}
