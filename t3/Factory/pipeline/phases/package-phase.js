// t3/Factory/pipeline/phases/package-phase.js
// KERROS: T3 – Tuotanto
// Pipeline-vaihe: pakkaa workspace-tiedostot deterministiseksi paketiksi.
//
// Deterministisyys:
//   - Tiedostot järjestetty pathilla (ei muutosajalla)
//   - Ei timestamp-metadataa sisällössä
//   - SHA256 lasketaan järjestetystä sisällöstä
//   - Sama workspace → identtinen hash joka kerta
//
// Zip-strategia:
//   - Expo/in-memory: workspace.serialize() → deterministinen JSON-paketti
//   - Node-runtime: opts.zipper-funktio injektoidaan → oikea .zip-tiedosto
//     (zipper toteutetaan alx-factory-server -projektissa)

import { BasePhase }                    from "../base-phase.js";
import { PIPELINE_PHASE, ARTIFACT_TYPE } from "../../core/factory-types.js";
import { simpleHash256, fnv1a32 }        from "../../core/factory-utils.js";

var PACKAGE_PHASE_VERSION = "2.0.0";

export class PackagePhase extends BasePhase {

  constructor(options) {
    var opts = options || {};
    super(PIPELINE_PHASE.PACKAGE, opts);
    this._packagerWorker = opts.packagerWorker || null;
    this._workspace      = opts.workspace      || null;
    // Injektoitava zip-funktio Node-runtimelle:
    //   zipper(files, outputPath) → { ok, zipPath, zipHash, zipBytes }
    this._zipper         = opts.zipper         || null;
  }

  canSkip(context) {
    return context.isIncrementalHit();
  }

