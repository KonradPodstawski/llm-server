import { Worker } from 'worker_threads';
import os from 'os';
import path from 'path';
import { SCHEDULE_DELAY } from '../constants';
import { RerankerTask, RerankerResult } from './reranker-worker';

type WorkerState = {
  worker: Worker;
  busy: boolean;
};

export class RerankerPool {
  private workers: WorkerState[] = [];
  private queue: {
    resolve: (value: RerankerResult) => void;
    reject: (err: any) => void;
    task: RerankerTask;
  }[] = [];

  constructor(poolSize: number = Math.max(1, os.cpus().length - 1)) {
    const workerFile = path.resolve('./dist/ranking/reranker-worker.js');

    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(workerFile);
      this.workers.push({ worker, busy: false });
    }
  }

  /**
   * Assigns the next queued job to a free worker (if exists)
   */
  private schedule() {
    const freeWorker = this.workers.find((w) => !w.busy);
    const nextJob = this.queue[0];

    if (!nextJob) return;
    if (!freeWorker)
      return setTimeout(() => {
        this.schedule();
      }, SCHEDULE_DELAY);

    freeWorker.busy = true;
    this.queue.shift();

    freeWorker.worker.once('message', (result) => {
      freeWorker.busy = false;

      if ('error' in result) {
        nextJob.reject(new Error(result.error));
      } else {
        nextJob.resolve(result as RerankerResult);
      }

      // schedule next task
      this.schedule();
    });

    freeWorker.worker.postMessage(nextJob.task);
  }

  /**
   * Public API: add task to queue
   */
  exec(task: RerankerTask): Promise<RerankerResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });

      this.schedule();
    });
  }
}
