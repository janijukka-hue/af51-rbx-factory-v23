// s4/hooks/useEventBus.js
// ALX Factory - EventBus Hook
// Version: 1.2.0
// - Poistettu kuollut alx._eventBus.on() polku:
//   ALX ei omista _eventBus:ia eikä EventBus:lla ole .on()-metodia (.subscribe() on oikea).
// - Factory-eventit saapuvat orchestrator.on():n kautta koska M2 Orchestrator
//   forwardaa ne subscribeAll-hookilla (_bootFactory).
// - Kaikki event-subscriptiot menevät orchestrator.on(type, handler) kautta.

import { useState, useEffect, useRef, useCallback } from "react";

var FACTORY_EVENTS = {
  BUILD_STARTED: "factory:build:started",
  BUILD_COMPLETED: "factory:build:completed",
  BUILD_FAILED: "factory:build:failed",
  BUILD_PROGRESS: "factory:build:progress",
  STAGE_STARTED: "factory:stage:started",
  STAGE_COMPLETED: "factory:stage:completed",
  STAGE_FAILED: "factory:stage:failed",
  WORKER_STARTED: "factory:worker:started",
  WORKER_COMPLETED: "factory:worker:completed",
  WORKER_FAILED: "factory:worker:failed",
  STATE_CHANGED: "factory:state:changed",
  ARTIFACT_CREATED: "factory:artifact:created",
  ARTIFACT_PUBLISHED: "factory:artifact:published",
  ORCHESTRATOR_COMMAND: "orchestrator:command:completed",
  ORCHESTRATOR_ERROR: "orchestrator:error"
};

// Modulitason vakiot — ei rekisteröidy uudelleen joka renderillä
var ALL_FACTORY_EVENTS = Object.values(FACTORY_EVENTS);

var BUILD_EVENT_TYPES = [
  FACTORY_EVENTS.BUILD_STARTED,
  FACTORY_EVENTS.BUILD_COMPLETED,
  FACTORY_EVENTS.BUILD_FAILED,
  FACTORY_EVENTS.BUILD_PROGRESS,
  FACTORY_EVENTS.STAGE_STARTED,
  FACTORY_EVENTS.STAGE_COMPLETED,
  FACTORY_EVENTS.STAGE_FAILED
];

function useEventBus(orchestrator, eventTypes) {
  var eventsState = useState([]);
  var events = eventsState[0];
  var setEvents = eventsState[1];

  var latestEventState = useState(null);
  var latestEvent = latestEventState[0];
  var setLatestEvent = latestEventState[1];

  var unsubscribesRef = useRef([]);
  var maxEventsRef = useRef(100);

  // eventTypes pitää olla modulitason vakio — muuttuvat taulukot aiheuttavat
  // jatkuvan re-subscriptionin. Käytetään parametria sellaisenaan tai fallback.
  var typesToSubscribe = eventTypes || ALL_FACTORY_EVENTS;

  var handleEvent = useCallback(function(type, payload) {
    var newEvent = {
      id: Date.now() + "_" + Math.random().toString(36).substr(2, 9),
      type: type,
      payload: payload,
      timestamp: new Date().toISOString()
    };

    setLatestEvent(newEvent);

    setEvents(function(prev) {
      var updated = [newEvent].concat(prev);
      if (updated.length > maxEventsRef.current) {
        updated = updated.slice(0, maxEventsRef.current);
      }
      return updated;
    });
  }, [setLatestEvent, setEvents]);

  useEffect(function() {
    if (!orchestrator || typeof orchestrator.on !== "function") return;

    // Subscriptionit menevät yksinomaan orchestrator.on():n kautta.
    // M2 Orchestrator forwardaa T3 factory-eventit subscribeAll-hookilla,
    // joten S4 ei tarvitse koskaan suoraa pääsyä factory EventBussiin.
    typesToSubscribe.forEach(function(eventType) {
      var unsub = orchestrator.on(eventType, function(payload) {
        handleEvent(eventType, payload);
      });
      if (typeof unsub === "function") {
        unsubscribesRef.current.push(unsub);
      }
    });

    return function() {
      unsubscribesRef.current.forEach(function(unsub) {
        unsub();
      });
      unsubscribesRef.current = [];
    };
  }, [orchestrator, handleEvent]); // eslint-disable-line react-hooks/exhaustive-deps
  // typesToSubscribe jätetään pois — sen on oltava staattinen (modulitason vakio)

  var clearEvents = useCallback(function() {
    setEvents([]);
    setLatestEvent(null);
  }, [setEvents, setLatestEvent]);

  var getEventsByType = useCallback(function(type) {
    return events.filter(function(e) {
      return e.type === type;
    });
  }, [events]);

  return {
    events: events,
    latestEvent: latestEvent,
    clearEvents: clearEvents,
    getEventsByType: getEventsByType,
    eventCount: events.length
  };
}

function useBuildEvents(orchestrator) {
  var result = useEventBus(orchestrator, BUILD_EVENT_TYPES);

  var currentBuildState = useState(null);
  var currentBuild = currentBuildState[0];
  var setCurrentBuild = currentBuildState[1];

  useEffect(function() {
    if (!result.latestEvent) return;

    var event = result.latestEvent;

    if (event.type === FACTORY_EVENTS.BUILD_STARTED) {
      setCurrentBuild({
        id: event.payload.buildId,
        status: "running",
        startedAt: event.timestamp,
        stages: [],
        progress: 0
      });
    } else if (event.type === FACTORY_EVENTS.BUILD_COMPLETED) {
      setCurrentBuild(function(prev) {
        if (!prev) return null;
        return Object.assign({}, prev, {
          status: "completed",
          completedAt: event.timestamp,
          progress: 100
        });
      });
    } else if (event.type === FACTORY_EVENTS.BUILD_FAILED) {
      setCurrentBuild(function(prev) {
        if (!prev) return null;
        return Object.assign({}, prev, {
          status: "failed",
          failedAt: event.timestamp,
          error: event.payload.error
        });
      });
    } else if (event.type === FACTORY_EVENTS.BUILD_PROGRESS) {
      setCurrentBuild(function(prev) {
        if (!prev) return null;
        return Object.assign({}, prev, {
          progress: event.payload.progress || prev.progress
        });
      });
    } else if (event.type === FACTORY_EVENTS.STAGE_COMPLETED) {
      setCurrentBuild(function(prev) {
        if (!prev) return null;
        return Object.assign({}, prev, {
          stages: prev.stages.concat([event.payload.stage])
        });
      });
    }
  }, [result.latestEvent, setCurrentBuild]);

  return Object.assign({}, result, {
    currentBuild: currentBuild,
    isBuilding: currentBuild && currentBuild.status === "running"
  });
}

export {
  useEventBus,
  useBuildEvents,
  FACTORY_EVENTS
};

export default useEventBus;