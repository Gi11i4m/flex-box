import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { JSDOM } from "jsdom";
import { CookieJar } from "tough-cookie";
import { Event, EventStatus } from "../shared/event";
import { NOW } from "../shared/date";

const SUPER7_LOCATIE_ID = 4;
const SUPER7_CROSSFIT_ROOSTER_ID = 4;

export class Super7Website {
  private http: AxiosInstance;

  constructor() {
    const jar = new CookieJar();
    this.http = wrapper(
      axios.create({
        withCredentials: true,
        baseURL: "https://crossfitsuper7.sportbitapp.nl/cbm/api/data",
        jar,
      }),
    );
  }

  async authenticate() {
    await this.http.post(
      "/inloggen",
      {
        username: process.env.SUPER7_LOGIN!,
        password: process.env.SUPER7_PASS!,
      },
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    return this;
  }

  async reservations(): Promise<Event[]> {
    const reservationLinks = await this.reservationsHtml();
    console.log("== RESERVATIONS ==");
    console.log(reservationLinks.toString());
    return [];
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

  private async reservationsHtml(): Promise<HTMLDivElement[]> {
    const reservationLinksForThreeWeeks = await Promise.all([
      this.getReservationLinksForWeek(NOW.getWeek()),
      this.getReservationLinksForWeek(NOW.getWeek() + 1),
      this.getReservationLinksForWeek(NOW.getWeek() + 2),
    ]);
    return reservationLinksForThreeWeeks.flat();
  }

  private async getReservationLinksForWeek(weekNr: number) {
    const { data } = await this.http.post("/calendar.ajax.php", {
      year: NOW.getFullYear(),
      weekNr,
      locatie: SUPER7_LOCATIE_ID,
    });
    console.log(data);
    // TODO: support the multi-workout <span>
    return Array.from(
      new JSDOM(data).window.document.querySelectorAll<HTMLDivElement>(
        "#calendar-content a[data-date].selected",
      ),
    );
  }

  async eventIdFor({
    title,
    start,
    location,
  }: Pick<Event, "title" | "start" | "location">): Promise<string | undefined> {
    const calendarFormData = new URLSearchParams();
    calendarFormData.append("Id", location === "Leuven" ? "2" : "1");
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

  async reservationIdFor({
    title,
    start,
    location,
  }: Pick<Event, "title" | "start" | "location">): Promise<string | undefined> {
    console.log(
      `Finding reservation id for ${title} @${location}: ${start.toLocaleString()}`,
    );
    return (
      onlyNumbers(
        (await this.reservationsHtml())
          .find((reservationHtml) => {
            return (
              reservationTitleFrom(reservationHtml).includes(title) &&
              start.getTime() ===
                reservationDateFrom(reservationHtml).getTime() &&
              location
                .replace("Super 7 ", "")
                .includes(reservationLocationFrom(reservationHtml))
            );
          })
          ?.querySelector<HTMLButtonElement>(".my_reg_foot_actions > button")
          ?.id,
      ) || undefined
    );
  }

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
}

const titleToEventName = (title?: string) => {
  const [reserveLijstText, titleText] = cleanTitle(title).split(":");
  return titleText || reserveLijstText;
};

const getReservationStatus = (title?: string) =>
  cleanTitle(title).split(":").at(0)?.includes("Waitlist")
    ? EventStatus.WAITLIST
    : EventStatus.RESERVED;

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

const dateToTime = (date: Date) =>
  `${String(date.getHours())}:${String(date.getMinutes()).padStart(2, "0")}`;

const daysFromToday = (date: Date) => {
  const [todayOnlyDate, untilDateOnlyDate] = [
    new Date(),
    new Date(date.getTime()),
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
