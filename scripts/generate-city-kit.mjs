import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const ROOT = new URL("../public/assets/city-kit-v1/", import.meta.url);
const TEXTURES = new URL("textures/", ROOT);

globalThis.FileReader ??= class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
};

const material = (name, color, roughness = 0.72, metalness = 0) => {
  const value = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  value.name = name;
  return value;
};

const MAT = {
  brick: material("warm-red-brick", "#8f4938", 0.91),
  darkBrick: material("dark-aged-brick", "#4e3631", 0.94),
  limestone: material("warm-limestone", "#c7b995", 0.88),
  concrete: material("architectural-concrete", "#8f908b", 0.9),
  steel: material("dark-structural-steel", "#1b2327", 0.29, 0.72),
  bronze: material("weathered-bronze", "#57483d", 0.36, 0.61),
  painted: material("painted-metal", "#53675f", 0.46, 0.38),
  glass: material("smoked-curtain-glass", "#557b82", 0.16, 0.08),
  glassBlue: material("blue-green-curtain-glass", "#6aa4aa", 0.18, 0.06),
  interior: material("warm-interior-card", "#d99a55", 0.82),
  canopy: material("shop-canopy", "#9c493b", 0.62, 0.08),
  asphalt: material("asphalt", "#30383c", 0.92),
  sidewalk: material("sidewalk-concrete", "#b8b5aa", 0.9),
  riverWall: material("river-wall-masonry", "#6f746f", 0.94),
  roof: material("roof-membrane", "#494d4a", 0.88),
  red: material("signal-red", "#a7302d", 0.54, 0.08),
  amber: material("signal-amber", "#d59b36", 0.5, 0.08),
  green: material("signal-green", "#3c8b70", 0.5, 0.08),
  foliage: material("foliage", "#315b3a", 0.96),
  bark: material("bark", "#554236", 1),
};

