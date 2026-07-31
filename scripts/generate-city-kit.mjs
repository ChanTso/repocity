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
  steel: material("dark-structural-steel", "#354247", 0.34, 0.64),
  bronze: material("weathered-bronze", "#57483d", 0.36, 0.61),
  painted: material("painted-metal", "#53675f", 0.46, 0.38),
  glass: material("smoked-curtain-glass", "#557b82", 0.16, 0.08),
  glassBlue: material("blue-green-curtain-glass", "#6aa4aa", 0.18, 0.06),
  glassClear: material("clear-podium-glass", "#a7c2c0", 0.09, 0.02),
  spandrel: material("blue-green-spandrel", "#47676b", 0.31, 0.12),
  interior: material("warm-interior-card", "#d99a55", 0.82),
  interiorDark: material("interior-shadow-card", "#2d2925", 0.94),
  oak: material("shop-oak", "#8d6745", 0.72),
  paper: material("display-paper", "#d8d0ba", 0.86),
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
  prism(parent, `${prefix}-lintel`, [width + bar * 2.2, bar, 0.028], [x, y + height / 2 + bar / 2, z + 0.01], frame);
  prism(parent, `${prefix}-sill`, [width + bar * 2.2, bar * 0.7, 0.034], [x, y - height / 2 - bar * 0.35, z + 0.014], frame);
  prism(parent, `${prefix}-mullion`, [bar, height, 0.026], [x, y, z + 0.012], frame);
}

function sideWindowBay(parent, prefix, z, y, width, height, x, side, frame = MAT.steel, glass = MAT.glass) {
  const surfaceX = x + side * 0.006;
  const bar = Math.min(width, height) * 0.075;
  prism(parent, `${prefix}-recess`, [0.035, height, width], [surfaceX, y, z], glass);
  prism(parent, `${prefix}-lintel`, [0.028, bar, width + bar * 2.2], [surfaceX + side * 0.01, y + height / 2 + bar / 2, z], frame);
  prism(parent, `${prefix}-sill`, [0.034, bar * 0.7, width + bar * 2.2], [surfaceX + side * 0.014, y - height / 2 - bar * 0.35, z], frame);
  prism(parent, `${prefix}-mullion`, [0.026, height, bar], [surfaceX + side * 0.012, y, z], frame);
}

function masonryBuilding() {
  const root = new THREE.Group();
  root.name = "masonry-building";
  prism(root, "masonry-shell", [1, 0.94, 0.96], [0, 0.47, 0], MAT.brick);
  prism(root, "stone-plinth", [1.03, 0.075, 0.99], [0, 0.0375, 0], MAT.limestone);
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
  prism(root, "warehouse-ground-shadow", [0.92, 0.14, 0.05], [0, 0.11, 0.501], MAT.interiorDark);
  for (const x of [-0.375, -0.125, 0.125, 0.375]) {
    prism(root, `warehouse-ground-pier-${x}`, [0.032, 0.19, 0.08], [x, 0.105, 0.525], MAT.darkBrick);
  }
  prism(root, "deep-cornice", [1.08, 0.055, 1.03], [0, 0.94, 0], MAT.darkBrick);
  prism(root, "parapet", [1.035, 0.075, 0.98], [0, 0.992, 0], MAT.brick);
  for (let level = 0; level < 3; level += 1) {
    prism(root, `fire-escape-platform-${level}`, [0.24, 0.018, 0.16], [0.512, 0.38 + level * 0.19, 0.15], MAT.steel);
    for (const offset of [-0.095, 0.095]) cylinder(root, `fire-escape-rail-${level}-${offset}`, 0.006, 0.12, [0.525, 0.445 + level * 0.19, 0.15 + offset], MAT.steel, 6);
  }
  prism(root, "roof-stair-head", [0.2, 0.07, 0.22], [0.22, 1.065, -0.13], MAT.roof);
  prism(root, "roof-screen-offset", [0.28, 0.045, 0.18], [-0.2, 1.045, 0.19], MAT.painted);
  return root;
}

function limestoneBuilding() {
  const root = new THREE.Group();
  root.name = "limestone-office";
  prism(root, "limestone-core", [0.96, 0.97, 0.93], [0, 0.485, 0], MAT.limestone);
  prism(root, "rusticated-base", [1.03, 0.105, 0.99], [0, 0.0525, 0], MAT.concrete);
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
  for (const x of [-0.33, 0.33]) prism(root, `office-base-shadow-${x}`, [0.24, 0.145, 0.04], [x, 0.1, 0.505], MAT.interiorDark);
  prism(root, "roof-penthouse", [0.35, 0.07, 0.38], [0.16, 1.09, -0.08], MAT.roof);
  return root;
}