  async execute(context) {
    var command  = context.getCommand();
    var manifest = context.getManifest()  || {};
    var checksum = context.getChecksum()  || "";

    // ── 1. Kerää tiedostot ──────────────────────────────────

    var files = this._collectFiles(context);

    if (files.length === 0 && this._workspace) {
      // Workspace-pohjainen build: kerää workspacesta
      var tree = this._workspace.listTree();
      if (tree.ok) {
        for (var i = 0; i < tree.files.length; i++) {
          var f   = tree.files[i];
          var readResult = this._workspace.readFile(f.path);
          if (readResult.ok) {
            files.push({ path: f.path, content: readResult.content, size: readResult.size, hash: readResult.hash });
          }
        }
      }
    }

    // ── 2. Deterministinen järjestys ────────────────────────
    //    Järjestys pathin mukaan — ei koskaan muutosajan mukaan

    files = files.slice().sort(function(a, b) {
      return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    });

    // ── 3. Laske deterministinen hash ───────────────────────
    //    Ei timestampeja mukaan — sama sisältö → sama hash

    var contentForHash = files.map(function(f) {
      return f.path + ":" + (f.hash || simpleHash256(f.content || ""));
    }).join("\n");

    var packageHash = simpleHash256(contentForHash);

    // ── 4. Zip-strategia ────────────────────────────────────

    var zipResult = null;
    var zipPath   = null;
    var zipHash   = null;
    var zipBytes  = 0;

    if (this._zipper) {
      // Node-runtime: oikea .zip (alx-factory-server)
      var projectName = manifest.projectName || command.projectName || "project";
      var zipName     = projectName + "-" + packageHash.slice(0, 12) + ".zip";
      zipResult = await this._zipper(files, zipName);
      if (!zipResult.ok) {
        throw new Error("PackagePhase: zip epäonnistui: " + (zipResult.error || "tuntematon virhe"));
      }
      zipPath  = zipResult.zipPath;
      zipHash  = zipResult.zipHash;
      zipBytes = zipResult.zipBytes || 0;

    } else if (this._packagerWorker) {
      // Vanha worker-pohjainen pakkaaja
      var workerResult = await this._packagerWorker.package(files, manifest);
      zipPath  = workerResult.path       || null;
      zipHash  = workerResult.hash       || packageHash;
      zipBytes = workerResult.bytes      || 0;

    } else {
      // Expo/in-memory: serialisoitu JSON-paketti workspaceen
      var pkg = {
        version:     "1.0",
        packageHash: packageHash,
        fileCount:   files.length,
        files:       files.map(function(f) {
          return { path: f.path, hash: f.hash || simpleHash256(f.content || ""), size: f.size || 0 };
        })
      };
      var pkgJson = JSON.stringify(pkg);
      zipPath     = "dist/" + packageHash.slice(0, 12) + ".package.json";
      zipHash     = packageHash;
      zipBytes    = pkgJson.length;

      if (this._workspace) {
        this._workspace.writeFile(zipPath, pkgJson);
      }
    }

    // ── 5. Laske build dist-hash ─────────────────────────────
    //    Erikseen koko worktreen hashista (ei paketin hashista)

    var distHash = packageHash;
    if (this._workspace && typeof this._workspace.hashAll === "function") {
      var treeHash = this._workspace.hashAll();
      if (treeHash.ok) distHash = treeHash.treeHash;
    }

    // ── 6. Rakenna artifact ─────────────────────────────────

    var artifactId = "art_" + this._clock.now() + "_" + fnv1a32(packageHash).toString(16);

    var artifact = {
      id:       artifactId,
      type:     ARTIFACT_TYPE.PACKAGE,
      checksum: checksum || packageHash,

      // Vaihe 6 (ProjectArtifact 2.0) -rakenne
      manifest: {
        projectName: manifest.projectName || command.projectName || "unknown",
        version:     manifest.version     || "1.0.0",
        target:      manifest.target      || command.target      || "unknown",
        specId:      command.specId       || null
      },
      files: files.map(function(f) {
        return { path: f.path, hash: f.hash || simpleHash256(f.content || ""), size: f.size || 0 };
      }),
      build: {
        distHash:  distHash,
        fileCount: files.length,
        bytes:     files.reduce(function(s, f) { return s + (f.size || 0); }, 0)
      },
      package: {
        zipPath:   zipPath,
        zipHash:   zipHash,
        zipBytes:  zipBytes,
        algorithm: "sha256",
        sorted:    true,
        deterministic: true
      },
      reports:   context.getReports ? context.getReports() : [],
      auditRefs: [],
      createdAt: this._clock.now(),
      packageVersion: PACKAGE_PHASE_VERSION
    };

    context.addArtifact(artifact);
    context.setPhaseResult(PIPELINE_PHASE.PACKAGE, {
      artifactId: artifactId,
      packageHash: packageHash,
      distHash: distHash,
      fileCount: files.length,
      zipBytes: zipBytes
    });

    this._emit("PACKAGE:CREATED", {
      artifactId: artifactId,
      packageHash: packageHash,
      fileCount: files.length,
      zipBytes: zipBytes
    });

    return {
      artifactId:  artifactId,
      packageHash: packageHash,
      distHash:    distHash,
      zipPath:     zipPath,
      zipHash:     zipHash,
      zipBytes:    zipBytes,
      fileCount:   files.length,
      deterministic: true
    };
  }

  // ── Helpers ──────────────────────────────────────────────

  _collectFiles(context) {
    // Ensisijaisesti context.getNormalizedFiles() (TemplatePhase asettaa)
    var normalized = context.getNormalizedFiles ? context.getNormalizedFiles() : null;
    if (Array.isArray(normalized) && normalized.length > 0) {
      return normalized.map(function(f) {
        return {
          path:    f.path,
          content: f.content || "",
          size:    f.size    || (f.content ? f.content.length : 0),
          hash:    f.hash    || null
        };
      });
    }
    // Fallback: context.getBuildOutput()
    var output = context.getBuildOutput ? context.getBuildOutput() : null;
    return Array.isArray(output) ? output : [];
  }
}

export function createPackagePhase(options) {
  return new PackagePhase(options || {});
}

export default PackagePhase;