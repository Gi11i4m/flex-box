import axios, { AxiosInstance } from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { Event } from "../shared/event";
import { NOW } from "../shared/date";
import { DateTime } from "luxon";
import { Memoize } from "typescript-memoize";
import { env, envNumber } from "../shared/env";
import { GraphQLClient, gql } from "graphql-request";

export const SUPER7_WEBSITE_MEMOIZE_TAG = "super7_website_memoize";
const PUSH_PRESS_BASE_URL = "https://api.pushpress.com/v2";

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
    const { data } = await this.http.post<PushPressLoginInfo>("/auth/login", {
      username: env("SUPER7_LOGIN"),
      password: env("SUPER7_PASS"),
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
          ...PushPressReservationFragment
          calendarItem {
            calendarItemType {
              name
            }
            location {
              name
              link
            }
            mainCoach {
              ...PushPressProfileFragment
            }
          }
        }
      }

      ${PushPressProfileFragment}
      ${PushPressReservationFragment}
    `);
    return reservations
      .map<Event>((r) => ({
        id: String(r.uuid),
        title: r.reservationTitle.trim(),
        start: DateTime.fromISO(r.rawStartTime)
          .toUTC()
          .setZone("Europe/Brussels", {
            keepLocalTime: true,
          }),
        status: r.waitlisted ? "⏳" : "✅",
      }))
      .filter((event) => NOW < event.start);
  }

  // TODO: filter out Aarschot events
  @Memoize({ tags: [SUPER7_WEBSITE_MEMOIZE_TAG] })
  private async getClasses(): Promise<PushPressClass[]> {
    const graphql = this.graphQlClient;
    const { classes } = await graphql.request<{ classes: PushPressClass[] }>(
      gql`
        query GetClasses($classStartDate: Date!, $classEndDate: Date!) {
          classes: getCalendarItems(
            getCalendarItemsInput: {
              startDate: $classStartDate
              endDate: $classEndDate
              calendarSessionTypeId: 2
            }
          ) {
            ...PushPressClassFragment
            mainCoach {
              ...PushPressProfileFragment
            }
          }
        }

        ${PushPressClassFragment}
        ${PushPressProfileFragment}
      `,
      {
        classStartDate: NOW.toJSDate(),
        classEndDate: NOW.plus({
          weeks: envNumber("NUMBER_OF_WEEKS_TO_RESERVE"),
        }).toJSDate(),
      },
    );
    return classes
      .filter((c) => c.startTime && c.endTime)
      .map(
        ({ startTime, endTime, ...rest }) =>
          ({
            ...rest,
            startTime: DateTime.fromISO(startTime!)
                .toUTC()
                .setZone("Europe/Brussels", { keepLocalTime: true })
                .toISO(),
            endTime: DateTime.fromISO(endTime!)
                .toUTC()
                .setZone("Europe/Brussels", { keepLocalTime: true })
                .toISO(),
          }) as PushPressClass,
      );
  }

  // TODO: filter out Aarschot events
  @Memoize({
    tags: [SUPER7_WEBSITE_MEMOIZE_TAG],
    hashFunction: (args: DateTime) => args.toISODate(),
  })
  private async getClassesForDay(date: DateTime): Promise<PushPressClass[]> {
    const classes = await this.getClasses();
    return classes.filter(
      (c) => DateTime.fromISO(c.startTime).diff(date).days < 1,
    );
  }

  async eventIdFor(event: Event): Promise<string | undefined> {
    const eventsForMatchingDay = await this.getClassesForDay(event.start);
    const maybeMatchedEvent = eventsForMatchingDay.find((e) =>
      DateTime.fromISO(e.startTime).equals(event.start),
    );
    return maybeMatchedEvent ? String(maybeMatchedEvent.uuid) : undefined;
  }

  @Memoize({ tags: [SUPER7_WEBSITE_MEMOIZE_TAG] })
  private async getProfile(): Promise<PushPressProfileDetails> {
    const graphql = this.graphQlClient;
    const loginInfo = this.graphql?.loginInfo;
    const client = loginInfo?.clients[0];
    if (!client) throw Error("The PushPress client profile is not available");

    const { profile } = await graphql.request<{
      profile: PushPressProfileDetails;
    }>(
      gql`
        query GetProfiles($clientUuid: String!, $userUuid: String!) {
          profile: getProfile(
            getProfileInput: { clientUuid: $clientUuid, userUuid: $userUuid }
          ) {
            ...ProfileFragment
            linkedAccounts {
              ...ProfileFragment
              __typename
            }
            __typename
          }
          __typename
        }

        ${PushPressProfileDetailsFragment}
      `,
      {
        clientUuid: client.clientUuid,
        userUuid: client.userUuid,
      },
    );

    return profile;
  }

  async makeReservation(eventId: string) {
    const graphql = this.graphQlClient;
    const subscription = await this.getSubscription();
    const profile = await this.getProfile();
    try {
      await graphql.request<void>(
        gql`
          mutation CreateReservation(
            $clientUserUuid: String!
            $calendarItemUuid: String!
            $subscriptionUuid: String!
            $source: String
          ) {
            createReservation(
              createReservationInput: {
                clientUserUuid: $clientUserUuid
                calendarItemUuid: $calendarItemUuid
                subscriptionUuid: $subscriptionUuid
                source: $source
              }
            ) {
              uuid
            }
          }
        `,
        {
          clientUserUuid: profile.clientUserUuid,
          calendarItemUuid: eventId,
          subscriptionUuid: subscription.subscriptionUuid,
          source: "member_app_web",
        },
      );
    } catch (error) {
      console.info("Joining waitlist.", error);
      await graphql.request<void>(
        gql`
          mutation JoinWaitlist(
            $clientUserUuid: String!
            $calendarItemUuid: String!
            $subscriptionUuid: String!
            $waitlistExpirationMins: Float!
          ) {
            joinWaitlist(
              joinWaitlistInput: {
                clientUserUuid: $clientUserUuid
                calendarItemUuid: $calendarItemUuid
                subscriptionUuid: $subscriptionUuid
                waitlistExpirationMins: $waitlistExpirationMins
              }
            ) {
              uuid
              __typename
            }
            __typename
          }
        `,
        {
          clientUserUuid: profile.clientUserUuid,
          calendarItemUuid: eventId,
          subscriptionUuid: subscription.subscriptionUuid,
          waitlistExpirationMins: 60,
        },
      );
    }
  }

  private async getSubscription(): Promise<PushPressSubscription> {
    const profile = await this.getProfile();
    const activeSubscriptions = profile.subscriptions.filter(
      (subscription) =>
        subscription.active &&
        subscription.status === "active" &&
        subscription.planObject.name !== "Insurance",
    );
    if (!activeSubscriptions.length) {
      throw Error("No active PushPress subscription available");
    }

    const usableSubscription = activeSubscriptions.find((subscription) => {
      const { available } = subscription.currentPeriodUsage;
      return available > 0 || available === -1;
    });
    if (usableSubscription) return usableSubscription;

    const now = NOW.startOf("day");
    const dateFiltered = activeSubscriptions.filter((subscription) => {
      if (!subscription.endDate) return true;
      const endDate = DateTime.fromISO(subscription.endDate).startOf("day");
      return endDate >= now;
    });

    return dateFiltered[0] ?? activeSubscriptions[0];
  }

  async removeReservation(event: Event) {
    const graphql = this.graphQlClient;
    try {
      const cancelReservation = graphql.request<void>(
        gql`
          mutation CancelReservation($reservationId: String!) {
            cancelReservation(
              cancelReservationInput: { reservationId: $reservationId }
            ) {
              uuid
            }
          }
        `,
        { reservationId: event.id },
      );
      const removeFromWaitlist = graphql.request<void>(
        gql`
          mutation RemoveFromWaitlist($reservationId: String!) {
            removeFromWaitlist(
              removeFromWaitlistInput: { reservationId: $reservationId }
            ) {
              uuid
            }
          }
        `,
        { reservationId: event.id },
      );
      await Promise.all([cancelReservation, removeFromWaitlist]);
    } catch (e) {
      console.error(e);
    }
  }

  private get graphQlClient(): GraphQLClient {
    if (!this.graphql) throw Error("The GraphQL client is not initialized yet");
    return this.graphql.client;
  }
}

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

type PushPressClass = {
  uuid: string;
  title: string;
  attendanceCap: number | null;
  classType: string;
  spotsAvailable: number;
  isAllDay: boolean;
  registrationStartOffset: number | null;
  registrationEndOffset: number | null;
  startTime: string;
  endTime: string;
  location: {
    name: string;
  };
  mainCoach?: PushPressProfile;
};
const PushPressClassFragment = gql`
  fragment PushPressClassFragment on Class {
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
  }