function prismGeometry(width, height, depth) {
  const x = width / 2;
  const y = height / 2;
  const z = depth / 2;
  const positions = [];
  const normals = [];
  const uvs = [];
  const faces = [
    [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]],
    [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]],
    [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0]],
    [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0]],
    [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0]],
    [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]],
  ];
  for (const [a, b, c, d, normal] of faces) {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let index = 0; index < 6; index += 1) normals.push(...normal);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("uv1", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

function prism(parent, name, size, position, mat, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(prismGeometry(...size), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, name, radius, height, position, mat, radialSegments = 12) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, radialSegments),
    mat,
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function windowBay(parent, prefix, x, y, width, height, z, frame = MAT.steel, glass = MAT.glass) {
  prism(parent, `${prefix}-recess`, [width, height, 0.035], [x, y, z], glass);
  const bar = Math.min(width, height) * 0.075;
  prism(parent, `${prefix}-lintel`, [width + bar * 2.2, bar, 0.065], [x, y + height / 2 + bar / 2, z + 0.018], frame);
  prism(parent, `${prefix}-sill`, [width + bar * 2.2, bar * 0.7, 0.08], [x, y - height / 2 - bar * 0.35, z + 0.025], frame);
  prism(parent, `${prefix}-mullion`, [bar, height, 0.06], [x, y, z + 0.02], frame);
}

function sideWindowBay(parent, prefix, z, y, width, height, x, side, frame = MAT.steel, glass = MAT.glass) {
  const surfaceX = x + side * 0.006;
  const bar = Math.min(width, height) * 0.075;
  prism(parent, `${prefix}-recess`, [0.035, height, width], [surfaceX, y, z], glass);
  prism(parent, `${prefix}-lintel`, [0.065, bar, width + bar * 2.2], [surfaceX + side * 0.018, y + height / 2 + bar / 2, z], frame);
  prism(parent, `${prefix}-sill`, [0.08, bar * 0.7, width + bar * 2.2], [surfaceX + side * 0.025, y - height / 2 - bar * 0.35, z], frame);
  prism(parent, `${prefix}-mullion`, [0.06, height, bar], [surfaceX + side * 0.02, y, z], frame);
}

function storefront(parent, prefix, x, width, z = 0.511, options = {}) {
  const frame = options.frame ?? MAT.steel;
  const canopy = options.canopy ?? MAT.canopy;
  prism(parent, `${prefix}-interior`, [width * 0.9, 0.135, 0.035], [x, 0.108, z - 0.025], MAT.interior);
  prism(parent, `${prefix}-glass`, [width * 0.92, 0.14, 0.04], [x, 0.1, z], MAT.glass);
  prism(parent, `${prefix}-door`, [width * 0.2, 0.145, 0.055], [x + width * 0.25, 0.09, z + 0.014], MAT.glassBlue);
  prism(parent, `${prefix}-left-frame`, [0.016, 0.16, 0.07], [x - width * 0.48, 0.095, z + 0.02], frame);
  prism(parent, `${prefix}-right-frame`, [0.016, 0.16, 0.07], [x + width * 0.48, 0.095, z + 0.02], frame);
  prism(parent, `${prefix}-sign-band`, [width * 0.94, 0.042, 0.068], [x, 0.19, z + 0.018], frame);
  prism(parent, `${prefix}-canopy`, [width * 0.82, 0.018, 0.12], [x, 0.163, z + 0.064], canopy, [-0.08, 0, 0]);
}

function masonryBuilding() {
  const root = new THREE.Group();
  root.name = "masonry-building";
  prism(root, "masonry-shell", [1, 0.94, 0.96], [0, 0.47, 0], MAT.brick);
  prism(root, "stone-plinth", [1.03, 0.15, 0.99], [0, 0.075, 0], MAT.limestone);
  for (let floor = 0; floor < 4; floor += 1) {
    for (let bay = 0; bay < 5; bay += 1) {
      windowBay(root, `warehouse-f${floor}-b${bay}`, -0.4 + bay * 0.2, 0.31 + floor * 0.145, 0.115, 0.08, 0.493, MAT.darkBrick);
    }
    prism(root, `warehouse-string-course-${floor}`, [1.035, 0.014, 0.045], [0, 0.247 + floor * 0.145, 0.502], MAT.darkBrick);
    for (const side of [-1, 1]) {
      for (let bay = 0; bay < 3; bay += 1) {
        sideWindowBay(root, `warehouse-side-${side}-f${floor}-b${bay}`, -0.25 + bay * 0.25, 0.31 + floor * 0.145, 0.14, 0.08, side * 0.502, side, MAT.darkBrick);
      }
    }
  }
  for (let bay = 0; bay < 4; bay += 1) storefront(root, `warehouse-shop-${bay}`, -0.375 + bay * 0.25, 0.225);
  prism(root, "deep-cornice", [1.08, 0.055, 1.03], [0, 0.94, 0], MAT.darkBrick);
  prism(root, "parapet", [1.035, 0.075, 0.98], [0, 0.992, 0], MAT.brick);
  for (let level = 0; level < 3; level += 1) {
    prism(root, `fire-escape-platform-${level}`, [0.24, 0.018, 0.16], [0.512, 0.38 + level * 0.19, 0.15], MAT.steel);
    for (const offset of [-0.095, 0.095]) cylinder(root, `fire-escape-rail-${level}-${offset}`, 0.006, 0.12, [0.525, 0.445 + level * 0.19, 0.15 + offset], MAT.steel, 6);
  }
  prism(root, "roof-stair-head", [0.2, 0.07, 0.22], [0.22, 1.065, -0.13], MAT.roof);
  return root;
}

function limestoneBuilding() {
  const root = new THREE.Group();
  root.name = "limestone-office";
  prism(root, "limestone-core", [0.96, 0.97, 0.93], [0, 0.485, 0], MAT.limestone);
  prism(root, "rusticated-base", [1.03, 0.19, 0.99], [0, 0.095, 0], MAT.concrete);
  for (let bay = 0; bay < 6; bay += 1) {
    const x = -0.416 + bay * 0.1665;
    prism(root, `pilaster-${bay}`, [0.037, 0.78, 0.064], [x, 0.57, 0.49], MAT.limestone);
  }
  for (let floor = 0; floor < 7; floor += 1) {
    for (let bay = 0; bay < 5; bay += 1) {
      windowBay(root, `office-f${floor}-b${bay}`, -0.332 + bay * 0.166, 0.275 + floor * 0.093, 0.098, 0.052, 0.484, MAT.bronze, MAT.glass);
    }
    for (const side of [-1, 1]) {
      for (let bay = 0; bay < 3; bay += 1) {
        sideWindowBay(root, `office-side-${side}-f${floor}-b${bay}`, -0.24 + bay * 0.24, 0.275 + floor * 0.093, 0.13, 0.052, side * 0.482, side, MAT.bronze, MAT.glass);
      }
    }
  }
  prism(root, "office-entablature", [1.045, 0.06, 0.995], [0, 0.92, 0], MAT.limestone);
  prism(root, "office-crown", [0.91, 0.09, 0.86], [0, 1.015, -0.015], MAT.limestone);
  prism(root, "recessed-entry", [0.23, 0.155, 0.055], [0, 0.105, 0.502], MAT.glassBlue);
  prism(root, "entry-surround", [0.34, 0.035, 0.09], [0, 0.19, 0.525], MAT.limestone);
  for (const x of [-0.33, 0.33]) storefront(root, `office-shop-${x}`, x, 0.25, 0.507, { frame: MAT.bronze, canopy: MAT.painted });
  prism(root, "roof-penthouse", [0.35, 0.07, 0.38], [0.16, 1.09, -0.08], MAT.roof);
  return root;
}

function curtainBuilding(name, variant) {
  const root = new THREE.Group();
  root.name = name;
  const frame = variant === "bronze" ? MAT.bronze : MAT.steel;
  const glass = variant === "blue" ? MAT.glassBlue : MAT.glass;
  const podiumHeight = variant === "transparent" ? 0.22 : 0.16;
  prism(root, `${name}-lobby-interior`, [0.96, podiumHeight, 0.82], [0, podiumHeight / 2, 0], MAT.interior);
  prism(root, `${name}-podium-glass`, [1, podiumHeight, 0.91], [0, podiumHeight / 2, 0], glass);
  const shaftWidth = variant === "vertical" ? 0.79 : 0.88;
  prism(root, `${name}-shaft-glass`, [shaftWidth, 0.78, 0.82], [variant === "vertical" ? 0.05 : 0, 0.57, -0.025], glass);
  for (let floor = 0; floor <= 10; floor += 1) {
    prism(root, `${name}-spandrel-${floor}`, [shaftWidth + 0.015, 0.015, 0.86], [variant === "vertical" ? 0.05 : 0, 0.19 + floor * 0.071, -0.025], frame);
  }
  const columns = variant === "vertical" ? 7 : variant === "blue" ? 9 : 8;
  for (let column = 0; column < columns; column += 1) {
    const x = -shaftWidth / 2 + column * (shaftWidth / (columns - 1)) + (variant === "vertical" ? 0.05 : 0);
    const width = variant === "vertical" ? 0.025 : 0.012;
    const depth = variant === "vertical" ? 0.09 : 0.035;
    prism(root, `${name}-mullion-${column}`, [width, 0.82, depth], [x, 0.57, 0.423], frame);
  }
  for (let bay = 0; bay < 2; bay += 1) storefront(root, `${name}-shop-${bay}`, -0.24 + bay * 0.48, 0.38, 0.472, { frame, canopy: variant === "bronze" ? MAT.bronze : MAT.painted });
  prism(root, `${name}-roof-screen`, [shaftWidth * 0.7, 0.055, 0.54], [variant === "vertical" ? 0.05 : 0, 0.99, -0.02], MAT.roof);
  if (variant === "transparent") {
    for (const x of [-0.36, -0.12, 0.12, 0.36]) cylinder(root, `${name}-lobby-column-${x}`, 0.012, 0.21, [x, 0.105, 0.43], frame, 8);
  }
  return root;
}

function storefrontKit() {
  const root = new THREE.Group();
  root.name = "storefront-row";
  for (let bay = 0; bay < 4; bay += 1) storefront(root, `modular-shop-${bay}`, -0.375 + bay * 0.25, 0.225, 0);
  return root;
}

function streetRiverKit() {
  const scene = new THREE.Group();
  scene.name = "street-river-kit";
  const lamp = new THREE.Group();
  lamp.name = "street-lamp";
  cylinder(lamp, "lamp-post", 0.025, 0.8, [0, 0.4, 0], MAT.steel, 10);
  prism(lamp, "lamp-arm", [0.28, 0.025, 0.025], [0.12, 0.78, 0], MAT.steel);
  prism(lamp, "lamp-head", [0.13, 0.055, 0.08], [0.25, 0.75, 0], MAT.painted);
  scene.add(lamp);
  const signal = new THREE.Group();
  signal.name = "traffic-signal";
  cylinder(signal, "signal-post", 0.025, 0.75, [0, 0.375, 0], MAT.steel, 10);
  prism(signal, "signal-arm", [0.55, 0.025, 0.025], [0.25, 0.7, 0], MAT.steel);
  prism(signal, "signal-case", [0.08, 0.22, 0.08], [0.51, 0.59, 0], MAT.steel);
  cylinder(signal, "red-lens", 0.018, 0.012, [0.51, 0.65, 0.045], MAT.red, 12).rotation.x = Math.PI / 2;
  cylinder(signal, "amber-lens", 0.018, 0.012, [0.51, 0.59, 0.045], MAT.amber, 12).rotation.x = Math.PI / 2;
  cylinder(signal, "green-lens", 0.018, 0.012, [0.51, 0.53, 0.045], MAT.green, 12).rotation.x = Math.PI / 2;
  scene.add(signal);
  const river = new THREE.Group();
  river.name = "river-edge";
  prism(river, "river-wall", [1, 0.42, 0.16], [0, 0.21, 0], MAT.riverWall);
  prism(river, "river-cap", [1.02, 0.04, 0.22], [0, 0.44, 0], MAT.concrete);
  for (let index = 0; index <= 10; index += 1) cylinder(river, `railing-post-${index}`, 0.008, 0.34, [-0.5 + index * 0.1, 0.63, 0], MAT.steel, 6);
  for (const y of [0.52, 0.66, 0.78]) prism(river, `railing-rail-${y}`, [1.02, 0.012, 0.012], [0, y, 0], MAT.steel);
  scene.add(river);
  const abutment = new THREE.Group();
  abutment.name = "bridge-abutment";
  prism(abutment, "abutment-body", [0.55, 0.65, 0.5], [0, 0.325, 0], MAT.riverWall);
  prism(abutment, "abutment-cap", [0.65, 0.08, 0.58], [0, 0.69, 0], MAT.limestone);
  prism(abutment, "bridge-bearing", [0.36, 0.08, 0.34], [0, 0.77, 0], MAT.steel);
  scene.add(abutment);
  const shelter = new THREE.Group();
  shelter.name = "transit-shelter";
  prism(shelter, "shelter-roof", [0.8, 0.045, 0.28], [0, 0.66, 0], MAT.steel);
  for (const x of [-0.36, 0.36]) cylinder(shelter, `shelter-post-${x}`, 0.015, 0.62, [x, 0.31, 0], MAT.steel, 8);
  prism(shelter, "shelter-glass", [0.7, 0.5, 0.025], [0, 0.36, -0.11], MAT.glass);
  prism(shelter, "shelter-bench", [0.5, 0.055, 0.12], [0, 0.19, -0.02], MAT.painted);
  scene.add(shelter);
  const parkedCar = new THREE.Group();
  parkedCar.name = "parked-car";
  prism(parkedCar, "car-body", [0.62, 0.16, 0.3], [0, 0.14, 0], MAT.painted);
  prism(parkedCar, "car-cabin", [0.32, 0.13, 0.26], [-0.02, 0.265, 0], MAT.glass);
  for (const x of [-0.22, 0.22]) for (const z of [-0.16, 0.16]) cylinder(parkedCar, `wheel-${x}-${z}`, 0.055, 0.035, [x, 0.08, z], MAT.steel, 12).rotation.x = Math.PI / 2;
  scene.add(parkedCar);
  const bench = new THREE.Group();
  bench.name = "street-bench";
  for (const z of [-0.08, 0.08]) prism(bench, `bench-slat-${z}`, [0.62, 0.035, 0.065], [0, z === -0.08 ? 0.31 : 0.19, z], MAT.painted, z === -0.08 ? [-0.16, 0, 0] : [0, 0, 0]);
  for (const x of [-0.25, 0.25]) cylinder(bench, `bench-leg-${x}`, 0.018, 0.18, [x, 0.09, 0.04], MAT.steel, 8);
  scene.add(bench);
  const planter = new THREE.Group();
  planter.name = "street-planter";
  cylinder(planter, "planter-pot", 0.18, 0.24, [0, 0.12, 0], MAT.concrete, 16);
  cylinder(planter, "planter-trunk", 0.035, 0.48, [0, 0.46, 0], MAT.bark, 8);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), MAT.foliage);
  crown.name = "planter-crown";
  crown.position.y = 0.78;
  crown.castShadow = true;
  planter.add(crown);
  scene.add(planter);
  const bike = new THREE.Group();
  bike.name = "parked-bike";
  for (const x of [-0.22, 0.22]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 18), MAT.steel);
    wheel.name = `bike-wheel-${x}`;
    wheel.position.set(x, 0.14, 0);
    bike.add(wheel);
  }
  prism(bike, "bike-frame-top", [0.38, 0.018, 0.018], [0, 0.23, 0], MAT.painted, [0, 0, 0.12]);
  prism(bike, "bike-frame-down", [0.34, 0.018, 0.018], [-0.02, 0.17, 0], MAT.painted, [0, 0, -0.25]);
  prism(bike, "bike-handlebar", [0.025, 0.22, 0.18], [0.18, 0.31, 0], MAT.steel);
  scene.add(bike);
  const pedestrian = new THREE.Group();
  pedestrian.name = "static-pedestrian";
  cylinder(pedestrian, "pedestrian-body", 0.075, 0.34, [0, 0.34, 0], MAT.canopy, 10);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 8), MAT.limestone);
  head.name = "pedestrian-head";
  head.position.y = 0.57;
  head.castShadow = true;
  pedestrian.add(head);
  for (const x of [-0.035, 0.035]) cylinder(pedestrian, `pedestrian-leg-${x}`, 0.025, 0.25, [x, 0.125, 0], MAT.steel, 8);
  scene.add(pedestrian);
  const streetUtility = new THREE.Group();
  streetUtility.name = "street-utility";
  cylinder(streetUtility, "bollard", 0.045, 0.32, [-0.24, 0.16, 0], MAT.steel, 10);
  cylinder(streetUtility, "hydrant-body", 0.07, 0.24, [0, 0.12, 0], MAT.red, 10);
  cylinder(streetUtility, "hydrant-cap", 0.09, 0.04, [0, 0.26, 0], MAT.red, 10);
  prism(streetUtility, "waste-bin", [0.22, 0.34, 0.22], [0.28, 0.17, 0], MAT.painted);
  scene.add(streetUtility);
  return scene;
}

