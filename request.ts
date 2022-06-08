import * as pkg from './package.json'
import { Collection, Episode, Paged, Subject } from './bangumi'
import { isNotNull } from './util'

const KVReadOption = { cacheTtl: 86400 } as const

export async function fetchWithUA (request: Request | string, init?: RequestInit | Request): Promise<Response> {
  const req = new Request(request, init)
  req.headers.set('user-agent', `trim21/bangumi-episode-ics/cf-workers/${pkg.version}`)
  return await fetch(req)
}

export async function fetchAllUserCollection (username: string, pageSize: number = 50): Promise<Array<Collection>> {
  const data: Array<Collection> = []
  let offset: number = 0
  let res: Paged<Collection>

  do {
    const r = await fetchWithUA(`https://api.bgm.tv/v0/users/${username}/collections` + '?' + qs({
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

export interface SlimSubject {
  name: string;
  name_cn: string;
  id: number;
  future_episodes: Array<ParsedEpisode>;
}

export async function getSubjectInfo (subjectID: number): Promise<SlimSubject | null> {
  const key = `subject-v8-${subjectID}`
  let value = await BANGUMI_CALENDAR.get(key, KVReadOption)
  if (value) {
    return JSON.parse(value)
  }

  const res = await fetchWithUA(`https://api.bgm.tv/v0/subjects/${subjectID}`)

  if (res.status === 404) {
    return null
  }

  if (res.status >= 400) {
    throw new Error('failed to get subject: ' + await res.text())
  }

  const d: Subject = await res.json()
  const episodes: Array<ParsedEpisode> = []
  if (d.total_episodes) {
    episodes.push(...await fetchAllEpisode(subjectID))
  }

  const data: SlimSubject = {
    id: d.id,
    name_cn: d.name_cn,
    name: d.name,
    future_episodes: episodes,
  }

  await BANGUMI_CALENDAR.put(key, JSON.stringify(data), { expirationTtl: 86400 })

  return data
}

export interface ParsedEpisode {
  id: number,
  sort: number;
  name: string;
  air_date: readonly [number, number, number];
}

export async function fetchAllEpisode (subjectID: number): Promise<Array<ParsedEpisode>> {
  const res = await _fetchAllEpisode(subjectID)

  const today = new Date()
  return res.map((episode) => {
    const date: number[] = episode.airdate.split('-')
      .map(x => parseInt(x, 10)).filter(x => !isNaN(x)).filter(isNotNull)
    if (date.length != 3) {
      return null
    }

    const ts = new Date(date[0], date[1] - 1, date[2])
    if (ts.getTime() < today.getTime() - 24 * 60 * 60 * 1000) {
      return null
    }

    if (date[0] === null || date[1] === null || date[2] === null) {
      throw new Error(`failed to parse episode for ${subjectID} ${episode.id}, ${episode.airdate}`)
    }

    return {
      id: episode.id,
      sort: episode.sort,
      name: episode.name_cn || episode.name,
      air_date: ([date[0], date[1], date[2]] as const),
    }
  }).filter(isNotNull)
}

export async function _fetchAllEpisode (
  subjectID: number,
  pageSize: number = 200
): Promise<Array<Episode>> {
  const data: Array<Episode> = []
  let offset: number = 0
  let res: Paged<Episode>

  do {
    const r = await fetchWithUA(`https://api.bgm.tv/v0/episodes?` + qs({
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

  return new URLSearchParams(q).toString()
}
