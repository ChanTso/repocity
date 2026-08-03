"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ChicagoKitV2Plan } from "@/app/lib/chicago-kit-v2";
import {
  buildChicagoKitV2Geometry,
  selectChicagoLod,
  type ChicagoGeometryBox,
  type ChicagoRenderMaterialKey,
} from "@/app/lib/chicago-kit-v2-geometry";
import type { UrbanFabricPlan } from "@/app/lib/urban-fabric";
import type { VisualCityPlan } from "@/app/lib/visual-city";

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
}

const MATERIALS: Record<ChicagoRenderMaterialKey, MaterialStyle> = {
  "warm-red-brick": { color: "#8b4938", roughness: 0.94, metalness: 0, surface: "brick", bumpScale: 0.055 },
  "dark-aged-brick": { color: "#4f3833", roughness: 0.97, metalness: 0, surface: "brick", bumpScale: 0.065 },
  "buff-brick": { color: "#aa8c69", roughness: 0.92, metalness: 0, surface: "brick", bumpScale: 0.045 },
  "cream-terra-cotta": { color: "#c8ad89", roughness: 0.82, metalness: 0.01, surface: "stone", bumpScale: 0.025 },
  limestone: { color: "#c7bea4", roughness: 0.84, metalness: 0, surface: "stone", bumpScale: 0.035 },
  "dark-granite": { color: "#343b3b", roughness: 0.56, metalness: 0.06 },
  "architectural-concrete": { color: "#8c908b", roughness: 0.9, metalness: 0, surface: "concrete", bumpScale: 0.07 },
  "dark-structural-steel": { color: "#26383d", roughness: 0.35, metalness: 0.62, surface: "metal", bumpScale: 0.012 },
  "weathered-bronze": { color: "#8c6a3e", roughness: 0.38, metalness: 0.7, surface: "metal", bumpScale: 0.018 },
  "roof-membrane": { color: "#4d5552", roughness: 0.78, metalness: 0.08 },
  "smoked-office-glass": { color: "#3d5d67", roughness: 0.16, metalness: 0.24, emissive: "#b57a45", emissiveBase: 0.015, emissiveNight: 0.22 },
  "blue-green-office-glass": { color: "#4f8586", roughness: 0.17, metalness: 0.16, emissive: "#d1a568", emissiveBase: 0.012, emissiveNight: 0.18 },
  "clear-storefront-glass": { color: "#6c9993", roughness: 0.12, metalness: 0.08, opacity: 0.72, transparent: true, depthWrite: false, emissive: "#e1a65d", emissiveBase: 0.035, emissiveNight: 0.42 },
  "masonry-shadow-joint": { color: "#433c37", roughness: 0.98, metalness: 0 },
  "warm-interior": { color: "#263432", roughness: 0.78, metalness: 0, emissive: "#e39a4f", emissiveBase: 0.035, emissiveNight: 0.82 },
  "context-ground": { color: "#747971", roughness: 0.98, metalness: 0 },
  "context-road": { color: "#3c474b", roughness: 0.94, metalness: 0.01 },
  "canvas-awning": { color: "#9d4d38", roughness: 0.8, metalness: 0 },
  "civic-accent": { color: "#ab9a70", roughness: 0.48, metalness: 0.28 },
};

const SHARED_SURFACE_TEXTURES = new Map<ChicagoRenderMaterialKey, THREE.DataTexture>();

