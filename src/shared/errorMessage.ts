// Render an unknown thrown value as a log-safe message string. JavaScript lets
// you `throw` anything, so `catch (err)` types err as `unknown` — this is the
// one place that narrows it.
export const errorMessage = (err: unknown): string =>
    err instanceof Error ? err.message : String(err);
