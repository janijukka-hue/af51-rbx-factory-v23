// s4/state/AppContext.js
// ALX Factory - Global App Context
// Version: 2.0.0 - powerUserMode + uiMode

import React, { createContext, useContext, useReducer, useCallback } from "react";

var ACTION = {
  SET_ORCHESTRATOR: "SET_ORCHESTRATOR",
  SET_FACTORY: "SET_FACTORY",
  SET_LOADING: "SET_LOADING",
  SET_ERROR: "SET_ERROR",
  CLEAR_ERROR: "CLEAR_ERROR",
  ADD_JOB: "ADD_JOB",
  UPDATE_JOB: "UPDATE_JOB",
  SET_ARTIFACTS: "SET_ARTIFACTS",
  ADD_ARTIFACT: "ADD_ARTIFACT",
  ADD_LOG: "ADD_LOG",
  CLEAR_LOGS: "CLEAR_LOGS",
  SET_SETTINGS: "SET_SETTINGS",
  SET_UI_MODE:  "SET_UI_MODE",
  // Enterprise UI Object Layer: a single FactoryUIOlio snapshot is the UI's
  // truth tree. React stores ONE reference (the serialized tree) — never a
  // parallel state model. Components read state.factoryUI.* only.
  SET_FACTORY_UI: "SET_FACTORY_UI",
  // Shared build state: the single latest build, written by RUN in EITHER the
  // Builder or the Cockpit, read by both. Makes AF51 one product, not two views.
  SET_LATEST_BUILD:   "SET_LATEST_BUILD",
  CLEAR_LATEST_BUILD: "CLEAR_LATEST_BUILD",
  SELECT_NODE:    "SELECT_NODE"
};

var initialState = {
  orchestrator: null,
  factory: null,
  loading: false,
  error: null,
  jobs: [],
  activeJobId: null,
  artifacts: [],
  logs: [],
  maxLogs: 500,
  settings: {
    autoRefresh: true,
    darkMode: true,
    debugMode: false,
    refreshInterval: 2000,
    powerUserMode: false    // false = Basic, true = Power User
  },
  uiMode: "basic",          // "basic" | "power"
  factoryUI: null,          // FactoryUIOlio.toJSON() — UI truth tree (read-only to React)
  latestBuild: null         // shared latest build (source, preview, directors, artifact)
};

function appReducer(state, action) {
  switch (action.type) {
    case ACTION.SET_ORCHESTRATOR:
      return { ...state, orchestrator: action.payload };

    case ACTION.SET_FACTORY:
      return { ...state, factory: action.payload };

    case ACTION.SET_LOADING:
      return { ...state, loading: action.payload };

    case ACTION.SET_ERROR:
      return { ...state, error: action.payload, loading: false };

    case ACTION.CLEAR_ERROR:
      return { ...state, error: null };

    case ACTION.ADD_JOB:
      return {
        ...state,
        jobs: [action.payload].concat(state.jobs),
        activeJobId: action.payload.id
      };

    case ACTION.UPDATE_JOB:
      return {
        ...state,
        jobs: state.jobs.map(function(job) {
          return job.id === action.payload.id
            ? { ...job, ...action.payload }
            : job;
        })
      };

    case ACTION.SET_ARTIFACTS:
      return { ...state, artifacts: action.payload };

    case ACTION.ADD_ARTIFACT:
      return {
        ...state,
        artifacts: [action.payload].concat(
          state.artifacts.filter(function(a) {
            return a.id !== action.payload.id;
          })
        )
      };

    case ACTION.ADD_LOG:
      var newLogs = [action.payload].concat(state.logs);
      if (newLogs.length > state.maxLogs) {
        newLogs = newLogs.slice(0, state.maxLogs);
      }
      return { ...state, logs: newLogs };

    case ACTION.CLEAR_LOGS:
      return { ...state, logs: [] };

    case ACTION.SET_SETTINGS:
      return {
        ...state,
        settings: { ...state.settings, ...action.payload }
      };

    case ACTION.SET_UI_MODE:
      return {
        ...state,
        uiMode: action.payload,
        settings: { ...state.settings, powerUserMode: action.payload === "power" }
      };

    case ACTION.SET_FACTORY_UI:
      // Replace the whole UI truth tree (a FactoryUIOlio.toJSON() snapshot).
      return { ...state, factoryUI: action.payload };

    case ACTION.SET_LATEST_BUILD:
      // The newest build, from RUN in Builder or Cockpit. Replaces prior build.
      return { ...state, latestBuild: action.payload };

    case ACTION.CLEAR_LATEST_BUILD:
      return { ...state, latestBuild: null };

    case ACTION.SELECT_NODE:
      // Selection flows through the same tree: update selection + inspector
      // slices of the stored snapshot. The live olio (owned by useFactoryUI)
      // performs the real derivation; this keeps React's copy consistent.
      if (!state.factoryUI) return state;
      return {
        ...state,
        factoryUI: {
          ...state.factoryUI,
          selection: { currentSelection: action.payload.id },
          inspector: action.payload.inspector || state.factoryUI.inspector
        }
      };

    default:
      return state;
  }
}