function curtainBuilding(name, variant) {
  const root = new THREE.Group();
  root.name = name;
  const frame = variant === "bronze" ? MAT.bronze : MAT.steel;
  const glass = variant === "blue" ? MAT.glassBlue : variant === "transparent" ? MAT.glassClear : MAT.glass;
  const podiumHeight = variant === "transparent" ? 0.22 : 0.16;
  prism(root, `${name}-lobby-interior`, [0.96, podiumHeight, 0.82], [0, podiumHeight / 2, 0], MAT.interior);
  prism(root, `${name}-podium-glass`, [1, podiumHeight, 0.91], [0, podiumHeight / 2, 0], glass);
  const shaftWidth = variant === "vertical" ? 0.79 : 0.88;
  prism(root, `${name}-shaft-glass`, [shaftWidth, 0.78, 0.82], [variant === "vertical" ? 0.05 : 0, 0.57, -0.025], glass);
  for (let floor = 0; floor <= 10; floor += 1) {
    prism(root, `${name}-spandrel-${floor}`, [shaftWidth + 0.015, variant === "blue" ? 0.024 : 0.015, 0.86], [variant === "vertical" ? 0.05 : 0, 0.19 + floor * 0.071, -0.025], variant === "blue" ? MAT.spandrel : frame);
    if (floor % 3 === 1) prism(root, `${name}-interior-${floor}`, [shaftWidth * 0.78, 0.012, 0.78], [variant === "vertical" ? 0.05 : 0, 0.217 + floor * 0.071, 0.006], MAT.interior);
  }
  const columns = variant === "vertical" ? 7 : variant === "blue" ? 9 : 8;
  for (let column = 0; column < columns; column += 1) {
    const x = -shaftWidth / 2 + column * (shaftWidth / (columns - 1)) + (variant === "vertical" ? 0.05 : 0);
    const width = variant === "vertical" ? 0.025 : 0.012;
    const depth = variant === "vertical" ? 0.09 : 0.035;
    prism(root, `${name}-mullion-${column}`, [width, 0.82, depth], [x, 0.57, 0.423], frame);
  }
  prism(root, `${name}-podium-base`, [1.02, 0.035, 0.96], [0, 0.018, 0], frame);
  prism(root, `${name}-roof-screen`, [shaftWidth * 0.7, 0.055, 0.54], [variant === "vertical" ? 0.05 : 0, 0.99, -0.02], MAT.roof);
  if (variant === "transparent") {
    for (const x of [-0.36, -0.12, 0.12, 0.36]) cylinder(root, `${name}-lobby-column-${x}`, 0.012, 0.21, [x, 0.105, 0.43], frame, 8);
  }
  if (variant === "vertical") {
    prism(root, `${name}-stepped-crown`, [shaftWidth * 0.45, 0.07, 0.34], [0.13, 1.055, -0.09], MAT.bronze);
  } else if (variant === "blue") {
    prism(root, `${name}-mechanical-screen`, [shaftWidth * 0.48, 0.08, 0.4], [-0.12, 1.06, 0.05], MAT.painted);
  }
  return root;
}

