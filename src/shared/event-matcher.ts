import { CROSSFIT_EVENT_PREFIX } from '../gapi/gapi';
import { Event, EventStatus } from './event';
import { stripStatusFrom } from './mapper';

export class EventMatcher {
  constructor(public gcalEvents: Event[], public super7Events: Event[]) {}

  get eventsToBook(): Event[] {
    return this.gcalEvents
      .reduce((acc, gcalEvent) => {
        const matchedSuper7Event = this.super7Events.find(
          super7Event =>
            gcalEvent.title.includes(super7Event.title) &&
            gcalEvent.start.getTime() === super7Event.start.getTime()
        );
        return matchedSuper7Event ? acc : [...acc, gcalEvent];
      }, [] as Event[])
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  get eventsToUpdate(): Event[] {
    return this.gcalEvents.reduce<Event[]>((acc, gcalEvent) => {
      const matchedSuper7Event = this.super7Events.find(
        super7Event =>
          gcalEvent.title.includes(super7Event.title) &&
          gcalEvent.start.getTime() === super7Event.start.getTime()
      );

      if (matchedSuper7Event) {
        return !gcalEvent.title.includes(matchedSuper7Event.status)
          ? [
              ...acc,
              {
                ...gcalEvent,
                title: `${CROSSFIT_EVENT_PREFIX}${matchedSuper7Event.title} ${matchedSuper7Event.status}`,
              },
            ]
          : acc;
      }
      return Object.values(EventStatus).find(status =>
        gcalEvent.title.endsWith(status)
      )
        ? [
            ...acc,
            {
              ...gcalEvent,
              title: stripStatusFrom(
                `${CROSSFIT_EVENT_PREFIX}${gcalEvent.title}`
              ),
            },
          ]
        : acc;
    }, []);
  }

  get eventsToDelete(): Event[] {
    return this.super7Events.filter(
      super7Event =>
        !this.gcalEvents.find(
          gcalEvent =>
            gcalEvent.title.includes(super7Event.title) &&
            gcalEvent.start.getTime() === super7Event.start.getTime()
        )
    );
  }
}
