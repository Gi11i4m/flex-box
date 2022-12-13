import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { JSDOM } from 'jsdom';
import { CookieJar } from 'tough-cookie';
import { isAfter, NOW } from '../shared/date';
import { Super7Event, Super7EventStatus } from './model';

export class Super7Website {
  private http: AxiosInstance;

  constructor() {
    const jar = new CookieJar();
    this.http = wrapper(
      axios.create({
        withCredentials: true,
        baseURL: 'https://crossfitsuper7.clubplanner.be',
        jar,
      })
    );
  }

  async authenticate() {
    const loginFormData = new URLSearchParams();
    loginFormData.append('aId', process.env.SUPER7_LOGIN!);
    loginFormData.append('aPwd', process.env.SUPER7_PASS!);
    loginFormData.append('aRemember', '1');

    await this.http.post('/Account/CheckPwd', loginFormData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    await this.http.get('/Home/SetLanguage?lang_id=EN');
    return this;
  }

  async reservations(): Promise<Super7Event[]> {
    return (await this.reservationsHtml())
      .map(el => {
        const htmlTitle = reservationTitleFrom(el);
        return {
          title: titleToEventName(htmlTitle),
          location: reservationLocationFrom(el),
          start: reservationDateFrom(el),
          status: getReservationStatus(htmlTitle),
        };
      })
      .filter(({ start }) => isAfter(start, NOW));
  }

  private async reservationsHtml(): Promise<HTMLDivElement[]> {
    const { data } = await this.http.get('/Reservation/Reservations');
    return Array.from(
      new JSDOM(data).window.document.querySelectorAll<HTMLDivElement>(
        '.my_reg_item'
      )
    );
  }

  async eventIdFor({
    title,
    start,
    location,
  }: Pick<Super7Event, 'title' | 'start' | 'location'>): Promise<
    string | undefined
  > {
    const calendarFormData = new URLSearchParams();
    calendarFormData.append('Id', location === 'Leuven' ? '2' : '1');
    calendarFormData.append('aDays', String(daysFromToday(start)));
    calendarFormData.append('aRoomIds[]', '2');
    const { data } = await this.http.post(
      `/Reservation/CalendarItems`,
      calendarFormData
    );
    console.log(
      `Finding event id for ${title} @${location}: ${start.toLocaleString()}`
    );
    return onlyNumbers(
      Array.from(
        new JSDOM(data).window.document.querySelectorAll<HTMLDivElement>(
          '.webshop-panel'
        )
      ).find(el => {
        const [panelTitle, panelTime] = panelTitleFrom(el);
        console.log(panelTitle, panelTime);
        return (
          title.includes(panelTitle.trim()) && dateToTime(start) === panelTime
        );
      })?.id || 'EVENT ID NOT FOUND'
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
  }: Pick<Super7Event, 'title' | 'start' | 'location'>): Promise<
    string | undefined
  > {
    console.log(
      `Finding reservation id for ${title} @${location}: ${start.toLocaleString()}`
    );
    return (
      onlyNumbers(
        (await this.reservationsHtml())
          .find(reservationHtml => {
            return (
              reservationTitleFrom(reservationHtml).includes(title) &&
              start.getTime() ===
                reservationDateFrom(reservationHtml).getTime() &&
              location
                .replace('Super 7 ', '')
                .includes(reservationLocationFrom(reservationHtml))
            );
          })
          ?.querySelector<HTMLButtonElement>('.my_reg_foot_actions > button')
          ?.id
      ) || undefined
    );
  }

  async removeReservation(reservationId: string) {
    return await this.http.post(
      `/Reservation/RemoveReservation?aId=${reservationId}`
    );
  }

  async removeWaitlist(reservationId: string) {
    return await this.http.post(
      `/Reservation/RemoveWaitlist?aId=${reservationId}`
    );
  }
}

const titleToEventName = (title?: string) => {
  const [reserveLijstText, titleText] = cleanTitle(title).split(':');
  return titleText || reserveLijstText;
};

const getReservationStatus = (title?: string) =>
  cleanTitle(title).split(':').at(0)?.includes('Waitlist')
    ? Super7EventStatus.WAITLIST
    : Super7EventStatus.RESERVED;

const cleanTitle = (title?: string) =>
  title?.replaceAll('\n', '').replaceAll(' ', '') || '';

const reservationTitleFrom = (reservationHtml: HTMLDivElement) =>
  reservationHtml.querySelector('.pay_box_head > strong')?.innerHTML.trim() ||
  '';

const reservationDateFrom = (reservationHtml: HTMLDivElement) => {
  const [_, date, time] = reservationHtml
    .querySelector('.fa-calendar ~ span')
    ?.innerHTML.trim()
    .split(' ') as [string, string, string];
  return new Date(`${date.split('/').reverse().join('-')} ${time}`);
};

const reservationLocationFrom = (
  reservationHtml: HTMLDivElement
): 'Leuven' | 'Aarschot' =>
  reservationHtml
    .querySelector('.fa-location-arrow ~ span')
    ?.innerHTML.includes('Leuven')
    ? 'Leuven'
    : 'Aarschot';

const panelTitleFrom = (eventHtml: HTMLDivElement) =>
  eventHtml
    .querySelector<HTMLDivElement>('.calendaritem-panel-title')!
    .innerHTML.trim()
    .split('<span')[0]
    .trim()
    .split(' ')
    .map(v => v.replace('[', '').replace(']', '').trim()) as [string, string];

const dateToTime = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`;

const daysFromToday = (date: Date) => {
  const [todayOnlyDate, untilDateOnlyDate] = [
    new Date(),
    new Date(date.getTime()),
  ].map(date => {
    date.setMilliseconds(0);
    date.setSeconds(0);
    date.setMinutes(0);
    date.setHours(0);
    return date;
  });

  return Math.ceil(
    (untilDateOnlyDate.getTime() - todayOnlyDate.getTime()) / (1000 * 3600 * 24)
  );
};

const onlyNumbers = (input?: string) =>
  input?.replaceAll(/[^0-9.]/g, '') || undefined;
