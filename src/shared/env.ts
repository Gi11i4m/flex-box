export class Env {
  static get dryRun() {
    if (process.env.DRY_RUN === 'true') {
      return true;
    }
    if (process.env.DRY_RUN === 'false') {
      return false;
    }
    return false;
  }
}
