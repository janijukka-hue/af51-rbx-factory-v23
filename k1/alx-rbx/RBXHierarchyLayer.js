
export class RBXHierarchyLayer {
  execute(context) {
    context.hierarchy = {
      validServices: [
        'workspace',
        'ReplicatedStorage',
        'StarterGui',
        'ServerScriptService'
      ],
      deterministic: true
    };

    return context;
  }
}
