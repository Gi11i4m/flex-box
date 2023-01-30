import { Event, EventStatus } from './event';

export const gcalEventToSuper7Event = ({
  title,
  start,
  location: mapsLocation,
}: Event): Event => ({
  title: stripStatusFrom(title),
  start,
  location: mapsLocation.startsWith('CrossFit Super7 Leuven')
    ? 'Leuven'
    : 'Aarschot',
  status: EventStatus.RESERVED,
});

export const stripStatusFrom = (title: string) =>
  Object.values(EventStatus).reduce(
    (acc, status) => acc.replace(` ${status}`, ''),
    title
  );
