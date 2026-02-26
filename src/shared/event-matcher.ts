import { Event } from "./event";
import { Memoize } from "typescript-memoize";

export const EVENT_MATCHER_MEMOIZE_TAG = "event_matcher_website_memoize";

export class EventMatcher {
  constructor(
    public gcalEvents: Event[],
    public super7Events: Event[],
  ) {}

  @Memoize({ tags: [EVENT_MATCHER_MEMOIZE_TAG] })
  get eventsToBook(): Event[] {
    return this.gcalEvents
      .reduce((acc, gcalEvent) => {
        const matchedSuper7Event = this.super7Events.find((super7Event) =>
          this.matches(super7Event, gcalEvent),
        );
        return matchedSuper7Event ? acc : [...acc, gcalEvent];
      }, [] as Event[])
      .sort((a, b) => a.start.toMillis() - b.start.toMillis());
  }

  @Memoize({ tags: [EVENT_MATCHER_MEMOIZE_TAG] })
  get eventsToUpdate(): Event[] {
    return this.gcalEvents.reduce<Event[]>((acc, gcalEvent) => {
      const matchedSuper7Event = this.super7Events.find((super7Event) =>
        this.matches(super7Event, gcalEvent),
      );
      if (this.equals(matchedSuper7Event, gcalEvent)) {
        return acc;
      }
      return matchedSuper7Event
        ? [...acc, { ...matchedSuper7Event, id: gcalEvent.id }]
        : [...acc, { ...gcalEvent, status: "❌" }];
    }, []);
  }

  @Memoize({ tags: [EVENT_MATCHER_MEMOIZE_TAG] })
  get eventsToDelete(): Event[] {
    return this.super7Events.filter(
      (super7Event) =>
        !this.gcalEvents.find((gcalEvent) =>
          this.matches(super7Event, gcalEvent),
        ),
    );
  }

  private matches(event1: Event, event2: Event) {
    return event1.start.toMillis() === event2.start.toMillis();
  }

  private equals(event1?: Event, event2?: Event) {
    if (!event1 || !event2) {
      return false;
    }
    return (
      event1.title === event2.title &&
      event1.start.toMillis() === event2.start.toMillis() &&
      event1.status === event2.status
    );
  }
}
