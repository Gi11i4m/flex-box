import { GcalEvent } from '../gapi/model';
import { Super7Event } from '../super7/model';

const shortenLocation = (location: string) =>
  location.length > 22 ? `${location.slice(0, 22)}...` : location;

export const logEvents = (
  gcalEvents: GcalEvent[],
  super7Events: Super7Event[]
) => {
  console.log(`Found ${gcalEvents.length} Gcal events:`);
  gcalEvents.forEach(({ title, start, location }) =>
    console.log(
      `${title} ${
        title.includes('Crossfit') ? '\t\t' : '\t'
      }@ ${shortenLocation(location)}: ${start.toLocaleDateString()}`
    )
  );
  console.log();
  console.log(`Found ${super7Events.length} Super7 reservations:`);
  super7Events.forEach(({ title, start, location, status }) =>
    console.log(
      `${title} \t@ ${shortenLocation(
        location
      )}: ${start.toLocaleDateString()} (${status})`
    )
  );
  console.log();
};
