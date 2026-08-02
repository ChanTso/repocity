import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const ROOT = new URL("../public/assets/city-kit-v2/", import.meta.url);
const VERSION = "0.2";

globalThis.FileReader ??= class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
};

const FAMILIES = [
  ["chicago-school-masonry", "#8b493b", "#c7b995", "#2d3639"],
  ["miesian-grid", "#29363a", "#263033", "#54777c"],
  ["blue-green-curtain-wall", "#507a7d", "#a9a795", "#6da4a7"],
  ["bronze-vertical-modern", "#495052", "#5d4b3c", "#607b7b"],
  ["fulton-brick-warehouse", "#914a39", "#4d3731", "#334044"],
  ["narrow-storefront-row", "#b28365", "#d0bd99", "#374348"],
  ["art-deco-setback", "#c8bfa7", "#5b554d", "#41555a"],
  ["civic-institutional", "#c9bd9e", "#4a4640", "#506b70"],
  ["riverfront-terrace", "#929e9b", "#514a40", "#648d90"],
];

function material(name, color, roughness, metalness = 0) {
  const value = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  value.name = name;
  return value;
}

function box(parent, name, size, position, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.name = name;
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

function moduleGroup(name, x) {
  const group = new THREE.Group();
  group.name = name;
  group.position.x = x;
  return group;
}

function makeFamily([family, wallColor, trimColor, glassColor]) {
  const root = new THREE.Group();
  root.name = `${family}-kit-v2`;
  root.userData = {
    version: VERSION,
    classification: "NON_SEMANTIC_URBAN_CONTEXT",
    license: "Apache-2.0",
    source: "RepoCity deterministic original geometry",
  };
  const wall = material(`${family}-wall`, wallColor, 0.82);
  const trim = material(`${family}-trim`, trimColor, 0.58, family.includes("miesian") || family.includes("bronze") ? 0.52 : 0.05);
  const glass = material(`${family}-glass`, glassColor, 0.2, 0.04);
  const roof = material(`${family}-roof`, "#343b3c", 0.9);

  const base = moduleGroup("base", -6);
  box(base, "base-shell", [3.5, 1.05, 1], [0, 0.525, 0], wall);
  box(base, "recessed-ground-floor", [3.08, 0.72, 0.08], [0, 0.47, 0.53], glass);
  for (const x of [-1.4, -0.7, 0, 0.7, 1.4]) box(base, `ground-pier-${x}`, [0.12, 0.95, 0.16], [x, 0.5, 0.57], trim);
  box(base, "entry-canopy", [0.9, 0.08, 0.52], [0, 0.82, 0.72], trim);
  root.add(base);

  for (let rhythm = 0; rhythm < 3; rhythm += 1) {
    const middle = moduleGroup(`middle-rhythm-${rhythm + 1}`, -2 + rhythm * 4);
    box(middle, "middle-wall", [3.5, 2.8, 1], [0, 1.4, 0], wall);
    const bays = 3 + rhythm;
    for (let floor = 0; floor < 3; floor += 1) {
      box(middle, `spandrel-${floor}`, [3.55, 0.1 + rhythm * 0.025, 0.12], [0, 0.36 + floor * 0.86, 0.55], trim);
      for (let bay = 0; bay < bays; bay += 1) {
        const width = 2.9 / bays;
        const x = -1.45 + width / 2 + bay * width;
        box(middle, `window-${floor}-${bay}`, [width * 0.72, 0.55, 0.08], [x, 0.7 + floor * 0.86, 0.545], glass);
        if (family.includes("miesian") || family.includes("bronze") || family.includes("curtain") || family.includes("riverfront")) {
          box(middle, `mullion-${floor}-${bay}`, [0.065 + rhythm * 0.015, 0.72, 0.13], [x - width * 0.42, 0.7 + floor * 0.86, 0.57], trim);
        }
      }
    }
    root.add(middle);
  }

  for (let variant = 0; variant < 2; variant += 1) {
    const corner = moduleGroup(`corner-${variant + 1}`, 10 + variant * 4);
    box(corner, "corner-wall", [3.4, 2.8, 1], [0, 1.4, 0], wall);
    box(corner, "front-glass", [2.72, 2.22, 0.08], [-0.18 + variant * 0.32, 1.4, 0.55], glass);
    box(corner, "corner-pier", [0.28, 2.9, 0.25], [variant ? -1.5 : 1.5, 1.45, 0.58], trim);
    box(corner, "corner-return", [0.16, 2.3, 0.78], [variant ? 1.62 : -1.62, 1.38, 0.08], trim);
    root.add(corner);
  }

  const endWall = moduleGroup("end-wall", 18);
  box(endWall, "party-wall", [3.4, 2.8, 1], [0, 1.4, 0], wall);
  for (const y of [0.55, 1.4, 2.25]) box(endWall, `end-wall-course-${y}`, [3.48, 0.09, 0.12], [0, y, 0.55], trim);
  root.add(endWall);

  const shoulder = moduleGroup("setback-shoulder", 22);
  box(shoulder, "shoulder", [3.5, 0.52, 1], [0, 0.26, 0], wall);
  box(shoulder, "shoulder-cap", [3.65, 0.12, 1.1], [0, 0.58, 0], trim);
  root.add(shoulder);

  for (let variant = 0; variant < 3; variant += 1) {
    const top = moduleGroup(`roof-${variant + 1}`, 26 + variant * 4);
    box(top, "cornice", [3.72 - variant * 0.12, 0.16, 1.08], [0, 0.08, 0], trim);
    box(top, "roof-house", [1.7 - variant * 0.2, 0.48 + variant * 0.14, 0.65], [variant === 1 ? 0.52 : -0.3, 0.4, 0], roof);
    if (variant === 2) {
      box(top, "crown-left", [0.2, 0.82, 0.22], [-0.78, 0.58, 0.43], trim);
      box(top, "crown-right", [0.2, 0.82, 0.22], [0.78, 0.58, 0.43], trim);
    }
    root.add(top);
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

async function exportFamily(definition) {
  const family = definition[0];
  const scene = new THREE.Scene();
  scene.name = `${family}-catalog`;
  const root = makeFamily(definition);
  scene.add(root);
  const result = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, trs: false });
  const bytes = Buffer.from(result);
  const file = `${family}.glb`;
  await writeFile(new URL(file, ROOT), bytes);
  return {
    file,
    bytes: bytes.length,
    triangles: triangleCount(root),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    roots: ["base", "middle-rhythm-1", "middle-rhythm-2", "middle-rhythm-3", "corner-1", "corner-2", "end-wall", "setback-shoulder", "roof-1", "roof-2", "roof-3"],
  };
}

await mkdir(ROOT, { recursive: true });
const assets = [];
for (const definition of FAMILIES) assets.push(await exportFamily(definition));
const catalog = {
  version: VERSION,
  deterministic: true,
  license: "Apache-2.0",
  classification: "NON_SEMANTIC_URBAN_CONTEXT",
  generatedFrom: "scripts/generate-city-kit-v2.mjs",
  assets,
};
await writeFile(new URL("catalog.json", ROOT), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(JSON.stringify(catalog, null, 2));
