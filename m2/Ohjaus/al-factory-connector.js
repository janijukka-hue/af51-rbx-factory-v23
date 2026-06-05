// m2/Ohjaus/al-factory-connector.js
// AL-Factory Connector - Yhdistää AL-oliot Factory workereihin

import { CoordinatorAL, WorkerAL, GuardianAL } from "../oliot/index.js";

export class ALFactoryConnector {
  constructor(options = {}) {
    this._clock = options.clock;
    this._factory = options.factory || null;
    
    this._coordinator = null;
    this._workers = [];
    this._guardian = null;
    
    this._isConnected = false;
  }

  initialize() {
    this._coordinator = new CoordinatorAL({
      clock: this._clock,
      name: "FactoryCoordinator"
    });
    this._coordinator.activate();

    for (let i = 0; i < 3; i++) {
      const worker = new WorkerAL({
        clock: this._clock,
        name: `BuildWorker_${i + 1}`,
        specialty: "build"
      });
      worker.activate();
      this._workers.push(worker);
      this._coordinator.registerSubordinate(worker);
    }

    this._guardian = new GuardianAL({
      clock: this._clock,
      name: "FactoryGuardian"
    });
    this._guardian.activate();
    this._coordinator.registerSubordinate(this._guardian);

    this._guardian.addRule("no-eval", (data) => {
      const content = data.content || "";
      return !content.includes("eval(");
    });

    this._guardian.addRule("max-file-size", (data) => {
      const bytes = data.bytes || data.content?.length || 0;
      return bytes < 1000000;
    });

    return {
      ok: true,
      coordinator: this._coordinator.getId(),
      workers: this._workers.map(w => w.getId()),
      guardian: this._guardian.getId()
    };
  }

  connectToFactory(factory) {
    this._factory = factory;
    
    const al2Builder = factory.getWorkers()?.builder;
    
    if (al2Builder) {
      al2Builder.setALCoordinator(this._coordinator);
      
      for (const worker of this._workers) {
        al2Builder.addALWorker(worker);
      }
    }

    this._isConnected = true;

    return { ok: true };
  }

  getCoordinator() {
    return this._coordinator;
  }

  getWorkers() {
    return this._workers;
  }

  getGuardian() {
    return this._guardian;
  }

  isConnected() {
    return this._isConnected;
  }

  getStatus() {
    return {
      connected: this._isConnected,
      coordinator: this._coordinator ? {
        id: this._coordinator.getId(),
        state: this._coordinator.getState(),
        subordinates: this._coordinator.getSubordinates().length
      } : null,
      workers: this._workers.map(w => ({
        id: w.getId(),
        name: w.getName(),
        state: w.getState()
      })),
      guardian: this._guardian ? {
        id: this._guardian.getId(),
        state: this._guardian.getState(),
        rules: this._guardian.getRules().length
      } : null
    };
  }

  async validateWithGuardian(data) {
    if (!this._guardian) {
      return { ok: false, error: "Guardian not initialized" };
    }

    return await this._guardian.guard(data, ["no-eval", "max-file-size"]);
  }

  async delegateTask(task) {
    if (!this._coordinator) {
      return { ok: false, error: "Coordinator not initialized" };
    }

    const availableWorker = this._workers.find(w => w.getState() === "ACTIVE");
    
    if (!availableWorker) {
      return { ok: false, error: "No available workers" };
    }

    return await this._coordinator.delegate(availableWorker.getId(), task);
  }

  shutdown() {
    for (const worker of this._workers) {
      worker.deactivate();
    }
    
    if (this._guardian) {
      this._guardian.deactivate();
    }
    
    if (this._coordinator) {
      this._coordinator.deactivate();
    }

    this._isConnected = false;

    return { ok: true };
  }
}

export function createALFactoryConnector(options) {
  return new ALFactoryConnector(options);
}

export default ALFactoryConnector;