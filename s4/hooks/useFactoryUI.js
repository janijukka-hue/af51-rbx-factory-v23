// s4/hooks/useFactoryUI.js
// KERROS: S4 – Studio/UI · Enterprise UI Object Layer
// Version: 1.0.0
//
// useFactoryUI — the SINGLE integration point between the production side and
// React. It owns the live FactoryUIOlio; React only ever holds the serialized
// snapshot (state.factoryUI). Rule: no parallel state model. Components read
// the snapshot through this hook's selectors.
//
//   const { snapshot, ingestBuild, select, viewport } = useFactoryUI();
//   ingestBuild(buildResult, { sceneGraph, ringRuntime });  // on build complete
//
// - ingestBuild:  pipeline result → FactoryUIOlio (via UIObjectAdapter) → React
// - select:       updates selection on the live olio, re-derives inspector,
//                 pushes a fresh snapshot (selection drives inspector)
// - refreshRings: pulls a new RingRuntime snapshot into the tree
//
// React never builds production; it reads, shows, selects, and sends control
// commands. The olio is the truth; React mirrors it.

import { useRef, useCallback } from "react";
import { useAppState, useAppActions } from "../state/AppContext.js";
import { createUIObjectAdapter } from "../oliot/ui/index.js";

function useFactoryUI() {
  var state = useAppState();
  var actions = useAppActions();

  // Live olio + adapter live in refs — NOT React state. React holds only the
  // serialized snapshot. This is what keeps the truth in the olio layer.
  var olioRef = useRef(null);
  var adapterRef = useRef(null);
  if (!adapterRef.current) adapterRef.current = createUIObjectAdapter();

  // Build completed → adapt the real result into the UI truth tree.
  var ingestBuild = useCallback(function (buildResult, opts) {
    var ui = adapterRef.current.createFromPipeline(buildResult, opts || {});
    olioRef.current = ui;
    actions.setFactoryUI(ui.toJSON());
    return ui;
  }, [actions]);

  // Selection drives the inspector through the SAME tree.
  var select = useCallback(function (nodeId) {
    var ui = olioRef.current;
    if (!ui) return;
    ui.selection.select(nodeId);
    // re-derive inspector from the live olio, then mirror into React
    actions.selectNode(nodeId, ui.inspector.toJSON());
  }, [actions]);

  // Refresh ring status from a live RingRuntime (rings stay owned by runtime).
  var refreshRings = useCallback(function (ringRuntime) {
    var ui = olioRef.current;
    if (!ui) return;
    adapterRef.current.updateRings(ui, ringRuntime);
    actions.setFactoryUI(ui.toJSON());
  }, [actions]);

  // Viewport commands mutate the live olio (logic lives there, not in React),
  // then push a snapshot so the view re-renders.
  var viewport = {
    orbit: useCallback(function (dy, dp) {
      var ui = olioRef.current; if (!ui) return;
      ui.viewport.orbit(dy, dp); actions.setFactoryUI(ui.toJSON());
    }, [actions]),
    zoomBy: useCallback(function (d) {
      var ui = olioRef.current; if (!ui) return;
      ui.viewport.zoomBy(d); actions.setFactoryUI(ui.toJSON());
    }, [actions]),
    focus: useCallback(function (p) {
      var ui = olioRef.current; if (!ui) return;
      ui.viewport.focus(p); actions.setFactoryUI(ui.toJSON());
    }, [actions]),
  };

  return {
    snapshot:    state.factoryUI,            // React-readable truth tree
    olio:        olioRef.current,            // live olio (advanced/imperative use)
    ingestBuild: ingestBuild,
    select:      select,
    refreshRings: refreshRings,
    viewport:    viewport,
  };
}

// Thin selectors so components don't reach into snapshot internals everywhere.
function selectBuildState(s) { return s && s.factoryUI ? s.factoryUI.buildState : null; }
function selectScene(s)      { return s && s.factoryUI ? s.factoryUI.scene : null; }
function selectHierarchy(s)  { return s && s.factoryUI ? s.factoryUI.hierarchy : null; }
function selectInspector(s)  { return s && s.factoryUI ? s.factoryUI.inspector : null; }
function selectArtifact(s)   { return s && s.factoryUI ? s.factoryUI.artifact : null; }
function selectRings(s)      { return s && s.factoryUI ? s.factoryUI.rings : null; }
function selectViewport(s)   { return s && s.factoryUI ? s.factoryUI.viewport : null; }

export {
  useFactoryUI,
  selectBuildState, selectScene, selectHierarchy, selectInspector,
  selectArtifact, selectRings, selectViewport,
};
export default useFactoryUI;
