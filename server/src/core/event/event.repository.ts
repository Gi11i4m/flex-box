import { Event } from './event.entity';

export abstract class EventRepository {
  abstract save(event: Event): Promise<void>;
}
