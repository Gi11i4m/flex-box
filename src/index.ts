import { Gapi } from './gapi/gapi.ts';
import {
  EVENT_MATCHER_MEMOIZE_TAG,
  EventMatcher,
} from './shared/event-matcher.ts';
import { logEvents } from './shared/logger.ts';
import { gcalEventToSuper7Event } from './shared/mapper.ts';
import { Event } from './shared/event.ts';
import { clear } from 'typescript-memoize';
import { Database } from './db/database.ts';
import chalk from 'chalk';
import { PushPress } from './pushpress/push-press.ts';
import { SUPER7_WEBSITE_MEMOIZE_TAG } from './pushpress/push-press-website.ts';

// TODO: only allow booking in Leuven
// TODO: running with Gilliam account ATM

const database = await Database.initialize();
const gapi = new Gapi(database);
const super7 = new PushPress();

Deno.cron('Sync Calendar Reservations', '*/5 * * * *', async () => {
  try {
    await runSyncJob();
  } catch (error) {
    console.error('Sync job failed', error);
  }
});

console.log(
  'Deno cron registered: Sync Calendar Reservations (every 5 minutes).',
);

export async function runSyncJob() {
  const [gcalEvents, super7Events] = await Promise.all([
    gapi.authenticate().then(gapi => gapi.getCrossfitEvents()),
    super7.authenticate().then(super7 => super7.getReservations()),
  ]);

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
  const failedEvents: Event[] = [];
  for (let event of eventMatcher.eventsToBook) {
    await super7.bookEvent(gcalEventToSuper7Event(event)).catch(e => {
      console.error(e);
      failedEvents.push(event);
    });
  }

  console.log(chalk.bold`\n⚠️ Failed to book ${failedEvents.length} events`);
  logEvents(failedEvents);

  clear([SUPER7_WEBSITE_MEMOIZE_TAG, EVENT_MATCHER_MEMOIZE_TAG]);
  eventMatcher.super7Events = await super7.getReservations();
  console.log(
    chalk.bold`\n✏️ Updating ${eventMatcher.eventsToUpdate.length} events`,
  );
  logEvents(eventMatcher.eventsToUpdate);
  for (let event of eventMatcher.eventsToUpdate) {
    await gapi.updateEventTitle(event);
  }
}
