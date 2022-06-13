import pLimit from "p-limit";
import { fetchAllUserCollection, getSubjectInfo, SlimSubject } from "./request";
import { hexdump, isNotNull } from "./util";

export async function buildICS(
  kv: KVNamespace,
  username: string
): Promise<string> {
  console.log("fetching episodes");
  let collections = await fetchAllUserCollection(username);

  const limit = pLimit(10);

  const subjects: SlimSubject[] = (
    await Promise.all(
      collections.map((s) => limit(() => getSubjectInfo(kv, s.subject_id)))
    )
  ).filter(isNotNull);

  return renderICS(subjects);
}

async function renderICS(subjects: SlimSubject[]): Promise<string> {
  const calendar = new ICalendar();
  const today = new Date();

  for (const subject of subjects) {
    for (const episode of subject.future_episodes) {
      const date = episode.air_date;
      const ts = new Date(date[0], date[1] - 1, date[2]);

      // only show episode in 30 days.
      if (ts.getTime() > today.getTime() + 30 * 24 * 60 * 60 * 1000) {
        continue;
      }

      const event: Event = {
        uid: await generateUID(subject.id, episode.id),
        start: date,
        summary: `${subject.name_cn || subject.name} ${episode.sort}`,
        description: episode.name || undefined,
      };

      try {
        calendar.createEvent(event);
      } catch (e) {
        throw new Error(
          `failed to create event for ${subject.id} ${
            episode.id
          } ${JSON.stringify(event)}`
        );
      }
    }
  }

  return calendar.toString();
}

interface Event {
  uid: string;
  start: readonly [number, number, number];
  summary: string;
  description?: string;
}

class ICalendar {
  private readonly lines: string[];
  private readonly now: Date;

  constructor() {
    this.now = new Date();

    this.lines = [
      `BEGIN:VCALENDAR`,
      "VERSION:2.0",
      "PRODID:-//trim21//bangumi-icalendar//CN",
    ];
  }

  createEvent(event: Event): void {
    const date = event.start;

    this.lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `DTSTAMP:${formatDateObject(this.now)}`,
      `DTSTART;VALUE=DATE:${formatDate(event.start)}`,
      `DTEND;VALUE=DATE:${formatDate([date[0], date[1], date[2] + 1])}`,
      `SUMMARY:${event.summary}`
    );
    if (event.description) {
      this.lines.push(`DESCRIPTION:${event.description}`);
    }

    this.lines.push(`END:VEVENT`);
  }

  toString(): string {
    return this.lines.join("\r\n") + "\r\nEND:VCALENDAR";
  }
}

function formatDateObject(d: Date): string {
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1),
    pad(d.getUTCDate()),
    "T",
    pad(d.getUTCHours()),
    pad(d.getUTCMinutes()),
    pad(d.getUTCSeconds()),
    "Z",
  ].join("");
}

function formatDate(d: readonly [number, number, number]): string {
  return d[0].toString().padStart(4) + pad(d[1]) + pad(d[2]);
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

async function generateUID(
  subjectID: number,
  episodeID: number
): Promise<string> {
  const key = `subject-${subjectID
    .toString()
    .padStart(6, "0")}-episode-${episodeID.toString().padStart(7, "0")}`;

  const view = new Uint16Array(key.split("").map((s) => s.charCodeAt(0)))
    .buffer;

  const buffer = await crypto.subtle.digest("SHA-256", view);

  return hexdump(buffer).toUpperCase();
}
