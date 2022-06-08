import pLimit from 'p-limit'
import { Episode, Subject } from './bangumi'
import {
  fetchAllEpisode,
  fetchAllUserCollection,
  getSubjectInfo
} from './request'

const SubjectTypeAnime = 2
const SubjectTypeEpisode = 6

function isNull<T> (s: T | null): s is T {
  return s !== null
}

export async function buildICS (username: string): Promise<string> {
  console.log('fetching episodes')
  const collections = (await fetchAllUserCollection(username)).filter(
    (value) =>
      value.subject_type == SubjectTypeAnime ||
      value.subject_id == SubjectTypeEpisode
  )

  const limit = pLimit(10)

  const subjectWithNull: Subject[] = (await Promise.all(
    collections.map((s) => limit(() => getSubjectInfo(s.subject_id)))
  )).filter(isNull)

  const subjects: Record<number, Subject> = subjectWithNull.reduce((previousValue: Record<number, Subject>, currentValue: Subject) => {
    previousValue[currentValue.id] = currentValue

    return previousValue
  }, {} as Record<number, Subject>)

  const result: Episode[][] = await Promise.all(
    collections.filter(x => subjects.hasOwnProperty(x.subject_id)).map((s) => limit(() => fetchAllEpisode(s.subject_id)))
  )

  const episodes = result.reduce((previousValue, currentValue) => {
    previousValue.push(...currentValue)
    return previousValue
  })

  return renderICS(episodes, subjects)
}

function renderICS (
  episodes: Episode[],
  subjects: Record<number, Subject>
): string {
  const today = new Date()

  // let events: Array<EventAttributes> = []
  const calendar = new ICalendar({ name: 'Bangumi Episode Air Calendar' })

  for (const episode of episodes) {
    const date: number[] = episode.airdate
      .split('-')
      .map((x) => parseInt(x, 10))
    if (!date.length) {
      continue
    }
    if (date.length != 3) {
      continue
    }

    const ts = new Date(date[0], date[1] - 1, date[2])
    if (ts.getTime() < today.getTime() - 24 * 60 * 60 * 1000) {
      continue
    }

    if (ts.getTime() > today.getTime() + 30 * 24 * 60 * 60 * 1000) {
      continue
    }

    calendar.createEvent({
      start: [date[0], date[1], date[2]],
      end: [date[0], date[1], date[2] + 1],
      summary: `${subjects[episode.subject_id].name_cn} ${episode.sort}`,
    })
  }

  return calendar.toString()
}

interface Event {
  start: [number, number, number],
  end: [number, number, number],
  summary: string
}

class ICalendar {
  private readonly name: string
  private readonly data: Event[]

  constructor (config: { name: string }) {
    this.name = config.name
    this.data = []
  }

  createEvent (data: Event): void {
    this.data.push(data)
  }

  toString (): string {
    const now = new Date()
    const lines = []
    lines.push(
      `BEGIN:VCALENDAR`,
      'VERSION:2.0',
      'PRODID:-//trim21//bangumi-icalendar//CN',
      `NAME:${this.name}`,
      `X-WR-CALNAME:${this.name}`,
    )

    for (const event of this.data) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${generateUID()}`,
        `DTSTAMP:${formatDateObject(now)}`,
        `DTSTART;VALUE=DATE:${formatDate(event.start)}`,
        `DTEND;VALUE=DATE:${formatDate(event.end)}`,
        `SUMMARY:${event.summary}`,
        `END:VEVENT`,
      )
    }

    lines.push('END:VCALENDAR')

    return lines.join('\n')
  }
}

function formatDateObject (d: Date): string {
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
    'T',
    pad(d.getUTCHours()),
    pad(d.getUTCMinutes()),
    pad(d.getUTCSeconds()),
    'Z'
  ].join('')
}

function formatDate (d: [number, number, number]): string {
  return d[0].toString().padStart(4) + pad(d[1]) + pad(d[2])
}

function pad (n: number) {
  return n < 10 ? `0${n}` : `${n}`
}

function generateUID (): string {
  return crypto.randomUUID()
}
