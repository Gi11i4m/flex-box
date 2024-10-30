import axios, { AxiosHeaders, AxiosInstance, AxiosRequestConfig } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { Event, EventStatus } from "../shared/event";
import { NOW } from "../shared/date";
import { DateTime } from "luxon";
import { Memoize } from "typescript-memoize";
import { env, envNumber } from "../shared/env";

const SUPER7_CROSSFIT_ROOSTER_ID = 4;
const SUPER7_BASE_URL = "https://crossfitsuper7.sportbitapp.nl/cbm/api/data";
export const SUPER7_WEBSITE_MEMOIZE_TAG = "super7_website_memoize";

/**
 * Example
 *
 * {
 *   id: 14059,
 *   start: '2024-07-24T07:00:00+02:00',
 *   eind: '2024-07-24T08:00:00+02:00',
 *   titel: 'CrossFit',
 *   trainer: { naam: 'Pieter Gielen ', telefoonnummer: null },
 *   ruimte: { naam: 'Hoofdruimte' },
 *   aantalDeelnemers: 5,
 *   maxDeelnemers: 12,
 *   type: { id: 1, hexkleur: '#0E76BC', naam: 'CrossFit' },
 *   aangemeld: false,
 *   opWachtlijst: false,
 *   buddyAangemeld: false,
 *   meerdereTrainers: false
 * }
 */
type Super7WebsiteEvent = {
  id: number;
  start: string;
  eind: string;
  titel: string;
  trainer: { naam: string; telefoonnummer: string | null };
  ruimte: { naam: "Hoofdruimte" };
  aantalDeelnemers: number;
  maxDeelnemers: number;
  type: { id: 1; hexkleur: string; naam: string };
  aangemeld: boolean;
  opWachtlijst: boolean;
  buddyAangemeld: boolean;
  meerdereTrainers: boolean;
};

export class Super7Website {
  private readonly http: AxiosInstance;
  private readonly cookieJar: CookieJar;

  constructor() {
    this.cookieJar = new CookieJar();
    this.http = wrapper(
      axios.create({
        withCredentials: true,
        baseURL: SUPER7_BASE_URL,
        jar: this.cookieJar,
      }),
    );
  }

  async authenticate() {
    await this.http.get("/heartbeat/?taalIso=be");
    await this.http.post(
      "/inloggen/",
      {
        username: env("SUPER7_LOGIN"),
        password: env("SUPER7_PASS"),
        remember: false,
      },
      this.headerConfig(),
    );
    return this;
  }

  async reservations(): Promise<Event[]> {
    return (await this.getEvents())
      .filter(({ aangemeld }) => aangemeld)
      .map((event) => ({
        id: String(event.id),
        title: event.titel.trim(),
        start: DateTime.fromISO(event.start),
        status: getEventStatus(event),
      }))
      .filter((event) => NOW < event.start);
  }

  @Memoize({ tags: [SUPER7_WEBSITE_MEMOIZE_TAG] })
  private async getEvents(): Promise<Super7WebsiteEvent[]> {
    const daysToScanArray = Array.from(
      { length: envNumber("NUMBER_OF_WEEKS_TO_RESERVE") * 7 },
      (_, i) => i,
    );

    let eventsForTwoWeeks: Super7WebsiteEvent[] = [];
    for (let day of daysToScanArray) {
      eventsForTwoWeeks = [
        ...eventsForTwoWeeks,
        ...(await this.getEventsForDay(NOW.plus({ day }))),
      ];
    }

    return eventsForTwoWeeks;
  }

  @Memoize({
    tags: [SUPER7_WEBSITE_MEMOIZE_TAG],
    hashFunction: (args: DateTime) => args.toISODate(),
  })
  private async getEventsForDay(date: DateTime): Promise<Super7WebsiteEvent[]> {
    const {
      data: { ochtend, middag, avond },
    } = await this.http.get(
      `/events/?datum=${date.toFormat(
        "yyyy-MM-dd",
      )}&rooster=${SUPER7_CROSSFIT_ROOSTER_ID}`,
      this.headerConfig(),
    );
    return [...ochtend, ...middag, ...avond];
  }

  async eventIdFor(event: Event): Promise<string | undefined> {
    const eventsForMatchingDay = await this.getEventsForDay(event.start);
    const maybeMatchedEvent = eventsForMatchingDay.find((e) =>
      DateTime.fromISO(e.start).equals(event.start),
    );
    return maybeMatchedEvent ? String(maybeMatchedEvent.id) : undefined;
  }

  async makeReservation(eventId: string) {
    return await this.http.post<void>(
      `/events/${eventId}/deelname/`,
      undefined,
      this.headerConfig(),
    );
  }

  async removeReservation(eventId: string) {
    return await this.http.delete<void>(
      `/events/${eventId}/deelname/`,
      this.headerConfig(),
    );
  }

  private headerConfig(): AxiosRequestConfig {
    const headers: AxiosHeaders = new AxiosHeaders({
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    });

    const maybeXsrfToken = this.cookieJar
      .getCookiesSync(SUPER7_BASE_URL)
      .find(({ key }) => key === "XSRF-TOKEN")?.value;

    if (maybeXsrfToken) {
      headers.set("X-Xsrf-Token", maybeXsrfToken);
    }
    return { headers };
  }
}

const getEventStatus = (event: Super7WebsiteEvent): EventStatus => {
  if (!event.aangemeld) {
    return "❌";
  }
  if (event.opWachtlijst) {
    return "⏳";
  }
  return "✅";
};
