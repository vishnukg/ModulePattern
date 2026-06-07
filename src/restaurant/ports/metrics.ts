export interface Metrics {
    increment: (name: string) => void;
    timing: (name: string, durationMs: number) => void;
}

export interface FakeMetrics extends Metrics {
    getCounter: (name: string) => number;
    getTimings: (name: string) => number[];
}
