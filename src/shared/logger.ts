import { Event } from "./event";
import { DateTime } from "luxon";
import { dateTimeFormat, dateTimeLocale } from "./date";

export function logEvents(
  events: Event[],
  loggingOptions: { newline: boolean } = { newline: false },
) {
  events.forEach((event) => logEvent(event));
  if (loggingOptions.newline) {
    console.log();
  }
}

export function logEvent(event: Event) {
  console.log(eventToString(event));
}

export function eventToString({ title, status, start }: Event) {
  return `${status ? status + " " : ""}[${start.toLocaleString(
    dateTimeFormat,
    dateTimeLocale,
  )}] ${title}`;
}
