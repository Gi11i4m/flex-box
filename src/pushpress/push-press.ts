import chalk from "chalk";
import { Event } from "../shared/event";
import { PushPressWebsite } from "./push-press-website";
import { isDryRun } from "../shared/env";

export class PushPress {
  website: PushPressWebsite;

  constructor() {
    this.website = new PushPressWebsite();
  }

  async authenticate() {
    await this.website.authenticate();
    return this;
  }

  async getReservations(): Promise<Event[]> {
    return await this.website.reservations();
  }

  async bookEvent(event: Event): Promise<void> {
    const eventId = await this.website.eventIdFor(event);
    console.log(
      chalk.bold.green(
        `${eventId ? "Making" : "Not making"} reservation ${
          event.title
        } at ${event.start.toLocaleString()}, id: ${eventId}`,
      ),
    );

    if (!eventId || isDryRun()) {
      return;
    }

    await this.website.makeReservation(eventId);
  }

  async deleteReservation(event: Event): Promise<void> {
    const eventId = await this.website.eventIdFor(event);
    console.log(
      chalk.bold.red(
        `${eventId ? "Deleting" : "Not deleting"} reservation ${
          event.title
        } at ${event.start.toLocaleString()}, id: ${eventId}`,
      ),
    );
    if (!eventId || isDryRun()) {
      return;
    }

    await this.website.removeReservation(eventId);
  }
}
