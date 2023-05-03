import { google } from 'googleapis';
import { calendar_v3 } from 'googleapis/build/src/apis/calendar';
import { Event } from '@core/event/event.entity';
import { gapiEventToGcalEvent } from './mapper';
import { OAuth2 } from './oauth';

const NOW = new Date();
const TWO_WEEKS_MS = 1209600000;
export const CROSSFIT_EVENT_PREFIX = '💪 ';

export class Gapi {
  auth: OAuth2;
  calendar: calendar_v3.Calendar;

  constructor() {
    this.auth = new OAuth2();
    this.calendar = google.calendar('v3');
  }

  async authenticate() {
    await this.auth.authenticate();
    return this;
  }

  async getCrossfitEvents(): Promise<Event[]> {
    const events = await this.calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      q: CROSSFIT_EVENT_PREFIX,
      singleEvents: true,
      orderBy: 'startTime',
      timeMin: NOW.toISOString(),
      timeMax: new Date(NOW.getTime() + TWO_WEEKS_MS).toISOString(),
    });

    if (events.status !== 200) {
      throw new Error(
        `Failed to fetch Google Calendar events: ${events.statusText}`,
      );
    }

    return (
      events.data.items?.map((event) =>
        gapiEventToGcalEvent(event, CROSSFIT_EVENT_PREFIX),
      ) || []
    );
  }

  // Beware of rate limiting
  async updateEventTitle({ id: eventId, title, start }: Event) {
    console.log(
      `Updating event at ${start.toLocaleDateString()} title to ${title}, (id: ${eventId})`,
    );
    !Env.dryRun &&
      (await this.calendar.events.patch({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        eventId,
        requestBody: { summary: title },
      }));
  }

  isAfter(date: Date, compareTo: Date) {
    date.getTime() > compareTo.getTime();
  }
}
