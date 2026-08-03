"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ChicagoKitV2Plan } from "@/app/lib/chicago-kit-v2";
import {
  buildChicagoKitV2Geometry,
  selectChicagoLod,
  type ChicagoGeometryBox,
  type ChicagoModulePrimitive,
  type ChicagoRenderMaterialKey,
} from "@/app/lib/chicago-kit-v2-geometry";
import type { UrbanFabricPlan } from "@/app/lib/urban-fabric";
import type { VisualCityPlan } from "@/app/lib/visual-city";
import { sharedChicagoModuleGeometry } from "./chicago-module-geometries";

interface MaterialStyle {
  color: string;
  roughness: number;
  metalness: number;
  opacity?: number;
  transparent?: boolean;
  depthWrite?: boolean;
  emissive?: string;
  emissiveBase?: number;
  emissiveNight?: number;
  surface?: "brick" | "stone" | "concrete" | "metal";
  bumpScale?: number;
  worldScale?: number;
}

const MATERIALS: Record<ChicagoRenderMaterialKey, MaterialStyle> = {
  "warm-red-brick": { color: "#8b4938", roughness: 0.94, metalness: 0, surface: "brick", bumpScale: 0.055, worldScale: 1.65 },
  "dark-aged-brick": { color: "#4f3833", roughness: 0.97, metalness: 0, surface: "brick", bumpScale: 0.065, worldScale: 1.65 },
  "buff-brick": { color: "#aa8c69", roughness: 0.92, metalness: 0, surface: "brick", bumpScale: 0.045, worldScale: 1.65 },
  "cream-terra-cotta": { color: "#c8ad89", roughness: 0.82, metalness: 0.01, surface: "stone", bumpScale: 0.025, worldScale: 0.7 },
  limestone: { color: "#c7bea4", roughness: 0.84, metalness: 0, surface: "stone", bumpScale: 0.035, worldScale: 0.7 },
  "dark-granite": { color: "#343b3b", roughness: 0.56, metalness: 0.06 },
  "architectural-concrete": { color: "#8c908b", roughness: 0.9, metalness: 0, surface: "concrete", bumpScale: 0.07, worldScale: 0.85 },
  "dark-structural-steel": { color: "#26383d", roughness: 0.35, metalness: 0.62, surface: "metal", bumpScale: 0.012, worldScale: 1.1 },
  "weathered-bronze": { color: "#8c6a3e", roughness: 0.38, metalness: 0.7, surface: "metal", bumpScale: 0.018, worldScale: 1.1 },
  "roof-membrane": { color: "#4d5552", roughness: 0.78, metalness: 0.08 },
  "smoked-office-glass": { color: "#78969b", roughness: 0.24, metalness: 0.04, opacity: 0.84, transparent: true, depthWrite: false, emissive: "#9b7857", emissiveBase: 0.04, emissiveNight: 0.22 },
  "blue-green-office-glass": { color: "#86b0ad", roughness: 0.21, metalness: 0.03, opacity: 0.82, transparent: true, depthWrite: false, emissive: "#ad8b67", emissiveBase: 0.04, emissiveNight: 0.2 },
  "clear-storefront-glass": { color: "#8bb9b0", roughness: 0.18, metalness: 0.03, opacity: 0.68, transparent: true, depthWrite: false, emissive: "#e1a65d", emissiveBase: 0.06, emissiveNight: 0.42 },
  "masonry-shadow-joint": { color: "#433c37", roughness: 0.98, metalness: 0 },
  "warm-interior": { color: "#6c503b", roughness: 0.78, metalness: 0, emissive: "#e39a4f", emissiveBase: 0.12, emissiveNight: 0.72 },
  "context-ground": { color: "#747971", roughness: 0.98, metalness: 0 },
  "context-road": { color: "#3c474b", roughness: 0.94, metalness: 0.01 },
  "canvas-awning": { color: "#9d4d38", roughness: 0.8, metalness: 0 },
  "civic-accent": { color: "#ab9a70", roughness: 0.48, metalness: 0.28 },
};

