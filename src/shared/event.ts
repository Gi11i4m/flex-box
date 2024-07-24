import { DateTime } from "luxon";

export interface Event {
  id?: string;
  title: string;
  location: string;
  start: DateTime;
  status: EventStatus;
}

export type EventStatus = "✅" | "⏳" | "❌";
