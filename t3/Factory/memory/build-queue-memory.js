// t3/Factory/memory/build-queue-memory.js
// Build Queue Memory - Job queue management

export const JOB_STATUS = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED"
};

export class BuildQueueMemory {
  constructor(options = {}) {
    this._clock = options.clock;
    this._maxSize = options.maxSize || 200;
    this._queue = [];
    this._history = [];
    this._maxHistory = 100;
  }

  enqueue(job) {
    if (this._queue.length >= this._maxSize) {
      return { ok: false, error: "Queue full" };
    }

    const entry = {
      id: job.id || `job_${this._clock?.now() || Date.now()}`,
      ...job,
      status: JOB_STATUS.QUEUED,
      queuedAt: this._clock?.now() || Date.now(),
      startedAt: null,
      finishedAt: null
    };

    this._queue.push(entry);
    return { ok: true, jobId: entry.id };
  }

  dequeue() {
    const job = this._queue.find(j => j.status === JOB_STATUS.QUEUED);
    if (!job) return null;

    job.status = JOB_STATUS.RUNNING;
    job.startedAt = this._clock?.now() || Date.now();
    return job;
  }

  complete(jobId, result = {}) {
    const job = this._queue.find(j => j.id === jobId);
    if (!job) return { ok: false, error: "Job not found" };

    job.status = result.ok ? JOB_STATUS.COMPLETED : JOB_STATUS.FAILED;
    job.finishedAt = this._clock?.now() || Date.now();
    job.result = result;

    this._moveToHistory(job);
    return { ok: true };
  }

  cancel(jobId) {
    const index = this._queue.findIndex(j => j.id === jobId);
    if (index === -1) return { ok: false, error: "Job not found" };

    const job = this._queue[index];
    if (job.status === JOB_STATUS.RUNNING) {
      return { ok: false, error: "Cannot cancel running job" };
    }

    job.status = JOB_STATUS.CANCELLED;
    job.finishedAt = this._clock?.now() || Date.now();
    this._moveToHistory(job);
    return { ok: true };
  }

  _moveToHistory(job) {
    const index = this._queue.findIndex(j => j.id === job.id);
    if (index !== -1) {
      this._queue.splice(index, 1);
    }

    this._history.push(job);
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }
  }

  getQueue() {
    return [...this._queue];
  }

  getHistory(count = 20) {
    return this._history.slice(-count);
  }

  getJob(jobId) {
    return this._queue.find(j => j.id === jobId) || 
           this._history.find(j => j.id === jobId);
  }

  clear() {
    this._queue = [];
  }

  getStats() {
    return {
      queueLength: this._queue.length,
      queued: this._queue.filter(j => j.status === JOB_STATUS.QUEUED).length,
      running: this._queue.filter(j => j.status === JOB_STATUS.RUNNING).length,
      historyLength: this._history.length,
      maxSize: this._maxSize
    };
  }
}

export function createBuildQueueMemory(options) {
  return new BuildQueueMemory(options);
}

export default BuildQueueMemory;