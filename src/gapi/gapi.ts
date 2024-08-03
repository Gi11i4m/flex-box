import { google } from "googleapis";
import { calendar_v3 } from "googleapis/build/src/apis/calendar";
import { NOW } from "../shared/date";
import { Event } from "../shared/event";
import { gapiEventToGcalEvent } from "./mapper";
import { OAuth2 } from "./oauth";
import { envNumber, isDryRun } from "../shared/environment";

export const CROSSFIT_EVENT_PREFIX = "💪";

export class Gapi {
  auth: OAuth2;
  calendar: calendar_v3.Calendar;

  constructor() {
    this.auth = new OAuth2();
    this.calendar = google.calendar("v3");
  }

  async authenticate() {
    await this.auth.authenticate();
    return this;
  }

  async getCrossfitEvents(): Promise<Event[]> {
    const now = new Date();
    const events = await this.calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      q: CROSSFIT_EVENT_PREFIX,
      singleEvents: true,
      orderBy: "startTime",
      timeMin: NOW.toISO(),
      timeMax: NOW.plus({
        week: envNumber("NUMBER_OF_WEEKS_TO_RESERVE"),
      }).toISO(),
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
  async updateEventTitle(event: Event) {
    const newEventTitle = `${CROSSFIT_EVENT_PREFIX} ${event.title} ${event.status}`;
    console.log(
      `Updating event at ${event.start.toLocaleString()} title to ${newEventTitle}, (id: ${
        event.id
      })`,
    );
    !isDryRun() &&
      (await this.calendar.events.patch({
        calendarId: process.env.GOOGLE_CALENDAR_ID,
        eventId: event.id,
        requestBody: { summary: newEventTitle },
      }));
  }
}
