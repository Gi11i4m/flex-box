import { GcalEvent } from '../gapi/model';
import { Super7Event } from '../super7/model';

export class EventMatcher {
  constructor(
    private readonly gcalEvents: GcalEvent[],
    private readonly super7Events: Super7Event[]
  ) {}

  /** @returns a triple with events [toBook, toUpdate, toDelete] */
  match(): [GcalEvent[], GcalEvent[], Super7Event[]] {
    const [eventsToBook, eventsToUpdate] = this.gcalEvents.reduce(
      ([toBook, toUpdate], gcalEvent) => {
        const matchedSuper7Event = this.super7Events.find(
          super7Event =>
            gcalEvent.title.includes(super7Event.title) &&
            gcalEvent.start.getTime() === super7Event.start.getTime()
        );

        if (matchedSuper7Event) {
          return gcalEvent.title.includes(matchedSuper7Event.status)
            ? [toBook, toUpdate]
            : [
                toBook,
                [
                  ...toUpdate,
                  {
                    ...gcalEvent,
                    title: `💪 ${matchedSuper7Event.title} ${matchedSuper7Event.status}`,
                  },
                ],
              ];
        }
        return [[...toBook, gcalEvent], toUpdate];
      },
      [[], []] as [GcalEvent[], GcalEvent[]]
    );
    const eventsToDelete = this.super7Events.filter(
      super7Event =>
        !this.gcalEvents.find(
          gcalEvent =>
            gcalEvent.title.includes(super7Event.title) &&
            gcalEvent.start.getTime() === super7Event.start.getTime()
        )
    );
    console.table({
      book: eventsToBook.length,
      update: eventsToUpdate.length,
      delete: eventsToDelete.length,
    });
    return [eventsToBook, eventsToUpdate, eventsToDelete];
  }
}
