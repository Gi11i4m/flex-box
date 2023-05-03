import { Event } from '../event/event.entity';

export abstract class CalendarRepository {
  abstract getEvents(): Promise<Event[]>;
  abstract updateEventTitle(event: Event): Promise<void>;
}
