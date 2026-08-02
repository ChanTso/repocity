"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type {
  SemanticCampus,
  SemanticCityPlan,
  SemanticFileSlot,
  SemanticRoad,
  SemanticWaterBoundary,
} from "@/app/lib/semantic-city";
import type {
  AmbientAgentPlan,
  AmbientMobilityPlan,
} from "@/app/lib/ambient-mobility";
import {
  prepareAmbientMotionRoute,
  sampleAmbientAgentInto,
  type PreparedAmbientMotionRoute,
} from "@/app/lib/ambient-motion";
import type { CityPoint } from "@/app/lib/living-city";
import type {
  UrbanArchitecturalEnvelope,
  UrbanFabricPlan,
  UrbanMaterialKey,
  UrbanStorefront,
} from "@/app/lib/urban-fabric";
import type {
  HeroFacadeSystem,
  VisualCityPlan,
  VisualHeroBlock,
} from "@/app/lib/visual-city";
import { stableCityHash } from "@/app/lib/city-visuals";
import { getTimeOfDayPalette } from "./living-city-render-utils";
import {
  measureChicagoKitV2Plan,
  type ChicagoKitV2Plan,
} from "@/app/lib/chicago-kit-v2";
import { ChicagoKitV2 } from "./ChicagoKitV2";

const LAND_Y = 0;
const ROAD_Y = 0.12;
const WATER_Y = -0.18;
const CAMPUS_BASE_Y = 0.24;
const ELEVATED_ROAD_Y = 2.8;
const BRIDGE_RISE = 0.82;
const TREE_CLEARANCE = 0.7;

type MobilityMode = AmbientAgentPlan["mode"];

interface BoxInstance {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  color?: string;
}

interface CylinderInstance {
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
  rotationY?: number;
  color?: string;
}

interface CampusGeometry {
  plazas: BoxInstance[];
  lawns: BoxInstance[];
  shells: BoxInstance[];
  wings: BoxInstance[];
  roofs: BoxInstance[];
  glazing: BoxInstance[];
  accents: BoxInstance[];
  details: BoxInstance[];
  cylinders: CylinderInstance[];
  selection: BoxInstance[];
}

interface VisualSliceGeometry {
  contextGround: BoxInstance[];
  contextRoads: BoxInstance[];
  contextShells: BoxInstance[];
  contextRoofs: BoxInstance[];
  contextWindows: BoxInstance[];
  heroMasonry: BoxInstance[];
  heroGlass: BoxInstance[];
  heroInteriors: BoxInstance[];
  heroFrames: BoxInstance[];
  heroShopfronts: BoxInstance[];
  heroAwnings: BoxInstance[];
  heroDetails: BoxInstance[];
  heroMassing: BoxInstance[];
  heroGlassMassing: BoxInstance[];
  heroRoofClutter: BoxInstance[];
  heroStreetTrees: CylinderInstance[];
  heroTreeCrowns: Array<CylinderInstance & { radius: number }>;
}

interface RenderWaterBoundary {
  id: string;
  outline: CityPoint[];
}

interface RoadGeometry {
  sidewalk: THREE.BufferGeometry;
  asphalt: THREE.BufferGeometry;
  markings: BoxInstance[];
  curbs: BoxInstance[];
  guardRails: BoxInstance[];
  pillars: CylinderInstance[];
  surfaceSamples: RoadSurfaceSample[];
}

interface RoadSurfaceSample {
  x: number;
  y: number;
  z: number;
  halfWidth: number;
}

interface MetropolisDisplayBounds {
  x: number;
  z: number;
  width: number;
  depth: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface PreparedMotionRoute {
  id: string;
  motion: PreparedAmbientMotionRoute;
  surfaceY: "water" | "road" | "ground";
  roadSamples: readonly RoadSurfaceSample[];
}

interface MotionAgent {
  id: string;
  mode: MobilityMode;
  route: PreparedMotionRoute;
  phase: number;
  speed: number;
  delay: number;
  dwellSeconds: number;
  lateralOffset: number;
  color: string;
  scale: number;
}

export interface SemanticMetropolisProps {
  plan: SemanticCityPlan;
  urbanFabric?: UrbanFabricPlan;
  visualCity?: VisualCityPlan;
  /**
   * Scenario-authorized agents. Omitting this prop renders no moving entities;
   * static plan relations shape infrastructure but never create traffic.
   */
  mobilityPlan?: AmbientMobilityPlan | null;
  /** Local solar hour, 0...24. */
  timeOfDay?: number;
  /**
   * Journey entities still rendered at legacy file coordinates. Their semantic
   * file slots are kept free of macro mass so the journey layer remains clear.
   */
  reservedEntityIds?: ReadonlySet<string>;
  activeComponentIds?: ReadonlySet<string> | null;
  showTraffic?: boolean;
  showPedestrians?: boolean;
  showWaterTraffic?: boolean;
  /** Visual weight for deterministic ambient context, never evidence. */
  ambientOpacity?: number;
  /** Motion multiplier used to subordinate ambient context by mode. */
  ambientSpeedScale?: number;
  selectedEntityId?: string | null;
  /** Freezes semantic traffic without rebuilding any scene objects. */
  playing?: boolean;
  onHoverEntity?: (entityId: string | null) => void;
  onSelectEntity?: (entityId: string) => void;
}

/**
 * Complete macro replacement for the legacy file-tower city in Flow mode.
 *
 * The component renders only compiler-provided semantic structures. Ambient
 * Trees and street furniture carry no software meaning. Semantic facts remain
 * backed by SemanticCityPlan while V4 projects them into shared streets,
 * blocks, parcels and buildings through UrbanFabricPlan.
 */
export function SemanticMetropolis({
  plan,
  urbanFabric,
  visualCity,
  mobilityPlan = null,
  timeOfDay = 14,
  reservedEntityIds = EMPTY_ID_SET,
  activeComponentIds = null,
  showTraffic = true,
  showPedestrians = true,
  showWaterTraffic = true,
  ambientOpacity = 1,
  ambientSpeedScale = 1,
  playing = true,
  onHoverEntity,
  onSelectEntity,
}: SemanticMetropolisProps) {
  const palette = useMemo(
    () => getTimeOfDayPalette(timeOfDay),
    [timeOfDay],
  );
  const measuredChicagoKit = useMemo(
    () =>
      urbanFabric && visualCity
        ? measureChicagoKitV2Plan(urbanFabric, visualCity)
        : null,
    [urbanFabric, visualCity],
  );
  const chicagoKit = measuredChicagoKit?.plan ?? null;
  const replacedEnvelopeIds = useMemo(
    () => new Set(chicagoKit?.signatures.map((signature) => signature.envelopeId) ?? []),
    [chicagoKit],
  );
  const hiddenSemanticBuildingIds = useMemo(
    () =>
      new Set(
        [...reservedEntityIds]
          .map((entityId) => urbanFabric?.entityAddresses[entityId]?.buildingId)
          .filter((id): id is string => Boolean(id)),
      ),
    [reservedEntityIds, urbanFabric],
  );
  const campusGeometry = useMemo(
    () =>
      urbanFabric
        ? makeUrbanFabricGeometry(
            urbanFabric,
            reservedEntityIds,
            activeComponentIds,
            replacedEnvelopeIds,
          )
        : makeCampusGeometry(
            plan.campuses,
            reservedEntityIds,
            activeComponentIds,
          ),
    [activeComponentIds, plan.campuses, replacedEnvelopeIds, reservedEntityIds, urbanFabric],
  );
  const visualSliceGeometry = useMemo(
    () =>
      visualCity && urbanFabric && !chicagoKit
        ? makeVisualSliceGeometry(visualCity, urbanFabric, replacedEnvelopeIds)
        : null,
    [chicagoKit, replacedEnvelopeIds, urbanFabric, visualCity],
  );
  const roadGeometry = useMemo(
    () => makeRoadGeometry(urbanFabric?.streets ?? plan.roads),
    [plan.roads, urbanFabric],
  );
  const greenGeometry = useMemo(
    () =>
      makeGreenGeometry(
        urbanFabric
          ? { ...plan, campuses: [], roads: urbanFabric.streets }
          : plan,
        roadGeometry.surfaceSamples,
        visualCity?.hero.bounds,
      ),
    [plan, roadGeometry.surfaceSamples, urbanFabric, visualCity],
  );
  const displayBounds = useMemo(
    () =>
      urbanFabric
        ? makeUrbanDisplayBounds(urbanFabric)
        : makeMetropolisDisplayBounds(plan),
    [plan, urbanFabric],
  );
  const displayWaterBoundaries = useMemo(
    () =>
      visualCity
        ? [
            {
              id: visualCity.river.contextId,
              outline: [
                { x: visualCity.river.minX, z: visualCity.river.minZ },
                { x: visualCity.river.maxX, z: visualCity.river.minZ },
                { x: visualCity.river.maxX, z: visualCity.river.maxZ },
                { x: visualCity.river.minX, z: visualCity.river.maxZ },
              ],
            },
          ]
        : clipWaterBoundaries(plan.terrain.waterBoundaries, displayBounds),
    [displayBounds, plan.terrain.waterBoundaries, visualCity],
  );
  const terrainBounds = useMemo(() => {
    if (visualCity) {
      return {
        ...displayBounds,
        ...visualCity.contextBounds,
        x: visualCity.contextBounds.x,
        z: visualCity.contextBounds.z,
      };
    }
    const padding = urbanFabric ? 12 : 0;
    return {
      ...displayBounds,
      minX: displayBounds.minX - padding,
      maxX: displayBounds.maxX + padding,
      minZ: displayBounds.minZ - padding,
      maxZ: displayBounds.maxZ + padding,
      width: displayBounds.width + padding * 2,
      depth: displayBounds.depth + padding * 2,
    };
  }, [displayBounds, urbanFabric, visualCity]);

  return (
    <group name="semantic-metropolis">
      <RenderDiagnostics
        chicagoKit={chicagoKit}
        chicagoKitPlanningMs={measuredChicagoKit?.planningMs ?? null}
        urbanFabric={urbanFabric}
      />
      <SemanticTerrain
        bounds={terrainBounds}
        waterBoundaries={displayWaterBoundaries}
      />
      <SemanticWater
        boundaries={displayWaterBoundaries}
        color={palette.water}
        night={palette.night}
      />

      {visualSliceGeometry ? (
        <VisualSliceInstances geometry={visualSliceGeometry} night={palette.night} />
      ) : null}
      {chicagoKit && urbanFabric && visualCity ? (
        <ChicagoKitV2
          hiddenSemanticBuildingIds={hiddenSemanticBuildingIds}
          night={palette.night}
          plan={chicagoKit}
          urbanFabric={urbanFabric}
          visualCity={visualCity}
        />
      ) : null}
      {visualCity && urbanFabric && !chicagoKit ? (
        <HeroStorefrontSigns plan={urbanFabric} visualCity={visualCity} />
      ) : null}

      <StaticBoxInstances
        boxes={campusGeometry.lawns}
        color="#6a9859"
        material="standard"
        receiveShadow
        roughness={0.96}
      />
      <StaticBoxInstances
        boxes={campusGeometry.plazas}
        color="#b5b7aa"
        material="standard"
        receiveShadow
        roughness={0.91}
      />

      <mesh
        geometry={roadGeometry.sidewalk}
        receiveShadow
        renderOrder={1}
      >
        <meshStandardMaterial
          color="#c7c9bf"
          metalness={0.01}
          roughness={0.92}
        />
      </mesh>
      <mesh
        geometry={roadGeometry.asphalt}
        receiveShadow
        renderOrder={2}
      >
        <meshStandardMaterial
          color="#465158"
          metalness={0.04}
          roughness={0.84}
        />
      </mesh>
      <StaticBoxInstances
        boxes={roadGeometry.markings}
        color="#f7f1dd"
        material="basic"
      />
      <StaticBoxInstances
        boxes={roadGeometry.curbs}
        color="#dadbd2"
        material="standard"
        receiveShadow
        roughness={0.88}
      />
      <StaticBoxInstances
        boxes={roadGeometry.guardRails}
        castShadow
        color="#59666a"
        material="standard"
        roughness={0.56}
      />
      <StaticCylinderInstances
        castShadow
        cylinders={roadGeometry.pillars}
        color="#727c80"
        radialSegments={10}
        receiveShadow
      />

      <StaticBoxInstances
        boxes={campusGeometry.shells}
        castShadow
        color="#ffffff"
        emissive="#5b4938"
        emissiveIntensity={palette.night * 0.16}
        material="standard"
        receiveShadow
        roughness={0.78}
      />
      <StaticBoxInstances
        boxes={campusGeometry.wings}
        castShadow
        color="#ffffff"
        emissive="#584637"
        emissiveIntensity={palette.night * 0.14}
        material="standard"
        receiveShadow
        roughness={0.8}
      />
      <StaticBoxInstances
        boxes={campusGeometry.roofs}
        castShadow
        color="#ffffff"
        material="standard"
        receiveShadow
        roughness={0.58}
      />
      <StaticBoxInstances
        boxes={campusGeometry.glazing}
        color="#ffffff"
        emissive="#d29d55"
        emissiveIntensity={0.025 + palette.night * 0.62}
        material="standard"
        roughness={0.28}
      />
      <StaticBoxInstances
        boxes={campusGeometry.accents}
        castShadow
        color="#ffffff"
        emissive="#2b625b"
        emissiveIntensity={0.025 + palette.night * 0.36}
        material="standard"
        roughness={0.48}
      />
      <StaticBoxInstances
        boxes={campusGeometry.details}
        castShadow
        color="#ffffff"
        material="standard"
        roughness={0.66}
      />
      <StaticCylinderInstances
        castShadow
        cylinders={campusGeometry.cylinders}
        color="#758986"
        radialSegments={12}
      />
      <StaticBoxInstances
        boxes={campusGeometry.selection}
        color="#8be4cf"
        material="basic"
        opacity={0.72}
        transparent
      />

      {urbanFabric ? (
        <UrbanBuildingHitTargets
          plan={urbanFabric}
          onHoverEntity={onHoverEntity}
          onSelectEntity={onSelectEntity}
          reservedEntityIds={reservedEntityIds}
        />
      ) : null}

      <StaticBoxInstances
        boxes={greenGeometry.greenBelts}
        color="#56844f"
        material="standard"
        receiveShadow
        roughness={1}
      />
      <StaticCylinderInstances
        castShadow
        cylinders={greenGeometry.trunks}
        color="#624b37"
        radialSegments={7}
      />
      <StaticIcosahedronInstances
        castShadow
        color="#ffffff"
        instances={greenGeometry.crowns}
      />
      <StaticCylinderInstances
        cylinders={greenGeometry.lightPoles}
        color="#31393d"
        radialSegments={7}
      />
      <StaticIcosahedronInstances
        color={palette.night > 0.15 ? "#ffe09b" : "#b8c5bc"}
        emissive="#ffbd5f"
        emissiveIntensity={0.12 + palette.night * 3.2}
        instances={greenGeometry.lightBulbs}
        toneMapped={false}
      />

      <SemanticMobility
        opacity={ambientOpacity}
        plan={mobilityPlan}
        playing={playing}
        paletteNight={palette.night}
        roadSamples={roadGeometry.surfaceSamples}
        showPedestrians={showPedestrians}
        showTraffic={showTraffic}
        showWaterTraffic={showWaterTraffic}
        speedScale={ambientSpeedScale}
      />
    </group>
  );
}

function RenderDiagnostics({
  chicagoKit,
  chicagoKitPlanningMs,
  urbanFabric,
}: {
  chicagoKit: ChicagoKitV2Plan | null;
  chicagoKitPlanningMs: number | null;
  urbanFabric?: UrbanFabricPlan;
}) {
  const renderer = useThree((state) => state.gl);
  const smoothedFrameMs = useRef(16.7);
  const outputRef = useRef<HTMLOutputElement>(null);
  useLayoutEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const target = window as Window & {
      __REPOCITY_RENDER_METRICS__?: Record<string, unknown>;
    };
    target.__REPOCITY_RENDER_METRICS__ = {
      drawCalls: 0,
      triangles: 0,
      lines: 0,
      points: 0,
      programs: renderer.info.programs?.length ?? 0,
      frameMs: smoothedFrameMs.current,
      architecturalEnvelopes:
        urbanFabric?.morphology.architecturalEnvelopeCount ?? 0,
      massingVolumes: urbanFabric?.morphology.massingVolumeCount ?? 0,
      storefronts: urbanFabric?.morphology.storefrontCount ?? 0,
      facadeInstances: urbanFabric?.morphology.facadeInstanceCount ?? 0,
      chicagoKitSignatures: chicagoKit?.signatures.length ?? 0,
      chicagoKitContextSignatures: chicagoKit?.contextSignatures.length ?? 0,
      chicagoKitPlanningMs,
    };
  }, [chicagoKit, chicagoKitPlanningMs, renderer, urbanFabric]);
  useFrame((_state, delta) => {
    if (process.env.NODE_ENV !== "development") return;
    smoothedFrameMs.current =
      smoothedFrameMs.current * 0.92 + delta * 1_000 * 0.08;
    const target = window as Window & {
      __REPOCITY_RENDER_METRICS__?: Record<string, unknown>;
    };
    target.__REPOCITY_RENDER_METRICS__ = {
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      lines: renderer.info.render.lines,
      points: renderer.info.render.points,
      programs: renderer.info.programs?.length ?? 0,
      frameMs: Number(smoothedFrameMs.current.toFixed(2)),
      architecturalEnvelopes:
        urbanFabric?.morphology.architecturalEnvelopeCount ?? 0,
      massingVolumes: urbanFabric?.morphology.massingVolumeCount ?? 0,
      storefronts: urbanFabric?.morphology.storefrontCount ?? 0,
      facadeInstances: urbanFabric?.morphology.facadeInstanceCount ?? 0,
      chicagoKitSignatures: chicagoKit?.signatures.length ?? 0,
      chicagoKitContextSignatures: chicagoKit?.contextSignatures.length ?? 0,
      chicagoKitPlanningMs,
    };
    const output = outputRef.current;
    if (output) {
      output.dataset.drawCalls = String(renderer.info.render.calls);
      output.dataset.triangles = String(renderer.info.render.triangles);
      output.dataset.geometries = String(renderer.info.memory.geometries);
      output.dataset.textures = String(renderer.info.memory.textures);
      output.dataset.programs = String(renderer.info.programs?.length ?? 0);
      output.dataset.frameMs = smoothedFrameMs.current.toFixed(2);
      output.dataset.fps = (1_000 / Math.max(0.01, smoothedFrameMs.current)).toFixed(1);
      output.dataset.chicagoKitSignatures = String(chicagoKit?.signatures.length ?? 0);
      output.dataset.chicagoKitContextSignatures = String(chicagoKit?.contextSignatures.length ?? 0);
      output.dataset.chicagoKitPlanningMs = String(chicagoKitPlanningMs ?? 0);
    }
  });
  return (
    <Html style={{ display: "none" }}>
      <output aria-hidden="true" data-repocity-render-metrics ref={outputRef} />
    </Html>
  );
}

