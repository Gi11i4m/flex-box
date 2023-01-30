import { Gapi } from './gapi/gapi';
import { EventMatcher } from './shared/event-matcher';
import { logEvents } from './shared/logger';
import { gcalEventToSuper7Event } from './shared/mapper';
import { Super7 } from './super7/super7';

require('dotenv').config();

/**
 * Possible improvements:
 * - Map Gcal titles to statusses
 * - If Gcal event is not matched on Super7, add a third ❌ status
 */

const gapi = new Gapi();
const super7 = new Super7();

Promise.all([
  gapi.authenticate().then(gapi => gapi.getCrossfitEvents()),
  super7.authenticate().then(super7 => super7.getReservations()),
]).then(async ([gcalEvents, super7Events]) => {
  logEvents(gcalEvents, super7Events);

  const matcher = new EventMatcher(gcalEvents, super7Events);

  await Promise.all(
    matcher.eventsToDelete.map(event => super7.deleteReservation(event))
  );

  await matcher.eventsToBook.reduce(
    (promise, eventToBook) =>
      promise.then(() => super7.bookEvent(gcalEventToSuper7Event(eventToBook))),
    Promise.resolve()
  );

  // Only fetch events to update after booking & deleting
  matcher.super7Events = await super7.getReservations();
  await Promise.all(
    matcher.eventsToUpdate.map(ev => gapi.updateEventTitle(ev))
  );
});
