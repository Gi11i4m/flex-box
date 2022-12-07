import { Env } from '../shared/env';
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
      `${eventId ? 'Making' : 'Not making'} reservation ${event.title} at ${
        event.location
      } at ${event.start.toLocaleDateString()}, id: ${eventId}`
    );
    eventId &&
      !Env.dryRun &&
      (await this.website
        .makeReservation(eventId)
        .then(({ data: { Message } }) => {
          if (Message === 'Full') {
            console.log(
              `Event ${event.title} at ${
                event.location
              } at ${event.start.toLocaleDateString()} fully booked, adding to waitlist..., id: ${eventId}`
            );
            this.website.waitlistReservation(eventId);
          }
        })
        .catch(console.error));
  }

  async deleteReservation(
    event: Pick<Super7Event, 'title' | 'start' | 'location'>
  ): Promise<void> {
    const reservationId = await this.website.reservationIdFor(event);
    console.log(
      `${reservationId ? 'Deleting' : 'Not deleting'} reservation ${
        event.title
      } at ${event.start.toLocaleDateString()} at ${event.location}`
    );
    reservationId &&
      !Env.dryRun &&
      (await this.website
        .removeReservation(reservationId)
        .catch(console.error));
  }
}
