import { DateTime } from "luxon";

export interface Event {
  id?: string;
  title: string;
  start: DateTime;
  status: EventStatus;
}

export const eventStatusValues = ["✅", "⏳", "❌"] as const;

export type EventStatus = (typeof eventStatusValues)[number];
