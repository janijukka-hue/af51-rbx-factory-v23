// s4/oliot/ui/ArtifactUIOlio.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer
// Version: 1.0.0
//
// ArtifactUIOlio — mallintaa tuotetun ZIP-artefaktin. Vastaa pipeline-tuloksen
// kenttiä: zipPath, artifactHash, ghostId, durationMs. Tarjoaa render-valmiin
// statuksen ("ZIP Ready", "Artifact Verified").

function ArtifactUIOlio(opts) {
  opts = opts || {};
  this.artifactId  = opts.artifactId  || null;
  this.zipPath     = opts.zipPath     || null;
  this.sizeBytes   = opts.sizeBytes   || 0;
  this.hash        = opts.hash        || null;   // artifactHash
  this.ghostId     = opts.ghostId     || null;
  this.createdAt   = opts.createdAt   || null;
  this.verified    = !!opts.verified;
}

ArtifactUIOlio.prototype.isReady = function () {
  return !!this.zipPath;
};

ArtifactUIOlio.prototype.sizeLabel = function () {
  if (!this.sizeBytes) return "—";
  if (this.sizeBytes < 1024) return this.sizeBytes + " B";
  if (this.sizeBytes < 1024 * 1024) return (this.sizeBytes / 1024).toFixed(1) + " KB";
  return (this.sizeBytes / (1024 * 1024)).toFixed(2) + " MB";
};

// One render-ready status line for the artifact card.
ArtifactUIOlio.prototype.statusLabel = function () {
  if (!this.isReady()) return "No artifact";
  return this.verified ? "Artifact Verified" : "ZIP Ready";
};

ArtifactUIOlio.prototype.toJSON = function () {
  return {
    artifactId: this.artifactId, zipPath: this.zipPath, sizeBytes: this.sizeBytes,
    hash: this.hash, ghostId: this.ghostId, createdAt: this.createdAt, verified: this.verified,
  };
};

export { ArtifactUIOlio };
export function createArtifactUIOlio(opts) { return new ArtifactUIOlio(opts); }
