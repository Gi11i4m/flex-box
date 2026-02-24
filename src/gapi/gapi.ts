import { google, calendar_v3 } from "googleapis";
import { NOW } from "../shared/date";
import { Event } from "../shared/event";
import { gapiEventToGcalEvent } from "./mapper";
import { OAuth2 } from "./oauth";
import { env, envNumber, isDryRun } from "../shared/env";
import { Database } from "../db/database";
import Schema$Event = calendar_v3.Schema$Event;

export const CROSSFIT_EVENT_PREFIX = "💪";

export class Gapi {
  auth: OAuth2;
  calendar: calendar_v3.Calendar;

  constructor(database: Database) {
    this.auth = new OAuth2(database);
    this.calendar = google.calendar("v3");
  }

  async authenticate() {
    await this.auth.authenticate();
    return this;
  }

  async getCrossfitEvents(): Promise<Event[]> {
    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId: env("GOOGLE_CALENDAR_ID") || undefined,
      q: CROSSFIT_EVENT_PREFIX,
      singleEvents: true,
      orderBy: "startTime",
      timeMin: NOW.toISO()!,
      timeMax: NOW.plus({
        week: envNumber("NUMBER_OF_WEEKS_TO_RESERVE"),
      }).toISO()!,
    };

    const response = await this.calendar.events.list(params);

    if (!response.data?.items) {
      return [];
    }

    return response.data.items
      .filter((event: Schema$Event) => !this.haveIDeclinedThisEvent(event))
      .map((event: Schema$Event) =>
        gapiEventToGcalEvent(event, CROSSFIT_EVENT_PREFIX),
      );
  }

  private haveIDeclinedThisEvent(event: Schema$Event): boolean {
    return !!event.attendees?.find(
      (att) => att.self && att.responseStatus === "declined",
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
        calendarId: env("GOOGLE_CALENDAR_ID"),
        eventId: event.id,
        requestBody: { summary: newEventTitle },
      }));
  }
}
