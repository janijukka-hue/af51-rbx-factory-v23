// ui/futureMachine/index.js
// AF51 FutureMachine — read-only visualization shell.
//
// SCOPE / RULES:
//   - This package never touches the production pipeline, the build manager,
//     the publish chain, the save chain, the ZIP chain or the preview format.
//   - It consumes PipelineAudit records (live via runtime.consume(record) or
//     replayed from a ZIP via runtime.replay(records)) and projects them as
//     visual rings around a central sphere.
//   - Any ring state must be reproducible by replaying the audit alone
//     (replay invariant). Live and replayed states are byte-equivalent.
//
// COMPOSITION:
//   import {
//     useReplayedRuntime, useLiveRuntime,
//     WorldRing, EnergyRing, MemoryRing, IntentRing, FactoryRing, GhostRing, CoreSphere,
//   } from "./ui/futureMachine";
//
//   // Replayed (one-shot fetch from /rbx/audit/<buildId>):
//   const { snapshot } = useReplayedRuntime({ server, buildId, token });
//
//   // Live SSE-paced stream (server emits records one at a time):
//   const { snapshot, status } = useLiveRuntime({ server, buildId, token, pacingMs: 120 });
//
//   // Both hooks expose the same snapshot shape, so the ring tree is identical:
//   <WorldRing snapshot={snapshot} diameter={1040}>
//     <EnergyRing snapshot={snapshot} diameter={880}>
//       <MemoryRing snapshot={snapshot} diameter={720}>
//         <IntentRing snapshot={snapshot} diameter={560}>
//           <FactoryRing snapshot={snapshot} diameter={400}>
//             <GhostRing snapshot={snapshot} diameter={240}>
//               <CoreSphere snapshot={snapshot} size={130} />
//             </GhostRing>
//           </FactoryRing>
//         </IntentRing>
//       </MemoryRing>
//     </EnergyRing>
//   </WorldRing>
//
//   // Direct (no hook) — replayed from a captured audit payload:
//   const runtime = createRingRuntime();
//   runtime.replay(audit.records, audit.intent, audit.ledger, audit.energy, audit.world);

export { RingRuntime, createRingRuntime } from "./RingRuntime.js";
export { RingState } from "./RingState.js";
export {
  FactoryRingContract,
  CoreSphereContract,
  GhostRingContract,
  IntentRingContract,
  MemoryRingContract,
  EnergyRingContract,
  WorldRingContract,
  recordToRingEvents,
  intentToRingEvents,
  memoryToRingEvents,
  energyToRingEvents,
  worldToRingEvents,
} from "./RingEvents.js";
export { CoreSphere } from "./CoreSphere.js";
export { FactoryRing } from "./FactoryRing.js";
export { GhostRing } from "./GhostRing.js";
export { IntentRing } from "./IntentRing.js";
export { MemoryRing } from "./MemoryRing.js";
export { EnergyRing } from "./EnergyRing.js";
export { WorldRing } from "./WorldRing.js";
export { useReplayedRuntime } from "./useReplayedRuntime.js";
export { useLiveRuntime } from "./useLiveRuntime.js";
export { FutureMachineScreen } from "./FutureMachineScreen.js";
