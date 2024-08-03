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
import { Database } from "./db/database";
import chalk from "chalk";

require("dotenv").config({ path: ".env.ariane" });
require("dotenv").config({ path: ".env" });

const database = new Database();
const gapi = new Gapi(database);
const super7 = new Super7();

Promise.all([
  gapi.authenticate().then((gapi) => gapi.getCrossfitEvents()),
  super7.authenticate().then((super7) => super7.getReservations()),
]).then(async ([gcalEvents, super7Events]) => {
  console.log(chalk.bold`Found ${gcalEvents.length} Gcal events:`);
  logEvents(gcalEvents, { newline: true });
  console.log(chalk.bold`Found ${super7Events.length} Super7 events:`);
  logEvents(super7Events, { newline: true });

  const eventMatcher = new EventMatcher(gcalEvents, super7Events);

  console.log(
    chalk.bold`\n🗑️ Deleting ${eventMatcher.eventsToDelete.length} events`,
  );
  logEvents(eventMatcher.eventsToDelete);
  for (let event of eventMatcher.eventsToDelete) {
    await super7.deleteReservation(event);
  }

  console.log(
    chalk.bold`\n🎟️ Booking ${eventMatcher.eventsToBook.length} events`,
  );
  logEvents(eventMatcher.eventsToBook);
  for (let event of eventMatcher.eventsToBook) {
    await super7.bookEvent(gcalEventToSuper7Event(event));
  }

  clear([SUPER7_WEBSITE_MEMOIZE_TAG, EVENT_MATCHER_MEMOIZE_TAG]);
  eventMatcher.super7Events = await super7.getReservations();
  console.log(
    chalk.bold`\n✏️ Updating ${eventMatcher.eventsToUpdate.length} events`,
  );
  logEvents(eventMatcher.eventsToUpdate);
  for (let event of eventMatcher.eventsToUpdate) {
    await gapi.updateEventTitle(event);
  }
});
