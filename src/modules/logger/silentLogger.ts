import type { Logger } from "./types.ts";

export default (): Logger => ({
  info: () => {},
  warn: () => {},
  error: () => {},
});