function programModule(name, kind) {
  const root = new THREE.Group();
  root.name = name;
  const lobby = kind === "office";
  const residential = kind === "residential";
  const service = kind === "service";
  const gallery = kind === "gallery";
  const height = lobby ? 1.18 : 0.92;
  const frame = lobby ? MAT.bronze : service ? MAT.painted : MAT.steel;
  prism(root, `${name}-recess`, [0.94, height, 0.08], [0, height / 2, -0.085], MAT.interiorDark);
  prism(root, `${name}-interior-warmth`, [0.86, height * 0.75, 0.025], [0, height * 0.48, -0.13], service ? MAT.concrete : MAT.interior);
  prism(root, `${name}-glazing`, [0.92, height * 0.78, 0.035], [0, height * 0.45, -0.005], service ? MAT.glass : MAT.glassClear);
  const doorX = lobby || residential ? 0 : service ? 0.22 : 0.28;
  const doorWidth = lobby ? 0.34 : residential ? 0.28 : service ? 0.38 : 0.22;
  prism(root, `${name}-door`, [doorWidth, height * 0.76, 0.055], [doorX, height * 0.43, 0.035], service ? MAT.painted : MAT.glassClear);
  prism(root, `${name}-kickplate`, [doorWidth, 0.09, 0.065], [doorX, 0.045, 0.045], frame);
  prism(root, `${name}-handle`, [0.018, height * 0.22, 0.035], [doorX - doorWidth * 0.28, height * 0.43, 0.075], MAT.bronze);
  for (const x of [-0.47, 0.47]) prism(root, `${name}-jamb-${x}`, [0.035, height + 0.08, 0.11], [x, height / 2, 0], frame);
  prism(root, `${name}-header`, [0.98, 0.055, 0.12], [0, height + 0.025, 0], frame);
  prism(root, `${name}-transom`, [0.92, 0.025, 0.06], [0, height * 0.72, 0.025], frame);
  if (service) {
    for (const x of [-0.28, 0, 0.28]) prism(root, `${name}-loading-panel-${x}`, [0.025, height * 0.74, 0.06], [x, height * 0.43, 0.06], frame);
    prism(root, `${name}-loading-curb`, [0.98, 0.09, 0.28], [0, 0.045, 0.15], MAT.concrete);
  } else if (residential) {
    prism(root, `${name}-stone-surround`, [0.44, height + 0.14, 0.13], [0, height / 2, -0.015], MAT.limestone);
    prism(root, `${name}-inner-door`, [0.28, height * 0.77, 0.06], [0, height * 0.43, 0.075], MAT.glassClear);
    prism(root, `${name}-stoop`, [0.46, 0.09, 0.28], [0, 0.045, 0.13], MAT.limestone);
  } else if (lobby) {
    for (const x of [-0.29, 0.29]) prism(root, `${name}-lobby-mullion-${x}`, [0.025, height, 0.07], [x, height / 2, 0.03], frame);
    prism(root, `${name}-reception`, [0.36, 0.18, 0.16], [-0.2, 0.18, -0.18], MAT.oak);
    cylinder(root, `${name}-vestibule`, 0.16, height * 0.68, [0, height * 0.4, 0.01], MAT.glassClear, 12);
  } else {
    prism(root, `${name}-display-sill`, [0.58, 0.09, 0.13], [-0.14, 0.08, 0.07], MAT.limestone);
    if (kind === "cafe" || kind === "restaurant") {
      prism(root, `${name}-canopy`, [0.82, 0.07, 0.38], [-0.04, height * 0.84, 0.18], kind === "cafe" ? MAT.canopy : MAT.painted, [-0.08, 0, 0]);
      for (const x of [-0.25, 0.02]) {
        cylinder(root, `${name}-table-${x}`, 0.09, 0.04, [x, 0.32, -0.17], MAT.oak, 12);
        cylinder(root, `${name}-table-leg-${x}`, 0.018, 0.27, [x, 0.15, -0.17], MAT.steel, 8);
      }
    } else if (kind === "bookstore") {
      for (const x of [-0.28, -0.08, 0.12]) prism(root, `${name}-books-${x}`, [0.13, 0.32, 0.08], [x, 0.25, -0.17], MAT.paper);
      prism(root, `${name}-blade-sign`, [0.08, 0.32, 0.28], [-0.44, height * 0.72, 0.18], MAT.painted);
      prism(root, `${name}-book-canopy`, [0.76, 0.055, 0.3], [0.03, height * 0.82, 0.16], MAT.limestone, [-0.06, 0, 0]);
    } else if (kind === "market") {
      for (const x of [-0.28, -0.08, 0.12]) prism(root, `${name}-crate-${x}`, [0.16, 0.16, 0.12], [x, 0.17, -0.17], MAT.oak);
      prism(root, `${name}-striped-awning`, [0.9, 0.08, 0.42], [-0.02, height * 0.82, 0.2], MAT.painted, [-0.1, 0, 0]);
    } else if (gallery) {
      for (const x of [-0.25, 0, 0.25]) prism(root, `${name}-art-${x}`, [0.13, 0.34, 0.025], [x, 0.42, -0.17], x === 0 ? MAT.canopy : MAT.paper);
      prism(root, `${name}-minimal-blade`, [0.045, 0.34, 0.24], [0.42, height * 0.68, 0.15], MAT.limestone);
    }
  }
  prism(root, `${name}-sign-band`, [0.86, 0.12, 0.08], [0, height * 0.9, 0.04], service ? MAT.painted : frame);
  return root;
}

