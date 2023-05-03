export interface Configuration {
  sync: {
    dryRun: boolean;
  };
}

export const configuration: () => { config: Configuration } = () => ({
  config: {
    sync: {
      dryRun:
        process.env.DRY_RUN === 'true'
          ? true
          : process.env.DRY_RUN === 'false'
          ? false
          : false,
    },
  },
});
