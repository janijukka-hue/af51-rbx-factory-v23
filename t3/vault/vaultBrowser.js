// t3/vault/vaultBrowser.js — Vault Browser HTML v2.0 (v12)
// buildMode: template | source
// sourceOrigin: template | manual | llm

export function renderVaultBrowser(builds) {
  var rows = builds.length === 0
    ? "<tr><td colspan='8' style='text-align:center;padding:2rem;color:#333'>Ei buildejä vielä</td></tr>"
    : builds.map(function(b) {
        var statusColor = b.status === "success" ? "#00d4aa" : "#ff4466";
        var modeColor   = b.buildMode === "source"   ? "#f0a500" : "#4a9eff";
        var originColor = b.sourceOrigin === "llm"    ? "#c084fc"
                        : b.sourceOrigin === "manual" ? "#f0a500"
                        : "#4a4a6a";
        var date = new Date(b.createdAt).toLocaleString("fi-FI");
        return [
          "<tr>",
          "<td><code style='color:#00d4ff;font-size:0.73rem'>" + esc(b.buildId) + "</code></td>",
          "<td>" + esc(b.projectName || "-") + "</td>",
          "<td><span style='color:" + statusColor + "'>" + esc(b.status) + "</span></td>",
          "<td><span style='color:" + modeColor + "'>" + esc(b.buildMode || "template") + "</span></td>",
          "<td><span style='color:" + originColor + "'>" + esc(b.sourceOrigin || "template") + "</span></td>",
          "<td>" + esc(b.target || "-") + "</td>",
          "<td>" + (b.sizeChars || 0) + " ch</td>",
          "<td style='color:#444'>" + date + "</td>",
          '<td><a href="/vault/builds/' + esc(b.buildId) + '/full" target="_blank" style="color:#00d4ff;text-decoration:none;font-size:1rem">↗</a></td>',
          "</tr>"
        ].join("");
      }).join("\n");

  return `<!DOCTYPE html>
<html lang="fi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ALX Vault Browser</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:#0a0a0f; color:#e4e4ef; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',monospace; padding:2rem; }
    h1 { color:#00d4ff; font-size:1.4rem; margin-bottom:0.2rem; }
    .sub { color:#444; font-size:0.78rem; margin-bottom:1.5rem; }
    .count { color:#00d4aa; font-weight:bold; }
    table { width:100%; border-collapse:collapse; font-size:0.81rem; }
    th { text-align:left; padding:0.5rem 0.75rem; background:#0f0f1a; color:#444; border-bottom:1px solid #1a1a28; font-weight:600; text-transform:uppercase; font-size:0.67rem; letter-spacing:0.05em; }
    td { padding:0.5rem 0.75rem; border-bottom:1px solid #0d0d16; vertical-align:middle; }
    tr:hover td { background:#0c0c18; }
    a.btn { display:inline-block; margin-bottom:1rem; margin-right:0.5rem; padding:0.3rem 0.8rem; background:#141420; border:1px solid #1e1e2e; color:#888; border-radius:4px; font-size:0.76rem; text-decoration:none; }
    a.btn:hover { background:#1e1e2e; color:#e4e4ef; }
    .legend { margin-top:1.5rem; font-size:0.71rem; }
    .legend span { margin-right:1.25rem; }
  </style>
</head>
<body>
  <h1>⚡ ALX Vault Browser</h1>
  <p class="sub">Tallennetut buildit — <span class="count">${builds.length}</span> kpl</p>
  <a class="btn" href="/vault/ui">↻ Päivitä</a>
  <a class="btn" href="/vault/builds" target="_blank">{ } JSON</a>
  <a class="btn" href="/health" target="_blank">♥ Health</a>
  <a class="btn" href="/api/llm/status" target="_blank">🤖 LLM</a>
  <table>
    <thead>
      <tr>
        <th>Build ID</th><th>Projekti</th><th>Status</th>
        <th>Moodi</th><th>Alkuperä</th><th>Target</th>
        <th>Koko</th><th>Luotu</th><th></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="legend">
    <span style="color:#555">Moodi:</span>
    <span style="color:#4a9eff">■ template</span>
    <span style="color:#f0a500">■ source</span>
    &nbsp;&nbsp;
    <span style="color:#555">Alkuperä:</span>
    <span style="color:#4a4a6a">■ template</span>
    <span style="color:#f0a500">■ manual</span>
    <span style="color:#c084fc">■ llm</span>
    &nbsp;&nbsp;
    <span style="color:#00d4aa">■ success</span>
    <span style="color:#ff4466">■ failure</span>
  </div>
  <p style="margin-top:0.75rem;color:#1e1e2e;font-size:0.68rem">Päivitetty: ${new Date().toLocaleString("fi-FI")}</p>
</body>
</html>`;
}

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}