function storefrontKit() {
  return [
    programModule("cafe-storefront", "cafe"),
    programModule("restaurant-storefront", "restaurant"),
    programModule("bookstore-storefront", "bookstore"),
    programModule("market-storefront", "market"),
    programModule("gallery-storefront", "gallery"),
    programModule("office-lobby", "office"),
    programModule("residential-entry", "residential"),
    programModule("service-loading", "service"),
  ];
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
  for (let index = 0; index <= 40; index += 1) cylinder(river, `railing-post-${index}`, 0.007, 0.34, [-0.5 + index * 0.025, 0.63, 0], MAT.steel, 6);
  for (const y of [0.52, 0.66, 0.78]) prism(river, `railing-rail-${y}`, [1.02, 0.012, 0.012], [0, y, 0], MAT.steel);
  scene.add(river);
  const abutment = new THREE.Group();
  abutment.name = "bridge-abutment";
  prism(abutment, "abutment-body", [0.55, 0.65, 0.5], [0, 0.325, 0], MAT.riverWall);
  for (const y of [0.16, 0.34, 0.52]) prism(abutment, `abutment-course-${y}`, [0.59, 0.025, 0.53], [0, y, 0], MAT.limestone);
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

  const sidewalk = new THREE.Group();
  sidewalk.name = "sidewalk-pavers";
  prism(sidewalk, "sidewalk-bed", [1, 0.08, 1], [0, 0.04, 0], MAT.sidewalk);
  for (const x of [-0.33, 0, 0.33]) prism(sidewalk, `sidewalk-joint-x-${x}`, [0.012, 0.012, 1.01], [x, 0.088, 0], MAT.concrete);
  for (const z of [-0.33, 0, 0.33]) prism(sidewalk, `sidewalk-joint-z-${z}`, [1.01, 0.012, 0.012], [0, 0.088, z], MAT.concrete);
  scene.add(sidewalk);

  const curb = new THREE.Group();
  curb.name = "curb-gutter";
  prism(curb, "curb", [1, 0.13, 0.18], [0, 0.065, -0.04], MAT.concrete);
  prism(curb, "gutter", [1, 0.035, 0.34], [0, 0.018, 0.19], MAT.asphalt);
  for (const x of [-0.35, 0.35]) prism(curb, `storm-grate-${x}`, [0.18, 0.018, 0.22], [x, 0.043, 0.18], MAT.steel);
  scene.add(curb);

  const markings = new THREE.Group();
  markings.name = "loading-zone";
  for (const x of [-0.42, -0.14, 0.14, 0.42]) prism(markings, `loading-dash-${x}`, [0.16, 0.012, 0.035], [x, 0.006, 0], MAT.limestone);
  prism(markings, "loading-end", [0.035, 0.012, 0.5], [-0.5, 0.006, 0], MAT.limestone);
  scene.add(markings);

  const riverWalk = new THREE.Group();
  riverWalk.name = "waterfront-walk";
  prism(riverWalk, "waterfront-paving", [1, 0.09, 1], [0, 0.045, 0], MAT.sidewalk);
  for (const x of [-0.4, -0.2, 0, 0.2, 0.4]) prism(riverWalk, `waterfront-joint-${x}`, [0.012, 0.012, 1], [x, 0.096, 0], MAT.concrete);
  cylinder(riverWalk, "mooring-bollard", 0.055, 0.22, [0.36, 0.2, -0.32], MAT.steel, 10);
  scene.add(riverWalk);

  const riverStairs = new THREE.Group();
  riverStairs.name = "river-stairs";
  for (let step = 0; step < 5; step += 1) prism(riverStairs, `river-step-${step}`, [1, 0.1, 0.28], [0, 0.05 + step * 0.1, -0.56 + step * 0.23], MAT.limestone);
  scene.add(riverStairs);
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

function makePng(family, map, size = family === "brick" || family === "limestone" ? 128 : 64) {
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
  let triangles = 0;
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    triangles += object.geometry.index
      ? object.geometry.index.count / 3
      : object.geometry.getAttribute("position").count / 3;
  });
  const result = await new GLTFExporter().parseAsync(scene, {
    binary: true,
    onlyVisible: true,
    trs: false,
  });
  const bytes = Buffer.from(result);
  await writeFile(new URL(fileName, ROOT), bytes);
  return { fileName, bytes: bytes.length, triangles: Math.round(triangles), sha256: createHash("sha256").update(bytes).digest("hex") };
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
assets.push(await exportGlb("storefront-modules.glb", ...storefrontKit()));
assets.push(await exportGlb("street-river-modules.glb", streetRiverKit()));

for (const family of ["brick", "limestone", "concrete", "metal", "asphalt", "sidewalk", "river", "roof"]) {
  for (const map of ["basecolor", "normal", "roughness", "ao"]) {
    const fileName = `${family}-${map}.png`;
    const bytes = makePng(family, map);
    await writeFile(new URL(fileName, TEXTURES), bytes);
    assets.push({ fileName: `textures/${fileName}`, bytes: bytes.length, dimensions: `${family === "brick" || family === "limestone" ? 128 : 64}x${family === "brick" || family === "limestone" ? 128 : 64}`, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
}

console.log(JSON.stringify({ generatedAt: "deterministic", assets }, null, 2));
