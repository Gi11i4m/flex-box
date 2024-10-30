import { calendar_v3 } from "googleapis";
import { Event, eventStatusValues } from "../shared/event";
import { DateTime } from "luxon";
import { NOW } from "../shared/date";

export const gapiEventToGcalEvent = (
  { id, summary, location, start, end }: calendar_v3.Schema$Event,
  eventPrefix = "",
): Event => ({
  id: id === null ? undefined : id,
  title:
    summary
      ?.replace(eventPrefix, "")
      .replaceAll(new RegExp(eventStatusValues.join("|"), "g"), "")
      .trim() || "",
  start: start?.dateTime ? DateTime.fromISO(start.dateTime) : NOW,
  status: eventStatusValues.find((status) => summary?.endsWith(status)) || "❌",
});
