import { DateTime, DateTimeFormatOptions, LocaleOptions } from "luxon";

export const dateTimeLocale: LocaleOptions = {
  locale: "nl",
};
export const dateTimeFormat: DateTimeFormatOptions = {
  ...DateTime.DATETIME_MED,
  timeZone: "Europe/Brussels",
};

export const NOW: DateTime = DateTime.now()
  .setZone("Europe/Brussels")
  .startOf("day");