interface SharedSurfaceMaps { albedo: THREE.DataTexture; height: THREE.DataTexture }

const SHARED_SURFACE_MAPS = new Map<ChicagoRenderMaterialKey, SharedSurfaceMaps>();
const SHARED_MATERIALS = new Map<ChicagoRenderMaterialKey, THREE.MeshStandardMaterial>();

function sharedSurfaceMaps(materialKey: ChicagoRenderMaterialKey, style: MaterialStyle): SharedSurfaceMaps | null {
  if (!style.surface) return null;
  const cached = SHARED_SURFACE_MAPS.get(materialKey);
  if (cached) return cached;
  const size = 64;
  const albedoData = new Uint8Array(size * size * 4);
  const heightData = new Uint8Array(size * size * 4);
  let seed = [...materialKey].reduce((value, character) => (Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0), 2166136261);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    seed = (Math.imul(seed ^ (x + y * size + 1), 16777619) >>> 0);
    const noise = (seed >>> 24) / 255;
    const brickJoint = style.surface === "brick" && (y % 5 === 0 || (x + (Math.floor(y / 5) % 2) * 4) % 8 === 0);
    const stoneJoint = style.surface === "stone" && (y % 24 === 0 || (x + (Math.floor(y / 24) % 2) * 12) % 32 === 0);
    const metalSeam = style.surface === "metal" && x % 10 === 0;
    const joint = brickJoint || stoneJoint || metalSeam;
    const base = brickJoint ? 174 : stoneJoint ? 205 : metalSeam ? 218 : style.surface === "concrete" ? 222 + noise * 22 : 232 + noise * 18;
    const height = joint ? 72 : 205 + noise * 34;
    const index = (y * size + x) * 4;
    for (const data of [albedoData, heightData]) data[index + 3] = 255;
    albedoData[index] = base; albedoData[index + 1] = base; albedoData[index + 2] = base;
    heightData[index] = height; heightData[index + 1] = height; heightData[index + 2] = height;
  }
  const albedo = new THREE.DataTexture(albedoData, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  const height = new THREE.DataTexture(heightData, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  for (const texture of [albedo, height]) { texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.needsUpdate = true; }
  albedo.name = `chicago-kit-v2-world-albedo-${materialKey}`;
  height.name = `chicago-kit-v2-world-height-${materialKey}`;
  albedo.colorSpace = THREE.SRGBColorSpace;
  height.colorSpace = THREE.NoColorSpace;
  const maps = { albedo, height };
  SHARED_SURFACE_MAPS.set(materialKey, maps);
  return maps;
}

function sharedMaterial(materialKey: ChicagoRenderMaterialKey): THREE.MeshStandardMaterial {
  const cached = SHARED_MATERIALS.get(materialKey);
  if (cached) return cached;
  const style = MATERIALS[materialKey];
  const material = new THREE.MeshStandardMaterial({ color: style.color, roughness: style.roughness, metalness: style.metalness, opacity: style.opacity ?? 1, transparent: style.transparent ?? false, depthWrite: style.depthWrite ?? true, emissive: style.emissive ?? "#000000" });
  material.name = `chicago-kit-v2-material-${materialKey}`;
  const maps = sharedSurfaceMaps(materialKey, style);
  if (maps) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.chicagoAlbedoMap = { value: maps.albedo };
      shader.uniforms.chicagoHeightMap = { value: maps.height };
      shader.uniforms.chicagoWorldScale = { value: style.worldScale ?? 1 };
      shader.uniforms.chicagoBumpScale = { value: style.bumpScale ?? 0 };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vChicagoWorldPosition;")
        .replace("#include <project_vertex>", `vec4 chicagoPosition = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nchicagoPosition = instanceMatrix * chicagoPosition;\n#endif\nvChicagoWorldPosition = (modelMatrix * chicagoPosition).xyz;\n#include <project_vertex>`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vChicagoWorldPosition;\nuniform sampler2D chicagoAlbedoMap;\nuniform sampler2D chicagoHeightMap;\nuniform float chicagoWorldScale;\nuniform float chicagoBumpScale;")
        .replace("#include <map_fragment>", `vec3 chicagoDx = dFdx(vChicagoWorldPosition);\nvec3 chicagoDy = dFdy(vChicagoWorldPosition);\nvec3 chicagoFaceNormal = normalize(cross(chicagoDx, chicagoDy));\nvec3 chicagoAbsNormal = abs(chicagoFaceNormal);\nvec2 chicagoSurfaceUv = chicagoAbsNormal.x > chicagoAbsNormal.z ? vChicagoWorldPosition.zy : vChicagoWorldPosition.xy;\nvec4 chicagoAlbedo = texture2D(chicagoAlbedoMap, chicagoSurfaceUv * chicagoWorldScale);\ndiffuseColor.rgb *= chicagoAlbedo.rgb;\nfloat chicagoHeight = texture2D(chicagoHeightMap, chicagoSurfaceUv * chicagoWorldScale).r;`)
        .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal = normalize(normal + vec3(dFdx(chicagoHeight), dFdy(chicagoHeight), 0.0) * chicagoBumpScale);");
    };
    material.customProgramCacheKey = () => `chicago-world-surface:${materialKey}:v2`;
  }
  SHARED_MATERIALS.set(materialKey, material);
  return material;
}

