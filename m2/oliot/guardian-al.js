// m2/oliot/guardian-al.js
// Guardian AL - Valvoja ja turvallisuus-AL

import { BaseAL, AL_ROLE } from "./base-al.js";

export class GuardianAL extends BaseAL {
  constructor(options = {}) {
    super({
      ...options,
      role: AL_ROLE.GUARDIAN,
      name: options.name || "Guardian"
    });

    this._watchList = new Set();
    this._alerts = [];
    this._maxAlerts = 100;
    this._rules = new Map();

    this._registerDefaultSkills();
  }

  _registerDefaultSkills() {
    this.registerSkill("monitor", async (task, al) => {
      const target = task.target;
      const check = task.check || (() => ({ ok: true }));
      const result = check(target);

      if (!result.ok) {
        this._addAlert("MONITOR_FAILED", { target, result });
      }

      return result;
    });

    this.registerSkill("validate", async (task, al) => {
      const data = task.data;
      const rules = task.rules || [];
      const violations = [];

      for (const rule of rules) {
        const ruleCheck = this._rules.get(rule);
        if (ruleCheck && !ruleCheck(data)) {
          violations.push(rule);
        }
      }

      const passed = violations.length === 0;
      if (!passed) {
        this._addAlert("VALIDATION_FAILED", { violations, data });
      }

      return { ok: passed, violations };
    });

    this.registerSkill("audit", async (task, al) => {
      const action = task.action;
      const actor = task.actor;
      const data = task.data;

      const auditEntry = {
        action,
        actor,
        data,
        timestamp: this._clock?.now() || Date.now()
      };

      this._addMemory("AUDIT", auditEntry);
      return { ok: true, auditEntry };
    });
  }

  addRule(name, checker) {
    this._rules.set(name, checker);
  }

  removeRule(name) {
    this._rules.delete(name);
  }

  getRules() {
    return Array.from(this._rules.keys());
  }

  watch(targetId) {
    this._watchList.add(targetId);
  }

  unwatch(targetId) {
    this._watchList.delete(targetId);
  }

  getWatchList() {
    return Array.from(this._watchList);
  }

  _addAlert(type, data) {
    this._alerts.push({
      type,
      data,
      timestamp: this._clock?.now() || Date.now()
    });

    if (this._alerts.length > this._maxAlerts) {
      this._alerts.shift();
    }
  }

  getAlerts(count = 20) {
    return this._alerts.slice(-count);
  }

  clearAlerts() {
    this._alerts = [];
  }

  async guard(data, rules = []) {
    const task = {
      skill: "validate",
      data,
      rules
    };

    const assignResult = await this.assignTask(task);
    if (!assignResult.ok) return assignResult;

    return await this.executeNextTask();
  }
}

export function createGuardianAL(options) {
  return new GuardianAL(options);
}

export default GuardianAL;