export function validateRobloxStructure(tree) {
  const required = [
    'Workspace',
    'ReplicatedStorage',
    'StarterGui',
    'ServerScriptService'
  ];

  const missing = required.filter(v => !tree.includes(v));

  if (missing.length > 0) {
    throw new Error(`RBX_STRUCTURE_INVALID:${missing.join(',')}`);
  }

  return {
    valid: true,
    checked: required.length
  };
}