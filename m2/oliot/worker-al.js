// m2/oliot/worker-al.js
// Worker AL - Yleiskäyttöinen työntekijä-AL

import { BaseAL, AL_ROLE } from "./base-al.js";

export class WorkerAL extends BaseAL {
  constructor(options = {}) {
    super({
      ...options,
      role: AL_ROLE.WORKER,
      name: options.name || "Worker"
    });

    this._specialty = options.specialty || "general";
    this._workQueue = [];

    this._registerDefaultSkills();
  }

  _registerDefaultSkills() {
    this.registerSkill("process", async (task, al) => {
      const input = task.input || task.data;
      return { ok: true, output: input, processed: true };
    });

    this.registerSkill("transform", async (task, al) => {
      const input = task.input || task.data;
      const transformer = task.transformer || (x => x);
      const output = transformer(input);
      return { ok: true, output };
    });

    this.registerSkill("validate", async (task, al) => {
      const input = task.input || task.data;
      const validator = task.validator || (() => true);
      const valid = validator(input);
      return { ok: valid, valid, input };
    });

    this.registerSkill("aggregate", async (task, al) => {
      const items = task.items || [];
      const aggregator = task.aggregator || (items => items);
      const result = aggregator(items);
      return { ok: true, result };
    });
  }

  getSpecialty() {
    return this._specialty;
  }

  async work(input, options = {}) {
    const task = {
      skill: options.skill || "process",
      input,
      ...options
    };

    const assignResult = await this.assignTask(task);
    if (!assignResult.ok) return assignResult;

    return await this.executeNextTask();
  }
}

export function createWorkerAL(options) {
  return new WorkerAL(options);
}

export default WorkerAL;