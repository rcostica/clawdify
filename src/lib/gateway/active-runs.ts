type ActiveGatewayRun = {
  id: string;
  controller: AbortController;
  startedAt: number;
};

const activeGatewayRuns = new Map<string, Map<string, ActiveGatewayRun>>();

export function registerActiveGatewayRun(sessionKey: string, id: string, controller: AbortController) {
  let runs = activeGatewayRuns.get(sessionKey);
  if (!runs) {
    runs = new Map();
    activeGatewayRuns.set(sessionKey, runs);
  }
  runs.set(id, { id, controller, startedAt: Date.now() });

  return () => {
    const current = activeGatewayRuns.get(sessionKey);
    current?.delete(id);
    if (current && current.size === 0) activeGatewayRuns.delete(sessionKey);
  };
}

export function abortActiveGatewayRuns(sessionKey: string) {
  const runs = activeGatewayRuns.get(sessionKey);
  if (!runs || runs.size === 0) {
    return { aborted: false, runIds: [] as string[] };
  }

  const runIds: string[] = [];
  for (const run of runs.values()) {
    if (!run.controller.signal.aborted) {
      run.controller.abort(new Error('Stopped by user'));
      runIds.push(run.id);
    }
  }

  return { aborted: runIds.length > 0, runIds };
}

export function listActiveGatewayRuns(sessionKey: string) {
  return Array.from(activeGatewayRuns.get(sessionKey)?.values() || []).map(run => ({
    id: run.id,
    startedAt: run.startedAt,
    aborted: run.controller.signal.aborted,
  }));
}
