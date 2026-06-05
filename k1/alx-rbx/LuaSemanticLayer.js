
export class LuaSemanticLayer {
  execute(context) {
    const source = context.source || '';

    context.luaSemantic = {
      hasInstanceCreation: source.includes('Instance.new'),
      hasParenting: source.includes('.Parent'),
      hasWorkspaceUsage: source.includes('workspace')
    };

    return context;
  }
}
