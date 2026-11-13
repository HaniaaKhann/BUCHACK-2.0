export interface BacklogInput {
  initialBacklog: number;
  lambdaLivePerMinute: number;
  appArrivalsPerMinute: readonly number[];
  muPerMinute: number;
}

export interface BacklogResult {
  backlog: number;
  trajectory: number[];
}

export function stepBacklog(
  backlog: number,
  lambdaLivePerMinute: number,
  appArrivals: number,
  muPerMinute: number,
): number {
  return Math.max(0, backlog + lambdaLivePerMinute + appArrivals - muPerMinute);
}

export function simulateBacklog(input: BacklogInput): BacklogResult {
  const trajectory: number[] = [];
  let backlog = input.initialBacklog;
  for (const appArrivals of input.appArrivalsPerMinute) {
    backlog = stepBacklog(backlog, input.lambdaLivePerMinute, appArrivals, input.muPerMinute);
    trajectory.push(backlog);
  }
  return { backlog, trajectory };
}

export function queueDelayMinutes(backlog: number, muPerMinute: number): number {
  return backlog / muPerMinute;
}