`;

type PushPressReservation = {
  id: string;
  uuid: string;
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
    mainCoach?: PushPressProfile;
  };
};
const PushPressReservationFragment = gql`
  fragment PushPressReservationFragment on Registration {
    id
    uuid
    reservationTitle
    calendarItemUuid
    isActive
    lateCancel
    waitlisted
    rawStartTime: reservationStart
    rawEndTime: reservationEnd
    rawStatus: status
  }
`;

type PushPressProfile = {
  firstName: string;
  lastName: string;
  primaryImage: string;
};
const PushPressProfileFragment = gql`
  fragment PushPressProfileFragment on Profile {
    userUuid
    firstName
    lastName
    gender
    primaryImage
  }
`;

type PushPressProfileMembershipStatus = {
  code: string;
  __typename: "ProfileMembershipStatus";
};

type PushPressCurrentPeriodUsage = {
  limit: number;
  period: string;
  periodStart: string;
  periodEnd: string;
  checkins: number;
  reservations: number;
  lateCancels: number;
  waitlists: number;
  noShows: number;
  available: number;
  __typename: "CurrentPeriodUsage";
};

type PushPressSubscriptionPlanCalendarItemType = {
  uuid: string;
  __typename: "SubscriptionPlanCalendarItemType";
};

type PushPressSubscriptionPlanObject = {
  uuid: string;
  name: string;
  allowCheckins: boolean;
  acceptedTypeUuids: PushPressSubscriptionPlanCalendarItemType[];
  type: string;
  interval: number;
  intervalType: string;
  __typename: "SubscriptionPlanSimple";
};

type PushPressSubscription = {
  subscriptionUuid: string;
  status: string;
  active: boolean;
  startDate: string;
  endDate: string;
  totalOccurrences: number;
  plan: string;
  currentPeriodUsage: PushPressCurrentPeriodUsage;
  planObject: PushPressSubscriptionPlanObject;
  __typename: "Subscription";
};

type PushPressProfileDetails = {
  clientUserUuid: string;
  email: string;
  username: string;
  clientUuid: string;
  userUuid: string;
  parentUserId: number;
  firstName: string;
  lastName: string;
  birthday: string;
  gender: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  emergencyName: string;
  emergencyPhone: string | null;
  emergencyRelationship: string;
  primaryImage: string;
  activateTimestamp: number;
  membershipStatus: PushPressProfileMembershipStatus;
  subscriptions: PushPressSubscription[];
  linkedAccounts: PushPressProfileDetails[];
  __typename: "Profile";
};

const PushPressProfileDetailsFragment = gql`
  fragment ProfileFragment on Profile {
    clientUserUuid
    email
    username
    clientUuid
    userUuid
    parentUserId
    firstName
    lastName
    birthday
    gender
    phone
    address1
    address2
    city
    state
    postalCode
    country
    emergencyName
    emergencyPhone
    emergencyRelationship
    primaryImage
    activateTimestamp
    membershipStatus {
      code
      __typename
    }
    subscriptions {
      subscriptionUuid
      status
      active
      startDate
      endDate
      totalOccurrences
      plan
      currentPeriodUsage {
        limit
        period
        periodStart
        periodEnd
        checkins
        reservations
        lateCancels
        waitlists
        noShows
        available
        __typename
      }
      planObject {
        uuid
        name
        allowCheckins
        acceptedTypeUuids: planCalendarItemTypes {
          uuid: calenderItemTypeUuid
          __typename
        }
        type
        interval
        intervalType
        __typename
      }
      __typename
    }
    __typename
  }
`;
