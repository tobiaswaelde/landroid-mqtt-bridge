import { configDirectory } from './runtime';

export const ENV = {
  /** Directory containing the loaded configuration file. */
  get CONFIG_PATH() {
    return configDirectory();
  },
};
