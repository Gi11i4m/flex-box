import { Event } from './event.ts';
import { dateTimeFormat, dateTimeLocale } from './date.ts';

export function logEvents(
  events: Event[],
  loggingOptions: { newline: boolean } = { newline: false },
) {
  events.forEach(event => logEvent(event));
  if (loggingOptions.newline) {
    console.log();
  }
}

export function logEvent(event: Event) {
  console.log(eventToString(event));
}

export function eventToString({ title, status, start }: Event) {
  return `${status ? status + ' ' : ''}[${start.toLocaleString(
    dateTimeFormat,
    dateTimeLocale,
  )}] ${title}`;
}
