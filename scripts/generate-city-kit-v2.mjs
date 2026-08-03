import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const ROOT = new URL("../public/assets/city-kit-v2/", import.meta.url);
const DEFINITION_URL = new URL("../app/lib/chicago-kit-v2-definition.json", import.meta.url);
const DEFINITION = JSON.parse(await readFile(DEFINITION_URL, "utf8"));
const VERSION = DEFINITION.version;

globalThis.FileReader ??= class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
};

function stableHash(value) {
  const input = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function material(name, color, roughness, metalness = 0) {
  const value = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  value.name = name;
  return value;
}

function box(parent, name, size, position, mat, rotationY = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  parent.add(mesh);
}

function moduleGroup(name, x) {
  const group = new THREE.Group();
  group.name = name;
  group.position.x = x;
  return group;
}

function makeFamily(family, familyDefinition) {
  const root = new THREE.Group();
  root.name = `${family}-kit-v2`;
  root.userData = {
    version: VERSION,
    classification: "NON_SEMANTIC_URBAN_CONTEXT",
    license: "Apache-2.0",
    canonicalDefinition: "app/lib/chicago-kit-v2-definition.json",
    purpose: "tooling-reference-runtime-procedural-parity",
  };
  const [wallColor, trimColor, glassColor] = familyDefinition.colors;
  const wall = material(`${family}-wall`, wallColor, 0.82);
  const trim = material(`${family}-trim`, trimColor, 0.58, family.includes("miesian") || family.includes("bronze") ? 0.52 : 0.05);
  const glass = material(`${family}-glass`, glassColor, 0.2, 0.04);
  const roof = material(`${family}-roof`, "#343b3c", 0.9);
  let cursor = -20;

  for (const [index, name] of familyDefinition.bases.entries()) {
    const recipe = DEFINITION.baseRecipes[index];
    const group = moduleGroup(`base-${name}`, cursor);
    cursor += 5;
    const height = 1.05 * recipe.heightScale;
    box(group, "base-shell", [3.5, height, 1], [0, height / 2, 0], wall);
    box(group, "ground-opening", [3.1 * recipe.openingWidth, height * 0.62, recipe.recess], [0, height * 0.48, 0.53], glass);
    for (let pier = 0; pier < 5; pier += recipe.pierCadence) box(group, `pier-${pier}`, [0.12, height * 0.92, recipe.recess + 0.06], [-1.4 + pier * 0.7, height * 0.5, 0.56], trim);
    box(group, "canopy", [2.1, 0.09, recipe.canopyDepth], [0, height * 0.74, 0.72], trim);
    box(group, "plinth", [3.4, recipe.plinthHeight, 0.15], [0, recipe.plinthHeight / 2, 0.55], trim);
    root.add(group);
  }

  for (const [index, name] of familyDefinition.rhythms.entries()) {
    const recipe = DEFINITION.rhythmRecipes[index];
    const group = moduleGroup(`middle-${name}`, cursor);
    cursor += 5;
    box(group, "middle-wall", [3.5, 2.8, 1], [0, 1.4, 0], wall);
    const bays = 3 * recipe.grouping;
    for (let floor = 0; floor < 3; floor += 1) {
      box(group, `band-${floor}`, [3.5, recipe.band, recipe.reveal + 0.05], [0, 0.36 + floor * 0.86, 0.55], trim);
      for (let bay = 0; bay < bays; bay += 1) {
        const bayWidth = 3.1 / bays;
        const x = -1.55 + bayWidth * (bay + 0.5) + (floor % 2 ? -recipe.offset : recipe.offset);
        box(group, `window-${floor}-${bay}`, [bayWidth * recipe.windowWidth, 0.82 * recipe.windowHeight, recipe.reveal], [x, 0.7 + floor * 0.86, 0.55], glass);
      }
    }
    for (let bay = 0; bay <= bays; bay += recipe.grouping) box(group, `mullion-${bay}`, [recipe.pier, 2.65, recipe.reveal + 0.08], [-1.55 + 3.1 / bays * bay, 1.4, 0.58], trim);
    root.add(group);
  }

  for (const [index, name] of familyDefinition.corners.entries()) {
    const recipe = DEFINITION.cornerRecipes[index];
    const group = moduleGroup(`corner-${name}`, cursor);
    cursor += 5;
    box(group, "corner-body", [recipe.width, 2.8, recipe.depth], [0, 1.4, 0], recipe.wrapGlass > 0.4 ? glass : trim, recipe.rotation);
    for (let fin = 0; fin < recipe.fins; fin += 1) box(group, `corner-fin-${fin}`, [0.045, 2.8 * recipe.wrapGlass, recipe.depth + recipe.projection], [(fin - (recipe.fins - 1) / 2) * 0.12, 1.4, 0.08], trim);
    root.add(group);
  }

  for (const [name, kind] of [["end-wall-exposed", "exposed"], ["end-wall-party", "party"], ["rear-service", "rear"]]) {
    const group = moduleGroup(name, cursor);
    cursor += 5;
    box(group, `${kind}-wall`, [3.4, 2.8, 1], [0, 1.4, 0], wall);
    if (kind === "exposed") for (const y of [0.7, 1.45, 2.2]) box(group, `end-window-${y}`, [1.4, 0.42, 0.08], [0, y, 0.55], glass);
    if (kind === "rear") box(group, "service-opening", [1.2, 0.9, 0.08], [0, 0.55, 0.55], trim);
    root.add(group);
  }

  for (const [index, name] of familyDefinition.roofs.entries()) {
    const recipe = DEFINITION.roofRecipes[index];
    const group = moduleGroup(`roof-${name}`, cursor);
    cursor += 5;
    box(group, "cornice", [3.6 + recipe.tiers * 0.04, 0.16, 1.08], [0, 0.08, 0], trim);
    for (let tier = 0; tier < recipe.tiers; tier += 1) {
      const scale = 1 - tier * 0.18;
      box(group, `roof-tier-${tier}`, [3.5 * recipe.widthScale * scale, Math.max(0.3, 2.8 * recipe.heightScale / recipe.tiers), recipe.depthScale * scale], [recipe.offset * (tier + 1), 0.28 + tier * 0.28, 0], roof);
    }
    for (let fin = 0; fin < recipe.fins; fin += 1) box(group, `roof-fin-${fin}`, [0.1, 0.86, 0.42], [(fin - (recipe.fins - 1) / 2) * 0.42, 0.58, 0.2], trim, fin % 2 ? 0.08 : -0.08);
    root.add(group);
  }
  return root;
}

function triangleCount(root) {
  let triangles = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    triangles += object.geometry.index ? object.geometry.index.count / 3 : object.geometry.getAttribute("position").count / 3;
  });
  return Math.round(triangles);
}

