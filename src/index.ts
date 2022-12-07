import { Gapi } from './gapi/gapi';
import { EventMatcher } from './shared/event-matcher';
import { gcalEventToSuper7Event } from './shared/mapper';
import { Super7 } from './super7/super7';

require('dotenv').config();

const gapi = new Gapi();
const super7 = new Super7();

Promise.all([
  gapi.authenticate().then(gapi => gapi.getCrossfitEvents()),
  super7.authenticate().then(super7 => super7.getReservations()),
]).then(async ([calendarEvents, super7Events]) => {
  console.log('Found Gcal events:');
  calendarEvents.forEach(({ title, start, location }) =>
    console.log(`${title} @ ${location}: ${start.toLocaleDateString()}`)
  );
  console.log('Found Super7 reservations:');
  super7Events.forEach(({ title, start, location, status }) =>
    console.log(
      `${title} @ ${location}: ${start.toLocaleDateString()} (${status})`
    )
  );

  const matcher = new EventMatcher(calendarEvents, super7Events);

  await matcher.eventsToBook.reduce(
    (promise, eventToBook) =>
      promise.then(() => super7.bookEvent(gcalEventToSuper7Event(eventToBook))),
    Promise.resolve()
  );

  await Promise.all(
    matcher.eventsToDelete.map(event => super7.deleteReservation(event))
  );

  // Only fetch events to update after booking & deleting
  matcher.super7Events = await super7.getReservations();
  await Promise.all(
    matcher.eventsToUpdate.map(ev =>
      gapi.updateEventTitle(ev).catch(console.error)
    )
  );
});
