import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { Event } from '../shared/event';
import { NOW } from '../shared/date';
import { DateTime } from 'luxon';
import { Memoize } from 'typescript-memoize';
import { env } from '../shared/env';
import { GraphQLClient, gql } from 'graphql-request';

export const SUPER7_WEBSITE_MEMOIZE_TAG = 'super7_website_memoize';
const PUSH_PRESS_BASE_URL = 'https://api.pushpress.com/v2';

type PushPressGraphQlRequirements = {
  loginInfo: PushPressLoginInfo;
  client: GraphQLClient;
};

export class PushPressWebsite {
  private graphql?: PushPressGraphQlRequirements;

  private readonly http: AxiosInstance;
  private readonly cookieJar: CookieJar;

  constructor() {
    this.cookieJar = new CookieJar();
    this.http = wrapper(
      axios.create({
        withCredentials: true,
        baseURL: PUSH_PRESS_BASE_URL,
        jar: this.cookieJar,
      }),
    );
  }

  async authenticate() {
    const { data } = await this.http.post<PushPressLoginInfo>('/auth/login', {
      username: env('SUPER7_LOGIN'),
      password: env('SUPER7_PASS'),
    });
    this.graphql = {
      loginInfo: data,
      client: new GraphQLClient(`${PUSH_PRESS_BASE_URL}/graph/graphql`, {
        headers: {
          authorization: `Bearer ${data.accessToken}`,
        },
      }),
    };
    return this;
  }

  /**
   * TODO: we could add a link to the event in PushPress using `https://members.pushpress.com/#/class/${calendarItemUuid}`
   * TODO: we could add the coach to the description of the event
   */
  async reservations(): Promise<Event[]> {
    const graphql = this.graphQlClient;
    const { reservations } = await graphql.request<{
      reservations: PushPressReservation[];
    }>(gql`
      query GetUpcomingReservations {
        reservations: getUpcomingReservations {
          id
          reservationTitle
          calendarItemUuid
          isActive
          lateCancel
          waitlisted
          rawStartTime: reservationStart
          rawEndTime: reservationEnd
          rawStatus: status
          calendarItem {
            calendarItemType {
              name
            }
            location {
              name
              link
            }
            mainCoach {
              firstName
              lastName
              primaryImage
            }
          }
        }
      }
    `);
    return reservations
      .map<Event>(r => ({
        id: String(r.id),
        title: r.reservationTitle.trim(),
        start: DateTime.fromISO(r.rawStartTime),
        status: r.waitlisted ? '⏳' : '✅',
      }))
      .filter(event => NOW < event.start);
  }

  @Memoize({ tags: [SUPER7_WEBSITE_MEMOIZE_TAG] })
  private async getEvents(): Promise<PushPressWebsiteEvent[]> {
    const graphql = this.graphQlClient;
    // TODO: get events for 2 weeks
    graphql.request(gql`
      query GetClasses($classStartDate: Date!, classEndDate: Date!) {
        classes: getCalendarItems(
          getCalendarItemsInput: {
            startDate: $classStartDate
            endDate: $classEndDate
            calendarSessionTypeId: 2
          }
        ) {
          uuid
          title
          attendanceCap
          classType: typeName
          spotsAvailable
          isAllDay
          registrationStartOffset
          registrationEndOffset
          startTime: startDatetime
          endTime: endDatetime
          location {
            name
          }
          mainCoach {
            ...ProfileFragment
          }
        }
      }

      ${ProfileFragment}
    `);
    console.log();
    process.exit();
  }

  @Memoize({
    tags: [SUPER7_WEBSITE_MEMOIZE_TAG],
    hashFunction: (args: DateTime) => args.toISODate(),
  })
  private async getEventsForDay(
    date: DateTime,
  ): Promise<PushPressWebsiteEvent[]> {
    const {
      data: { ochtend, middag, avond },
    } = await this.http.get(
      `/events/?datum=${date.toFormat('yyyy-MM-dd')}&rooster=${4}`,
    );
    return [...ochtend, ...middag, ...avond];
  }

  async eventIdFor(event: Event): Promise<string | undefined> {
    const eventsForMatchingDay = await this.getEventsForDay(event.start);
    const maybeMatchedEvent = eventsForMatchingDay.find(e =>
      DateTime.fromISO(e.start).equals(event.start),
    );
    return maybeMatchedEvent ? String(maybeMatchedEvent.id) : undefined;
  }

  async makeReservation(eventId: string) {
    return await this.http.post<void>(
      `/events/${eventId}/deelname/`,
      undefined,
    );
  }

  async removeReservation(eventId: string) {
    return await this.http.delete<void>(`/events/${eventId}/deelname/`);
  }

  private get graphQlClient(): GraphQLClient {
    if (!this.graphql) throw Error('The GraphQL client is not initialized yet');
    return this.graphql.client;
  }
}

/** @deprecated */
type PushPressWebsiteEvent = {
  id: number;
  start: string;
  eind: string;
  titel: string;
  trainer: { naam: string; telefoonnummer: string | null };
  ruimte: { naam: 'Hoofdruimte' };
  aantalDeelnemers: number;
  maxDeelnemers: number;
  type: { id: 1; hexkleur: string; naam: string };
  aangemeld: boolean;
  opWachtlijst: boolean;
  buddyAangemeld: boolean;
  meerdereTrainers: boolean;
};

type PushPressLoginInfo = {
  accessToken: string;
  clients: Array<{
    accessToken: string;
    active: boolean;
    clientId: number;
    clientUuid: string;
    company: string;
    email: string;
    firstName: string;
    lastName: string;
    logoUrl: string;
    marketingConsent: null;
    primaryImage: string;
    privacyConsent: null;
    profileUuid: string;
    refreshToken: string;
    role: string;
    subdomain: string;
    userUuid: string;
    username: string;
    features: {
      appointments: null;
      sso: boolean;
      churnReport: boolean;
      welcomeEmail: boolean;
      workSheet: boolean;
    };
  }>;
  profileUuid: string;
  refreshToken: string;
};

type PushPressReservation = {
  id: string;
  reservationTitle: string;
  calendarItemUuid: string;
  isActive: boolean;
  isCancelled: boolean;
  lateCancel: boolean;
  waitlisted: boolean;
  rawStartTime: string;
  rawEndTime: string;
  rawStatus: string;
  calendarItem: {
    calendarItemType: {
      name: string;
    };
    location: {
      name: string;
      link: string;
    };
    mainCoach?: Profile;
  };
};

type Profile = {
  firstName: string;
  lastName: string;
  primaryImage: string;
};
const ProfileFragment = gql`
  fragment ProfileFragment on Profile {
    userUuid
    firstName
    lastName
    gender
    primaryImage
  }
`;
