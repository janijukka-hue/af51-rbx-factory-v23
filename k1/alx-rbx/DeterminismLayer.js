
export class DeterminismLayer {
  execute(context) {
    context.determinism = {
      stablePaths: true,
      stableOrdering: true,
      stableArtifacts: true
    };

    return context;
  }
}
