export class RojoCompatibleExporter {
  export(graph) {
    return {
      format: 'rojo-project',
      deterministic: true,
      folders: [
        'src',
        'ReplicatedStorage',
        'StarterGui',
        'ServerScriptService'
      ],
      graph
    };
  }
}