"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { ChicagoKitV2Plan } from "@/app/lib/chicago-kit-v2";
import {
  buildChicagoKitV2Geometry,
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
}

const MATERIALS: Record<ChicagoRenderMaterialKey, MaterialStyle> = {
  "warm-red-brick": { color: "#8b4938", roughness: 0.94, metalness: 0 },
  "dark-aged-brick": { color: "#4f3833", roughness: 0.97, metalness: 0 },
  "buff-brick": { color: "#aa8c69", roughness: 0.92, metalness: 0 },
  "cream-terra-cotta": { color: "#c8ad89", roughness: 0.82, metalness: 0.01 },
  limestone: { color: "#c7bea4", roughness: 0.84, metalness: 0 },
  "dark-granite": { color: "#343b3b", roughness: 0.56, metalness: 0.06 },
  "architectural-concrete": { color: "#8c908b", roughness: 0.9, metalness: 0 },
  "dark-structural-steel": { color: "#26383d", roughness: 0.35, metalness: 0.62 },
  "weathered-bronze": { color: "#8c6a3e", roughness: 0.38, metalness: 0.7 },
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
        depthWrite={style.depthWrite ?? true}
        emissive={style.emissive ?? "#000000"}
        emissiveIntensity={(style.emissiveBase ?? 0) + night * (style.emissiveNight ?? 0)}
        metalness={style.metalness}
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
  night: number;
}

export function ChicagoKitV2({
  plan,
  urbanFabric,
  visualCity,
  hiddenSemanticBuildingIds = EMPTY_ID_SET,
  night,
}: ChicagoKitV2Props) {
  const geometry = useMemo(
    () => buildChicagoKitV2Geometry(plan, urbanFabric, visualCity, hiddenSemanticBuildingIds),
    [hiddenSemanticBuildingIds, plan, urbanFabric, visualCity],
  );
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
      {(Object.entries(geometry.byMaterial) as Array<[ChicagoRenderMaterialKey, ChicagoGeometryBox[]]>).map(
        ([materialKey, boxes]) => (
          <InstancedModuleBatch
            boxes={boxes}
            key={materialKey}
            materialKey={materialKey}
            night={night}
          />
        ),
      )}
    </group>
  );
}

const EMPTY_ID_SET: ReadonlySet<string> = new Set<string>();

export default ChicagoKitV2;
