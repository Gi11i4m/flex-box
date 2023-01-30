import { calendar_v3 } from 'googleapis';
import { Event, EventStatus } from '../shared/event';

export const gapiEventToGcalEvent = (
  { id, summary, location, start, end }: calendar_v3.Schema$Event,
  eventPrefix = ''
): Event => ({
  id: id === null ? undefined : id,
  title: summary?.replace(eventPrefix, '').trim() || '',
  location: location || '',
  start: new Date(start?.dateTime || ''),
  status:
    Object.values(EventStatus).find(status => summary?.endsWith(status)) ||
    EventStatus.UNRESERVED,
});