function sharedSurfaceTexture(materialKey: ChicagoRenderMaterialKey, style: MaterialStyle): THREE.DataTexture | null {
  if (!style.surface) return null;
  const cached = SHARED_SURFACE_TEXTURES.get(materialKey);
  if (cached) return cached;
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  let seed = [...materialKey].reduce((value, character) => (Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0), 2166136261);
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    seed = (Math.imul(seed ^ (x + y * size + 1), 16777619) >>> 0);
    const noise = (seed >>> 24) / 255;
    const brickJoint = style.surface === "brick" && (y % 5 === 0 || (x + (Math.floor(y / 5) % 2) * 4) % 8 === 0);
    const stoneJoint = style.surface === "stone" && (y % 16 === 0 || x % 16 === 0);
    const metalSeam = style.surface === "metal" && x % 10 === 0;
    const base = brickJoint ? 118 : stoneJoint ? 175 : metalSeam ? 205 : style.surface === "concrete" ? 210 + noise * 36 : 222 + noise * 28;
    const index = (y * size + x) * 4;
    data[index] = base;
    data[index + 1] = base;
    data[index + 2] = base;
    data[index + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.name = `chicago-kit-v2-shared-${materialKey}`;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(style.surface === "brick" ? 2 : 1, style.surface === "brick" ? 3 : 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  SHARED_SURFACE_TEXTURES.set(materialKey, texture);
  return texture;
}

function isShadowCaster(material: ChicagoRenderMaterialKey): boolean {
  return !material.includes("glass") && material !== "warm-interior" && material !== "context-road";
}

function InstancedModuleBatch({
  boxes,
  materialKey,
  night,
}: {
  boxes: readonly ChicagoGeometryBox[];
  materialKey: ChicagoRenderMaterialKey;
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
  const surfaceTexture = sharedSurfaceTexture(materialKey, style);
  return (
    <instancedMesh
      args={[undefined, undefined, boxes.length]}
      castShadow={isShadowCaster(materialKey)}
      frustumCulled
      name={`chicago-kit-v2-batch-${materialKey}`}
      raycast={() => null}
      receiveShadow
      ref={meshRef}
      userData={{
        chicagoKitVersion: "0.2",
        classification: "NON_SEMANTIC_URBAN_CONTEXT",
        materialKey,
        moduleCount: boxes.length,
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={style.color}
        bumpMap={surfaceTexture ?? undefined}
        bumpScale={style.bumpScale ?? 0}
        depthWrite={style.depthWrite ?? true}
        emissive={style.emissive ?? "#000000"}
        emissiveIntensity={(style.emissiveBase ?? 0) + night * (style.emissiveNight ?? 0)}
        metalness={style.metalness}
        map={surfaceTexture ?? undefined}
        opacity={style.opacity ?? 1}
        roughness={style.roughness}
        transparent={style.transparent ?? false}
      />
    </instancedMesh>
  );
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
  const tierGroups = useRef<Record<"lod0" | "lod1" | "lod2", THREE.Group | null>>({ lod0: null, lod1: null, lod2: null });
  const activeTier = useRef<"lod0" | "lod1" | "lod2">("lod0");
  const renderTiers = useMemo(() => Object.fromEntries(
    (Object.entries(geometry.tiers) as Array<["lod0" | "lod1" | "lod2", (typeof geometry.tiers)["lod0"]]>).map(([lod, tier]) => [
      lod,
      Object.fromEntries((Object.entries(tier.byMaterial) as Array<[ChicagoRenderMaterialKey, ChicagoGeometryBox[]]>).map(([material, boxes]) => [
        material,
        selectedSemanticBuildingId ? boxes.filter((box) => box.semanticBuildingId !== selectedSemanticBuildingId) : boxes,
      ])) as Record<ChicagoRenderMaterialKey, ChicagoGeometryBox[]>,
    ]),
  ) as Record<"lod0" | "lod1" | "lod2", Record<ChicagoRenderMaterialKey, ChicagoGeometryBox[]>>, [geometry, selectedSemanticBuildingId]);
  const selectedLod0 = useMemo(() => Object.fromEntries(
    (Object.entries(geometry.tiers.lod0.byMaterial) as Array<[ChicagoRenderMaterialKey, ChicagoGeometryBox[]]>).map(([material, boxes]) => [
      material,
      selectedSemanticBuildingId ? boxes.filter((box) => box.semanticBuildingId === selectedSemanticBuildingId) : [],
    ]),
  ) as Record<ChicagoRenderMaterialKey, ChicagoGeometryBox[]>, [geometry.tiers.lod0.byMaterial, selectedSemanticBuildingId]);
  useFrame(({ camera }) => {
    const target = visualCity.hero.cameraTarget;
    const distance = Math.hypot(camera.position.x - target.x, camera.position.y, camera.position.z - target.z);
    activeTier.current = selectChicagoLod(distance, activeTier.current);
    for (const lod of ["lod0", "lod1", "lod2"] as const) if (tierGroups.current[lod]) tierGroups.current[lod]!.visible = lod === activeTier.current;
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
      compiledMetrics: geometry.metrics,
      facadeFamilies: plan.metrics.facadeFamilyCount,
      curtainWallSystems: plan.metrics.curtainWallSystemCount,
      classification: plan.classification,
    };
  }, [geometry, plan]);
  return (
    <group
      name="chicago-kit-v2-full-city"
      userData={{
        classification: plan.classification,
        interactionPolicy: plan.interactionPolicy,
        planningPolicy: plan.planningPolicy,
      }}
    >
      {(["lod0", "lod1", "lod2"] as const).map((lod) => (
        <group key={lod} name={`chicago-kit-v2-${lod}`} ref={(value) => { tierGroups.current[lod] = value; }} visible={lod === "lod0"}>
          {(Object.entries(renderTiers[lod]) as Array<[ChicagoRenderMaterialKey, ChicagoGeometryBox[]]>).map(([materialKey, boxes]) => (
            <InstancedModuleBatch boxes={boxes} key={`${lod}:${materialKey}`} materialKey={materialKey} night={night} />
          ))}
        </group>
      ))}
      {selectedSemanticBuildingId ? (
        <group name="chicago-kit-v2-selected-lod0" userData={{ forcedLod: "lod0", semanticBuildingId: selectedSemanticBuildingId }}>
          {(Object.entries(selectedLod0) as Array<[ChicagoRenderMaterialKey, ChicagoGeometryBox[]]>).map(([materialKey, boxes]) => (
            <InstancedModuleBatch boxes={boxes} key={`selected:${materialKey}`} materialKey={materialKey} night={night} />
          ))}
        </group>
      ) : null}
    </group>
  );
}

const EMPTY_ID_SET: ReadonlySet<string> = new Set<string>();

export default ChicagoKitV2;