const EMPTY_ID_SET: ReadonlySet<string> = new Set<string>();
function makeMetropolisDisplayBounds(
  plan: SemanticCityPlan,
): MetropolisDisplayBounds {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  const include = (x: number, z: number, margin = 0) => {
    minX = Math.min(minX, x - margin);
    maxX = Math.max(maxX, x + margin);
    minZ = Math.min(minZ, z - margin);
    maxZ = Math.max(maxZ, z + margin);
  };

  for (const campus of plan.campuses) {
    const cosine = Math.abs(Math.cos(campus.orientation));
    const sine = Math.abs(Math.sin(campus.orientation));
    const halfX =
      cosine * campus.width * 0.68 + sine * campus.depth * 0.68;
    const halfZ =
      sine * campus.width * 0.68 + cosine * campus.depth * 0.68;
    include(campus.x - halfX, campus.z - halfZ);
    include(campus.x + halfX, campus.z + halfZ);
  }
  for (const road of plan.roads) {
    const margin = road.width / 2 + 1.8;
    for (const point of road.centerline) {
      include(point.x, point.z, margin);
    }
  }

  if (!Number.isFinite(minX)) {
    minX = plan.bounds.minX;
    maxX = plan.bounds.maxX;
    minZ = plan.bounds.minZ;
    maxZ = plan.bounds.maxZ;
  }
  const contentWidth = Math.max(1, maxX - minX);
  const contentDepth = Math.max(1, maxZ - minZ);
  const padding = Math.max(
    4,
    Math.min(9, Math.max(contentWidth, contentDepth) * 0.08),
  );
  minX -= padding;
  maxX += padding;
  minZ -= padding;
  maxZ += padding;
  return {
    x: (minX + maxX) / 2,
    z: (minZ + maxZ) / 2,
    width: maxX - minX,
    depth: maxZ - minZ,
    minX,
    maxX,
    minZ,
    maxZ,
  };
}

function makeUrbanDisplayBounds(
  plan: UrbanFabricPlan,
): MetropolisDisplayBounds {
  return {
    x: plan.bounds.x,
    z: plan.bounds.z,
    width: plan.bounds.width,
    depth: plan.bounds.depth,
    minX: plan.bounds.minX,
    maxX: plan.bounds.maxX,
    minZ: plan.bounds.minZ,
    maxZ: plan.bounds.maxZ,
  };
}

function clipWaterBoundaries(
  boundaries: readonly SemanticWaterBoundary[],
  bounds: MetropolisDisplayBounds,
): SemanticWaterBoundary[] {
  return boundaries.flatMap((boundary) => {
    const first = boundary.outline[0];
    const last = boundary.outline.at(-1);
    const openOutline =
      first &&
      last &&
      first.x === last.x &&
      first.z === last.z
        ? boundary.outline.slice(0, -1)
        : boundary.outline;
    const unclamped = openOutline.filter(
      (point, index, points) =>
        index === 0 ||
        point.x !== points[index - 1]!.x ||
        point.z !== points[index - 1]!.z,
    );
    let outline = clipPolygonAxis(
      unclamped,
      "x",
      bounds.minX,
      true,
    );
    outline = clipPolygonAxis(outline, "x", bounds.maxX, false);
    outline = clipPolygonAxis(outline, "z", bounds.minZ, true);
    outline = clipPolygonAxis(outline, "z", bounds.maxZ, false);
    return outline.length >= 3 ? [{ ...boundary, outline }] : [];
  });
}

function clipPolygonAxis(
  points: readonly { x: number; z: number }[],
  axis: "x" | "z",
  boundary: number,
  keepGreater: boolean,
): { x: number; z: number }[] {
  if (points.length === 0) return [];
  const output: { x: number; z: number }[] = [];
  const inside = (point: { x: number; z: number }) =>
    keepGreater ? point[axis] >= boundary : point[axis] <= boundary;
  const intersection = (
    start: { x: number; z: number },
    end: { x: number; z: number },
  ) => {
    const difference = end[axis] - start[axis];
    const progress =
      Math.abs(difference) < 0.000001
        ? 0
        : (boundary - start[axis]) / difference;
    return {
      x: THREE.MathUtils.lerp(start.x, end.x, progress),
      z: THREE.MathUtils.lerp(start.z, end.z, progress),
      [axis]: boundary,
    };
  };

  let previous = points.at(-1)!;
  for (const current of points) {
    const previousInside = inside(previous);
    const currentInside = inside(current);
    if (currentInside) {
      if (!previousInside) output.push(intersection(previous, current));
      output.push({ x: current.x, z: current.z });
    } else if (previousInside) {
      output.push(intersection(previous, current));
    }
    previous = current;
  }
  return output;
}

function SemanticTerrain({
  bounds,
  waterBoundaries,
}: {
  bounds: MetropolisDisplayBounds;
  waterBoundaries: readonly RenderWaterBoundary[];
}) {
  const geometry = useMemo(
    () => makeTerrainGeometry(bounds, waterBoundaries),
    [bounds, waterBoundaries],
  );

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        color="#ffffff"
        metalness={0}
        roughness={0.98}
        vertexColors
      />
    </mesh>
  );
}

function makeTerrainGeometry(
  bounds: MetropolisDisplayBounds,
  waterBoundaries: readonly RenderWaterBoundary[],
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(bounds.minX, bounds.minZ);
  shape.lineTo(bounds.maxX, bounds.minZ);
  shape.lineTo(bounds.maxX, bounds.maxZ);
  shape.lineTo(bounds.minX, bounds.maxZ);
  shape.closePath();

  for (const boundary of waterBoundaries) {
    if (boundary.outline.length < 3) continue;
    const hole = new THREE.Path();
    hole.moveTo(boundary.outline[0]!.x, boundary.outline[0]!.z);
    for (const point of boundary.outline.slice(1)) {
      hole.lineTo(point.x, point.z);
    }
    hole.closePath();
    shape.holes.push(hole);
  }

  const geometry = new THREE.ShapeGeometry(shape, 8);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, LAND_Y, 0);

  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const cityColor = new THREE.Color("#77766f");
  const outerColor = new THREE.Color("#4d5653");
  const color = new THREE.Color();
  const gradientDistance = Math.max(4, Math.max(bounds.width, bounds.depth) * 0.12);
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const z = positions.getZ(index);
    const distanceX =
      Math.max(0, Math.abs(x - bounds.x) - bounds.width * 0.38);
    const distanceZ =
      Math.max(0, Math.abs(z - bounds.z) - bounds.depth * 0.38);
    const distance = Math.hypot(distanceX, distanceZ);
    color
      .copy(cityColor)
      .lerp(
        outerColor,
        THREE.MathUtils.smoothstep(distance, 0, gradientDistance),
      );
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function SemanticWater({
  boundaries,
  color,
  night,
}: {
  boundaries: readonly RenderWaterBoundary[];
  color: string;
  night: number;
}) {
  return (
    <group name="semantic-water">
      {boundaries.map((boundary) => (
        <WaterBody
          boundary={boundary}
          color={color}
          key={boundary.id}
          night={night}
        />
      ))}
    </group>
  );
}

function WaterBody({
  boundary,
  color,
  night,
}: {
  boundary: RenderWaterBoundary;
  color: string;
  night: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const geometry = useMemo(
    () => makePolygonGeometry(boundary.outline, WATER_Y),
    [boundary.outline],
  );
  const shorelineGeometry = useMemo(
    () => makeShorelineGeometry(boundary),
    [boundary],
  );
  const quayDeckGeometry = useMemo(
    () =>
      makeBoundaryRibbonGeometry(
        boundary,
        0.52,
        LAND_Y + 0.035,
      ),
    [boundary],
  );
  const quayWallGeometry = useMemo(
    () => makeBoundaryWallGeometry(boundary),
    [boundary],
  );
  const uniforms = useMemo(
    () =>
      THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(color) },
          uNight: { value: night },
        },
      ]),
    [color, night],
  );

  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uTime!.value = clock.elapsedTime;
    (material.uniforms.uColor!.value as THREE.Color).set(color);
    material.uniforms.uNight!.value = night;
  });

  return (
    <group>
      <mesh geometry={geometry} receiveShadow renderOrder={0}>
        <shaderMaterial
          ref={materialRef}
          fog
          fragmentShader={`
            #include <fog_pars_fragment>
            uniform float uTime;
            uniform float uNight;
            uniform vec3 uColor;
            varying vec3 vWorld;
            varying vec3 vViewDirection;
            void main() {
              float waveA = sin(vWorld.x * .55 + vWorld.z * .21 + uTime * .72);
              float waveB = sin(vWorld.z * 1.18 - vWorld.x * .14 - uTime * 1.08);
              float ripple = waveA * .52 + waveB * .48;
              float fresnel = pow(1.0 - clamp(abs(vViewDirection.y), 0.0, 1.0), 2.2);
              float glint = smoothstep(.55, .96, ripple);
              float shoreBand = smoothstep(.15, .85, abs(sin(vWorld.x * .075)));
              vec3 deep = vec3(.025, .095, .12) * (1.0 + uNight * .05);
              vec3 shallow = vec3(.11, .22, .235);
              vec3 finalColor = mix(deep, shallow, fresnel * .38 + glint * .12);
              finalColor *= .86 + shoreBand * .14;
              gl_FragColor = vec4(finalColor, .97);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
              #include <fog_fragment>
            }
          `}
          transparent
          uniforms={uniforms}
          vertexShader={`
            #include <fog_pars_vertex>
            varying vec3 vWorld;
            varying vec3 vViewDirection;
            void main() {
              vec4 world = modelMatrix * vec4(position, 1.0);
              vec4 mvPosition = viewMatrix * world;
              vWorld = world.xyz;
              vViewDirection = normalize(cameraPosition - world.xyz);
              gl_Position = projectionMatrix * mvPosition;
              #include <fog_vertex>
            }
          `}
        />
      </mesh>
      <mesh geometry={shorelineGeometry} renderOrder={3}>
        <meshBasicMaterial
          color="#566b66"
          depthWrite={false}
          opacity={0.42}
          toneMapped={false}
          transparent
        />
      </mesh>
      <mesh
        geometry={quayWallGeometry}
        receiveShadow
        renderOrder={2}
      >
        <meshStandardMaterial
          color="#76847e"
          metalness={0.02}
          roughness={0.94}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh
        geometry={quayDeckGeometry}
        receiveShadow
        renderOrder={4}
      >
        <meshStandardMaterial
          color="#aeb6ac"
          metalness={0.01}
          roughness={0.9}
        />
      </mesh>
    </group>
  );
}

function makePolygonGeometry(
  points: readonly { x: number; z: number }[],
  y: number,
): THREE.BufferGeometry {
  if (points.length < 3) return new THREE.BufferGeometry();
  const shape = new THREE.Shape();
  shape.moveTo(points[0]!.x, points[0]!.z);
  for (const point of points.slice(1)) shape.lineTo(point.x, point.z);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape, 12);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  geometry.computeVertexNormals();
  return geometry;
}

function makeShorelineGeometry(
  boundary: RenderWaterBoundary,
): THREE.BufferGeometry {
  return makeBoundaryRibbonGeometry(
    boundary,
    0.18,
    WATER_Y + 0.014,
  );
}

