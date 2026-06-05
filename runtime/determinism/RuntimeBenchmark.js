export async function benchmark(runtime, source, runs = 100) {
  const results = [];

  for (let i = 0; i < runs; i++) {
    const start = Date.now();

    await runtime.run(source, `snap_${i}`);

    results.push(Date.now() - start);
  }

  return {
    runs,
    averageMs: results.reduce((a,b) => a+b, 0) / results.length
  };
}