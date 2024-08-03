import { DateTime, DateTimeFormatOptions, LocaleOptions, Zone } from "luxon";

export const dateTimeLocale: LocaleOptions = {
  locale: "nl",
};
export const dateTimeFormat: DateTimeFormatOptions = {
  ...DateTime.DATETIME_MED,
  timeZone: "Europe/Brussels",
};

export const NOW = DateTime.now();
