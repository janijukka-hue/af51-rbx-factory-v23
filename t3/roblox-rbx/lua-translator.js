// AF51 Deterministic Lua Translator

function parseVector3(input) {

  const match =
    /Vector3\.new\(([-0-9.]+),\s*([-0-9.]+),\s*([-0-9.]+)\)/.exec(input);

  if (!match) {
    return [0,0,0];
  }

  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3])
  ];
}

function parseColor(input) {

  const match =
    /Color3\.fromRGB\((\d+),\s*(\d+),\s*(\d+)\)/.exec(input);

  if (!match) {
    return "#FFFFFF";
  }

  const r = Number(match[1]).toString(16).padStart(2,"0");
  const g = Number(match[2]).toString(16).padStart(2,"0");
  const b = Number(match[3]).toString(16).padStart(2,"0");

  return ("#" + r + g + b).toUpperCase();
}

export function translateLuaToRBXObjects(source) {

  const objects = [];

  const instanceRegex =
    /local\s+(\w+)\s*=\s*Instance\.new\("([A-Za-z0-9_]+)"\)/g;

  let match;

  while ((match = instanceRegex.exec(source)) !== null) {

    const varName = match[1];
    const type = match[2];

    const sizeRegex =
      new RegExp(varName + "\\.Size\\s*=\\s*(Vector3\\.new\\([^\\n]+\\))");

    const positionRegex =
      new RegExp(varName + "\\.Position\\s*=\\s*(Vector3\\.new\\([^\\n]+\\))");

    const colorRegex =
      new RegExp(varName + "\\.Color\\s*=\\s*(Color3\\.fromRGB\\([^\\n]+\\))");

    const sizeMatch = source.match(sizeRegex);
    const positionMatch = source.match(positionRegex);
    const colorMatch = source.match(colorRegex);

    const obj = {
      id: varName,
      type,
      size: sizeMatch ? parseVector3(sizeMatch[1]) : [4,4,4],
      position: positionMatch ? parseVector3(positionMatch[1]) : [0,0,0],
      color: colorMatch ? parseColor(colorMatch[1]) : "#FFFFFF"
    };

    

    objects.push(obj);
  }

  

  return {
    objectCount: objects.length,
    objects
  };
}