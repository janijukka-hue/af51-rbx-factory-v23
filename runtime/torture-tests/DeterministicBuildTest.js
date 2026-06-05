export async function deterministicBuildTest(runtime, source) {
  const a = await runtime.run(source, 'snap_a');
  const b = await runtime.run(source, 'snap_a');

  return JSON.stringify(a) === JSON.stringify(b);
}