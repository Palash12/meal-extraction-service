import type { MetricName } from "../../types/observability";

export interface MetricsRecorder {
  increment: (name: MetricName, value?: number) => void;
  histogram: (name: MetricName, value: number) => void;
}

export const noOpMetrics: MetricsRecorder = {
  increment: (): void => undefined,
  histogram: (): void => undefined,
};
