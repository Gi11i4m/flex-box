import { calendar_v3 } from 'googleapis';
import { GcalEvent } from './model';

export const gapiEventToGcalEvent = (
  { id, summary, location, start, end }: calendar_v3.Schema$Event,
  eventPrefix = ''
): GcalEvent => ({
  id: id || '',
  title: summary?.replace(eventPrefix, '').trim() || '',
  location: location || '',
  start: new Date(start?.dateTime || ''),
  end: new Date(end?.dateTime || ''),
});