function rootMap(familyDefinition) {
  return {
    bases: Object.fromEntries(familyDefinition.bases.map((name) => [name, `base-${name}`])),
    rhythms: Object.fromEntries(familyDefinition.rhythms.map((name) => [name, `middle-${name}`])),
    corners: Object.fromEntries(familyDefinition.corners.map((name) => [name, `corner-${name}`])),
    roofs: Object.fromEntries(familyDefinition.roofs.map((name) => [name, `roof-${name}`])),
    exposure: { exposedEnd: "end-wall-exposed", partyWall: "end-wall-party", rearService: "rear-service" },
  };
}

function variantFingerprints(family, familyDefinition) {
  const entries = [];
  for (const [kind, names, recipes] of [
    ["rhythm", familyDefinition.rhythms, DEFINITION.rhythmRecipes],
    ["base", familyDefinition.bases, DEFINITION.baseRecipes],
    ["corner", familyDefinition.corners, DEFINITION.cornerRecipes],
    ["roof", familyDefinition.roofs, DEFINITION.roofRecipes],
  ]) for (const [index, name] of names.entries()) entries.push([`${kind}:${name}`, stableHash({ family, kind, recipe: recipes[index] })]);
  return Object.fromEntries(entries);
}

async function exportFamily(family, familyDefinition) {
  const scene = new THREE.Scene();
  scene.name = `${family}-catalog`;
  const root = makeFamily(family, familyDefinition);
  scene.add(root);
  const result = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, trs: false });
  const bytes = Buffer.from(result);
  const file = `${family}.glb`;
  await writeFile(new URL(file, ROOT), bytes);
  const mappings = rootMap(familyDefinition);
  return {
    family,
    file,
    bytes: bytes.length,
    triangles: triangleCount(root),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    definitionFingerprint: stableHash(familyDefinition),
    rootMap: mappings,
    roots: Object.values(mappings).flatMap((value) => Object.values(value)),
    variantFingerprints: variantFingerprints(family, familyDefinition),
    usage: "tooling-reference-runtime-procedural-parity",
  };
}

await mkdir(ROOT, { recursive: true });
const assets = [];
for (const [family, familyDefinition] of Object.entries(DEFINITION.families)) assets.push(await exportFamily(family, familyDefinition));
const catalog = {
  version: VERSION,
  deterministic: true,
  license: "Apache-2.0",
  classification: "NON_SEMANTIC_URBAN_CONTEXT",
  canonicalDefinition: "app/lib/chicago-kit-v2-definition.json",
  generatedFrom: "scripts/generate-city-kit-v2.mjs",
  assets,
};
await writeFile(new URL("catalog.json", ROOT), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(JSON.stringify(catalog, null, 2));
