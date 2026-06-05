export class RBXObjectGraph {
  constructor() {
    this.nodes = [];
  }

  addNode(node) {
    this.nodes.push(node);
  }

  serialize() {
    return this.nodes.sort((a,b) => a.id.localeCompare(b.id));
  }
}