
export class ALXPipelineBridge {
  handoff(context, orchestrator) {
    return orchestrator.run({
      semanticContext: context,
      graph: context.objectGraph
    });
  }
}
