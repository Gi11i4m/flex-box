import chalk from "chalk";
import { Env } from "../shared/env";
import { Event, EventStatus } from "../shared/event";
import { Super7Website } from "./super7-website";

export class Super7 {
  website: Super7Website;

  constructor() {
    this.website = new Super7Website();
  }

  async authenticate() {
    await this.website.authenticate();
    return this;
  }

  async getReservations(): Promise<Event[]> {
    return await this.website.reservations();
  }

  async bookEvent(
    event: Pick<Event, "title" | "start" | "location">,
  ): Promise<void> {
    const eventId = await this.website.eventIdFor(event);
    console.log(
      chalk.bold.green(
        `${eventId ? "Making" : "Not making"} reservation ${event.title} at ${
          event.location
        } at ${event.start.toLocaleString()}, id: ${eventId}`,
      ),
    );
    eventId &&
      !Env.dryRun &&
      (await this.website
        .makeReservation(eventId)
        .then(({ data: { Message } }) => {
          if (Message === "Full") {
            console.log(
              chalk.bold.yellow(
                `Event ${event.title} at ${
                  event.location
                } at ${event.start.toLocaleString()} fully booked, adding to waitlist..., id: ${eventId}`,
              ),
            );
            return this.website.waitlistReservation(eventId);
          }
          if (Message !== "Full") {
            console.error(`Unhandled edge case: `, Message);
          }
        }));
  }

  async deleteReservation(event: Event): Promise<void> {
    // const reservationId = await this.website.reservationIdFor(event);
    const reservationId = null;
    console.log(
      chalk.bold.red(
        `${reservationId ? "Deleting" : "Not deleting"} reservation ${
          event.title
        } at ${event.start.toLocaleString()} at ${
          event.location
        }, id: ${reservationId}`,
      ),
    );
    reservationId &&
      !Env.dryRun &&
      (event.status === EventStatus.RESERVED
        ? await this.website.removeReservation(reservationId)
        : await this.website.removeWaitlist(reservationId));
  }
}
