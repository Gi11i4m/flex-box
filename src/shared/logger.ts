import { Event } from "./event";
import { DateTime } from "luxon";

export const logEvents = (gcalEvents: Event[], super7Events: Event[]) => {
  console.log(`Found ${gcalEvents.length} Gcal events:`);
  gcalEvents.forEach(logEvent);
  console.log();
  console.log(`Found ${super7Events.length} Super7 reservations:`);
  super7Events.forEach(logEvent);
  console.log();
};

const logEvent = ({ start, status, title }: Event) =>
  console.log(
    `${status ? status + " " : ""}[${start.toLocaleString(
      DateTime.DATETIME_MED,
      { locale: "nl" },
    )}] ${title}`,
  );
