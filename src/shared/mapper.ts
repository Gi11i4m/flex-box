import { GcalEvent } from '../gapi/model';
import { Super7Event, Super7EventStatus } from '../super7/model';

export const gcalEventToSuper7Event = ({
  title,
  start,
  location: mapsLocation,
}: GcalEvent): Super7Event => ({
  title: stripStatusFrom(title),
  start,
  location: mapsLocation.startsWith('CrossFit Super7 Leuven')
    ? 'Leuven'
    : 'Aarschot',
  status: Super7EventStatus.RESERVED,
});

export const stripStatusFrom = (title: string) =>
  Object.values(Super7EventStatus).reduce(
    (acc, status) => acc.replace(` ${status}`, ''),
    title
  );
