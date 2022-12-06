import { GcalEvent } from '../gapi/model';
import { Super7Event } from '../super7/model';

export const gcalEventToSuper7Event = ({
  title,
  start,
  location: mapsLocation,
}: GcalEvent): Super7Event => ({
  title,
  start,
  location: mapsLocation.startsWith('CrossFit Super7 Leuven')
    ? 'Leuven'
    : 'Aarschot',
  status: '✅',
});
