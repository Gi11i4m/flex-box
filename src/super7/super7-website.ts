import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { JSDOM } from 'jsdom';
import { CookieJar } from 'tough-cookie';
import { Super7Event } from './model';

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
    return (await this.reservationsHtml()).map(el => {
      const htmlTitle = reservationTitleFrom(el);
      return {
        title: titleToEventName(htmlTitle),
        location: reservationLocationFrom(el),
        start: reservationDateFrom(el),
        status: getReservationStatus(htmlTitle),
      };
    });
  }

  private async reservationsHtml(): Promise<HTMLDivElement[]> {
    const { data } = await this.http.get('/Reservation/Reservations');
    return Array.from(
      domFrom(data).querySelectorAll<HTMLDivElement>('.my_reg_item')
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
    calendarFormData.append('aDays', String(daysFromToday(start) - 1));
    calendarFormData.append('aRoomIds[]', '2');
    const { data } = await this.http.post(
      `/Reservation/CalendarItems`,
      calendarFormData
    );
    const dom = domFrom(data, true);
    return Array.from(dom.querySelectorAll<HTMLDivElement>('.webshop-panel'))
      .find(el => {
        const [panelTitle, panelTime] = panelTitleFrom(el);
        return title === panelTitle && dateToTime(start) === panelTime;
      })
      ?.id.replace('calitem_', '');
  }

  async makeReservation(eventId: string): Promise<void> {
    await this.http.post(`/Reservation/AddReservation`, { aId: eventId });
  }

  async reservationIdFor({
    title,
    start,
    location,
  }: Pick<Super7Event, 'title' | 'start' | 'location'>): Promise<
    string | undefined
  > {
    return (await this.reservationsHtml())
      .find(
        reservationHtml =>
          title.includes(reservationTitleFrom(reservationHtml)) &&
          start.getTime() === reservationDateFrom(reservationHtml).getTime() &&
          location
            .replace('Super 7 ', '')
            .includes(reservationLocationFrom(reservationHtml))
      )
      ?.querySelector<HTMLButtonElement>('.my_reg_foot_actions > button')
      ?.id.replace('reservation_', '');
  }

  async removeReservation(reservationId: string): Promise<void> {
    await this.http.post(`/Reservation/RemoveReservation?aId=${reservationId}`);
  }
}

const domFrom = (data: string, scripts = false) =>
  new JSDOM(data, { runScripts: scripts ? undefined : 'dangerously' }).window
    .document;

const titleToEventName = (title?: string) => {
  const [reserveLijstText, titleText] = cleanTitle(title).split(':');
  return titleText || reserveLijstText;
};

const getReservationStatus = (title?: string) =>
  cleanTitle(title).split(':').at(0)?.includes('Waitlist') ? '⏳' : '✅';

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

const reservationLocationFrom = (reservationHtml: HTMLDivElement) =>
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

const dateToTime = (date: Date) => date.toLocaleTimeString().substring(0, 5);

const daysFromToday = (date: Date) =>
  Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
