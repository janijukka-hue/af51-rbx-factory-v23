// s4/oliot/rbx-skills/MeshSkill.js
// KERROS: S4 – Olio · RBX Skill Layer · Version 1.0.0
//
// MeshSkill — meshes. Two jobs:
//   1. A MeshPart is an imported mesh → never a plain box. Use MeshType if
//      present, else a rounded default so it reads as a mesh.
//   2. A Part with a SpecialMesh/SphereMesh/CylinderMesh/BlockMesh CHILD adopts
//      that child's shape (so a Part + SpecialMesh.Head renders as a head/ball).
//
// This is interpretation, not generation: it reads the mesh the user wrote.

import { meshTypeToShape, meshClassToShape } from "./_skillBase.js";

const MESH_CLASSES = new Set(["SpecialMesh", "SphereMesh", "CylinderMesh", "BlockMesh"]);

export const MeshSkill = {
  name: "MeshSkill",

  // Match a MeshPart, OR a Part that owns a mesh child, OR a mesh node itself.
  match(node, ctx) {
    if (!node) return false;
    if (node.className === "MeshPart") return true;
    if (MESH_CLASSES.has(node.className)) return true;
    // Part with a mesh child?
    if (node.varName && ctx) {
      return ctx.childrenOf(node.varName).some((c) => MESH_CLASSES.has(c.className));
    }
    return false;
  },

  interpret(node, ctx) {
    const p = node.properties || {};

    // A standalone mesh node: not separately drawn (parent adopts its shape).
    if (MESH_CLASSES.has(node.className)) {
      return { kind: "mesh-modifier", drawable: false };
    }

    // MeshPart: rounded by nature.
    if (node.className === "MeshPart") {
      const shape = meshTypeToShape(p.MeshType) || "Cylinder";
      return { kind: "meshpart", shape, drawable: true };
    }

    // A Part hosting a mesh child → inherit the child's shape.
    if (node.varName && ctx) {
      const child = ctx.childrenOf(node.varName).find((c) => MESH_CLASSES.has(c.className));
      if (child) {
        const shape = child.className === "SpecialMesh"
          ? meshTypeToShape((child.properties || {}).MeshType)
          : meshClassToShape(child.className);
        if (shape) return { kind: "meshed-part", shape, drawable: true };
      }
    }
    return {};
  },
};

export default MeshSkill;
