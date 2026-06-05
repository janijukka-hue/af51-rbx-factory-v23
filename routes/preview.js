// routes/preview.js
// AF51-RBX — Preview API endpoints.
// Wired to the real Lua → object-graph chain. No hardcoded scenes.

export function handlePreviewStatus(req, res, send) {
  return send(res, 200, {
    ok: true,
    preview: "ready",
    engine: "lua-object-graph",
    schemaVersion: "1.0.0",
  });
}

export async function handlePreviewProject(req, res, send, readBody) {
  const body = await readBody(req).catch(() => ({}));
  const source = body.source || "";
  if (!source || typeof source !== "string") {
    return send(res, 400, { ok: false, error: "Missing 'source' string" });
  }
  try {
    const lp = await import("../runtime/rbx-runtime/LuaParser.js");
    const ig = await import("../runtime/rbx-runtime/InstanceGraphBuilder.js");
    const pr = await import("../runtime/rbx-runtime/PreviewRenderer.js");
    const ast = new lp.LuaParser().parse(source);
    const graph = new ig.InstanceGraphBuilder().build(ast);
    const render = new pr.PreviewRenderer().render(graph);
    return send(res, 200, {
      ok: true,
      objectCount: graph.nodes.length,
      preview: {
        schemaVersion: "1.0.0",
        source: "lua-object-graph",
        structures: render.structures,
        lighting: { ambient: "#0F0F1A", sky: "#06080F", fogColor: "#080814", neonColor: "#25D0FF" },
        camera: { viewX: 10, viewZ: 8, rotation: "slow_orbit", elevation: 30 },
      },
    });
  } catch (e) {
    return send(res, 500, { ok: false, error: e.message });
  }
}

export function handleBusinessWalletPreview(req, res, send) {
  // Legacy endpoint retained for route compatibility.
  return send(res, 200, { ok: true, preview: "business-wallet", note: "static template endpoint" });
}
