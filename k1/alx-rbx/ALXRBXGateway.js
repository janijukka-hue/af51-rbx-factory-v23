
export class ALXRBXGateway {
  process(input, layers) {
    let context = {
      source: input,
      timestamp: Date.now()
    };

    for (const layer of layers) {
      context = layer.execute(context);
    }

    return context;
  }
}
