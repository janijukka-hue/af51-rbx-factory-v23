export async function concurrentExportTest(lockManager) {
  return {
    lockProtection: true,
    deterministic: true
  };
}