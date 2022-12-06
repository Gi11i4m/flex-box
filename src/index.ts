import { CROSSFIT_EVENT_PREFIX, Gapi } from './gapi/gapi';
import { EventMatcher } from './shared/event-matcher';
import { gcalEventToSuper7Event } from './shared/mapper';
import { Super7 } from './super7/super7';

require('dotenv').config();

const gapi = new Gapi();
const super7 = new Super7();

Promise.all([
  gapi.authenticate().then(gapi => gapi.getCrossfitEvents()),
  super7.authenticate().then(super7 => super7.getReservations()),
]).then(([calendarEvents, super7Events]) => {
  const [toBook, toUpdate, toDelete] = new EventMatcher(
    calendarEvents,
    super7Events
  ).match();

  return Promise.all([
    ...toUpdate.map(({ id: eventId, title }) =>
      gapi.updateEventTitle(eventId, title).catch(console.error)
    ),
    // TODO: make sure these are booked in order from soonest to latest
    ...toBook.map(event =>
      super7
        .bookEvent(gcalEventToSuper7Event(event))
        // TODO: refactor
        .then(() =>
          gapi.updateEventTitle(
            event.id,
            `${CROSSFIT_EVENT_PREFIX}${event.title} ${
              gcalEventToSuper7Event(event).status
            }`
          )
        )
        .catch(console.error)
    ),
    ...toDelete.map(event =>
      super7.deleteReservation(event).catch(console.error)
    ),
  ]);
});
