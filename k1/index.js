// k1/index.js
// Kernel Layer Entry Point
// MINIMAL PUBLIC API - No wildcard exports

import { CoreMemory, createCoreMemory, MEMORY_STORE } from "./Ydin/muisti.js";
import { ALX, createALX } from "./alx/core/ALX.js";

function bootstrapKernel(options) {
  if (!options) {
    options = {};
  }
  
  var coreMemory = new CoreMemory({
    clock: options.clock,
    owner: options.owner,
    episodicLimit: options.episodicLimit || 10000,
    semanticLimit: options.semanticLimit || 5000,
    proceduralLimit: options.proceduralLimit || 1000
  });
  
  var coreWriter = function(entry) {
    return coreMemory.write({
      store: entry.store || "episodic",
      content: entry.content,
      tags: entry.tags || ["alx"],
      metadata: entry.metadata || {}
    });
  };
  
  var alx = new ALX({
    clock: options.clock,
    owner: options.owner,
    coreMemory: coreMemory,
    coreWriter: coreWriter,
    debug: options.debug,
    localMemoryLimit: options.localMemoryLimit || 500,
    localMemoryTTL: options.localMemoryTTL || 300000
  });
  
  return {
    coreMemory: coreMemory,
    alx: alx
  };
}

export {
  bootstrapKernel,
  CoreMemory,
  createCoreMemory,
  MEMORY_STORE,
  ALX,
  createALX
};

export default {
  bootstrapKernel: bootstrapKernel,
  CoreMemory: CoreMemory,
  ALX: ALX
};