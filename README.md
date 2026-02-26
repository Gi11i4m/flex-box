# Flexbox

Automated script that checks Google Calendar for events with "Crossfit", "Calisthenics" or "Open Gym" in the names and automatically reserves or unreserves a spot on https://crossfitsuper7.clubplanner.be/.

Google Calendar acts as the source of truth. After matching Google Calendar events with Super7 reservations it will book events that are in the calendar but not in reservations and unreserve events that are in the reservations but not in Google Calendar. After this, Flexbox will update the status for each Super7 reservation in the matching Google Calendar events.

## Github Actions

This script is run twice a day to have a recent idea of event statusses in Google Calendar.

Want to run this yourself? Fork this project, set up GitHub Actions, create a Google app and fill in the necessary ENV variables on GitHub. You can find these in the GitHub Actions workflow file `flexbox.yml`.

You can run the script locally by creating a `.env` file with the same variables. To get the GOOGLE_REFRESH_TOKEN you'll have to run it once locally and log the refresh token to copy it (`oauth.ts - set tokens()`).

## Deno KV

Refresh tokens are stored in Deno KV per account (`ACCOUNT_NAME`) instead of JSONBin.

- `ACCOUNT_NAME` selects which refresh token namespace to use.

## OAuth2

Confused about OAuth2, me 2. Here's a [clear article](https://medium.com/starthinker/google-oauth-2-0-access-token-and-refresh-token-explained-cccf2fc0a6d9).