function makeBoundaryRibbonGeometry(
  boundary: RenderWaterBoundary,
  width: number,
  y: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index < boundary.outline.length; index += 1) {
    const current = boundary.outline[index]!;
    const next = boundary.outline[(index + 1) % boundary.outline.length]!;
    const dx = next.x - current.x;
    const dz = next.z - current.z;
    const length = Math.max(0.0001, Math.hypot(dx, dz));
    const nx = (-dz / length) * width;
    const nz = (dx / length) * width;
    const base = positions.length / 3;
    positions.push(
      current.x - nx,
      y,
      current.z - nz,
      current.x + nx,
      y,
      current.z + nz,
      next.x - nx,
      y,
      next.z - nz,
      next.x + nx,
      y,
      next.z + nz,
    );
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeBoundaryWallGeometry(
  boundary: RenderWaterBoundary,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const wallBottom = WATER_Y - 0.035;
  const wallTop = LAND_Y + 0.055;
  for (let index = 0; index < boundary.outline.length; index += 1) {
    const current = boundary.outline[index]!;
    const next = boundary.outline[(index + 1) % boundary.outline.length]!;
    const base = positions.length / 3;
    positions.push(
      current.x,
      wallBottom,
      current.z,
      current.x,
      wallTop,
      current.z,
      next.x,
      wallBottom,
      next.z,
      next.x,
      wallTop,
      next.z,
    );
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const HERO_GLASS_SYSTEMS = new Set<HeroFacadeSystem>([
  "miesian-black-grid",
  "blue-green-unitized-glass",
  "bronze-vertical-fins",
]);

const CONTEXT_MATERIAL_COLORS: Readonly<
  Record<VisualCityPlan["contextBuildings"][number]["material"], string>
> = {
  brick: "#76574d",
  limestone: "#aaa79e",
  concrete: "#7f8582",
  "dark-glass": "#40565d",
};

function heroPanel(
  target: BoxInstance[],
  envelope: UrbanArchitecturalEnvelope,
  edge: "north" | "east" | "south" | "west",
  offset: number,
  y: number,
  width: number,
  height: number,
  depth: number,
  surfaceOffset: number,
  color: string,
) {
  const northSouth = edge === "north" || edge === "south";
  const side = edge === "north" || edge === "west" ? -1 : 1;
  target.push({
    x: northSouth
      ? envelope.x + offset
      : envelope.x + side * (envelope.width / 2 + surfaceOffset),
    y: CAMPUS_BASE_Y + y,
    z: northSouth
      ? envelope.z + side * (envelope.depth / 2 + surfaceOffset)
      : envelope.z + offset,
    width,
    height,
    depth,
    rotationY: northSouth ? 0 : Math.PI / 2,
    color,
  });
}

function facadePalette(system: HeroFacadeSystem): {
  masonry: string;
  glass: string;
  frame: string;
  interior: string;
} {
  if (system === "fulton-warehouse-brick") {
    return { masonry: "#713e32", glass: "#4d676b", frame: "#332f2a", interior: "#382e27" };
  }
  if (system === "chicago-school-terra-cotta") {
    return { masonry: "#b89263", glass: "#587a7e", frame: "#57483a", interior: "#372f29" };
  }
  if (system === "loop-limestone-bay") {
    return { masonry: "#b9b3a6", glass: "#526d73", frame: "#4d514e", interior: "#312f2c" };
  }
  if (system === "miesian-black-grid") {
    return { masonry: "#303536", glass: "#284850", frame: "#111819", interior: "#162023" };
  }
  if (system === "blue-green-unitized-glass") {
    return { masonry: "#608b8c", glass: "#4a7f88", frame: "#b1b9b3", interior: "#1d3236" };
  }
  return { masonry: "#7a6247", glass: "#3f6268", frame: "#806743", interior: "#1f2b2c" };
}

function addHeroFacade(
  geometry: VisualSliceGeometry,
  envelope: UrbanArchitecturalEnvelope,
  heroBlock: VisualHeroBlock,
) {
  const system = heroBlock.facadeSystem;
  const palette = facadePalette(system);
  const glassSystem = HERO_GLASS_SYSTEMS.has(system);
  const floorHeight = system === "fulton-warehouse-brick" ? 1.25 : 1.04;
  const floors = Math.max(3, Math.min(15, Math.floor((envelope.height - 2.25) / floorHeight)));
  // Tall hero volumes must read as complete buildings from orbit, not stage
  // flats with a finished street side and a blank rear wall.
  for (const edge of ["north", "east", "south", "west"] as const) {
    const span = edge === "north" || edge === "south" ? envelope.width : envelope.depth;
    const bayWidth = glassSystem ? 0.72 : system === "fulton-warehouse-brick" ? 1.18 : 0.92;
    const bays = Math.max(2, Math.min(10, Math.floor(span / bayWidth)));
    const actualBay = span / bays;
    for (let floor = 0; floor < floors; floor += 1) {
      const y = 2.45 + floor * floorHeight + floorHeight * 0.48;
      for (let bay = 0; bay < bays; bay += 1) {
        const offset = -span / 2 + actualBay * (bay + 0.5);
        heroPanel(
          geometry.heroInteriors,
          envelope,
          edge,
          offset,
          y,
          actualBay * (glassSystem ? 0.84 : 0.58),
          floorHeight * 0.64,
          0.09,
          0.018,
          palette.interior,
        );
        heroPanel(
          glassSystem ? geometry.heroGlass : geometry.heroMasonry,
          envelope,
          edge,
          offset,
          y,
          actualBay * (glassSystem ? 0.79 : 0.54),
          floorHeight * (glassSystem ? 0.57 : 0.55),
          glassSystem ? 0.045 : 0.085,
          glassSystem ? 0.075 : 0.09,
          glassSystem ? palette.glass : "#49656a",
        );
      }
      heroPanel(
        geometry.heroFrames,
        envelope,
        edge,
        0,
        2.35 + floor * floorHeight,
        span * 0.98,
        glassSystem ? 0.07 : 0.13,
        0.08,
        0.11,
        palette.frame,
      );
    }
    for (let bay = 0; bay <= bays; bay += 1) {
      const offset = -span / 2 + (span / bays) * bay;
      heroPanel(
        glassSystem ? geometry.heroFrames : geometry.heroMasonry,
        envelope,
        edge,
        offset,
        2.25 + (floors * floorHeight) / 2,
        glassSystem ? 0.065 : Math.max(0.13, actualBay * 0.16),
        floors * floorHeight + 0.2,
        glassSystem ? 0.075 : 0.11,
        0.115,
        glassSystem ? palette.frame : palette.masonry,
      );
    }
    if (system === "bronze-vertical-fins") {
      for (let bay = 0; bay <= bays; bay += 2) {
        heroPanel(
          geometry.heroDetails,
          envelope,
          edge,
          -span / 2 + (span / bays) * bay,
          2.25 + (floors * floorHeight) / 2,
          0.1,
          floors * floorHeight + 0.3,
          0.32,
          0.19,
          "#9a7a48",
        );
      }
    }
    heroPanel(
      geometry.heroDetails,
      envelope,
      edge,
      0,
      envelope.height + 0.1,
      span * 1.035,
      system === "fulton-warehouse-brick" ? 0.34 : 0.18,
      0.22,
      0.18,
      glassSystem ? palette.frame : palette.masonry,
    );
    if (system === "fulton-warehouse-brick") {
      const escapeX = span * 0.2;
      for (let floor = 1; floor < floors; floor += 2) {
        heroPanel(
          geometry.heroDetails,
          envelope,
          edge,
          escapeX,
          2.5 + floor * floorHeight,
          1.35,
          0.07,
          0.46,
          0.36,
          "#2d302e",
        );
      }
      for (const railOffset of [escapeX - 0.58, escapeX + 0.58]) {
        heroPanel(
          geometry.heroDetails,
          envelope,
          edge,
          railOffset,
          2.45 + (floors * floorHeight) / 2,
          0.055,
          floors * floorHeight,
          0.32,
          0.34,
          "#2d302e",
        );
      }
    }
  }
}

function makeVisualSliceGeometry(
  visualCity: VisualCityPlan,
  urbanFabric: UrbanFabricPlan,
  replacedEnvelopeIds: ReadonlySet<string>,
): VisualSliceGeometry {
  const replacedBlockIds = new Set(
    urbanFabric.architecturalEnvelopes
      .filter((envelope) => replacedEnvelopeIds.has(envelope.id))
      .map((envelope) => envelope.blockId),
  );
  const geometry: VisualSliceGeometry = {
    contextGround: [],
    contextRoads: [],
    contextShells: [],
    contextRoofs: [],
    contextWindows: [],
    heroMasonry: [],
    heroGlass: [],
    heroInteriors: [],
    heroFrames: [],
    heroShopfronts: [],
    heroAwnings: [],
    heroDetails: [],
    heroMassing: [],
    heroGlassMassing: [],
    heroRoofClutter: [],
    heroStreetTrees: [],
    heroTreeCrowns: [],
  };
  for (const block of visualCity.contextBlocks) {
    geometry.contextGround.push({
      x: block.x,
      y: LAND_Y + 0.025,
      z: block.z,
      width: block.width,
      height: 0.05,
      depth: block.depth,
      color: block.ring === 1 ? "#73766f" : block.ring === 2 ? "#686c67" : "#5e635f",
    });
  }
  for (const road of visualCity.contextRoads) {
    const [start, end] = road.centerline;
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const length = Math.hypot(dx, dz);
    geometry.contextRoads.push({
      x: (start.x + end.x) / 2,
      y: ROAD_Y - 0.025,
      z: (start.z + end.z) / 2,
      width: length,
      height: 0.05,
      depth: road.width,
      rotationY: -Math.atan2(dz, dx),
      color: road.ring === 1 ? "#394348" : "#3f484b",
    });
  }
  for (const building of visualCity.contextBuildings) {
    geometry.contextShells.push({
      x: building.x,
      y: CAMPUS_BASE_Y + building.height / 2,
      z: building.z,
      width: building.width,
      height: building.height,
      depth: building.depth,
      color: CONTEXT_MATERIAL_COLORS[building.material],
    });
    const roofHeight = building.roof === "mechanical" ? 0.44 : building.roof === "setback" ? 0.24 : 0.12;
    geometry.contextRoofs.push({
      x: building.x,
      y: CAMPUS_BASE_Y + building.height + roofHeight / 2,
      z: building.z,
      width: building.width * (building.roof === "setback" ? 0.62 : 0.82),
      height: roofHeight,
      depth: building.depth * (building.roof === "setback" ? 0.6 : 0.76),
      color: "#4b5150",
    });
    if (building.ring === 1) {
      const floors = Math.min(8, Math.max(2, Math.floor(building.height / 1.25)));
      for (let floor = 0; floor < floors; floor += 1) {
        geometry.contextWindows.push({
          x: building.x,
          y: CAMPUS_BASE_Y + 0.9 + floor * 1.18,
          z: building.z - building.depth / 2 - 0.025,
          width: building.width * 0.72,
          height: 0.42,
          depth: 0.04,
          color: "#29464e",
        });
        geometry.contextWindows.push({
          x: building.x + building.width / 2 + 0.025,
          y: CAMPUS_BASE_Y + 0.9 + floor * 1.18,
          z: building.z,
          width: building.depth * 0.68,
          height: 0.38,
          depth: 0.04,
          rotationY: Math.PI / 2,
          color: floor % 3 === 1 ? "#5c5a50" : "#30474c",
        });
      }
      if (building.roof !== "setback") geometry.contextRoofs.push({
        x: building.x - building.width * 0.18,
        y: CAMPUS_BASE_Y + building.height + roofHeight + 0.12,
        z: building.z + building.depth * 0.12,
        width: building.width * 0.24,
        height: 0.22,
        depth: building.depth * 0.28,
        color: "#555957",
      });
    }
  }

  const heroByBlockId = new Map(visualCity.hero.blocks.map((block) => [block.blockId, block]));
  const envelopesByBlockId = new Map<string, UrbanArchitecturalEnvelope[]>();
  for (const envelope of urbanFabric.architecturalEnvelopes) {
    if (!heroByBlockId.has(envelope.blockId)) continue;
    const candidates = envelopesByBlockId.get(envelope.blockId) ?? [];
    candidates.push(envelope);
    envelopesByBlockId.set(envelope.blockId, candidates);
  }
  for (const heroBlock of visualCity.hero.blocks) {
    const envelopes = (envelopesByBlockId.get(heroBlock.blockId) ?? []).sort((left, right) => left.id.localeCompare(right.id, "en"));
    for (const [index, envelope] of envelopes.entries()) {
      if (replacedEnvelopeIds.has(envelope.id)) continue;
      const bonus = index === 0
        ? heroBlock.role === "civic-podium-tower"
          ? 10
          : heroBlock.role === "modern-glass-corner"
            ? 7
            : heroBlock.role === "loop-masonry-streetwall"
              ? 5
              : heroBlock.role === "riverfront-bridge-gateway"
                ? 3
                : 0
        : 0;
      const detailedEnvelope = bonus > 0 ? { ...envelope, height: envelope.height + bonus } : envelope;
      if (bonus > 0) {
        const glass = HERO_GLASS_SYSTEMS.has(heroBlock.facadeSystem);
        const palette = facadePalette(heroBlock.facadeSystem);
        (glass ? geometry.heroGlassMassing : geometry.heroMassing).push({
          x: detailedEnvelope.x,
          y: CAMPUS_BASE_Y + detailedEnvelope.height / 2,
          z: detailedEnvelope.z,
          width: detailedEnvelope.width,
          height: detailedEnvelope.height,
          depth: detailedEnvelope.depth,
          color: glass ? palette.interior : palette.masonry,
        });
        geometry.heroRoofClutter.push(
          {
            x: detailedEnvelope.x - detailedEnvelope.width * 0.18,
            y: CAMPUS_BASE_Y + detailedEnvelope.height + 0.25,
            z: detailedEnvelope.z,
            width: detailedEnvelope.width * 0.22,
            height: 0.5,
            depth: detailedEnvelope.depth * 0.24,
            color: "#48504e",
          },
          {
            x: detailedEnvelope.x + detailedEnvelope.width * 0.19,
            y: CAMPUS_BASE_Y + detailedEnvelope.height + 0.16,
            z: detailedEnvelope.z + detailedEnvelope.depth * 0.12,
            width: detailedEnvelope.width * 0.12,
            height: 0.32,
            depth: detailedEnvelope.depth * 0.14,
            color: "#343b3a",
          },
        );
      }
      addHeroFacade(geometry, detailedEnvelope, heroBlock);
    }
  }
  for (const storefront of urbanFabric.storefronts) {
    if (!heroByBlockId.has(storefront.blockId)) continue;
    if (replacedEnvelopeIds.has(storefront.architecturalEnvelopeId)) continue;
    const side = storefront.edge === "north" || storefront.edge === "west" ? -1 : 1;
    const northSouth = storefront.edge === "north" || storefront.edge === "south";
    geometry.heroShopfronts.push({
      x: storefront.x + (northSouth ? 0 : side * 0.07),
      y: CAMPUS_BASE_Y + 0.92,
      z: storefront.z + (northSouth ? side * 0.07 : 0),
      width: storefront.width * 0.94,
      height: 1.32,
      depth: 0.085,
      rotationY: storefront.rotation,
      color: "#233e43",
    });
    geometry.heroAwnings.push({
      x: storefront.x + (northSouth ? 0 : side * 0.17),
      y: CAMPUS_BASE_Y + 1.55,
      z: storefront.z + (northSouth ? side * 0.17 : 0),
      width: storefront.width * 0.88,
      height: 0.1,
      depth: 0.46,
      rotationX: northSouth ? -side * 0.12 : 0,
      rotationY: storefront.rotation,
      rotationZ: northSouth ? 0 : side * 0.12,
      color: storefront.active ? "#b56343" : "#6c716c",
    });
  }
  for (const heroBlock of visualCity.hero.blocks) {
    if (replacedBlockIds.has(heroBlock.blockId)) continue;
    const { block } = heroBlock;
    for (const side of [-1, 1] as const) {
      for (let index = -1; index <= 1; index += 1) {
        const x = block.x + index * (block.width * 0.28);
        const z = block.z + side * (block.depth / 2 + 0.5);
        geometry.heroStreetTrees.push({ x, y: CAMPUS_BASE_Y + 0.7, z, radius: 0.085, height: 1.4, color: "#514337" });
        geometry.heroTreeCrowns.push({ x, y: CAMPUS_BASE_Y + 1.62, z, radius: 0.48, height: 0.7, color: side === 1 ? "#486c46" : "#52764e" });
      }
    }
  }
  return geometry;
}

function makeBrickTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const row = Math.floor(y / 8);
      const mortar = y % 8 === 0 || (x + (row % 2) * 8) % 16 === 0;
      const noise = (x * 13 + y * 7) % 17;
      data[index] = mortar ? 205 : 148 + noise;
      data[index + 1] = mortar ? 205 : 148 + noise;
      data[index + 2] = mortar ? 205 : 148 + noise;
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.needsUpdate = true;
  return texture;
}

function makeCityReflectionTexture(): THREE.DataTexture {
  const width = 64;
  const height = 32;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const horizon = y / (height - 1);
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const band = Math.sin(x * 0.55) > 0.5 && y > 16 ? 24 : 0;
      data[index] = 58 + Math.floor(horizon * 80) + band;
      data[index + 1] = 91 + Math.floor(horizon * 70) + band;
      data[index + 2] = 108 + Math.floor(horizon * 58) + band;
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function VisualSliceInstances({ geometry, night }: { geometry: VisualSliceGeometry; night: number }) {
  const brickTexture = useMemo(() => makeBrickTexture(), []);
  const reflectionTexture = useMemo(() => makeCityReflectionTexture(), []);
  return (
    <group name="visual-city-v4-1-context">
      <StaticBoxInstances boxes={geometry.contextGround} color="#6d716b" material="standard" receiveShadow roughness={0.98} />
      <StaticBoxInstances boxes={geometry.contextRoads} color="#3d474b" material="standard" receiveShadow roughness={0.9} />
      <StaticBoxInstances boxes={geometry.contextShells} castShadow color="#ffffff" material="standard" receiveShadow roughness={0.84} />
      <StaticBoxInstances boxes={geometry.contextRoofs} castShadow color="#505654" material="standard" roughness={0.74} />
      <StaticBoxInstances boxes={geometry.contextWindows} color="#29464e" emissive="#d99b55" emissiveIntensity={night * 0.32} material="standard" roughness={0.32} />
      <StaticBoxInstances boxes={geometry.heroMasonry} castShadow color="#ffffff" map={brickTexture} material="standard" receiveShadow roughness={0.94} />
      <StaticBoxInstances boxes={geometry.heroMassing} castShadow color="#ffffff" map={brickTexture} material="standard" receiveShadow roughness={0.94} />
      <StaticBoxInstances boxes={geometry.heroGlassMassing} castShadow color="#ffffff" material="standard" metalness={0.14} receiveShadow roughness={0.4} />
      <StaticBoxInstances boxes={geometry.heroInteriors} color="#1a2425" emissive="#d9a968" emissiveIntensity={0.04 + night * 0.68} material="standard" roughness={0.88} />
      <StaticBoxInstances boxes={geometry.heroGlass} color="#ffffff" envMap={reflectionTexture} material="physical" metalness={0.12} opacity={0.84} roughness={0.12} transparent />
      <StaticBoxInstances boxes={geometry.heroFrames} castShadow color="#ffffff" material="standard" metalness={0.54} roughness={0.35} />
      <StaticBoxInstances boxes={geometry.heroShopfronts} color="#233e43" envMap={reflectionTexture} material="physical" opacity={0.9} roughness={0.16} transparent />
      <StaticBoxInstances boxes={geometry.heroAwnings} castShadow color="#ffffff" material="standard" roughness={0.72} />
      <StaticBoxInstances boxes={geometry.heroDetails} castShadow color="#ffffff" material="standard" metalness={0.62} roughness={0.32} />
      <StaticBoxInstances boxes={geometry.heroRoofClutter} castShadow color="#ffffff" material="standard" metalness={0.18} roughness={0.72} />
      <StaticCylinderInstances cylinders={geometry.heroStreetTrees} color="#514337" radialSegments={8} castShadow />
      <StaticCylinderInstances cylinders={geometry.heroTreeCrowns} color="#52764e" radialSegments={10} castShadow />
    </group>
  );
}

function HeroStorefrontSigns({ plan, visualCity }: { plan: UrbanFabricPlan; visualCity: VisualCityPlan }) {
  const heroIds = new Set(visualCity.hero.blockIds);
  const signs = visualCity.hero.blocks.flatMap((heroBlock) => {
    const candidates = plan.storefronts
      .filter((storefront) => storefront.blockId === heroBlock.blockId && storefront.active)
      .sort((left, right) => left.id.localeCompare(right.id, "en"));
    return candidates.slice(0, 1);
  });
  return (
    <group name="hero-storefront-signs">
      {signs.filter((sign) => heroIds.has(sign.blockId)).map((sign) => (
        <Html
          center
          distanceFactor={14}
          key={sign.id}
          position={[sign.x, CAMPUS_BASE_Y + 1.74, sign.z]}
          sprite
          transform
          zIndexRange={[8, 0]}
        >
          <span style={{
            background: "rgba(30, 33, 31, .88)",
            border: "1px solid rgba(238, 215, 166, .65)",
            borderRadius: 2,
            color: "#f4e4bd",
            display: "block",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: ".08em",
            padding: "1px 3px",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}>{sign.signLabel}</span>
        </Html>
      ))}
    </group>
  );
}

const URBAN_MATERIAL_COLORS: Readonly<Record<UrbanMaterialKey, string>> = {
  limestone: "#c8c4b8",
  "warm-concrete": "#aaa59a",
  brick: "#947d70",
  slate: "#727b7d",
  "red-brick": "#8a493c",
  "cream-terra-cotta": "#c8ab7e",
  "dark-metal": "#263337",
  "blue-green-glass": "#6b9294",
  "bronze-metal": "#765d43",
};

function emptyCampusGeometry(): CampusGeometry {
  return {
    plazas: [],
    lawns: [],
    shells: [],
    wings: [],
    roofs: [],
    glazing: [],
    accents: [],
    details: [],
    cylinders: [],
    selection: [],
  };
}

function addFacadePanel(
  target: BoxInstance[],
  envelope: UrbanArchitecturalEnvelope,
  edge: "north" | "east" | "south" | "west",
  offset: number,
  y: number,
  width: number,
  height: number,
  depth: number,
  color: string,
) {
  const northSouth = edge === "north" || edge === "south";
  target.push({
    x: northSouth
      ? envelope.x + offset
      : envelope.x + (edge === "west" ? -1 : 1) * (envelope.width / 2 + 0.025),
    y: CAMPUS_BASE_Y + y,
    z: northSouth
      ? envelope.z + (edge === "north" ? -1 : 1) * (envelope.depth / 2 + 0.025)
      : envelope.z + offset,
    width,
    height,
    depth,
    rotationY: northSouth ? 0 : Math.PI / 2,
    color,
  });
}

function addChicagoFacade(
  geometry: CampusGeometry,
  envelope: UrbanArchitecturalEnvelope,
) {
  const streetEdges = [envelope.primaryEdge, envelope.secondaryEdge] as const;
  const curtain = Boolean(envelope.curtainWallVariant);
  const warehouse =
    envelope.facadeFamily === "fulton-brick-warehouse" ||
    envelope.facadeFamily === "narrow-storefront-row";
  const civic = envelope.facadeFamily === "civic-institutional";
  const glazingColor =
    envelope.curtainWallVariant === "light-blue-green-grid"
      ? "#7fa7aa"
      : envelope.curtainWallVariant === "bronze-vertical-fins"
        ? "#746f64"
        : curtain
          ? "#455a60"
          : "#4d6970";
  const frameColor =
    envelope.curtainWallVariant === "bronze-vertical-fins"
      ? "#7d6549"
      : curtain
        ? "#263237"
        : envelope.facadeFamily === "fulton-brick-warehouse"
          ? "#d0b691"
          : "#756b5e";
  const availableHeight = Math.max(2.4, envelope.height - 2.15);
  const floorHeight = warehouse ? 1.25 : curtain ? 0.92 : 1.08;
  const floorCount = Math.max(
    2,
    Math.min(11, Math.floor(availableHeight / floorHeight)),
  );

  for (const edge of streetEdges) {
    const facadeLength =
      edge === "north" || edge === "south"
        ? envelope.width
        : envelope.depth;
    const bayCount = Math.max(2, Math.min(5, Math.floor(facadeLength / 0.84)));
    const bayPitch = (facadeLength * 0.82) / bayCount;
    for (let floor = 0; floor < floorCount; floor += 1) {
      const y = 2.25 + floor * floorHeight;
      for (let bay = 0; bay < bayCount; bay += 1) {
        const offset = (bay - (bayCount - 1) / 2) * bayPitch;
        addFacadePanel(
          geometry.glazing,
          envelope,
          edge,
          offset,
          y,
          bayPitch * (curtain ? 0.9 : civic ? 0.46 : warehouse ? 0.64 : 0.57),
          floorHeight * (curtain ? 0.72 : warehouse ? 0.66 : 0.56),
          0.055,
          glazingColor,
        );
      }
      if (curtain || warehouse) {
        addFacadePanel(
          geometry.details,
          envelope,
          edge,
          0,
          y - floorHeight * 0.48,
          facadeLength * 0.88,
          curtain ? 0.08 : 0.12,
          0.07,
          frameColor,
        );
      }
    }
    if (curtain) {
      for (let bay = 0; bay <= bayCount; bay += 1) {
        addFacadePanel(
          geometry.details,
          envelope,
          edge,
          (bay - bayCount / 2) * bayPitch,
          2.15 + (floorCount * floorHeight) / 2,
          0.055,
          floorCount * floorHeight,
          0.075,
          frameColor,
        );
      }
    }
    if (!curtain) {
      addFacadePanel(
        geometry.details,
        envelope,
        edge,
        0,
        Math.min(envelope.height - 0.18, 2.15 + floorCount * floorHeight),
        facadeLength * 0.94,
        envelope.facadeFamily === "art-deco-setback" ? 0.26 : 0.16,
        0.1,
        frameColor,
      );
    }
    if (envelope.facadeFamily === "riverfront-terrace") {
      for (let terrace = 0; terrace < Math.min(3, floorCount - 1); terrace += 1) {
        addFacadePanel(
          geometry.accents,
          envelope,
          edge,
          0,
          3.05 + terrace * floorHeight * 1.75,
          facadeLength * (0.82 - terrace * 0.08),
          0.08,
          0.34,
          "#a6aaa4",
        );
      }
    }
    if (
      envelope.facadeFamily === "art-deco-setback" ||
      envelope.facadeFamily === "chicago-school-masonry"
    ) {
      for (const pier of [-1, 1]) {
        addFacadePanel(
          geometry.details,
          envelope,
          edge,
          pier * facadeLength * 0.31,
          Math.min(envelope.height, 2.1 + floorCount * floorHeight) / 2 + 1,
          envelope.facadeFamily === "art-deco-setback" ? 0.11 : 0.08,
          Math.min(envelope.height - 0.4, floorCount * floorHeight + 1.4),
          0.085,
          frameColor,
        );
      }
    }
    if (envelope.facadeFamily === "narrow-storefront-row") {
      addFacadePanel(
        geometry.details,
        envelope,
        edge,
        0,
        Math.min(envelope.height - 0.05, 2.3 + floorCount * floorHeight),
        facadeLength,
        0.12,
        0.18,
        "#493f37",
      );
    }
  }

  if (envelope.landmark) {
    geometry.cylinders.push({
      x: envelope.x,
      y: CAMPUS_BASE_Y + envelope.height + 0.9,
      z: envelope.z,
      radius: 0.12,
      height: 1.8,
      color: "#4e5d60",
    });
  }
}

function storefrontColor(storefront: UrbanStorefront): string {
  const colors = [
    "#a64f3d",
    "#315f76",
    "#52734b",
    "#d29b42",
    "#6d4f79",
    "#bd6d3d",
    "#48777a",
    "#9a5c70",
    "#a33f35",
    "#4f657a",
  ];
  return colors[stableCityHash(storefront.category) % colors.length]!;
}

function addUrbanStorefront(
  geometry: CampusGeometry,
  storefront: UrbanStorefront,
) {
  const color = storefrontColor(storefront);
  geometry.glazing.push({
    x: storefront.x,
    y: CAMPUS_BASE_Y + 0.88,
    z: storefront.z,
    width: storefront.width,
    height: 1.22,
    depth: 0.075,
    rotationY: storefront.rotation,
    color: "#314e54",
  });
  geometry.accents.push({
    x: storefront.x,
    y: CAMPUS_BASE_Y + 1.57,
    z: storefront.z,
    width: storefront.width * 0.92,
    height: 0.24,
    depth: 0.14,
    rotationY: storefront.rotation,
    color,
  });
  if (stableCityHash(storefront.id) % 4 !== 0) {
    const direction =
      storefront.edge === "north" || storefront.edge === "west" ? -1 : 1;
    geometry.accents.push({
      x:
        storefront.edge === "east" || storefront.edge === "west"
          ? storefront.x + direction * 0.16
          : storefront.x,
      y: CAMPUS_BASE_Y + 1.4,
      z:
        storefront.edge === "north" || storefront.edge === "south"
          ? storefront.z + direction * 0.16
          : storefront.z,
      width: storefront.width * 0.78,
      height: 0.08,
      depth: 0.42,
      rotationX: -0.08,
      rotationY: storefront.rotation,
      color,
    });
  }
  if (stableCityHash(storefront.signLabel) % 3 === 0) {
    const direction =
      storefront.edge === "north" || storefront.edge === "west" ? -1 : 1;
    geometry.accents.push({
      x:
        storefront.edge === "east" || storefront.edge === "west"
          ? storefront.x + direction * 0.32
          : storefront.x + storefront.width * 0.36,
      y: CAMPUS_BASE_Y + 1.24,
      z:
        storefront.edge === "north" || storefront.edge === "south"
          ? storefront.z + direction * 0.32
          : storefront.z + storefront.width * 0.36,
      width: 0.08,
      height: 0.38,
      depth: 0.42,
      rotationY: storefront.rotation,
      color,
    });
  }
  geometry.details.push(
    {
      x: storefront.x,
      y: CAMPUS_BASE_Y + 0.9,
      z: storefront.z,
      width: 0.055,
      height: 1.28,
      depth: 0.1,
      rotationY: storefront.rotation,
      color: "#c3bca9",
    },
    {
      x: storefront.x,
      y: CAMPUS_BASE_Y + 0.24,
      z: storefront.z,
      width: storefront.width * 0.96,
      height: 0.08,
      depth: 0.16,
      rotationY: storefront.rotation,
      color: "#b9b5a9",
    },
  );
}

function makeUrbanFabricGeometry(
  plan: UrbanFabricPlan,
  reservedEntityIds: ReadonlySet<string>,
  activeComponentIds: ReadonlySet<string> | null,
  replacedEnvelopeIds: ReadonlySet<string> = EMPTY_ID_SET,
): CampusGeometry {
  const geometry = emptyCampusGeometry();
  const reservedBuildingIds = new Set(
    [...reservedEntityIds]
      .map((entityId) => plan.entityAddresses[entityId]?.buildingId)
      .filter((id): id is string => Boolean(id)),
  );
  const visibleEnvelopeIds = new Set(
    plan.architecturalEnvelopes
      .filter(
        (envelope) =>
          !reservedBuildingIds.has(envelope.semanticBuildingId) &&
          !replacedEnvelopeIds.has(envelope.id),
      )
      .map((envelope) => envelope.id),
  );
  for (const block of plan.blocks) {
    const alley = block.characterZone === "fulton-market" ? 0.58 : 0.42;
    geometry.plazas.push(
      {
        x: block.x,
        y: CAMPUS_BASE_Y + 0.025,
        z: block.z,
        width: alley,
        height: 0.05,
        depth: block.depth - 0.5,
        color: "#85877f",
      },
      {
        x: block.x,
        y: CAMPUS_BASE_Y + 0.03,
        z: block.z,
        width: block.width - 0.5,
        height: 0.055,
        depth: alley,
        color: "#8d8c83",
      },
    );
  }
  for (const mass of plan.massingVolumes) {
    if (!visibleEnvelopeIds.has(mass.architecturalEnvelopeId)) continue;
    const target =
      mass.kind === "roof-house" || mass.kind === "crown"
        ? geometry.roofs
        : mass.kind === "base" || mass.kind === "shoulder"
          ? geometry.wings
          : geometry.shells;
    target.push({
      x: mass.x,
      y: CAMPUS_BASE_Y + mass.y,
      z: mass.z,
      width: mass.width,
      height: mass.height,
      depth: mass.depth,
      rotationY: mass.rotation,
      color: URBAN_MATERIAL_COLORS[mass.material],
    });
  }
  for (const envelope of plan.architecturalEnvelopes) {
    if (!visibleEnvelopeIds.has(envelope.id)) continue;
    addChicagoFacade(geometry, envelope);
  }
  for (const storefront of plan.storefronts) {
    if (!visibleEnvelopeIds.has(storefront.architecturalEnvelopeId)) continue;
    addUrbanStorefront(geometry, storefront);
  }
  if (activeComponentIds && activeComponentIds.size > 0) {
    const assignmentByComponentId = new Map(
      plan.componentAssignments.map((assignment) => [
        assignment.componentId,
        assignment,
      ]),
    );
    for (const block of plan.blocks) {
      const componentId = [...activeComponentIds].find((candidate) =>
        assignmentByComponentId.get(candidate)?.blockIds.includes(block.id),
      );
      if (!componentId) continue;
      const color =
        assignmentByComponentId.get(componentId)?.accentColor ?? "#8be4cf";
      const edge = 0.28;
      geometry.selection.push(
        {
          x: block.x,
          y: CAMPUS_BASE_Y + 0.075,
          z: block.z - block.depth / 2,
          width: block.width + edge,
          height: 0.07,
          depth: edge,
          color,
        },
        {
          x: block.x,
          y: CAMPUS_BASE_Y + 0.075,
          z: block.z + block.depth / 2,
          width: block.width + edge,
          height: 0.07,
          depth: edge,
          color,
        },
        {
          x: block.x - block.width / 2,
          y: CAMPUS_BASE_Y + 0.075,
          z: block.z,
          width: edge,
          height: 0.07,
          depth: block.depth + edge,
          color,
        },
        {
          x: block.x + block.width / 2,
          y: CAMPUS_BASE_Y + 0.075,
          z: block.z,
          width: edge,
          height: 0.07,
          depth: block.depth + edge,
          color,
        },
      );
    }
    for (const envelope of plan.architecturalEnvelopes) {
      if (!activeComponentIds.has(envelope.componentId)) continue;
      const color =
        assignmentByComponentId.get(envelope.componentId)?.accentColor ??
        "#8be4cf";
      const edge = 0.09;
      const y = CAMPUS_BASE_Y + envelope.height + 0.1;
      geometry.selection.push(
        {
          x: envelope.x,
          y,
          z: envelope.z - envelope.depth * 0.44,
          width: envelope.width * 0.86,
          height: 0.08,
          depth: edge,
          color,
        },
        {
          x: envelope.x,
          y,
          z: envelope.z + envelope.depth * 0.44,
          width: envelope.width * 0.86,
          height: 0.08,
          depth: edge,
          color,
        },
        {
          x: envelope.x - envelope.width * 0.44,
          y,
          z: envelope.z,
          width: edge,
          height: 0.08,
          depth: envelope.depth * 0.86,
          color,
        },
        {
          x: envelope.x + envelope.width * 0.44,
          y,
          z: envelope.z,
          width: edge,
          height: 0.08,
          depth: envelope.depth * 0.86,
          color,
        },
      );
    }
  }
  return geometry;
}

function UrbanBuildingHitTargets({
  plan,
  reservedEntityIds,
  onHoverEntity,
  onSelectEntity,
}: {
  plan: UrbanFabricPlan;
  reservedEntityIds: ReadonlySet<string>;
  onHoverEntity?: (entityId: string | null) => void;
  onSelectEntity?: (entityId: string) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const semanticBuildingById = useMemo(
    () => new Map(plan.buildings.map((building) => [building.id, building])),
    [plan.buildings],
  );
  const interactiveBuildings = useMemo(
    () =>
      plan.architecturalEnvelopes.filter((envelope) => {
        const semantic = semanticBuildingById.get(envelope.semanticBuildingId);
        return !semantic?.entityIds.some((id) => reservedEntityIds.has(id));
      }),
    [plan.architecturalEnvelopes, reservedEntityIds, semanticBuildingById],
  );
  const primaryEntityIdFor = (envelope: UrbanArchitecturalEnvelope) =>
    semanticBuildingById.get(envelope.semanticBuildingId)?.primaryEntityId;
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    interactiveBuildings.forEach((building, index) => {
      dummy.position.set(
        building.x,
        CAMPUS_BASE_Y + building.height / 2,
        building.z,
      );
      dummy.rotation.set(0, building.rotation, 0);
      dummy.scale.set(building.width, building.height, building.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [dummy, interactiveBuildings]);
  const entityIdAt = (instanceId: number | undefined) =>
    instanceId === undefined
      ? undefined
      : interactiveBuildings[instanceId]
        ? primaryEntityIdFor(interactiveBuildings[instanceId]!)
        : undefined;
  if (interactiveBuildings.length === 0) return null;
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, interactiveBuildings.length]}
      name="urban-building-hit-targets"
      onClick={(event) => {
        const entityId = entityIdAt(event.instanceId);
        if (!entityId) return;
        event.stopPropagation();
        onSelectEntity?.(entityId);
      }}
      onDoubleClick={(event) => {
        const entityId = entityIdAt(event.instanceId);
        if (!entityId) return;
        event.stopPropagation();
        onSelectEntity?.(entityId);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onHoverEntity?.(null);
      }}
      onPointerOver={(event) => {
        const entityId = entityIdAt(event.instanceId);
        if (!entityId) return;
        event.stopPropagation();
        onHoverEntity?.(entityId);
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        color="#ffffff"
        depthWrite={false}
        opacity={0.001}
        transparent
      />
    </instancedMesh>
  );
}

function makeCampusGeometry(
  campuses: readonly SemanticCampus[],
  reservedEntityIds: ReadonlySet<string>,
  activeComponentIds: ReadonlySet<string> | null,
): CampusGeometry {
  const geometry: CampusGeometry = {
    plazas: [],
    lawns: [],
    shells: [],
    wings: [],
    roofs: [],
    glazing: [],
    accents: [],
    details: [],
    cylinders: [],
    selection: [],
  };

  for (const campus of campuses) {
    const reservedSlots = campus.fileSlots.filter((slot) =>
      reservedEntityIds.has(slot.entityId),
    );
    const active =
      campus.active &&
      (activeComponentIds === null ||
        activeComponentIds.has(campus.componentId));
    const baseColor = new THREE.Color(campus.color);
    if (!active) {
      baseColor.lerp(new THREE.Color("#7a8780"), 0.58);
    }
    const shellColor = baseColor
      .clone()
      .lerp(new THREE.Color("#eef0e8"), active ? 0.48 : 0.62);
    const wingColor = baseColor
      .clone()
      .lerp(new THREE.Color("#d5dbd3"), active ? 0.34 : 0.52);
    const roofColor = baseColor
      .clone()
      .lerp(new THREE.Color("#435157"), 0.72);
    const glazingColor = baseColor
      .clone()
      .lerp(new THREE.Color("#9edce0"), 0.72);
    const accentColor = baseColor
      .clone()
      .lerp(new THREE.Color("#efd38a"), 0.44);
    const detailColor = baseColor
      .clone()
      .lerp(new THREE.Color("#435054"), 0.78);

    addCampusGround(geometry, campus);
    const context: CampusBuildContext = {
      campus,
      geometry,
      reservedSlots,
      shellColor: shellColor.getStyle(),
      wingColor: wingColor.getStyle(),
      roofColor: roofColor.getStyle(),
      glazingColor: glazingColor.getStyle(),
      accentColor: accentColor.getStyle(),
      detailColor: detailColor.getStyle(),
      height: Math.max(2.6, campus.height),
    };
    buildCampusByKind(context);
    addAggregateCampusBlock(context);
    addCampusStreetEdge(context);
  }

  return geometry;
}

interface CampusBuildContext {
  campus: SemanticCampus;
  geometry: CampusGeometry;
  reservedSlots: readonly SemanticFileSlot[];
  shellColor: string;
  wingColor: string;
  roofColor: string;
  glazingColor: string;
  accentColor: string;
  detailColor: string;
  height: number;
}

type AggregateWingEdge = "north" | "east" | "south" | "west";

interface AggregateWingCandidate {
  edge: AggregateWingEdge;
  x: number;
  z: number;
  width: number;
  depth: number;
}

/**
 * Unit-space perimeter sites. The sequence alternates edges so even the
 * smallest aggregate produces an enclosure instead of a row of detached bars.
 */
const AGGREGATE_WING_CANDIDATES: readonly AggregateWingCandidate[] = [
  { edge: "north", x: -0.31, z: -0.49, width: 0.27, depth: 0.15 },
  { edge: "south", x: 0.31, z: 0.49, width: 0.27, depth: 0.15 },
  { edge: "east", x: 0.5, z: -0.29, width: 0.14, depth: 0.25 },
  { edge: "west", x: -0.5, z: 0.29, width: 0.14, depth: 0.25 },
  { edge: "north", x: 0, z: -0.49, width: 0.28, depth: 0.15 },
  { edge: "south", x: 0, z: 0.49, width: 0.28, depth: 0.15 },
  { edge: "east", x: 0.5, z: 0, width: 0.14, depth: 0.27 },
  { edge: "west", x: -0.5, z: 0, width: 0.14, depth: 0.27 },
  { edge: "north", x: 0.31, z: -0.49, width: 0.27, depth: 0.15 },
  { edge: "south", x: -0.31, z: 0.49, width: 0.27, depth: 0.15 },
  { edge: "east", x: 0.5, z: 0.29, width: 0.14, depth: 0.25 },
  { edge: "west", x: -0.5, z: -0.29, width: 0.14, depth: 0.25 },
  { edge: "north", x: -0.18, z: -0.34, width: 0.22, depth: 0.13 },
  { edge: "south", x: 0.18, z: 0.34, width: 0.22, depth: 0.13 },
  { edge: "east", x: 0.35, z: 0.17, width: 0.12, depth: 0.2 },
  { edge: "west", x: -0.35, z: -0.17, width: 0.12, depth: 0.2 },
];

function addCampusGround(
  geometry: CampusGeometry,
  campus: SemanticCampus,
) {
  const rotation = campus.orientation;
  geometry.plazas.push(
    transformCampusBox(campus, {
      x: 0,
      y: CAMPUS_BASE_Y - 0.055,
      z: 0,
      width: campus.width * 1.08,
      height: 0.11,
      depth: campus.depth * 1.08,
      rotationY: rotation,
      color: "#b2b3a7",
    }),
  );
  geometry.lawns.push(
    transformCampusBox(campus, {
      x: 0,
      y: CAMPUS_BASE_Y - 0.085,
      z: 0,
      width: campus.width * 1.24,
      height: 0.07,
      depth: campus.depth * 1.24,
      rotationY: rotation,
      color: "#659355",
    }),
  );
}

function buildCampusByKind(context: CampusBuildContext) {
  switch (context.campus.kind) {
    case "gateway":
      buildGatewayCampus(context);
      break;
    case "civic":
      buildCivicCampus(context);
      break;
    case "factory":
      buildFactoryCampus(context);
      break;
    case "station":
      buildStationCampus(context);
      break;
    case "port":
      buildPortCampus(context);
      break;
    case "laboratory":
      buildLaboratoryCampus(context);
      break;
    case "library":
      buildLibraryCampus(context);
      break;
    case "operations":
      buildOperationsCampus(context);
      break;
    case "mixed-use":
      buildMixedUseCampus(context);
      break;
    default:
      assertNeverCampus(context.campus.kind);
  }
}

/**
 * Turns a component into a city block around its signature building.
 *
 * Entity count is intentionally bucketed into only 5–10 aggregate masses:
 * these are component-scale capacity/footprint cues, never one building per
 * file and never a quality score. Perimeter placement forms a courtyard while
 * the signature building remains the taller, more central landmark.
 */
function addAggregateCampusBlock(context: CampusBuildContext) {
  const desiredCount =
    5 +
    Math.min(
      5,
      Math.floor(
        Math.max(0, context.campus.entityIds.length - 1) / 9,
      ),
    );
  let addedCount = 0;

  for (
    let candidateIndex = 0;
    candidateIndex < AGGREGATE_WING_CANDIDATES.length &&
    addedCount < desiredCount;
    candidateIndex += 1
  ) {
    const candidate = AGGREGATE_WING_CANDIDATES[candidateIndex]!;
    const seed = stableCityHash(
      `${context.campus.id}:aggregate-wing:${candidateIndex}`,
    );
    const localX = candidate.x * context.campus.width;
    const localZ = candidate.z * context.campus.depth;
    const width = candidate.width * context.campus.width;
    const depth = candidate.depth * context.campus.depth;
    const normalizedDistance = Math.min(
      1,
      Math.hypot(candidate.x * 1.45, candidate.z * 1.45),
    );
    const centrality = 1 - normalizedDistance;
    const variation = ((seed >>> 8) % 13) / 100;
    const height =
      context.height * (0.24 + centrality * 0.28 + variation);

    if (
      !addCampusBox(
        context,
        candidateIndex % 3 === 0 ? "shells" : "wings",
        {
          x: localX,
          z: localZ,
          width,
          height,
          depth,
        },
      )
    ) {
      continue;
    }

    addAggregateWingDetails(context, {
      candidate,
      x: localX,
      z: localZ,
      width,
      depth,
      height,
      seed,
    });
    addedCount += 1;
  }
}

function addAggregateWingDetails(
  context: CampusBuildContext,
  {
    candidate,
    x,
    z,
    width,
    depth,
    height,
    seed,
  }: {
    candidate: AggregateWingCandidate;
    x: number;
    z: number;
    width: number;
    depth: number;
    height: number;
    seed: number;
  },
) {
  const northSouth =
    candidate.edge === "north" || candidate.edge === "south";
  const direction =
    candidate.edge === "north" || candidate.edge === "west" ? -1 : 1;
  const facadeX = northSouth ? x : x + direction * (width / 2 + 0.026);
  const facadeZ = northSouth ? z + direction * (depth / 2 + 0.026) : z;
  const bandCount = Math.max(
    2,
    Math.min(4, Math.floor(height / 1.05) + 1),
  );

  for (let bandIndex = 0; bandIndex < bandCount; bandIndex += 1) {
    const progress = (bandIndex + 1) / (bandCount + 1);
    addCampusBox(context, "glazing", {
      x: facadeX,
      y: CAMPUS_BASE_Y + height * progress,
      z: facadeZ,
      width: northSouth ? width * 0.82 : 0.052,
      height: Math.max(0.08, height * 0.055),
      depth: northSouth ? 0.052 : depth * 0.82,
    });
  }

  for (let frameIndex = -1; frameIndex <= 1; frameIndex += 1) {
    const frameOffset = frameIndex * 0.27;
    addCampusBox(context, "details", {
      x: northSouth ? x + width * frameOffset : facadeX,
      y: CAMPUS_BASE_Y + height * 0.52,
      z: northSouth ? facadeZ : z + depth * frameOffset,
      width: northSouth ? Math.max(0.045, width * 0.025) : 0.055,
      height: height * 0.76,
      depth: northSouth ? 0.055 : Math.max(0.045, depth * 0.025),
    });
  }

  addCampusBox(context, "accents", {
    x: facadeX,
    y: CAMPUS_BASE_Y + 0.19,
    z: facadeZ,
    width: northSouth ? Math.max(0.38, width * 0.24) : 0.075,
    height: 0.38,
    depth: northSouth ? 0.075 : Math.max(0.38, depth * 0.24),
  });
  addCampusBox(context, "roofs", {
    x,
    y: CAMPUS_BASE_Y + height + 0.045,
    z,
    width: width * 1.04,
    height: 0.09,
    depth: depth * 1.04,
  });

  const equipmentOffset = (((seed >>> 16) % 9) - 4) / 20;
  addCampusBox(context, "details", {
    x: x + (northSouth ? width * equipmentOffset : 0),
    y: CAMPUS_BASE_Y + height + 0.14,
    z: z + (northSouth ? 0 : depth * equipmentOffset),
    width: Math.max(0.28, width * 0.25),
    height: 0.19,
    depth: Math.max(0.24, depth * 0.28),
  });
}

function buildGatewayCampus(context: CampusBuildContext) {
  const { campus, height } = context;
  const pylonWidth = campus.width * 0.18;
  addCampusBox(context, "shells", {
    x: -campus.width * 0.31,
    z: 0,
    width: pylonWidth,
    height: height * 0.82,
    depth: campus.depth * 0.38,
  });
  addCampusBox(context, "shells", {
    x: campus.width * 0.31,
    z: 0,
    width: pylonWidth,
    height: height * 0.82,
    depth: campus.depth * 0.38,
  });
  addCampusBox(context, "accents", {
    x: 0,
    y: CAMPUS_BASE_Y + height * 0.66,
    z: 0,
    width: campus.width * 0.78,
    height: height * 0.16,
    depth: campus.depth * 0.34,
  });
  addCampusBox(context, "wings", {
    x: 0,
    z: campus.depth * 0.3,
    width: campus.width * 0.78,
    height: height * 0.23,
    depth: campus.depth * 0.24,
  });
  for (const side of [-1, 1]) {
    addCampusBox(context, "glazing", {
      x: side * campus.width * 0.31,
      y: CAMPUS_BASE_Y + height * 0.43,
      z: -campus.depth * 0.195,
      width: pylonWidth * 0.58,
      height: height * 0.56,
      depth: campus.depth * 0.025,
    });
    addCampusBox(context, "roofs", {
      x: side * campus.width * 0.31,
      y: CAMPUS_BASE_Y + height * 0.84,
      z: 0,
      width: pylonWidth * 1.18,
      height: height * 0.06,
      depth: campus.depth * 0.43,
    });
  }
  addEntranceCanopy(context, 0, -campus.depth * 0.38, campus.width * 0.48);
  addRoofMasts(context, 3, height * 0.88);
}

function buildCivicCampus(context: CampusBuildContext) {
  const { campus, height } = context;
  addCampusBox(context, "shells", {
    x: 0,
    z: campus.depth * 0.12,
    width: campus.width * 0.48,
    height: height * 0.72,
    depth: campus.depth * 0.52,
  });
  for (const side of [-1, 1]) {
    addCampusBox(context, "wings", {
      x: side * campus.width * 0.31,
      z: campus.depth * 0.11,
      width: campus.width * 0.25,
      height: height * 0.38,
      depth: campus.depth * 0.66,
    });
  }
  addCampusBox(context, "roofs", {
    x: 0,
    y: CAMPUS_BASE_Y + height * 0.75,
    z: campus.depth * 0.12,
    width: campus.width * 0.34,
    height: height * 0.12,
    depth: campus.depth * 0.3,
  });
  addFacadeBands(context, {
    x: 0,
    z: -campus.depth * 0.145,
    width: campus.width * 0.43,
    fromY: height * 0.2,
    toY: height * 0.62,
    count: 4,
  });
  for (const side of [-1, 1]) {
    addCampusBox(context, "glazing", {
      x: side * campus.width * 0.31,
      y: CAMPUS_BASE_Y + height * 0.24,
      z: -campus.depth * 0.225,
      width: campus.width * 0.19,
      height: height * 0.18,
      depth: campus.depth * 0.035,
    });
  }
  addCampusBox(context, "glazing", {
    x: 0,
    y: CAMPUS_BASE_Y + height * 0.83,
    z: campus.depth * 0.12,
    width: campus.width * 0.2,
    height: height * 0.04,
    depth: campus.depth * 0.19,
  });
  for (let index = -2; index <= 2; index += 1) {
    addCampusCylinder(
      context,
      index * campus.width * 0.1,
      -campus.depth * 0.28,
      campus.width * 0.025,
      height * 0.32,
    );
  }
  addEntranceCanopy(context, 0, -campus.depth * 0.36, campus.width * 0.56);
}

function buildFactoryCampus(context: CampusBuildContext) {
  const { campus, height } = context;
  addCampusBox(context, "shells", {
    x: -campus.width * 0.14,
    z: campus.depth * 0.05,
    width: campus.width * 0.62,
    height: height * 0.38,
    depth: campus.depth * 0.72,
  });
  addCampusBox(context, "wings", {
    x: campus.width * 0.33,
    z: campus.depth * 0.09,
    width: campus.width * 0.22,
    height: height * 0.52,
    depth: campus.depth * 0.48,
  });
  for (let index = -2; index <= 2; index += 1) {
    addCampusBox(context, "roofs", {
      x: -campus.width * 0.16,
      y: CAMPUS_BASE_Y + height * 0.41,
      z: index * campus.depth * 0.115,
      width: campus.width * 0.58,
      height: height * 0.075,
      depth: campus.depth * 0.15,
      rotationX: index % 2 === 0 ? 0.12 : -0.12,
    });
  }
  addCampusBox(context, "glazing", {
    x: -campus.width * 0.14,
    y: CAMPUS_BASE_Y + height * 0.25,
    z: -campus.depth * 0.315,
    width: campus.width * 0.5,
    height: height * 0.13,
    depth: campus.depth * 0.035,
  });
  for (const offset of [-0.23, 0, 0.23]) {
    addCampusBox(context, "details", {
      x: -campus.width * 0.14 + offset * campus.width,
      y: CAMPUS_BASE_Y + height * 0.49,
      z: campus.depth * 0.02,
      width: campus.width * 0.07,
      height: height * 0.12,
      depth: campus.depth * 0.12,
    });
  }
  addCampusCylinder(
    context,
    campus.width * 0.31,
    campus.depth * 0.23,
    campus.width * 0.045,
    height * 0.88,
  );
  addCampusCylinder(
    context,
    campus.width * 0.15,
    campus.depth * 0.27,
    campus.width * 0.035,
    height * 0.68,
  );
  addLoadingDock(context, 0, -campus.depth * 0.42, campus.width * 0.7);
}

function buildStationCampus(context: CampusBuildContext) {
  const { campus, height } = context;
  addCampusBox(context, "shells", {
    x: 0,
    z: campus.depth * 0.05,
    width: campus.width * 0.76,
    height: height * 0.34,
    depth: campus.depth * 0.42,
  });
  for (const side of [-1, 1]) {
    addCampusBox(context, "accents", {
      x: side * campus.width * 0.25,
      y: CAMPUS_BASE_Y + height * 0.35,
      z: campus.depth * 0.04,
      width: campus.width * 0.38,
      height: height * 0.08,
      depth: campus.depth * 0.5,
      rotationZ: side * 0.08,
    });
    addCampusBox(context, "roofs", {
      x: side * campus.width * 0.26,
      z: campus.depth * 0.34,
      width: campus.width * 0.44,
      height: 0.1,
      depth: campus.depth * 0.14,
    });
  }
  addCampusBox(context, "wings", {
    x: 0,
    z: campus.depth * 0.19,
    width: campus.width * 0.16,
    height: height * 0.88,
    depth: campus.depth * 0.18,
  });
  addFacadeBands(context, {
    x: 0,
    z: -campus.depth * 0.165,
    width: campus.width * 0.68,
    fromY: height * 0.16,
    toY: height * 0.31,
    count: 2,
  });
  for (const offset of [-0.32, -0.16, 0.16, 0.32]) {
    addCampusBox(context, "accents", {
      x: offset * campus.width,
      y: CAMPUS_BASE_Y + 0.035,
      z: -campus.depth * 0.31,
      width: campus.width * 0.018,
      height: 0.07,
      depth: campus.depth * 0.62,
    });
  }
  for (const side of [-1, 1]) {
    addCampusBox(context, "details", {
      x: side * campus.width * 0.3,
      y: CAMPUS_BASE_Y + 0.18,
      z: -campus.depth * 0.33,
      width: campus.width * 0.055,
      height: 0.24,
      depth: campus.depth * 0.5,
    });
  }
  addEntranceCanopy(context, 0, -campus.depth * 0.26, campus.width * 0.52);
}

function buildPortCampus(context: CampusBuildContext) {
  const { campus, height } = context;
  addCampusBox(context, "shells", {
    x: -campus.width * 0.18,
    z: campus.depth * 0.16,
    width: campus.width * 0.5,
    height: height * 0.32,
    depth: campus.depth * 0.48,
  });
  addCampusBox(context, "wings", {
    x: campus.width * 0.26,
    z: campus.depth * 0.15,
    width: campus.width * 0.24,
    height: height * 0.56,
    depth: campus.depth * 0.32,
  });
  addCampusBox(context, "glazing", {
    x: -campus.width * 0.18,
    y: CAMPUS_BASE_Y + height * 0.23,
    z: -campus.depth * 0.085,
    width: campus.width * 0.42,
    height: height * 0.12,
    depth: campus.depth * 0.035,
  });
  for (const offset of [-0.24, 0, 0.24]) {
    addCampusBox(context, "details", {
      x: -campus.width * 0.18 + offset * campus.width,
      y: CAMPUS_BASE_Y + 0.32,
      z: -campus.depth * 0.105,
      width: campus.width * 0.05,
      height: 0.52,
      depth: campus.depth * 0.04,
    });
  }
  for (const side of [-1, 1]) {
    addCampusBox(context, "accents", {
      x: side * campus.width * 0.29,
      y: CAMPUS_BASE_Y + height * 0.66,
      z: -campus.depth * 0.04,
      width: campus.width * 0.055,
      height: height * 0.8,
      depth: campus.depth * 0.055,
    });
  }
  addCampusBox(context, "accents", {
    x: 0,
    y: CAMPUS_BASE_Y + height * 0.74,
    z: -campus.depth * 0.04,
    width: campus.width * 0.64,
    height: campus.width * 0.045,
    depth: campus.depth * 0.055,
  });
  addCampusBox(context, "accents", {
    x: campus.width * 0.26,
    y: CAMPUS_BASE_Y + height * 0.45,
    z: -campus.depth * 0.23,
    width: campus.width * 0.045,
    height: height * 0.56,
    depth: campus.depth * 0.36,
    rotationX: -0.62,
  });
  addLoadingDock(context, 0, -campus.depth * 0.4, campus.width * 0.86);
}

function buildLaboratoryCampus(context: CampusBuildContext) {
  const { campus, height } = context;
  for (const side of [-1, 1]) {
    addCampusBox(context, "shells", {
      x: side * campus.width * 0.25,
      z: campus.depth * 0.08,
      width: campus.width * 0.35,
      height: height * (side < 0 ? 0.48 : 0.62),
      depth: campus.depth * 0.62,
    });
    addFacadeBands(context, {
      x: side * campus.width * 0.25,
      z: -campus.depth * 0.235,
      width: campus.width * 0.29,
      fromY: height * 0.2,
      toY: height * (side < 0 ? 0.42 : 0.55),
      count: side < 0 ? 3 : 4,
    });
  }
  addCampusBox(context, "glazing", {
    x: 0,
    y: CAMPUS_BASE_Y + height * 0.26,
    z: campus.depth * 0.08,
    width: campus.width * 0.18,
    height: height * 0.3,
    depth: campus.depth * 0.26,
  });
  addCampusBox(context, "accents", {
    x: 0,
    y: CAMPUS_BASE_Y + height * 0.5,
    z: campus.depth * 0.08,
    width: campus.width * 0.34,
    height: height * 0.08,
    depth: campus.depth * 0.17,
  });
  for (const side of [-1, 1]) {
    addCampusCylinder(
      context,
      side * campus.width * 0.25,
      campus.depth * 0.08,
      campus.width * 0.075,
      height * 0.22,
      CAMPUS_BASE_Y + height * (side < 0 ? 0.58 : 0.72),
    );
  }
  addEntranceCanopy(context, 0, -campus.depth * 0.35, campus.width * 0.4);
}

function buildLibraryCampus(context: CampusBuildContext) {
  const { campus, height } = context;
  addCampusBox(context, "shells", {
    x: 0,
    z: campus.depth * 0.08,
    width: campus.width * 0.72,
    height: height * 0.4,
    depth: campus.depth * 0.68,
  });
  addCampusBox(context, "wings", {
    x: 0,
    y: CAMPUS_BASE_Y + height * 0.45,
    z: campus.depth * 0.1,
    width: campus.width * 0.48,
    height: height * 0.2,
    depth: campus.depth * 0.46,
  });
  addCampusBox(context, "roofs", {
    x: 0,
    y: CAMPUS_BASE_Y + height * 0.61,
    z: campus.depth * 0.1,
    width: campus.width * 0.28,
    height: height * 0.12,
    depth: campus.depth * 0.28,
  });
  addFacadeBands(context, {
    x: 0,
    z: -campus.depth * 0.265,
    width: campus.width * 0.64,
    fromY: height * 0.14,
    toY: height * 0.34,
    count: 3,
  });
  addCampusBox(context, "glazing", {
    x: 0,
    y: CAMPUS_BASE_Y + height * 0.7,
    z: campus.depth * 0.1,
    width: campus.width * 0.18,
    height: height * 0.04,
    depth: campus.depth * 0.18,
  });
  for (let index = -3; index <= 3; index += 1) {
    addCampusCylinder(
      context,
      index * campus.width * 0.075,
      -campus.depth * 0.3,
      campus.width * 0.018,
      height * 0.3,
    );
  }
  addEntranceCanopy(context, 0, -campus.depth * 0.38, campus.width * 0.52);
}

function buildOperationsCampus(context: CampusBuildContext) {
  const { campus, height } = context;
  addCampusBox(context, "shells", {
    x: 0,
    z: campus.depth * 0.08,
    width: campus.width * 0.38,
    height: height * 0.9,
    depth: campus.depth * 0.38,
  });
  for (let index = 0; index < 3; index += 1) {
    const angle = (index / 3) * Math.PI * 2;
    addCampusBox(context, "wings", {
      x: Math.cos(angle) * campus.width * 0.29,
      z: campus.depth * 0.08 + Math.sin(angle) * campus.depth * 0.27,
      width: campus.width * 0.27,
      height: height * (0.3 + index * 0.06),
      depth: campus.depth * 0.25,
      rotationY: -angle,
    });
  }
  addFacadeBands(context, {
    x: 0,
    z: -campus.depth * 0.115,
    width: campus.width * 0.32,
    fromY: height * 0.17,
    toY: height * 0.76,
    count: 6,
  });
  addCampusBox(context, "roofs", {
    x: 0,
    y: CAMPUS_BASE_Y + height * 0.94,
    z: campus.depth * 0.08,
    width: campus.width * 0.22,
    height: height * 0.08,
    depth: campus.depth * 0.22,
  });
  addRoofMasts(context, 4, height * 0.96);
  addCampusBox(context, "glazing", {
    x: 0,
    y: CAMPUS_BASE_Y + height * 0.48,
    z: -campus.depth * 0.13,
    width: campus.width * 0.32,
    height: height * 0.42,
    depth: campus.depth * 0.04,
  });
  addEntranceCanopy(context, 0, -campus.depth * 0.28, campus.width * 0.36);
}

function buildMixedUseCampus(context: CampusBuildContext) {
  const { campus, height } = context;
  addCampusBox(context, "shells", {
    x: -campus.width * 0.28,
    z: campus.depth * 0.02,
    width: campus.width * 0.28,
    height: height * 0.74,
    depth: campus.depth * 0.72,
  });
  addCampusBox(context, "wings", {
    x: campus.width * 0.25,
    z: campus.depth * 0.25,
    width: campus.width * 0.38,
    height: height * 0.48,
    depth: campus.depth * 0.28,
  });
  addCampusBox(context, "wings", {
    x: campus.width * 0.25,
    z: -campus.depth * 0.25,
    width: campus.width * 0.38,
    height: height * 0.34,
    depth: campus.depth * 0.28,
  });
  addCampusBox(context, "glazing", {
    x: campus.width * 0.03,
    y: CAMPUS_BASE_Y + height * 0.3,
    z: campus.depth * 0.34,
    width: campus.width * 0.7,
    height: height * 0.18,
    depth: campus.depth * 0.035,
  });
  addCampusBox(context, "details", {
    x: campus.width * 0.25,
    y: CAMPUS_BASE_Y + 0.31,
    z: campus.depth * 0.39,
    width: campus.width * 0.28,
    height: 0.12,
    depth: campus.depth * 0.08,
  });
  addEntranceCanopy(
    context,
    campus.width * 0.22,
    -campus.depth * 0.42,
    campus.width * 0.32,
  );
  addRoofMasts(context, 2, height * 0.78);
}

/**
 * Adds facade-scale rhythm without turning source files into windows. These
 * strips are purely architectural dressing on a compiler-backed campus mass.
 */
function addFacadeBands(
  context: CampusBuildContext,
  {
    x,
    z,
    width,
    fromY,
    toY,
    count,
  }: {
    x: number;
    z: number;
    width: number;
    fromY: number;
    toY: number;
    count: number;
  },
) {
  for (let index = 0; index < count; index += 1) {
    const progress = count <= 1 ? 0.5 : index / (count - 1);
    addCampusBox(context, "glazing", {
      x,
      y:
        CAMPUS_BASE_Y +
        THREE.MathUtils.lerp(fromY, toY, progress),
      z,
      width,
      height: Math.max(0.075, context.height * 0.025),
      depth: Math.max(0.045, context.campus.depth * 0.022),
    });
  }
}

/**
 * Repeats a path, benches, and bollards at every campus frontage. They carry no
 * repository meaning; their job is to give the semantic masses a believable
 * pedestrian scale and a shared city street datum.
 */
function addCampusStreetEdge(context: CampusBuildContext) {
  const { campus } = context;
  addCampusBox(context, "accents", {
    x: 0,
    y: CAMPUS_BASE_Y + 0.015,
    z: -campus.depth * 0.47,
    width: Math.max(0.72, campus.width * 0.14),
    height: 0.03,
    depth: campus.depth * 0.24,
  });

  for (const side of [-1, 1]) {
    addCampusBox(context, "details", {
      x: side * campus.width * 0.31,
      y: CAMPUS_BASE_Y + 0.09,
      z: -campus.depth * 0.49,
      width: Math.max(0.42, campus.width * 0.11),
      height: 0.12,
      depth: 0.16,
    });
  }

  const bollardCount = Math.max(
    3,
    Math.min(6, Math.round(campus.width / 3.5)),
  );
  for (let index = 0; index < bollardCount; index += 1) {
    const progress =
      bollardCount <= 1 ? 0.5 : index / (bollardCount - 1);
    addCampusBox(context, "details", {
      x: THREE.MathUtils.lerp(
        -campus.width * 0.22,
        campus.width * 0.22,
        progress,
      ),
      y: CAMPUS_BASE_Y + 0.13,
      z: -campus.depth * 0.535,
      width: 0.075,
      height: 0.26,
      depth: 0.075,
    });
  }
}

function addEntranceCanopy(
  context: CampusBuildContext,
  x: number,
  z: number,
  width: number,
) {
  addCampusBox(context, "accents", {
    x,
    y: CAMPUS_BASE_Y + 0.38,
    z,
    width,
    height: 0.11,
    depth: context.campus.depth * 0.18,
  });
  addCampusBox(context, "glazing", {
    x,
    y: CAMPUS_BASE_Y + 0.23,
    z: z + context.campus.depth * 0.04,
    width: width * 0.62,
    height: 0.42,
    depth: 0.08,
  });
}

function addLoadingDock(
  context: CampusBuildContext,
  x: number,
  z: number,
  width: number,
) {
  addCampusBox(context, "roofs", {
    x,
    y: CAMPUS_BASE_Y + 0.08,
    z,
    width,
    height: 0.16,
    depth: context.campus.depth * 0.24,
  });
  for (let index = -1; index <= 1; index += 1) {
    addCampusBox(context, "glazing", {
      x: x + index * width * 0.25,
      y: CAMPUS_BASE_Y + 0.28,
      z: z + context.campus.depth * 0.08,
      width: width * 0.18,
      height: 0.44,
      depth: 0.07,
    });
  }
}

function addRoofMasts(
  context: CampusBuildContext,
  count: number,
  roofHeight: number,
) {
  for (let index = 0; index < count; index += 1) {
    const progress = count <= 1 ? 0.5 : index / (count - 1);
    addCampusCylinder(
      context,
      THREE.MathUtils.lerp(
        -context.campus.width * 0.18,
        context.campus.width * 0.18,
        progress,
      ),
      context.campus.depth * 0.08,
      context.campus.width * 0.012,
      context.height * (0.18 + progress * 0.08),
      CAMPUS_BASE_Y + roofHeight,
    );
  }
}

function addCampusBox(
  context: CampusBuildContext,
  layer: keyof Pick<
    CampusGeometry,
    | "shells"
    | "wings"
    | "roofs"
    | "glazing"
    | "accents"
    | "details"
  >,
  local: {
    x: number;
    y?: number;
    z: number;
    width: number;
    height: number;
    depth: number;
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
  },
) {
  if (
    overlapsReservedSlot(
      local,
      context.reservedSlots,
      context.campus,
    )
  ) {
    return false;
  }
  const defaultY = CAMPUS_BASE_Y + local.height / 2;
  const color =
    layer === "shells"
      ? context.shellColor
      : layer === "wings"
        ? context.wingColor
        : layer === "roofs"
          ? context.roofColor
          : layer === "glazing"
            ? context.glazingColor
            : layer === "accents"
              ? context.accentColor
              : context.detailColor;
  context.geometry[layer].push(
    transformCampusBox(context.campus, {
      ...local,
      y: local.y ?? defaultY,
      color,
      rotationY:
        context.campus.orientation + (local.rotationY ?? 0),
    }),
  );
  return true;
}

function addCampusCylinder(
  context: CampusBuildContext,
  localX: number,
  localZ: number,
  radius: number,
  height: number,
  baseY = CAMPUS_BASE_Y,
) {
  if (
    overlapsReservedSlot(
      {
        x: localX,
        z: localZ,
        width: radius * 2,
        depth: radius * 2,
      },
      context.reservedSlots,
      context.campus,
    )
  ) {
    return;
  }
  const point = transformCampusPoint(context.campus, localX, localZ);
  context.geometry.cylinders.push({
    x: point.x,
    y: baseY + height / 2,
    z: point.z,
    radius,
    height,
    rotationY: context.campus.orientation,
    color: context.shellColor,
  });
}

function overlapsReservedSlot(
  rect: {
    x: number;
    z: number;
    width: number;
    depth: number;
  },
  slots: readonly SemanticFileSlot[],
  campus: SemanticCampus,
): boolean {
  return slots.some((slot) => {
    const padding = 0.8;
    const semanticWorld = inverseCampusPoint(campus, slot.x, slot.z);
    const legacyWorld = inverseCampusPoint(
      campus,
      slot.legacyPoint.x,
      slot.legacyPoint.z,
    );
    return [
      { x: slot.localX, z: slot.localZ },
      semanticWorld,
      legacyWorld,
    ].some(
      (candidate) =>
        Math.abs(rect.x - candidate.x) <
          rect.width / 2 + slot.width / 2 + padding &&
        Math.abs(rect.z - candidate.z) <
          rect.depth / 2 + slot.depth / 2 + padding,
    );
  });
}

function transformCampusPoint(
  campus: SemanticCampus,
  localX: number,
  localZ: number,
) {
  const cosine = Math.cos(campus.orientation);
  const sine = Math.sin(campus.orientation);
  return {
    x: campus.x + localX * cosine - localZ * sine,
    z: campus.z + localX * sine + localZ * cosine,
  };
}

function inverseCampusPoint(
  campus: SemanticCampus,
  worldX: number,
  worldZ: number,
) {
  const dx = worldX - campus.x;
  const dz = worldZ - campus.z;
  const cosine = Math.cos(-campus.orientation);
  const sine = Math.sin(-campus.orientation);
  return {
    x: dx * cosine - dz * sine,
    z: dx * sine + dz * cosine,
  };
}

function transformCampusBox(
  campus: SemanticCampus,
  local: BoxInstance,
): BoxInstance {
  const point = transformCampusPoint(campus, local.x, local.z);
  return {
    ...local,
    x: point.x,
    z: point.z,
  };
}

function assertNeverCampus(kind: never): never {
  throw new Error(`Unsupported semantic campus kind: ${kind}`);
}

function makeRoadGeometry(roads: readonly SemanticRoad[]): RoadGeometry {
  const asphaltParts: RibbonPart[] = [];
  const sidewalkParts: RibbonPart[] = [];
  const markings: BoxInstance[] = [];
  const curbs: BoxInstance[] = [];
  const guardRails: BoxInstance[] = [];
  const pillars: CylinderInstance[] = [];
  const surfaceSamples: RoadSurfaceSample[] = [];

  for (const road of roads) {
    if (road.centerline.length < 2) continue;
    const sourcePoints = road.centerline.map(
      (point) => new THREE.Vector3(point.x, 0, point.z),
    );
    const curve =
      sourcePoints.length === 2
        ? new THREE.LineCurve3(sourcePoints[0]!, sourcePoints[1]!)
        : new THREE.CatmullRomCurve3(
            sourcePoints,
            false,
            "centripetal",
            0.36,
          );
    const length = Math.max(1, curve.getLength());
    const divisions = Math.max(8, Math.min(100, Math.ceil(length * 1.5)));
    const points = curve.getSpacedPoints(divisions);
    for (let index = 0; index < points.length; index += 1) {
      points[index]!.y = roadHeightAtProgress(
        road,
        index / Math.max(1, points.length - 1),
      );
    }

    sidewalkParts.push({
      points,
      width: road.width + 1.65,
      yOffset: -0.028,
    });
    asphaltParts.push({
      points,
      width: road.width,
      yOffset: 0.006,
    });

    const distances = cumulativeDistances(points);
    const totalLength = distances.at(-1) ?? length;
    const laneWidth = road.width / Math.max(1, road.lanes);
    const dashSpacing = road.roadClass === "arterial" ? 2.9 : 3.5;
    const dashCount = Math.max(2, Math.floor(totalLength / dashSpacing));
    for (let dashIndex = 0; dashIndex < dashCount; dashIndex += 1) {
      const progress = (dashIndex + 0.5) / dashCount;
      const sampleIndex = nearestDistanceIndex(distances, progress * totalLength);
      const point = points[sampleIndex]!;
      const tangent = tangentAtPoint(points, sampleIndex);
      const normalX = -tangent.z;
      const normalZ = tangent.x;
      for (let lane = 1; lane < road.lanes; lane += 1) {
        const offset = -road.width / 2 + lane * laneWidth;
        const isCenter = lane === road.lanes / 2;
        markings.push({
          x: point.x + normalX * offset,
          y: point.y + 0.023,
          z: point.z + normalZ * offset,
          width: isCenter ? 0.075 : 0.045,
          height: 0.014,
          depth: Math.min(1.55, dashSpacing * 0.52),
          rotationY: Math.atan2(tangent.x, tangent.z),
          color: isCenter ? "#e5ca72" : "#eee9da",
        });
      }
    }

    const elevated = road.level === "elevated";
    const bridge = road.surface === "bridge";
    if (!elevated && !bridge) {
      for (const crosswalkProgress of [0.075, 0.925]) {
        const sampleIndex = nearestDistanceIndex(
          distances,
          crosswalkProgress * totalLength,
        );
        const point = points[sampleIndex]!;
        const tangent = tangentAtPoint(points, sampleIndex);
        for (let stripe = -3; stripe <= 3; stripe += 1) {
          const offset = stripe * 0.25;
          markings.push({
            x: point.x + tangent.x * offset,
            y: point.y + 0.024,
            z: point.z + tangent.z * offset,
            width: road.width * 0.76,
            height: 0.014,
            depth: 0.105,
            rotationY: Math.atan2(tangent.x, tangent.z),
            color: "#f4f0e7",
          });
        }
      }
    }
    const propSpacing = elevated ? 7 : bridge ? 8.5 : 2.4;
    const propCount = Math.max(2, Math.floor(totalLength / propSpacing));
    for (let index = 0; index <= propCount; index += 1) {
      const progress = index / propCount;
      const sampleIndex = nearestDistanceIndex(distances, progress * totalLength);
      const point = points[sampleIndex]!;
      const tangent = tangentAtPoint(points, sampleIndex);
      const normalX = -tangent.z;
      const normalZ = tangent.x;
      surfaceSamples.push({
        x: point.x,
        y: point.y,
        z: point.z,
        halfWidth: road.width / 2,
      });
      if (!elevated && !bridge) {
        for (const side of [-1, 1]) {
          curbs.push({
            x: point.x + normalX * (road.width / 2 + 0.08) * side,
            y: point.y + 0.012,
            z: point.z + normalZ * (road.width / 2 + 0.08) * side,
            width: 0.12,
            height: 0.08,
            depth: Math.max(0.72, propSpacing * 0.94),
            rotationY: Math.atan2(tangent.x, tangent.z),
          });
        }
        continue;
      }

      if (index > 0 && index < propCount && index % 2 === 0) {
        const pillarHeight = Math.max(0.3, point.y - LAND_Y);
        pillars.push({
          x: point.x,
          y: LAND_Y + pillarHeight / 2,
          z: point.z,
          radius: 0.22,
          height: pillarHeight,
        });
      }
      for (const side of [-1, 1]) {
        guardRails.push({
          x: point.x + normalX * (road.width / 2 - 0.08) * side,
          y: point.y + 0.19,
          z: point.z + normalZ * (road.width / 2 - 0.08) * side,
          width: 0.08,
          height: 0.34,
          depth: Math.max(0.8, propSpacing * 0.96),
          rotationY: Math.atan2(tangent.x, tangent.z),
        });
      }
    }

    for (let index = 0; index < points.length; index += 2) {
      const point = points[index]!;
      surfaceSamples.push({
        x: point.x,
        y: point.y,
        z: point.z,
        halfWidth: road.width / 2,
      });
    }
  }

  return {
    sidewalk: makeRibbonGeometry(sidewalkParts),
    asphalt: makeRibbonGeometry(asphaltParts),
    markings,
    curbs,
    guardRails,
    pillars,
    surfaceSamples,
  };
}

interface RibbonPart {
  points: readonly THREE.Vector3[];
  width: number;
  yOffset: number;
}

function makeRibbonGeometry(parts: readonly RibbonPart[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (const part of parts) {
    const base = positions.length / 3;
    const distances = cumulativeDistances(part.points);
    const total = Math.max(0.001, distances.at(-1) ?? 1);
    for (let index = 0; index < part.points.length; index += 1) {
      const point = part.points[index]!;
      const tangent = tangentAtPoint(part.points, index);
      const normalX = -tangent.z;
      const normalZ = tangent.x;
      const halfWidth = part.width / 2;
      positions.push(
        point.x + normalX * halfWidth,
        point.y + part.yOffset,
        point.z + normalZ * halfWidth,
        point.x - normalX * halfWidth,
        point.y + part.yOffset,
        point.z - normalZ * halfWidth,
      );
      normals.push(0, 1, 0, 0, 1, 0);
      const v = distances[index]! / total;
      uvs.push(0, v, 1, v);
      if (index < part.points.length - 1) {
        const vertex = base + index * 2;
        indices.push(
          vertex,
          vertex + 2,
          vertex + 1,
          vertex + 2,
          vertex + 3,
          vertex + 1,
        );
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(normals, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function roadHeightAtProgress(road: SemanticRoad, progress: number): number {
  if (road.surface === "bridge") {
    return ROAD_Y + Math.sin(progress * Math.PI) * BRIDGE_RISE;
  }
  if (road.level === "elevated") {
    const ramp = 0.24;
    const up = THREE.MathUtils.smoothstep(progress, 0, ramp);
    const down = 1 - THREE.MathUtils.smoothstep(progress, 1 - ramp, 1);
    return ROAD_Y + ELEVATED_ROAD_Y * Math.min(up, down);
  }
  return ROAD_Y;
}

function cumulativeDistances(
  points: readonly THREE.Vector3[],
): number[] {
  const distances = [0];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += points[index - 1]!.distanceTo(points[index]!);
    distances.push(total);
  }
  return distances;
}

function tangentAtPoint(
  points: readonly THREE.Vector3[],
  index: number,
): THREE.Vector3 {
  const previous = points[Math.max(0, index - 1)]!;
  const next = points[Math.min(points.length - 1, index + 1)]!;
  const dx = next.x - previous.x;
  const dz = next.z - previous.z;
  const inverseLength = 1 / Math.max(0.0001, Math.hypot(dx, dz));
  return new THREE.Vector3(dx * inverseLength, 0, dz * inverseLength);
}

function nearestDistanceIndex(
  distances: readonly number[],
  target: number,
): number {
  let low = 0;
  let high = distances.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (distances[middle]! < target) low = middle + 1;
    else high = middle;
  }
  if (
    low > 0 &&
    Math.abs(distances[low - 1]! - target) <
      Math.abs(distances[low]! - target)
  ) {
    return low - 1;
  }
  return low;
}

function makeGreenGeometry(
  plan: SemanticCityPlan,
  roadSamples: readonly RoadSurfaceSample[],
  excludeBounds?: { minX: number; maxX: number; minZ: number; maxZ: number },
) {
  const trunks: CylinderInstance[] = [];
  const crowns: BoxInstance[] = [];
  const greenBelts: BoxInstance[] = [];
  const lightPoles: CylinderInstance[] = [];
  const lightBulbs: BoxInstance[] = [];

  for (const campus of plan.campuses) {
    const beltDepth = Math.max(0.9, campus.depth * 0.08);
    greenBelts.push(
      transformCampusBox(campus, {
        x: 0,
        y: CAMPUS_BASE_Y - 0.09,
        z: -campus.depth * 0.59,
        width: campus.width * 1.16,
        height: 0.06,
        depth: beltDepth,
        rotationY: campus.orientation,
      }),
      transformCampusBox(campus, {
        x: 0,
        y: CAMPUS_BASE_Y - 0.09,
        z: campus.depth * 0.59,
        width: campus.width * 1.16,
        height: 0.06,
        depth: beltDepth,
        rotationY: campus.orientation,
      }),
    );
    const desired = 7 + (stableCityHash(campus.id) % 8);
    for (let index = 0; index < desired; index += 1) {
      const seed = stableCityHash(`${plan.seed}:${campus.id}:tree:${index}`);
      const side = seed % 4;
      const progression = ((seed >>> 5) % 1000) / 1000;
      const local =
        side < 2
          ? {
              x: THREE.MathUtils.lerp(
                -campus.width * 0.54,
                campus.width * 0.54,
                progression,
              ),
              z: (side === 0 ? -1 : 1) * campus.depth * 0.59,
            }
          : {
              x: (side === 2 ? -1 : 1) * campus.width * 0.59,
              z: THREE.MathUtils.lerp(
                -campus.depth * 0.48,
                campus.depth * 0.48,
                progression,
              ),
            };
      const world = transformCampusPoint(campus, local.x, local.z);
      if (
        pointIsInWater(plan.terrain.waterBoundaries, world.x, world.z) ||
        distanceToRoadSamples(world.x, world.z, roadSamples) <
          TREE_CLEARANCE
      ) {
        continue;
      }
      const scale = 0.72 + ((seed >>> 14) % 45) / 100;
      const trunkHeight = 0.72 * scale;
      trunks.push({
        x: world.x,
        y: CAMPUS_BASE_Y + trunkHeight / 2,
        z: world.z,
        radius: 0.085 * scale,
        height: trunkHeight,
        rotationY: ((seed % 360) * Math.PI) / 180,
      });
      crowns.push({
        x: world.x,
        y: CAMPUS_BASE_Y + trunkHeight + 0.38 * scale,
        z: world.z,
        width: 0.74 * scale,
        height: 0.82 * scale,
        depth: 0.74 * scale,
        rotationY: ((seed % 180) * Math.PI) / 180,
        color:
          seed % 3 === 0
            ? "#4e844e"
            : seed % 3 === 1
              ? "#3d7548"
              : "#477d43",
      });
    }
  }

  for (const road of plan.roads) {
    if (
      road.centerline.length < 2 ||
      road.level === "elevated" ||
      road.surface === "bridge"
    ) {
      continue;
    }
    const sourcePoints = road.centerline.map(
      (point) => new THREE.Vector3(point.x, LAND_Y, point.z),
    );
    const curve =
      sourcePoints.length === 2
        ? new THREE.LineCurve3(sourcePoints[0]!, sourcePoints[1]!)
        : new THREE.CatmullRomCurve3(
            sourcePoints,
            false,
            "centripetal",
            0.36,
          );
    const length = curve.getLength();
    const treeCount = Math.max(1, Math.floor(length / 4.6));
    for (let treeIndex = 1; treeIndex < treeCount; treeIndex += 1) {
      const progress = treeIndex / treeCount;
      const point = curve.getPointAt(progress);
      const tangent = curve.getTangentAt(progress).normalize();
      const normalX = -tangent.z;
      const normalZ = tangent.x;
      for (const side of [-1, 1]) {
        const x =
          point.x + normalX * (road.width / 2 + 1.02) * side;
        const z =
          point.z + normalZ * (road.width / 2 + 1.02) * side;
        if (pointIsInWater(plan.terrain.waterBoundaries, x, z)) {
          continue;
        }
        if (
          excludeBounds &&
          x >= excludeBounds.minX &&
          x <= excludeBounds.maxX &&
          z >= excludeBounds.minZ &&
          z <= excludeBounds.maxZ
        ) continue;
        const seed = stableCityHash(
          `${plan.seed}:${road.id}:avenue-tree:${treeIndex}:${side}`,
        );
        const scale = 0.76 + ((seed >>> 11) % 32) / 100;
        const trunkHeight = 0.66 * scale;
        trunks.push({
          x,
          y: LAND_Y + trunkHeight / 2,
          z,
          radius: 0.075 * scale,
          height: trunkHeight,
          rotationY: ((seed % 360) * Math.PI) / 180,
        });
        crowns.push({
          x,
          y: LAND_Y + trunkHeight + 0.34 * scale,
          z,
          width: 0.68 * scale,
          height: 0.76 * scale,
          depth: 0.68 * scale,
          rotationY: ((seed % 180) * Math.PI) / 180,
          color:
            seed % 3 === 0
              ? "#65965a"
              : seed % 3 === 1
                ? "#548b55"
                : "#5d9150",
        });
      }
    }
  }

  for (const road of plan.roads) {
    if (road.centerline.length < 2 || road.level === "elevated") continue;
    const points = road.centerline;
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index]!;
      const end = points[index + 1]!;
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.hypot(dx, dz);
      const count = Math.max(1, Math.floor(length / 9));
      const nx = -dz / Math.max(0.001, length);
      const nz = dx / Math.max(0.001, length);
      for (let lightIndex = 0; lightIndex <= count; lightIndex += 1) {
        const progress = lightIndex / count;
        const side = lightIndex % 2 === 0 ? -1 : 1;
        const x =
          THREE.MathUtils.lerp(start.x, end.x, progress) +
          nx * (road.width / 2 + 0.48) * side;
        const z =
          THREE.MathUtils.lerp(start.z, end.z, progress) +
          nz * (road.width / 2 + 0.48) * side;
        if (pointIsInWater(plan.terrain.waterBoundaries, x, z)) continue;
        if (
          excludeBounds &&
          x >= excludeBounds.minX &&
          x <= excludeBounds.maxX &&
          z >= excludeBounds.minZ &&
          z <= excludeBounds.maxZ
        ) continue;
        lightPoles.push({
          x,
          y: CAMPUS_BASE_Y + 0.78,
          z,
          radius: 0.035,
          height: 1.56,
        });
        lightBulbs.push({
          x,
          y: CAMPUS_BASE_Y + 1.58,
          z,
          width: 0.1,
          height: 0.1,
          depth: 0.1,
        });
      }
    }
  }

  return {
    trunks,
    crowns,
    greenBelts,
    lightPoles,
    lightBulbs,
  };
}

function distanceToRoadSamples(
  x: number,
  z: number,
  samples: readonly RoadSurfaceSample[],
): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    const distance =
      Math.hypot(x - sample.x, z - sample.z) - sample.halfWidth;
    if (distance < nearest) nearest = distance;
  }
  return nearest;
}

function pointIsInWater(
  boundaries: readonly SemanticWaterBoundary[],
  x: number,
  z: number,
): boolean {
  return boundaries.some((boundary) =>
    pointInPolygon(boundary.outline, x, z),
  );
}

function pointInPolygon(
  polygon: readonly { x: number; z: number }[],
  x: number,
  z: number,
): boolean {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const currentPoint = polygon[index]!;
    const previousPoint = polygon[previous]!;
    if (
      currentPoint.z > z !== previousPoint.z > z &&
      x <
        ((previousPoint.x - currentPoint.x) * (z - currentPoint.z)) /
          (previousPoint.z - currentPoint.z) +
          currentPoint.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function SemanticMobility({
  plan,
  roadSamples,
  playing,
  opacity,
  speedScale,
  paletteNight,
  showTraffic,
  showPedestrians,
  showWaterTraffic,
}: {
  plan: AmbientMobilityPlan | null;
  roadSamples: readonly RoadSurfaceSample[];
  playing: boolean;
  opacity: number;
  speedScale: number;
  paletteNight: number;
  showTraffic: boolean;
  showPedestrians: boolean;
  showWaterTraffic: boolean;
}) {
  const agents = useMemo(
    () => makeMotionAgents(plan, roadSamples),
    [plan, roadSamples],
  );
  const roadVehicles = useMemo(
    () =>
      agents.filter(
        (agent) =>
          agent.mode === "car" ||
          agent.mode === "freight" ||
          agent.mode === "transit",
      ),
    [agents],
  );
  const pedestrians = useMemo(
    () => agents.filter((agent) => agent.mode === "pedestrian"),
    [agents],
  );
  const boats = useMemo(
    () => agents.filter((agent) => agent.mode === "boat"),
    [agents],
  );

  return (
    <group name="semantic-mobility">
      <AmbientMobilityDiagnostics plan={plan} playing={playing} />
      <VehicleFleet
        agents={roadVehicles}
        night={paletteNight}
        opacity={opacity}
        playing={playing}
        speedScale={speedScale}
        visible={showTraffic}
      />
      <PedestrianFleet
        agents={pedestrians}
        night={paletteNight}
        opacity={opacity}
        playing={playing}
        speedScale={speedScale}
        visible={showPedestrians}
      />
      <BoatFleet
        agents={boats}
        night={paletteNight}
        opacity={opacity}
        playing={playing}
        speedScale={speedScale}
        visible={showWaterTraffic}
      />
    </group>
  );
}

function AmbientMobilityDiagnostics({
  plan,
  playing,
}: {
  plan: AmbientMobilityPlan | null;
  playing: boolean;
}) {
  return (
    <Html style={{ display: "none" }}>
      <output
        aria-hidden="true"
        data-ambient-boat-count={plan?.diagnostics.boatCount ?? 0}
        data-ambient-classification={plan?.classification ?? "none"}
        data-ambient-pedestrian-count={plan?.diagnostics.pedestrianCount ?? 0}
        data-ambient-plan-bytes={plan?.diagnostics.serializedBytes ?? 0}
        data-ambient-playing={playing ? "true" : "false"}
        data-ambient-route-count={
          (plan?.diagnostics.roadRouteCount ?? 0) +
          (plan?.diagnostics.pedestrianRouteCount ?? 0) +
          (plan?.diagnostics.waterRouteCount ?? 0)
        }
        data-ambient-vehicle-count={plan?.diagnostics.vehicleCount ?? 0}
        data-repocity-ambient-diagnostics
      />
    </Html>
  );
}

function makeMotionAgents(
  plan: AmbientMobilityPlan | null,
  roadSamples: readonly RoadSurfaceSample[],
): MotionAgent[] {
  if (!plan) return [];
  const routes = [
    ...plan.roadRoutes,
    ...plan.pedestrianRoutes,
    ...plan.waterRoutes,
  ];
  const preparedRoutes = new Map<string, PreparedMotionRoute>();
  for (const route of routes) {
    if (route.points.length < 2) continue;
    const motion = prepareAmbientMotionRoute(route);
    if (!motion) continue;
    preparedRoutes.set(route.id, {
      id: route.id,
      motion,
      surfaceY:
        route.kind === "water"
          ? "water"
          : route.kind === "road" ||
              route.points.some((candidate) => candidate.surface === "bridge-walk")
            ? "road"
            : "ground",
      roadSamples,
    });
  }
  return plan.agents.flatMap((agent) => {
    const route = preparedRoutes.get(agent.routeId);
    if (!route) return [];
    return [
      {
        id: agent.id,
        mode: agent.mode,
        route,
        phase: agent.phase,
        speed: agent.speed,
        delay: agent.delay,
        dwellSeconds: agent.dwellSeconds,
        lateralOffset:
          agent.mode === "pedestrian"
            ? ((agent.colorVariant % 3) - 1) * 0.11
            : 0,
        color: agentColor(agent.mode, agent.colorVariant),
        scale: agent.scale,
      },
    ];
  });
}

function agentColor(mode: MobilityMode, variant: number): string {
  const palettes: Record<MobilityMode, readonly string[]> = {
    car: ["#dc624f", "#e2b84e", "#6091c7", "#d8ddd5", "#6b9678"],
    freight: ["#e09555", "#c96b55", "#7393a2"],
    transit: ["#5ab7b0", "#e0c257", "#6e92cc"],
    pedestrian: ["#e78067", "#7298cb", "#dab85f", "#83b79d", "#a77cb4"],
    boat: ["#d3634c", "#e2b65c", "#6f9eb1"],
  };
  const palette = palettes[mode];
  return palette[variant % palette.length]!;
}

function nearestRoadSurfaceY(
  x: number,
  z: number,
  samples: readonly RoadSurfaceSample[],
): number {
  let nearest = Number.POSITIVE_INFINITY;
  let y = ROAD_Y;
  for (const sample of samples) {
    const distance = Math.hypot(x - sample.x, z - sample.z);
    if (distance < nearest) {
      nearest = distance;
      y = sample.y;
    }
  }
  return y + 0.02;
}

const VEHICLE_DIMENSIONS = {
  car: { width: 0.52, height: 0.24, length: 1.02 },
  freight: { width: 0.64, height: 0.4, length: 1.62 },
  transit: { width: 0.66, height: 0.46, length: 1.92 },
} as const;

function VehicleFleet({
  agents,
  night,
  opacity,
  playing,
  speedScale,
  visible,
}: {
  agents: readonly MotionAgent[];
  night: number;
  opacity: number;
  playing: boolean;
  speedScale: number;
  visible: boolean;
}) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const headlightRef = useRef<THREE.InstancedMesh>(null);
  const tailLightRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame((_, delta) => {
    const body = bodyRef.current;
    const cabin = cabinRef.current;
    const headlights = headlightRef.current;
    const tailLights = tailLightRef.current;
    if (!body || !cabin || !headlights || !tailLights || !visible) return;
    if (playing) timeRef.current += delta * speedScale;
    for (let index = 0; index < agents.length; index += 1) {
      const agent = agents[index]!;
      const kind = agent.mode as "car" | "freight" | "transit";
      const dimensions = VEHICLE_DIMENSIONS[kind];
      sampleMotionAgent(agent, timeRef.current, position, tangent);
      const sideX = -tangent.z * agent.lateralOffset;
      const sideZ = tangent.x * agent.lateralOffset;
      const rotationY = Math.atan2(tangent.x, tangent.z);
      const scale = agent.scale;
      dummy.position.set(
        position.x + sideX,
        position.y + dimensions.height * scale * 0.62,
        position.z + sideZ,
      );
      dummy.rotation.set(0, rotationY, 0);
      dummy.scale.set(
        dimensions.width * scale,
        dimensions.height * scale,
        dimensions.length * scale,
      );
      dummy.updateMatrix();
      body.setMatrixAt(index, dummy.matrix);
      color.set(agent.color);
      body.setColorAt(index, color);

      const cabinForward =
        kind === "freight" ? -0.42 : kind === "transit" ? 0 : 0.02;
      dummy.position.set(
        position.x + sideX + tangent.x * cabinForward * scale,
        position.y + dimensions.height * scale * 1.22,
        position.z + sideZ + tangent.z * cabinForward * scale,
      );
      dummy.scale.set(
        dimensions.width * scale * 0.78,
        dimensions.height * scale * 0.74,
        dimensions.length * scale * (kind === "transit" ? 0.82 : 0.44),
      );
      dummy.updateMatrix();
      cabin.setMatrixAt(index, dummy.matrix);

      for (let light = 0; light < 2; light += 1) {
        const lateral = (light === 0 ? -1 : 1) * dimensions.width * scale * 0.3;
        const forward = dimensions.length * scale * 0.49;
        dummy.position.set(
          position.x + sideX + tangent.x * forward - tangent.z * lateral,
          position.y + dimensions.height * scale * 0.7,
          position.z + sideZ + tangent.z * forward + tangent.x * lateral,
        );
        dummy.scale.set(0.07, 0.06, 0.035);
        dummy.updateMatrix();
        headlights.setMatrixAt(index * 2 + light, dummy.matrix);

        dummy.position.set(
          position.x + sideX - tangent.x * forward - tangent.z * lateral,
          position.y + dimensions.height * scale * 0.68,
          position.z + sideZ - tangent.z * forward + tangent.x * lateral,
        );
        dummy.updateMatrix();
        tailLights.setMatrixAt(index * 2 + light, dummy.matrix);
      }
    }
    for (const mesh of [body, cabin, headlights, tailLights]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (body.instanceColor) body.instanceColor.needsUpdate = true;
  });

  if (agents.length === 0) return null;
  return (
    <group visible={visible}>
      <instancedMesh
        ref={bodyRef}
        args={[undefined, undefined, agents.length]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          metalness={0.3}
          opacity={opacity}
          roughness={0.46}
          transparent={opacity < 1}
        />
      </instancedMesh>
      <instancedMesh
        ref={cabinRef}
        args={[undefined, undefined, agents.length]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#2b4349"
          metalness={0.3}
          opacity={opacity}
          roughness={0.34}
          transparent={opacity < 1}
        />
      </instancedMesh>
      <group visible={night > 0.08}>
        <instancedMesh
          ref={headlightRef}
          args={[undefined, undefined, agents.length * 2]}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color="#fff1b3"
            opacity={(0.4 + night * 0.6) * opacity}
            toneMapped={false}
            transparent
          />
        </instancedMesh>
        <instancedMesh
          ref={tailLightRef}
          args={[undefined, undefined, agents.length * 2]}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color="#ff5b42"
            opacity={(0.32 + night * 0.68) * opacity}
            toneMapped={false}
            transparent
          />
        </instancedMesh>
      </group>
    </group>
  );
}

function PedestrianFleet({
  agents,
  night,
  opacity,
  playing,
  speedScale,
  visible,
}: {
  agents: readonly MotionAgent[];
  night: number;
  opacity: number;
  playing: boolean;
  speedScale: number;
  visible: boolean;
}) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    const bodies = bodyRef.current;
    const heads = headRef.current;
    if (!bodies || !heads || !visible) return;
    if (playing) timeRef.current += delta * speedScale;
    for (let index = 0; index < agents.length; index += 1) {
      const agent = agents[index]!;
      sampleMotionAgent(agent, timeRef.current, position, tangent);
      const sideX = -tangent.z * agent.lateralOffset;
      const sideZ = tangent.x * agent.lateralOffset;
      const stride = Math.sin(timeRef.current * 8 + agent.phase * 20) * 0.018;
      const rotationY = Math.atan2(tangent.x, tangent.z);
      dummy.position.set(
        position.x + sideX,
        position.y + 0.24 + stride,
        position.z + sideZ,
      );
      dummy.rotation.set(0, rotationY, 0);
      dummy.scale.set(0.065, 0.11, 0.065);
      dummy.updateMatrix();
      bodies.setMatrixAt(index, dummy.matrix);
      color.set(agent.color);
      bodies.setColorAt(index, color);

      dummy.position.set(
        position.x + sideX,
        position.y + 0.52 + stride,
        position.z + sideZ,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.09);
      dummy.updateMatrix();
      heads.setMatrixAt(index, dummy.matrix);
    }
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  });

  if (agents.length === 0) return null;
  return (
    <group visible={visible}>
      <instancedMesh
        ref={bodyRef}
        args={[undefined, undefined, agents.length]}
        castShadow
        frustumCulled={false}
      >
        <capsuleGeometry args={[1, 2, 4, 7]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#4a4f4c"
          emissiveIntensity={night * 0.42}
          opacity={opacity}
          transparent={opacity < 1}
        />
      </instancedMesh>
      <instancedMesh
        ref={headRef}
        args={[undefined, undefined, agents.length]}
        castShadow
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#d4aa89" opacity={opacity} roughness={0.9} transparent={opacity < 1} />
      </instancedMesh>
    </group>
  );
}

function BoatFleet({
  agents,
  night,
  opacity,
  playing,
  speedScale,
  visible,
}: {
  agents: readonly MotionAgent[];
  night: number;
  opacity: number;
  playing: boolean;
  speedScale: number;
  visible: boolean;
}) {
  const hullRef = useRef<THREE.InstancedMesh>(null);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const wakeRef = useRef<THREE.InstancedMesh>(null);
  const navigationLightRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    const hulls = hullRef.current;
    const cabins = cabinRef.current;
    const wakes = wakeRef.current;
    const navigationLights = navigationLightRef.current;
    if (!hulls || !cabins || !wakes || !navigationLights || !visible) return;
    if (playing) timeRef.current += delta * speedScale;
    for (let index = 0; index < agents.length; index += 1) {
      const agent = agents[index]!;
      sampleMotionAgent(agent, timeRef.current, position, tangent);
      const sideX = -tangent.z * agent.lateralOffset;
      const sideZ = tangent.x * agent.lateralOffset;
      const rotationY = Math.atan2(tangent.x, tangent.z);
      const bob = Math.sin(timeRef.current * 2 + agent.phase * 11) * 0.025;
      dummy.position.set(
        position.x + sideX,
        position.y + bob,
        position.z + sideZ,
      );
      dummy.rotation.set(0, rotationY, 0);
      dummy.scale.set(0.74 * agent.scale, 0.24, 1.65 * agent.scale);
      dummy.updateMatrix();
      hulls.setMatrixAt(index, dummy.matrix);
      color.set(agent.color);
      hulls.setColorAt(index, color);

      dummy.position.set(
        position.x + sideX - tangent.x * 0.15,
        position.y + 0.27 + bob,
        position.z + sideZ - tangent.z * 0.15,
      );
      dummy.scale.set(0.44 * agent.scale, 0.34, 0.62 * agent.scale);
      dummy.updateMatrix();
      cabins.setMatrixAt(index, dummy.matrix);

      dummy.position.set(
        position.x + sideX - tangent.x * 1.12,
        WATER_Y + 0.025,
        position.z + sideZ - tangent.z * 1.12,
      );
      dummy.rotation.set(-Math.PI / 2, rotationY, 0);
      dummy.scale.set(0.68, 1.7, 1);
      dummy.updateMatrix();
      wakes.setMatrixAt(index, dummy.matrix);

      dummy.position.set(
        position.x + sideX + tangent.x * 0.2,
        position.y + 0.62 + bob,
        position.z + sideZ + tangent.z * 0.2,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.075);
      dummy.updateMatrix();
      navigationLights.setMatrixAt(index, dummy.matrix);
    }
    for (const mesh of [hulls, cabins, wakes, navigationLights]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    if (hulls.instanceColor) hulls.instanceColor.needsUpdate = true;
  });

  if (agents.length === 0) return null;
  return (
    <group visible={visible}>
      <instancedMesh
        ref={hullRef}
        args={[undefined, undefined, agents.length]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ffffff" opacity={opacity} roughness={0.64} transparent={opacity < 1} />
      </instancedMesh>
      <instancedMesh
        ref={cabinRef}
        args={[undefined, undefined, agents.length]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#dce4df"
          metalness={0.08}
          opacity={opacity}
          roughness={0.46}
          transparent={opacity < 1}
        />
      </instancedMesh>
      <instancedMesh
        ref={wakeRef}
        args={[undefined, undefined, agents.length]}
        frustumCulled={false}
        visible={playing}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#b7e2d9"
          depthWrite={false}
          opacity={0.34 * opacity}
          toneMapped={false}
          transparent
        />
      </instancedMesh>
      <instancedMesh
        ref={navigationLightRef}
        args={[undefined, undefined, agents.length]}
        frustumCulled={false}
        visible={night > 0.08}
      >
        <sphereGeometry args={[1, 7, 5]} />
        <meshBasicMaterial
          color="#b5ffe6"
          opacity={(0.38 + night * 0.62) * opacity}
          toneMapped={false}
          transparent
        />
      </instancedMesh>
    </group>
  );
}

function sampleMotionAgent(
  agent: MotionAgent,
  elapsed: number,
  positionTarget: THREE.Vector3,
  tangentTarget: THREE.Vector3,
) {
  sampleAmbientAgentInto(
    agent.route.motion,
    agent,
    elapsed,
    positionTarget,
    tangentTarget,
  );
  positionTarget.y =
    agent.route.surfaceY === "water"
      ? WATER_Y + 0.13
      : agent.route.surfaceY === "road"
        ? nearestRoadSurfaceY(
            positionTarget.x,
            positionTarget.z,
            agent.route.roadSamples,
          ) + (agent.mode === "pedestrian" ? 0.06 : 0)
        : CAMPUS_BASE_Y + 0.02;
  tangentTarget.y = 0;
}

function StaticBoxInstances({
  boxes = [],
  color,
  material,
  emissive = "#000000",
  emissiveIntensity = 0,
  metalness = 0.04,
  roughness = 0.8,
  castShadow = false,
  receiveShadow = false,
  opacity = 1,
  transparent = false,
  map,
  envMap,
}: {
  boxes: readonly BoxInstance[];
  color: string;
  material: "basic" | "standard" | "physical";
  emissive?: string;
  emissiveIntensity?: number;
  metalness?: number;
  roughness?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  opacity?: number;
  transparent?: boolean;
  map?: THREE.Texture;
  envMap?: THREE.Texture;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const workingColor = useMemo(() => new THREE.Color(), []);
  const usesInstanceColors = boxes.some((box) => Boolean(box.color));

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    boxes.forEach((box, index) => {
      dummy.position.set(box.x, box.y, box.z);
      dummy.rotation.set(
        box.rotationX ?? 0,
        box.rotationY ?? 0,
        box.rotationZ ?? 0,
      );
      dummy.scale.set(box.width, box.height, box.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (usesInstanceColors) {
        workingColor.set(box.color ?? color);
        mesh.setColorAt(index, workingColor);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [boxes, color, dummy, usesInstanceColors, workingColor]);

  if (boxes.length === 0) return null;
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, boxes.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <boxGeometry args={[1, 1, 1]} />
      {material === "basic" ? (
        <meshBasicMaterial
          color={usesInstanceColors ? "#ffffff" : color}
          depthWrite={!transparent}
          opacity={opacity}
          toneMapped={false}
          transparent={transparent}
        />
      ) : material === "physical" ? (
        <meshPhysicalMaterial
          clearcoat={0.72}
          clearcoatRoughness={0.16}
          color={usesInstanceColors ? "#ffffff" : color}
          envMap={envMap}
          envMapIntensity={1.25}
          metalness={metalness}
          opacity={opacity}
          roughness={roughness}
          transparent={transparent}
        />
      ) : (
        <meshStandardMaterial
          color={usesInstanceColors ? "#ffffff" : color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={metalness}
          roughness={roughness}
          opacity={opacity}
          map={map}
          transparent={transparent}
        />
      )}
    </instancedMesh>
  );
}

function StaticCylinderInstances({
  cylinders = [],
  color,
  radialSegments,
  castShadow = false,
  receiveShadow = false,
}: {
  cylinders: readonly CylinderInstance[];
  color: string;
  radialSegments: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const workingColor = useMemo(() => new THREE.Color(), []);
  const usesInstanceColors = cylinders.some((item) => Boolean(item.color));

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    cylinders.forEach((cylinder, index) => {
      dummy.position.set(cylinder.x, cylinder.y, cylinder.z);
      dummy.rotation.set(0, cylinder.rotationY ?? 0, 0);
      dummy.scale.set(
        cylinder.radius,
        cylinder.height,
        cylinder.radius,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (usesInstanceColors) {
        workingColor.set(cylinder.color ?? color);
        mesh.setColorAt(index, workingColor);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [color, cylinders, dummy, usesInstanceColors, workingColor]);

  if (cylinders.length === 0) return null;
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, cylinders.length]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <cylinderGeometry args={[1, 1, 1, radialSegments]} />
      <meshStandardMaterial
        color={usesInstanceColors ? "#ffffff" : color}
        metalness={0.06}
        roughness={0.7}
      />
    </instancedMesh>
  );
}

function StaticIcosahedronInstances({
  instances = [],
  color,
  emissive = "#000000",
  emissiveIntensity = 0,
  toneMapped = true,
  castShadow = false,
}: {
  instances: readonly BoxInstance[];
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  toneMapped?: boolean;
  castShadow?: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const workingColor = useMemo(() => new THREE.Color(), []);
  const usesInstanceColors = instances.some(
    (instance) => Boolean(instance.color),
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    instances.forEach((instance, index) => {
      dummy.position.set(instance.x, instance.y, instance.z);
      dummy.rotation.set(
        instance.rotationX ?? 0,
        instance.rotationY ?? 0,
        instance.rotationZ ?? 0,
      );
      dummy.scale.set(instance.width, instance.height, instance.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (usesInstanceColors) {
        workingColor.set(instance.color ?? color);
        mesh.setColorAt(index, workingColor);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [color, dummy, instances, usesInstanceColors, workingColor]);

  if (instances.length === 0) return null;
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, instances.length]}
      castShadow={castShadow}
    >
      <icosahedronGeometry args={[0.5, 1]} />
      <meshStandardMaterial
        color={usesInstanceColors ? "#ffffff" : color}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        roughness={0.82}
        toneMapped={toneMapped}
      />
    </instancedMesh>
  );
}

export default SemanticMetropolis;