var AppContext = createContext(null);

function AppProvider(props) {
  var children = props.children;
  var orchestrator = props.orchestrator;
  var factory = props.factory;

  var stateAndDispatch = useReducer(appReducer, {
    ...initialState,
    orchestrator: orchestrator,
    factory: factory
  });

  var state = stateAndDispatch[0];
  var dispatch = stateAndDispatch[1];

  var setLoading = useCallback(function(loading) {
    dispatch({ type: ACTION.SET_LOADING, payload: loading });
  }, [dispatch]);

  var setError = useCallback(function(error) {
    dispatch({ type: ACTION.SET_ERROR, payload: error });
  }, [dispatch]);

  var clearError = useCallback(function() {
    dispatch({ type: ACTION.CLEAR_ERROR });
  }, [dispatch]);

  var addJob = useCallback(function(job) {
    dispatch({ type: ACTION.ADD_JOB, payload: job });
  }, [dispatch]);

  var updateJob = useCallback(function(job) {
    dispatch({ type: ACTION.UPDATE_JOB, payload: job });
  }, [dispatch]);

  var setArtifacts = useCallback(function(artifacts) {
    dispatch({ type: ACTION.SET_ARTIFACTS, payload: artifacts });
  }, [dispatch]);

  var addArtifact = useCallback(function(artifact) {
    dispatch({ type: ACTION.ADD_ARTIFACT, payload: artifact });
  }, [dispatch]);

  var addLog = useCallback(function(log) {
    dispatch({ type: ACTION.ADD_LOG, payload: log });
  }, [dispatch]);

  var clearLogs = useCallback(function() {
    dispatch({ type: ACTION.CLEAR_LOGS });
  }, [dispatch]);

  var setSettings = useCallback(function(settings) {
    dispatch({ type: ACTION.SET_SETTINGS, payload: settings });
  }, [dispatch]);

  var setUiMode = useCallback(function(mode) {
    dispatch({ type: ACTION.SET_UI_MODE, payload: mode });
  }, [dispatch]);

  var setFactoryUI = useCallback(function(snapshot) {
    dispatch({ type: ACTION.SET_FACTORY_UI, payload: snapshot });
  }, [dispatch]);

  var selectNode = useCallback(function(id, inspector) {
    dispatch({ type: ACTION.SELECT_NODE, payload: { id: id, inspector: inspector } });
  }, [dispatch]);

  // Shared build helpers. setLatestBuild normalizes a /rbx/lua-build response
  // (or a Builder build) into the canonical latestBuild shape both views read.
  var setLatestBuild = useCallback(function(build) {
    dispatch({ type: ACTION.SET_LATEST_BUILD, payload: build || null });
  }, [dispatch]);

  var clearLatestBuild = useCallback(function() {
    dispatch({ type: ACTION.CLEAR_LATEST_BUILD });
  }, [dispatch]);

  var actions = {
    setLoading: setLoading,
    setError: setError,
    clearError: clearError,
    addJob: addJob,
    updateJob: updateJob,
    setArtifacts: setArtifacts,
    addArtifact: addArtifact,
    addLog: addLog,
    clearLogs: clearLogs,
    setSettings: setSettings,
    setUiMode:   setUiMode,
    setFactoryUI: setFactoryUI,
    selectNode:   selectNode,
    setLatestBuild:   setLatestBuild,
    clearLatestBuild: clearLatestBuild
  };

  var value = {
    state: state,
    dispatch: dispatch,
    actions: actions
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

function useAppContext() {
  var context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }
  return context;
}

function useAppState() {
  return useAppContext().state;
}

function useAppActions() {
  return useAppContext().actions;
}

export {
  AppContext,
  AppProvider,
  useAppContext,
  useAppState,
  useAppActions,
  ACTION
};

export default AppProvider;