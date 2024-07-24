import { calendar_v3 } from "googleapis";
import { Event, EventStatus } from "../shared/event";
import { DateTime } from "luxon";

export const gapiEventToGcalEvent = (
  { id, summary, location, start, end }: calendar_v3.Schema$Event,
  eventPrefix = "",
): Event => ({
  id: id === null ? undefined : id,
  title: summary?.replace(eventPrefix, "").trim() || "",
  location: location || "",
  start: start?.dateTime ? DateTime.fromISO(start.dateTime) : DateTime.now(),
  status:
    Object.values(EventStatus).find((status) => summary?.endsWith(status)) ||
    EventStatus.UNRESERVED,
});
