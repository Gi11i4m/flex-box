export const NOW = new Date();

export const isAfter = (date: Date, compareTo: Date) =>
  date.getTime() > compareTo.getTime();
