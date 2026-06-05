export class StructureHasher {
  hash(graph) {
    const stable = JSON.stringify(graph, Object.keys(graph).sort());
    let hash = 0;

    for (let i = 0; i < stable.length; i++) {
      hash = ((hash << 5) - hash) + stable.charCodeAt(i);
      hash |= 0;
    }

    return `rbx_${Math.abs(hash)}`;
  }
}