function isShadowCaster(material: ChicagoRenderMaterialKey): boolean {
  return !material.includes("glass") && material !== "warm-interior" && material !== "context-road";
}

function InstancedModuleBatch({
  boxes,
  materialKey,
  primitive,
  night,
}: {
  boxes: readonly ChicagoGeometryBox[];
  materialKey: ChicagoRenderMaterialKey;
  primitive: ChicagoModulePrimitive;
  night: number;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    boxes.forEach((box, index) => {
      dummy.position.set(box.x, box.y, box.z);
      dummy.rotation.set(0, box.rotationY, 0);
      dummy.scale.set(box.width, box.height, box.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }, [boxes, dummy]);
  if (boxes.length === 0) return null;
  const style = MATERIALS[materialKey];
  const material = sharedMaterial(materialKey);
  material.emissiveIntensity = (style.emissiveBase ?? 0) + night * (style.emissiveNight ?? 0);
  return (
    <instancedMesh
      args={[undefined, undefined, boxes.length]}
      castShadow={isShadowCaster(materialKey)}
      frustumCulled
      name={`chicago-kit-v2-batch-${materialKey}-${primitive}`}
      raycast={() => null}
      receiveShadow
      ref={meshRef}
      userData={{
        chicagoKitVersion: "0.2",
        classification: "NON_SEMANTIC_URBAN_CONTEXT",
        materialKey,
        primitive,
        moduleCount: boxes.length,
      }}
    >
      <primitive attach="geometry" object={sharedChicagoModuleGeometry(primitive)} />
      <primitive attach="material" object={material} />
    </instancedMesh>
  );
}

interface RenderBatch {
  materialKey: ChicagoRenderMaterialKey;
  primitive: ChicagoModulePrimitive;
  boxes: ChicagoGeometryBox[];
}

function makeRenderBatches(boxes: readonly ChicagoGeometryBox[]): RenderBatch[] {
  const batches = new Map<string, RenderBatch>();
  for (const box of boxes) {
    const primitive = box.primitive ?? "box";
    const key = `${box.material}:${primitive}`;
    const batch = batches.get(key) ?? { materialKey: box.material, primitive, boxes: [] };
    batch.boxes.push(box);
    batches.set(key, batch);
  }
  return [...batches.values()].sort((left, right) => `${left.materialKey}:${left.primitive}`.localeCompare(`${right.materialKey}:${right.primitive}`));
}

interface RenderChunk {
  id: string;
  centerX: number;
  centerZ: number;
  minimumLod: "lod0" | "lod1" | "lod2";
  tiers: Record<"lod0" | "lod1" | "lod2", RenderBatch[]>;
}

const CHUNK_SIZE = 28;

function chunkId(box: ChicagoGeometryBox): string {
  return `${Math.floor(box.x / CHUNK_SIZE)}:${Math.floor(box.z / CHUNK_SIZE)}`;
}

function capChunkLod(lod: "lod0" | "lod1" | "lod2", minimum: "lod0" | "lod1" | "lod2") {
  if (minimum === "lod0") return "lod0";
  if (minimum === "lod1" && lod === "lod2") return "lod1";
  return lod;
}

export interface ChicagoKitV2Props {
  plan: ChicagoKitV2Plan;
  urbanFabric: UrbanFabricPlan;
  visualCity: VisualCityPlan;
  hiddenSemanticBuildingIds?: ReadonlySet<string>;
  selectedSemanticBuildingId?: string | null;
  night: number;
}

export function ChicagoKitV2({
  plan,
  urbanFabric,
  visualCity,
  hiddenSemanticBuildingIds = EMPTY_ID_SET,
  selectedSemanticBuildingId = null,
  night,
}: ChicagoKitV2Props) {
  const geometry = useMemo(
    () => buildChicagoKitV2Geometry(plan, urbanFabric, visualCity, hiddenSemanticBuildingIds),
    [hiddenSemanticBuildingIds, plan, urbanFabric, visualCity],
  );
  const chunkGroups = useRef<Record<string, Record<"lod0" | "lod1" | "lod2", THREE.Group | null>>>({});
  const activeChunkLods = useRef(new Map<string, "lod0" | "lod1" | "lod2">());
  const renderChunks = useMemo<RenderChunk[]>(() => {
    const contextRing = new Map(plan.contextSignatures.map((signature) => [signature.contextId, signature.ring]));
    const chunks = new Map<string, { tiers: Record<"lod0" | "lod1" | "lod2", ChicagoGeometryBox[]>; minimumLod: "lod0" | "lod1" | "lod2" }>();
    for (const lod of ["lod0", "lod1", "lod2"] as const) for (const box of geometry.tiers[lod].boxes) {
      if (selectedSemanticBuildingId && box.semanticBuildingId === selectedSemanticBuildingId) continue;
      const id = chunkId(box);
      const chunk = chunks.get(id) ?? { tiers: { lod0: [], lod1: [], lod2: [] }, minimumLod: "lod2" as const };
      chunk.tiers[lod].push(box);
      if (box.contextId && contextRing.get(box.contextId) === 1) chunk.minimumLod = "lod1";
      chunks.set(id, chunk);
    }
    return [...chunks.entries()].map(([id, chunk]) => {
      const anchors = chunk.tiers.lod0.length > 0 ? chunk.tiers.lod0 : chunk.tiers.lod1;
      return {
        id,
        centerX: anchors.reduce((sum, box) => sum + box.x, 0) / Math.max(1, anchors.length),
        centerZ: anchors.reduce((sum, box) => sum + box.z, 0) / Math.max(1, anchors.length),
        minimumLod: chunk.minimumLod,
        tiers: {
          lod0: makeRenderBatches(chunk.tiers.lod0),
          lod1: makeRenderBatches(chunk.tiers.lod1),
          lod2: makeRenderBatches(chunk.tiers.lod2),
        },
      };
    }).sort((left, right) => left.id.localeCompare(right.id));
  }, [geometry.tiers, plan.contextSignatures, selectedSemanticBuildingId]);
  const selectedLod0 = useMemo(
    () => makeRenderBatches(selectedSemanticBuildingId ? geometry.tiers.lod0.boxes.filter((box) => box.semanticBuildingId === selectedSemanticBuildingId) : []),
    [geometry.tiers.lod0.boxes, selectedSemanticBuildingId],
  );
  useFrame(({ camera }) => {
    for (const chunk of renderChunks) {
      const previous = activeChunkLods.current.get(chunk.id) ?? "lod1";
      const distance = Math.hypot(camera.position.x - chunk.centerX, camera.position.z - chunk.centerZ, camera.position.y * 0.28);
      const next = capChunkLod(selectChicagoLod(distance, previous), chunk.minimumLod);
      activeChunkLods.current.set(chunk.id, next);
      const groups = chunkGroups.current[chunk.id];
      if (groups) for (const lod of ["lod0", "lod1", "lod2"] as const) if (groups[lod]) groups[lod]!.visible = lod === next;
    }
  });
  useLayoutEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const target = window as Window & { __REPOCITY_CHICAGO_KIT_V2__?: Record<string, unknown> };
    target.__REPOCITY_CHICAGO_KIT_V2__ = {
      version: plan.version,
      signatures: plan.signatures.length,
      contextSignatures: plan.contextSignatures.length,
      coreModules: geometry.coreModuleCount,
      contextModules: geometry.contextModuleCount,
      storefrontModules: geometry.storefrontModuleCount,
      materialBatches: Object.values(geometry.byMaterial).filter((batch) => batch.length > 0).length,
      lodModuleCounts: Object.fromEntries(Object.entries(geometry.tiers).map(([lod, tier]) => [lod, tier.moduleCount])),
      spatialLodChunkCount: renderChunks.length,
      ringOneMinimumLod: "lod1",
      compiledMetrics: geometry.metrics,
      facadeFamilies: plan.metrics.facadeFamilyCount,
      curtainWallSystems: plan.metrics.curtainWallSystemCount,
      classification: plan.classification,
    };
  }, [geometry, plan, renderChunks.length]);
  return (
    <group
      name="chicago-kit-v2-full-city"
      userData={{
        classification: plan.classification,
        interactionPolicy: plan.interactionPolicy,
        planningPolicy: plan.planningPolicy,
      }}
    >
      {renderChunks.map((chunk) => (
        <group key={chunk.id} name={`chicago-kit-v2-spatial-chunk-${chunk.id}`} userData={{ centerX: chunk.centerX, centerZ: chunk.centerZ, minimumLod: chunk.minimumLod }}>
          {(["lod0", "lod1", "lod2"] as const).map((lod) => (
            <group
              key={lod}
              name={`chicago-kit-v2-${chunk.id}-${lod}`}
              ref={(value) => {
                const refs = chunkGroups.current[chunk.id] ?? { lod0: null, lod1: null, lod2: null };
                refs[lod] = value;
                chunkGroups.current[chunk.id] = refs;
              }}
              visible={lod === "lod1"}
            >
              {chunk.tiers[lod].map((batch) => (
                <InstancedModuleBatch boxes={batch.boxes} key={`${lod}:${batch.materialKey}:${batch.primitive}`} materialKey={batch.materialKey} primitive={batch.primitive} night={night} />
              ))}
            </group>
          ))}
        </group>
      ))}
      {selectedSemanticBuildingId ? (
        <group name="chicago-kit-v2-selected-lod0" userData={{ forcedLod: "lod0", semanticBuildingId: selectedSemanticBuildingId }}>
          {selectedLod0.map((batch) => (
            <InstancedModuleBatch boxes={batch.boxes} key={`selected:${batch.materialKey}:${batch.primitive}`} materialKey={batch.materialKey} primitive={batch.primitive} night={night} />
          ))}
        </group>
      ) : null}
    </group>
  );
}

const EMPTY_ID_SET: ReadonlySet<string> = new Set<string>();

export default ChicagoKitV2;
