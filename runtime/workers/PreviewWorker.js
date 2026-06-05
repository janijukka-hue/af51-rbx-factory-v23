export class PreviewWorker {
  async run({ graph, renderer }) {
    return renderer.render(graph);
  }
}