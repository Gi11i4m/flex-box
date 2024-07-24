import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { JSDOM } from "jsdom";
import { CookieJar } from "tough-cookie";
import { Event, EventStatus } from "../shared/event";
import { NOW } from "../shared/date";
import { DateTime } from "luxon";
import { Memoize } from "typescript-memoize";

const SUPER7_CROSSFIT_ROOSTER_ID = 4;
const SUPER7_BASE_URL = "https://crossfitsuper7.sportbitapp.nl/cbm/api/data";

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
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        jar: this.cookieJar,
      }),
    );
  }

  async authenticate() {
    await this.http.get("/heartbeat/?taalIso=be");
    await this.http.post(
      "/inloggen/",
      {
        username: process.env.SUPER7_LOGIN!,
        password: process.env.SUPER7_PASS!,
        remember: false,
      },
      this.headerConfig(),
    );
    return this;
  }

  async reservations(): Promise<Event[]> {
    return (await this.getEventsForNextTwoWeeks())
      .filter(({ aangemeld }) => aangemeld)
      .map((event) => ({
        title: event.titel.trim(),
        start: DateTime.fromISO(event.start),
        status: getEventStatus(event),
      }));
    // return reservationLinks.map((el) => {
    //   const htmlTitle = reservationTitleFrom(el);
    //   return {
    //     title: titleToEventName(htmlTitle),
    //     location: reservationLocationFrom(el),
    //     start: reservationDateFrom(el),
    //     status: getReservationStatus(htmlTitle),
    //   };
    // });
  }

  @Memoize()
  private async getEventsForNextTwoWeeks(): Promise<Super7WebsiteEvent[]> {
    const threeWeeksInDaysArray = Array.from({ length: 14 }, (_, i) => i);
    const reservationLinksForThreeWeeks = await Promise.all(
      threeWeeksInDaysArray.map((dayToAdd) =>
        this.getReservationsForDay(NOW.plus({ day: dayToAdd })),
      ),
    );
    return reservationLinksForThreeWeeks.flat();
  }

  private async getReservationsForDay(date: DateTime) {
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

  async eventIdFor({
    title,
    start,
  }: Pick<Event, "title" | "start">): Promise<string | undefined> {
    const calendarFormData = new URLSearchParams();
    // calendarFormData.append("Id", location === "Leuven" ? "2" : "1");
    calendarFormData.append("aDays", String(daysFromToday(start)));
    calendarFormData.append("aRoomIds[]", "2");
    const { data } = await this.http.post(
      `/Reservation/CalendarItems`,
      calendarFormData,
    );
    console.log(
      `Finding event id for ${title} @${location}: ${start.toLocaleString()}`,
    );
    return onlyNumbers(
      Array.from(
        new JSDOM(data).window.document.querySelectorAll<HTMLDivElement>(
          ".webshop-panel",
        ),
      ).find((el) => {
        const [panelTitle, panelTime] = panelTitleFrom(el);
        console.log(panelTitle, panelTime, dateToTime(start));

        return title.includes(panelTitle) && dateToTime(start) === panelTime;
      })?.id || "EVENT ID NOT FOUND",
    );
  }

  async makeReservation(eventId: string) {
    return await this.http.post(`/Reservation/AddReservation`, {
      aId: eventId,
    });
  }

  async waitlistReservation(eventId: string) {
    return await this.http.get(`/Reservation/AddWaitlist?aId=${eventId}`);
  }

  // async reservationIdFor({
  //   title,
  //   start,
  //   location,
  // }: Pick<Event, "title" | "start" | "location">): Promise<string | undefined> {
  //   console.log(
  //     `Finding reservation id for ${title} @${location}: ${start.toLocaleString()}`,
  //   );
  //   return (
  //     onlyNumbers(
  //       (await this.getEventsForNextTwoWeeks())
  //         .find((reservationHtml) => {
  //           return (
  //             reservationTitleFrom(reservationHtml).includes(title) &&
  //             start.getTime() ===
  //               reservationDateFrom(reservationHtml).getTime() &&
  //             location
  //               .replace("Super 7 ", "")
  //               .includes(reservationLocationFrom(reservationHtml))
  //           );
  //         })
  //         ?.querySelector<HTMLButtonElement>(".my_reg_foot_actions > button")
  //         ?.id,
  //     ) || undefined
  //   );
  // }

  async removeReservation(reservationId: string) {
    return await this.http.post(
      `/Reservation/RemoveReservation?aId=${reservationId}`,
    );
  }

  async removeWaitlist(reservationId: string) {
    return await this.http.post(
      `/Reservation/RemoveWaitlist?aId=${reservationId}`,
    );
  }

  private headerConfig(): AxiosRequestConfig {
    const maybeXsrfToken = this.cookieJar
      .getCookiesSync(SUPER7_BASE_URL)
      .find(({ key }) => key === "XSRF-TOKEN")?.value;

    if (!maybeXsrfToken) {
      return {};
    }
    return {
      headers: {
        "X-Xsrf-Token": maybeXsrfToken,
      },
    };
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

const titleToEventName = (title?: string) => {
  const [reserveLijstText, titleText] = cleanTitle(title).split(":");
  return titleText || reserveLijstText;
};

const getReservationStatus = (title?: string): EventStatus =>
  cleanTitle(title).split(":").at(0)?.includes("Waitlist") ? "⏳" : "✅";

const cleanTitle = (title?: string) =>
  title?.replaceAll("\n", "").replaceAll(" ", "") || "";

const reservationTitleFrom = (reservationHtml: HTMLDivElement) =>
  reservationHtml.querySelector(".pay_box_head > strong")?.innerHTML.trim() ||
  "";

const reservationDateFrom = (reservationHtml: HTMLDivElement) => {
  const [_, date, time] = reservationHtml
    .querySelector(".fa-calendar ~ span")
    ?.innerHTML.trim()
    .split(" ") as [string, string, string];
  return new Date(`${date.split("/").reverse().join("-")} ${time}`);
};

// TODO: get from class `round-location`
const reservationLocationFrom = (
  reservationHtml: HTMLDivElement,
): "Leuven" | "Aarschot" =>
  reservationHtml
    .querySelector(".fa-location-arrow ~ span")
    ?.innerHTML.includes("Leuven")
    ? "Leuven"
    : "Aarschot";

const panelTitleFrom = (eventHtml: HTMLDivElement) =>
  eventHtml
    .querySelector<HTMLDivElement>(".calendaritem-panel-title")!
    .innerHTML.trim()
    .split("<span")[0]
    .trim()
    .split(" ")
    .map((v) => v.replace("[", "").replace("]", "").trim()) as [string, string];

const dateToTime = (date: DateTime) => date.toFormat("H:mm");

const daysFromToday = (date: DateTime) => {
  const [todayOnlyDate, untilDateOnlyDate] = [
    new Date(),
    new Date(date.toMillis()),
  ].map((date) => {
    date.setMilliseconds(0);
    date.setSeconds(0);
    date.setMinutes(0);
    date.setHours(0);
    return date;
  });

  return Math.ceil(
    (untilDateOnlyDate.getTime() - todayOnlyDate.getTime()) /
      (1000 * 3600 * 24),
  );
};

const onlyNumbers = (input?: string) =>
  input?.replaceAll(/[^0-9.]/g, "") || undefined;
