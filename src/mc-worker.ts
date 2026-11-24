/// <reference lib="webworker" />
/**
 * Web Worker wrapper for the Monte-Carlo simulation.
 *
 * Receives  { type: 'run', id, state, runs, seed }
 * Posts     { type: 'progress', id, fraction }
 *           { type: 'done', id, result }
 *           { type: 'error', id, error }
 */

import { runMonteCarlo, McCancelled } from './engine/monte-carlo';
import { ParamState } from './engine/params';

const ctx: Worker = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent) => {
  const msg = e.data as {
    type: string;
    id: number;
    state: ParamState;
    runs: number;
    seed: number;
  };
  if (msg.type !== 'run') return;
  try {
    const result = runMonteCarlo(msg.state, {
      runs: msg.runs,
      seed: msg.seed,
      onProgress: (fraction) => {
        ctx.postMessage({ type: 'progress', id: msg.id, fraction });
      },
    });
    ctx.postMessage({ type: 'done', id: msg.id, result });
  } catch (err) {
    ctx.postMessage({
      type: 'error',
      id: msg.id,
      error: err instanceof McCancelled ? 'cancelled' : String(err),
    });
  }
};
