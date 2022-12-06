import { Super7Event } from './model';
import { Super7Website } from './super7-website';

export class Super7 {
  website: Super7Website;

  constructor() {
    this.website = new Super7Website();
  }

  async authenticate() {
    await this.website.authenticate();
    return this;
  }

  async getReservations(): Promise<Super7Event[]> {
    return await this.website.reservations();
  }

  async bookEvent(
    event: Pick<Super7Event, 'title' | 'start' | 'location'>
  ): Promise<void> {
    const eventId = await this.website.eventIdFor(event);
    console.log(
      `Making reservation for event ${event.title} at ${
        event.location
      } at ${event.start.toLocaleDateString()}, id: ${eventId}`
    );
    eventId && (await this.website.makeReservation(eventId));
  }

  async deleteReservation(
    event: Pick<Super7Event, 'title' | 'start' | 'location'>
  ): Promise<void> {
    console.log(
      `Deleting reservation for reservation ${
        event.title
      } at ${event.start.toLocaleDateString()} at ${event.location}`
    );
    const reservationId = await this.website.reservationIdFor(event);
    reservationId && (await this.website.removeReservation(reservationId));
  }
}
