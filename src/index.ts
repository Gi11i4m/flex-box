import { Gapi } from './gapi/gapi.ts';
import { handleOAuthCallbackRequest } from './gapi/oauth-callback.ts';
import {
  EVENT_MATCHER_MEMOIZE_TAG,
  EventMatcher,
} from './shared/event-matcher.ts';
import { envOptional } from './shared/env.ts';
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

const deploymentId = envOptional('DENO_DEPLOYMENT_ID') ?? 'local';
console.log(`[startup:${deploymentId}] Booting sync service...`);

let database: Database;
try {
  console.log(`[startup:${deploymentId}] Initializing database...`);
  database = await Database.initialize();
  console.log(`[startup:${deploymentId}] Database initialized.`);
} catch (error) {
  console.error(
    `[startup:${deploymentId}] Database initialization failed.`,
    error,
  );
  throw error;
}

const gapi = new Gapi(database);
const super7 = new PushPress();
const cronName = 'Sync Calendar Reservations';
const cronSchedule = '*/5 * * * *';

console.log(
  `[startup:${deploymentId}] Registering cron "${cronName}" (${cronSchedule})...`,
);

Deno.cron(cronName, cronSchedule, async () => {
  const startedAt = Date.now();
  console.log(`[cron:${deploymentId}] Tick started.`);

  try {
    await runSyncJob();
    const durationMs = Date.now() - startedAt;
    console.log(`[cron:${deploymentId}] Tick finished in ${durationMs}ms.`);
  } catch (error) {
    console.error(`[cron:${deploymentId}] Tick failed.`, error);
  }
});

console.log(
  `[startup:${deploymentId}] Cron registration complete: ${cronName} (${cronSchedule}).`,
);

console.log(
  `[startup:${deploymentId}] Starting HTTP handler (/auth_callback + health).`,
);

Deno.serve(request => {
  const { pathname } = new URL(request.url);
  if (pathname === '/auth_callback') {
    return handleOAuthCallbackRequest(request);
  }

  return new Response('ok', {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
});

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
