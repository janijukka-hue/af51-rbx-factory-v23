export class WorkerLockManager {
  constructor() {
    this.locks = new Set();
  }

  acquire(lockId) {
    if (this.locks.has(lockId)) {
      throw new Error('LOCK_EXISTS');
    }

    this.locks.add(lockId);
  }

  release(lockId) {
    this.locks.delete(lockId);
  }
}