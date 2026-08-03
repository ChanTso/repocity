import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type { ChicagoModulePrimitive } from "@/app/lib/chicago-kit-v2-geometry";

const CACHE = new Map<ChicagoModulePrimitive, THREE.BufferGeometry>();

function box(width: number, height: number, depth: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(x, y, z);
  return geometry;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts, false);
  if (!geometry) throw new Error("Chicago Kit v2 could not merge shared module geometry");
  for (const part of parts) part.dispose();
  geometry.computeVertexNormals();
  return geometry;
}

function recessedPanel(frame = 0.08, reveal = 0.2): THREE.BufferGeometry {
  return merge([
    box(1, frame, reveal, 0, 0.5 - frame / 2, 0.5 - reveal / 2),
    box(1, frame, reveal, 0, -0.5 + frame / 2, 0.5 - reveal / 2),
    box(frame, 1 - frame * 2, reveal, -0.5 + frame / 2, 0, 0.5 - reveal / 2),
    box(frame, 1 - frame * 2, reveal, 0.5 - frame / 2, 0, 0.5 - reveal / 2),
    box(1 - frame * 2, 1 - frame * 2, 0.12, 0, 0, -0.44),
  ]);
}

function triangularAwning(): THREE.BufferGeometry {
  const positions = new Float32Array([
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
    0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5,
    0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5,
    -0.5, -0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5,
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function contextFacadeGrid(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const bays = 5;
  const stories = 7;
  const bayWidth = 0.82 / bays;
  const storyHeight = 0.86 / stories;
  for (let story = 0; story < stories; story += 1) for (let bay = 0; bay < bays; bay += 1) {
    parts.push(box(
      bayWidth * 0.72,
      storyHeight * 0.58,
      0.22,
      -0.41 + bayWidth * (bay + 0.5),
      -0.43 + storyHeight * (story + 0.5),
      0.38,
    ));
  }
  return merge(parts);
}

function createGeometry(primitive: ChicagoModulePrimitive): THREE.BufferGeometry {
  switch (primitive) {
    case "single-recess":
      return recessedPanel(0.075, 0.22);
    case "paired-oriel":
      return merge([
        box(0.42, 0.9, 0.34, -0.26, 0, 0.16),
        box(0.42, 0.9, 0.34, 0.26, 0, 0.16),
        box(0.08, 1, 0.5, 0, 0, 0.24),
        box(1, 0.07, 0.42, 0, 0.46, 0.2),
        box(1, 0.07, 0.42, 0, -0.46, 0.2),
      ]);
    case "deep-reveal":
      return recessedPanel(0.13, 0.46);
    case "arcade-opening":
      return merge([
        box(0.13, 1, 0.38, -0.435, 0, 0.18),
        box(0.13, 1, 0.38, 0.435, 0, 0.18),
        box(0.74, 0.15, 0.38, 0, 0.425, 0.18),
        box(0.72, 0.78, 0.12, 0, -0.05, -0.44),
      ]);
    case "recessed-lobby":
      return recessedPanel(0.11, 0.5);
    case "miesian-grid":
      return merge([
        box(0.88, 0.88, 0.1, 0, 0, -0.44),
        box(0.055, 1, 0.24, -0.472, 0, 0.38),
        box(0.055, 1, 0.24, 0.472, 0, 0.38),
        box(0.055, 1, 0.3, 0, 0, 0.35),
        box(1, 0.05, 0.24, 0, 0.475, 0.38),
        box(1, 0.05, 0.24, 0, -0.475, 0.38),
      ]);
    case "unitized-panel":
      return merge([
        box(0.9, 0.72, 0.1, 0, 0.12, -0.44),
        box(0.94, 0.18, 0.26, 0, -0.4, 0.36),
        box(0.055, 1, 0.2, -0.472, 0, 0.4),
        box(0.055, 1, 0.2, 0.472, 0, 0.4),
      ]);
    case "bronze-fin-panel":
      return merge([
        box(0.88, 0.92, 0.1, 0, 0, -0.44),
        box(0.06, 1, 0.62, -0.28, 0, 0.18),
        box(0.06, 1, 0.62, 0.28, 0, 0.18),
        box(1, 0.05, 0.18, 0, -0.475, 0.4),
      ]);
    case "expressed-pier":
      return merge([box(0.72, 1, 0.72), box(1, 0.08, 1, 0, 0.46, 0), box(1, 0.08, 1, 0, -0.46, 0)]);
    case "chamfer-wrap": {
      const geometry = new THREE.CylinderGeometry(0.56, 0.56, 1, 6, 1, false);
      geometry.rotateY(Math.PI / 6);
      return geometry;
    }
    case "cornice-cap":
      return merge([box(1, 0.34, 1), box(0.93, 0.33, 0.93, 0, 0.33, 0), box(0.84, 0.33, 0.84, 0, -0.33, 0)]);
    case "screen-house":
      return merge([box(1, 0.78, 0.9, 0, -0.1, 0), box(1.08, 0.18, 0.98, 0, 0.41, 0)]);
    case "stepped-crown":
      return merge([box(1, 0.34, 1, 0, -0.33, 0), box(0.78, 0.34, 0.78, 0, 0, 0), box(0.54, 0.34, 0.54, 0, 0.33, 0)]);
    case "context-facade-grid":
      return contextFacadeGrid();
    case "awning-wedge":
      return triangularAwning();
    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

export function sharedChicagoModuleGeometry(primitive: ChicagoModulePrimitive): THREE.BufferGeometry {
  const cached = CACHE.get(primitive);
  if (cached) return cached;
  const geometry = createGeometry(primitive);
  geometry.name = `chicago-kit-v2-shared-${primitive}`;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  CACHE.set(primitive, geometry);
  return geometry;
}
