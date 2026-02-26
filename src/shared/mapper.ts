import { Event, eventStatusValues } from './event.ts';

export const gcalEventToSuper7Event = ({ title, start }: Event): Event => ({
  title: stripStatusFrom(title),
  start,
  status: '✅',
});

export const stripStatusFrom = (title: string) =>
  eventStatusValues.reduce(
    (acc, status) => acc.replace(` ${status}`, ''),
    title,
  );
