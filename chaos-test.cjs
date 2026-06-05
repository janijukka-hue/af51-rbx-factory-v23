// chaos-test.js — AF51 Full Chaos Test Runner
// Testaa oikeita AF51-reittejä — ei /project/create jota ei ole
const http = require("http");

const TARGET = "http://localhost:3000";
const TOTAL   = 300;
const WORKERS = 50;

var success = 0, fail = 0, errors = {}, latencies = [];
var fs500 = require("fs");
var log500 = [];

function req(method, path, payload) {
  return new Promise(function(resolve) {
    var start = Date.now();
    var body  = payload ? JSON.stringify(payload) : null;
    var opts  = {
      method: method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": body ? Buffer.byteLength(body) : 0,
      },
    };
    var r = http.request(TARGET + path, opts, function(res) {
      var data = "";
      res.on("data", function(c) { data += c; });
      res.on("end", function() {
        latencies.push(Date.now() - start);
        if (res.statusCode >= 200 && res.statusCode < 500) { success++; }
        else { fail++; errors[res.statusCode] = (errors[res.statusCode]||0)+1; }
        resolve();
      });
    });
    r.on("error", function() {
      fail++; errors["NETWORK"] = (errors["NETWORK"]||0)+1; resolve();
    });
    if (body) r.write(body);
    r.end();
  });
}

async function worker(id) {
  var perWorker = Math.floor(TOTAL / WORKERS);
  for (var i = 0; i < perWorker; i++) {
    var rand = Math.random();

    if (rand < 0.20) {
      // Health check
      await req("GET", "/health");
    }
    else if (rand < 0.40) {
      // Execute — normaali input
      await req("POST", "/execute", { input: "status " + id });
    }
    else if (rand < 0.55) {
      // Workspace save — validi
      await req("POST", "/workspace/save", {
        files: [{ path: "src/App.jsx", content: 'export default function App() { return (<div>AF51 chaos valid React app source guard padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding padding</div>); }' }]
      });
    }
    else if (rand < 0.65) {
      // Workspace save — path traversal yritys (pitää hylätä ei kaatua)
      await req("POST", "/workspace/save", {
        source: "test",
        projectId: "../evil_" + id
      });
    }
    else if (rand < 0.75) {
      // Works list
      await req("GET", "/works");
    }
    else if (rand < 0.82) {
      // Asset upload — tyhjä data (pitää hylätä)
      await req("POST", "/assets/upload", {
        filename: "test.exe",
        mime: "application/x-msdownload",
        data: ""
      });
    }
    else if (rand < 0.88) {
      // Publish — väärä workspaceDir (pitää hylätä)
      await req("POST", "/publish", { workspaceDir: "/etc/passwd", name: "evil" });
    }
    else if (rand < 0.93) {
      // Ghost Vault health
      await req("GET", "/ghost/health");
    }
    else if (rand < 0.97) {
      // Tyhjä body
      await req("POST", "/execute", {});
    }
    else {
      // Vault list
      await req("GET", "/vault/builds");
    }
  }
}

async function run() {
  console.log("🔥 AF51 CHAOS TEST — " + TOTAL + " requestia, " + WORKERS + " workers");
  console.log("Target:", TARGET);
  console.log("========================================");

  var t0 = Date.now();
  var pool = [];
  for (var i = 0; i < WORKERS; i++) pool.push(worker(i));
  await Promise.all(pool);
  var totalTime = Date.now() - t0;

  latencies.sort(function(a,b) { return a-b; });
  var avg  = latencies.reduce(function(a,b){return a+b;},0) / latencies.length;
  var p50  = latencies[Math.floor(latencies.length*0.50)];
  var p95  = latencies[Math.floor(latencies.length*0.95)];
  var p99  = latencies[Math.floor(latencies.length*0.99)];
  var max  = latencies[latencies.length-1];
  var total = success + fail;
  var failPct = ((fail/total)*100).toFixed(1);

  console.log("\n📊 TULOS");
  console.log("========================================");
  console.log("Total:   ", total);
  console.log("Success: ", success, "✅");
  console.log("Fail:    ", fail,    failPct > 5 ? "❌ (" + failPct + "%)" : "(" + failPct + "%)");
  var errCopy = Object.assign({}, errors);
  var paths = errCopy["500_paths"] || [];
  delete errCopy["500_paths"];
  console.log("Errors:  ", JSON.stringify(errCopy));
  if (paths.length > 0) paths.forEach(function(p) { console.log("  500:", p); });

  console.log("\n⏱  LATENSSI");
  console.log("Avg: " + Math.round(avg) + "ms");
  console.log("P50: " + p50 + "ms");
  console.log("P95: " + p95 + "ms");
  console.log("P99: " + p99 + "ms");
  console.log("Max: " + max + "ms");

  console.log("\n⚡ Kokonaisaika:", totalTime + "ms");

  if (log500.length > 0) {
    console.log("\n🔍 500-virheet:");
    log500.forEach(function(l) { console.log("  ", l); });
  }

  var ok = Object.keys(errors).filter(function(k) { return k === "500" || k === "NETWORK"; }).length === 0;
  console.log("\n" + (ok ? "✅ PASS — ei 500-erroreita, ei kaatumisia" : "❌ FAIL — tarkista errors yllä"));
}

run().catch(function(e) { console.error("FATAL:", e.message); process.exit(1); });
