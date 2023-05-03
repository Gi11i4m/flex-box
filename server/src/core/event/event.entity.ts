export class Event {
  id?: string;
  title!: string;
  location!: string;
  start!: Date;
  status!: EventStatus;
}

export enum EventStatus {
  RESERVED = '✅',
  WAITLIST = '⏳',
  UNRESERVED = '❌',
}
