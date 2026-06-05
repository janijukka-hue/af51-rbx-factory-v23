import os from "os";

const PROFILES = {
  TURBO: {
    concurrency: 8,
    mutationDepth: 1.0,
    burst: true,
    thermalLimit: 95
  },

  BALANCED: {
    concurrency: 4,
    mutationDepth: 0.7,
    burst: true,
    thermalLimit: 80
  },

  WHISPER: {
    concurrency: 2,
    mutationDepth: 0.4,
    burst: false,
    thermalLimit: 65
  },

  SURVIVAL: {
    concurrency: 1,
    mutationDepth: 0.2,
    burst: false,
    thermalLimit: 50
  }
};

class EnergyRing {
  constructor() {
    this.profile = "BALANCED";
    this.metrics = {
      cpu: 0,
      ram: 0,
      load: 0,
      queueDepth: 0,
      latency: 0
    };
  }

  setProfile(profile) {
    if (PROFILES[profile]) {
      this.profile = profile;
      return true;
    }
    return false;
  }

  getProfile() {
    return PROFILES[this.profile];
  }

  getProfileName() {
    return this.profile;
  }

  getProfiles() {
    return Object.keys(PROFILES);
  }

  updateTelemetry(data = {}) {
    this.metrics.cpu = os.loadavg()[0];
    this.metrics.ram =
      ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;

    this.metrics.load = data.load ?? this.metrics.load ?? 0;
    this.metrics.queueDepth = data.queueDepth ?? this.metrics.queueDepth ?? 0;
    this.metrics.latency = data.latency ?? this.metrics.latency ?? 0;

    return this.getStatus();
  }

  shouldThrottle() {
    const profile = this.getProfile();

    return (
      this.metrics.cpu > profile.thermalLimit ||
      this.metrics.ram > 90 ||
      this.metrics.queueDepth > profile.concurrency
    );
  }

  getStatus() {
    return {
      profile: this.profile,
      config: this.getProfile(),
      metrics: this.metrics,
      throttle: this.shouldThrottle()
    };
  }
}

const energyRing = new EnergyRing();

export { PROFILES, EnergyRing };
export default energyRing;