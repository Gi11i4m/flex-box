import { Injectable } from '@nestjs/common';
import { Event, EventStatus } from './event.entity';

const SOURCE_EVENT_PREFIX = '💪 ';

@Injectable()
export class EventMatcherService {
  public sourceEvents: Event[] = [];
  public destinationEvents: Event[] = [];

  get eventsToBook(): Event[] {
    return this.sourceEvents
      .reduce((acc, gcalEvent) => {
        const matchedSuper7Event = this.destinationEvents.find(
          (super7Event) =>
            gcalEvent.title.includes(super7Event.title) &&
            gcalEvent.start.getTime() === super7Event.start.getTime(),
        );
        return matchedSuper7Event ? acc : [...acc, gcalEvent];
      }, [] as Event[])
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  get eventsToUpdate(): Event[] {
    return this.sourceEvents.reduce<Event[]>((acc, gcalEvent) => {
      const matchedSuper7Event = this.destinationEvents.find(
        (super7Event) =>
          gcalEvent.title.includes(super7Event.title) &&
          gcalEvent.start.getTime() === super7Event.start.getTime(),
      );

      if (matchedSuper7Event) {
        return !gcalEvent.title.includes(matchedSuper7Event.status)
          ? [
              ...acc,
              {
                ...gcalEvent,
                title: `${SOURCE_EVENT_PREFIX}${matchedSuper7Event.title} ${matchedSuper7Event.status}`,
              },
            ]
          : acc;
      }
      return Object.values(EventStatus).find((status) =>
        gcalEvent.title.endsWith(status),
      )
        ? [
            ...acc,
            {
              ...gcalEvent,
              title: this.stripStatusFrom(
                `${SOURCE_EVENT_PREFIX}${gcalEvent.title}`,
              ),
            },
          ]
        : acc;
    }, []);
  }

  get eventsToDelete(): Event[] {
    return this.destinationEvents.filter(
      (super7Event) =>
        !this.sourceEvents.find(
          (gcalEvent) =>
            gcalEvent.title.includes(super7Event.title) &&
            gcalEvent.start.getTime() === super7Event.start.getTime(),
        ),
    );
  }

  private stripStatusFrom(title: string) {
    return Object.values(EventStatus).reduce(
      (acc, status) => acc.replace(` ${status}`, ''),
      title,
    );
  }
}