function texturePixel(family, map, x, y) {
  const noise = ((x * 19 + y * 31 + family.length * 17) % 23) - 11;
  if (map === "normal") return [128 + noise, 128 + Math.floor(noise / 2), 250, 255];
  if (map === "roughness") {
    const roughness = family.includes("metal") ? 112 : family.includes("glass") ? 45 : 205 + noise;
    return [roughness, roughness, roughness, 255];
  }
  if (map === "ao") {
    const value = 225 + Math.floor(noise / 2);
    return [value, value, value, 255];
  }
  const palette = {
    brick: [142, 70, 52],
    limestone: [198, 184, 147],
    concrete: [145, 146, 140],
    metal: [49, 59, 61],
    asphalt: [53, 59, 61],
    sidewalk: [181, 179, 168],
    river: [104, 111, 107],
    roof: [73, 77, 74],
  }[family];
  if (family === "brick") {
    const course = Math.floor(y / 6);
    const mortar = y % 6 === 0 || (x + (course % 2) * 6) % 12 === 0;
    return mortar ? [190, 184, 170, 255] : [...palette.map((value) => value + noise), 255];
  }
  if (family === "limestone" && (x % 16 === 0 || y % 10 === 0)) return [171, 164, 143, 255];
  if (family === "sidewalk" && (x % 16 === 0 || y % 16 === 0)) return [136, 137, 132, 255];
  return [...palette.map((value) => value + noise), 255];
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function makePng(family, map, size = 64) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const pixel = texturePixel(family, map, x, y);
      for (let channel = 0; channel < 4; channel += 1) raw[row + 1 + x * 4 + channel] = pixel[channel];
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function mergeModuleMeshes(group) {
  const meshes = group.children.filter((child) => child instanceof THREE.Mesh);
  if (meshes.length < 2) return;
  const byMaterial = new Map();
  for (const mesh of meshes) {
    if (Array.isArray(mesh.material)) {
      throw new Error(`City-kit module ${group.name} unexpectedly uses multi-material geometry`);
    }
    mesh.updateMatrix();
    let geometry = mesh.geometry.index
      ? mesh.geometry.toNonIndexed()
      : mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrix);
    if (!geometry.getAttribute("uv1") && geometry.getAttribute("uv")) {
      geometry.setAttribute("uv1", geometry.getAttribute("uv").clone());
    }
    for (const name of Object.keys(geometry.attributes)) {
      if (!["position", "normal", "uv", "uv1"].includes(name)) geometry.deleteAttribute(name);
    }
    const list = byMaterial.get(mesh.material) ?? [];
    list.push(geometry);
    byMaterial.set(mesh.material, list);
  }
  for (const mesh of meshes) group.remove(mesh);
  for (const [sourceMaterial, geometries] of byMaterial) {
    const geometry = mergeGeometries(geometries, false);
    if (!geometry) throw new Error(`Unable to merge ${group.name}/${sourceMaterial.name}`);
    const mesh = new THREE.Mesh(geometry, sourceMaterial);
    mesh.name = `${group.name}-${sourceMaterial.name}-merged`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

function optimizeAssetRoot(root) {
  mergeModuleMeshes(root);
  for (const child of root.children) {
    if (child instanceof THREE.Group) mergeModuleMeshes(child);
  }
}

async function exportGlb(fileName, ...objects) {
  const scene = new THREE.Scene();
  scene.name = fileName.replace(".glb", "");
  for (const object of objects) {
    optimizeAssetRoot(object);
    scene.add(object);
  }
  const result = await new GLTFExporter().parseAsync(scene, {
    binary: true,
    onlyVisible: true,
    trs: false,
  });
  const bytes = Buffer.from(result);
  await writeFile(new URL(fileName, ROOT), bytes);
  return { fileName, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}

await mkdir(TEXTURES, { recursive: true });
const assets = [];
assets.push(await exportGlb("masonry-modules.glb", masonryBuilding()));
assets.push(await exportGlb("office-modules.glb", limestoneBuilding()));
assets.push(await exportGlb(
  "curtain-wall-modules.glb",
  curtainBuilding("miesian-grid-tower", "mies"),
  curtainBuilding("blue-unitized-tower", "blue"),
  curtainBuilding("bronze-fin-tower", "vertical"),
  curtainBuilding("transparent-podium-tower", "transparent"),
));
assets.push(await exportGlb("storefront-modules.glb", storefrontKit()));
assets.push(await exportGlb("street-river-modules.glb", streetRiverKit()));

for (const family of ["brick", "limestone", "concrete", "metal", "asphalt", "sidewalk", "river", "roof"]) {
  for (const map of ["basecolor", "normal", "roughness", "ao"]) {
    const fileName = `${family}-${map}.png`;
    const bytes = makePng(family, map);
    await writeFile(new URL(fileName, TEXTURES), bytes);
    assets.push({ fileName: `textures/${fileName}`, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
}

console.log(JSON.stringify({ generatedAt: "deterministic", assets }, null, 2));
