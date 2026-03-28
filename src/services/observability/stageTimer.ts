export interface StageTimer {
  start: (stage: string) => void;
  end: (stage: string) => number;
}

export function createStageTimer(): StageTimer {
  const starts = new Map<string, number>();

  return {
    start: (stage: string): void => {
      starts.set(stage, Date.now());
    },
    end: (stage: string): number => {
      const startedAt = starts.get(stage) ?? Date.now();
      return Date.now() - startedAt;
    },
  };
}
