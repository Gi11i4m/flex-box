import { CROSSFIT_EVENT_PREFIX } from '../gapi/gapi';
import { GcalEvent } from '../gapi/model';
import { Super7Event, Super7EventStatus } from '../super7/model';
import { stripStatusFrom } from './mapper';

export class EventMatcher {
  constructor(
    public gcalEvents: GcalEvent[],
    public super7Events: Super7Event[]
  ) {}

  get eventsToBook(): GcalEvent[] {
    return this.gcalEvents
      .reduce((acc, gcalEvent) => {
        const matchedSuper7Event = this.super7Events.find(
          super7Event =>
            gcalEvent.title.includes(super7Event.title) &&
            gcalEvent.start.getTime() === super7Event.start.getTime()
        );
        return matchedSuper7Event ? acc : [...acc, gcalEvent];
      }, [] as GcalEvent[])
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  get eventsToUpdate(): GcalEvent[] {
    return this.gcalEvents.reduce((acc, gcalEvent) => {
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
      return Object.values(Super7EventStatus).find(status =>
        gcalEvent.title.includes(status)
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
    }, [] as GcalEvent[]);
  }

  get eventsToDelete(): Super7Event[] {
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
