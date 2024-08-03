import { Gapi } from "./gapi/gapi";
import {
  EVENT_MATCHER_MEMOIZE_TAG,
  EventMatcher,
} from "./shared/event-matcher";
import { logEvents } from "./shared/logger";
import { gcalEventToSuper7Event } from "./shared/mapper";
import { Super7 } from "./super7/super7";
import { clear } from "typescript-memoize";
import { SUPER7_WEBSITE_MEMOIZE_TAG } from "./super7/super7-website";

require("dotenv").config();

/**
 * Possible improvements:
 * - Map Gcal titles to statusses
 * - If Gcal event is not matched on Super7, add a third ❌ status
 */

const gapi = new Gapi();
const super7 = new Super7();

Promise.all([
  gapi.authenticate().then((gapi) => gapi.getCrossfitEvents()),
  super7.authenticate().then((super7) => super7.getReservations()),
]).then(async ([gcalEvents, super7Events]) => {
  console.log(`Found ${gcalEvents.length} Gcal events:`);
  logEvents(gcalEvents, { newline: true });
  console.log(`Found ${super7Events.length} Super7 events:`);
  logEvents(super7Events, { newline: true });

  const eventMatcher = new EventMatcher(gcalEvents, super7Events);

  console.log(`\n🗑️ Deleting ${eventMatcher.eventsToDelete.length} events`);
  logEvents(eventMatcher.eventsToDelete);
  for (let event of eventMatcher.eventsToDelete) {
    await super7.deleteReservation(event);
  }

  console.log(`\n🎟️ Booking ${eventMatcher.eventsToBook.length} events`);
  logEvents(eventMatcher.eventsToBook);
  for (let event of eventMatcher.eventsToBook) {
    await super7.bookEvent(gcalEventToSuper7Event(event));
  }

  clear([SUPER7_WEBSITE_MEMOIZE_TAG, EVENT_MATCHER_MEMOIZE_TAG]);
  eventMatcher.super7Events = await super7.getReservations();
  console.log(`\n✏️ Updating ${eventMatcher.eventsToUpdate.length} events`);
  logEvents(eventMatcher.eventsToUpdate);
  for (let event of eventMatcher.eventsToUpdate) {
    await gapi.updateEventTitle(event);
  }
});
