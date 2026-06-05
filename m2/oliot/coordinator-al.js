// m2/oliot/coordinator-al.js
// Coordinator AL - Koordinaattori ja orkestroija

import { BaseAL, AL_ROLE, AL_STATE } from "./base-al.js";

export class CoordinatorAL extends BaseAL {
  constructor(options = {}) {
    super({
      ...options,
      role: AL_ROLE.COORDINATOR,
      name: options.name || "Coordinator"
    });

    this._subordinates = new Map();
    this._workflows = new Map();
    this._activeWorkflows = new Map();

    this._registerDefaultSkills();
  }

  _registerDefaultSkills() {
    this.registerSkill("delegate", async (task, al) => {
      const targetId = task.targetId;
      const subTask = task.subTask;

      const subordinate = this._subordinates.get(targetId);
      if (!subordinate) {
        return { ok: false, error: `Unknown subordinate: ${targetId}` };
      }

      if (subordinate.getState() !== AL_STATE.ACTIVE) {
        return { ok: false, error: `Subordinate not active: ${targetId}` };
      }

      const result = await subordinate.assignTask(subTask);
      if (result.ok) {
        return await subordinate.executeNextTask();
      }
      return result;
    });

    this.registerSkill("broadcast", async (task, al) => {
      const message = task.message;
      const filter = task.filter || (() => true);
      const results = [];

      for (const [id, subordinate] of this._subordinates) {
        if (filter(subordinate)) {
          results.push({
            id,
            received: true,
            state: subordinate.getState()
          });
        }
      }

      return { ok: true, recipients: results.length, results };
    });

    this.registerSkill("orchestrate", async (task, al) => {
      const workflowId = task.workflowId;
      const input = task.input;

      const workflow = this._workflows.get(workflowId);
      if (!workflow) {
        return { ok: false, error: `Unknown workflow: ${workflowId}` };
      }

      return await this._executeWorkflow(workflow, input);
    });
  }

  registerSubordinate(al) {
    this._subordinates.set(al.getId(), al);
  }

  unregisterSubordinate(id) {
    this._subordinates.delete(id);
  }

  getSubordinates() {
    const list = [];
    for (const [id, al] of this._subordinates) {
      list.push({
        id,
        name: al.getName(),
        role: al.getRole(),
        state: al.getState()
      });
    }
    return list;
  }

  getSubordinate(id) {
    return this._subordinates.get(id);
  }

  registerWorkflow(id, steps) {
    this._workflows.set(id, { id, steps });
  }

  async _executeWorkflow(workflow, input) {
    const execution = {
      workflowId: workflow.id,
      startedAt: this._clock?.now() || Date.now(),
      input,
      stepResults: [],
      status: "RUNNING"
    };

    this._activeWorkflows.set(workflow.id, execution);

    let currentData = input;

    for (const step of workflow.steps) {
      const subordinate = this._subordinates.get(step.alId);

      if (!subordinate) {
        execution.status = "FAILED";
        execution.error = `Missing AL: ${step.alId}`;
        break;
      }

      const assignResult = await subordinate.assignTask({
        skill: step.skill,
        input: currentData,
        ...step.params
      });

      if (!assignResult.ok) {
        execution.status = "FAILED";
        execution.error = assignResult.reason;
        break;
      }

      const result = await subordinate.executeNextTask();
      execution.stepResults.push({ step: step.id, result });

      if (!result.ok) {
        execution.status = "FAILED";
        execution.error = result.error;
        break;
      }

      currentData = result.output || result.result || currentData;
    }

    if (execution.status === "RUNNING") {
      execution.status = "COMPLETED";
    }

    execution.finishedAt = this._clock?.now() || Date.now();
    execution.output = currentData;

    this._activeWorkflows.delete(workflow.id);

    return {
      ok: execution.status === "COMPLETED",
      execution
    };
  }

  async delegate(targetId, task) {
    const delegateTask = {
      skill: "delegate",
      targetId,
      subTask: task
    };

    const assignResult = await this.assignTask(delegateTask);
    if (!assignResult.ok) return assignResult;

    return await this.executeNextTask();
  }

  async runWorkflow(workflowId, input) {
    const task = {
      skill: "orchestrate",
      workflowId,
      input
    };

    const assignResult = await this.assignTask(task);
    if (!assignResult.ok) return assignResult;

    return await this.executeNextTask();
  }
}

export function createCoordinatorAL(options) {
  return new CoordinatorAL(options);
}

export default CoordinatorAL;