"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type {
  SemanticCampus,
  SemanticCityPlan,
  SemanticFileSlot,
  SemanticMobilityRoute,
  SemanticRoad,
  SemanticWaterBoundary,
} from "@/app/lib/semantic-city";
import type {
  UrbanBuildingEnvelope,
  UrbanFabricPlan,
  UrbanMaterialKey,
} from "@/app/lib/urban-fabric";
import { stableCityHash } from "@/app/lib/city-visuals";
import { getTimeOfDayPalette } from "./living-city-render-utils";

const LAND_Y = 0;
const ROAD_Y = 0.12;
const WATER_Y = -0.18;
const CAMPUS_BASE_Y = 0.24;
const ELEVATED_ROAD_Y = 2.8;
const BRIDGE_RISE = 0.82;
const TREE_CLEARANCE = 0.7;

type MobilityMode = SemanticMobilityRoute["mode"];

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
  mode: MobilityMode;
  curve: THREE.CurvePath<THREE.Vector3>;
  weight: number;
  closed: boolean;
  length: number;
}

interface MotionAgent {
  id: string;
  mode: MobilityMode;
  route: PreparedMotionRoute;
  phase: number;
  speed: number;
  laneOffset: number;
  color: string;
  scale: number;
}

export interface SemanticMetropolisProps {
  plan: SemanticCityPlan;
  urbanFabric?: UrbanFabricPlan;
  /**
   * Scenario-authorized agents. Omitting this prop renders no moving entities;
   * static plan relations shape infrastructure but never create traffic.
   */
  mobilityRoutes?: readonly SemanticMobilityRoute[];
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
  mobilityRoutes = EMPTY_MOBILITY_ROUTES,
  timeOfDay = 14,
  reservedEntityIds = EMPTY_ID_SET,
  activeComponentIds = null,
  showTraffic = true,
  showPedestrians = true,
  showWaterTraffic = true,
  playing = true,
  onHoverEntity,
  onSelectEntity,
}: SemanticMetropolisProps) {
  const palette = useMemo(
    () => getTimeOfDayPalette(timeOfDay),
    [timeOfDay],
  );
  const campusGeometry = useMemo(
    () =>
      urbanFabric
        ? makeUrbanFabricGeometry(
            urbanFabric,
            reservedEntityIds,
            activeComponentIds,
          )
        : makeCampusGeometry(
            plan.campuses,
            reservedEntityIds,
            activeComponentIds,
          ),
    [activeComponentIds, plan.campuses, reservedEntityIds, urbanFabric],
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
      ),
    [plan, roadGeometry.surfaceSamples, urbanFabric],
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
      clipWaterBoundaries(
        plan.terrain.waterBoundaries,
        displayBounds,
      ),
    [displayBounds, plan.terrain.waterBoundaries],
  );

  return (
    <group name="semantic-metropolis">
      <SemanticTerrain
        bounds={displayBounds}
        waterBoundaries={displayWaterBoundaries}
      />
      <SemanticWater
        boundaries={displayWaterBoundaries}
        color={palette.water}
        night={palette.night}
      />

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
        color="#c5c9c8"
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
        material="standard"
        receiveShadow
        roughness={0.78}
      />
      <StaticBoxInstances
        boxes={campusGeometry.wings}
        castShadow
        color="#ffffff"
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
        emissive="#254f55"
        emissiveIntensity={0.035 + palette.night * 0.72}
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
          buildings={urbanFabric.buildings}
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
        routes={mobilityRoutes}
        playing={playing}
        roadSamples={roadGeometry.surfaceSamples}
        showPedestrians={showPedestrians}
        showTraffic={showTraffic}
        showWaterTraffic={showWaterTraffic}
      />
    </group>
  );
}

const EMPTY_ID_SET: ReadonlySet<string> = new Set<string>();
const EMPTY_MOBILITY_ROUTES: readonly SemanticMobilityRoute[] = [];

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
  waterBoundaries: readonly SemanticWaterBoundary[];
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
  waterBoundaries: readonly SemanticWaterBoundary[],
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
  const cityColor = new THREE.Color("#688d62");
  const outerColor = new THREE.Color("#4f735b");
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
  boundaries: readonly SemanticWaterBoundary[];
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
  boundary: SemanticWaterBoundary;
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
              vec3 deep = uColor * (.64 + uNight * .08);
              vec3 shallow = uColor + vec3(.11, .18, .16);
              vec3 finalColor = mix(deep, shallow, fresnel * .55 + glint * .2);
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
          color="#a5c8b7"
          depthWrite={false}
          opacity={0.28}
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
  boundary: SemanticWaterBoundary,
): THREE.BufferGeometry {
  return makeBoundaryRibbonGeometry(
    boundary,
    0.18,
    WATER_Y + 0.014,
  );
}

function makeBoundaryRibbonGeometry(
  boundary: SemanticWaterBoundary,
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
  boundary: SemanticWaterBoundary,
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

const URBAN_MATERIAL_COLORS: Readonly<Record<UrbanMaterialKey, string>> = {
  limestone: "#c8c4b8",
  "warm-concrete": "#aaa59a",
  brick: "#947d70",
  slate: "#727b7d",
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

function urbanMass(
  target: BoxInstance[],
  building: UrbanBuildingEnvelope,
  options: {
    x?: number;
    y: number;
    z?: number;
    width: number;
    height: number;
    depth: number;
    color?: string;
    rotationZ?: number;
  },
) {
  target.push({
    x: building.x + (options.x ?? 0),
    y: CAMPUS_BASE_Y + options.y,
    z: building.z + (options.z ?? 0),
    width: options.width,
    height: options.height,
    depth: options.depth,
    rotationY: building.rotation,
    rotationZ: options.rotationZ,
    color: options.color,
  });
}

function addUrbanFacadeRhythm(
  geometry: CampusGeometry,
  building: UrbanBuildingEnvelope,
  facadeHeight: number,
) {
  const floors = Math.max(2, Math.min(7, Math.floor(facadeHeight / 1.65)));
  const north = building.entrance.z <= building.z;
  const facadeZ =
    (north ? -1 : 1) * (building.depth / 2 + 0.025);
  for (let floor = 0; floor < floors; floor += 1) {
    urbanMass(geometry.glazing, building, {
      y: 1.05 + floor * Math.max(1.15, (facadeHeight - 1.1) / floors),
      z: facadeZ,
      width: building.width * 0.72,
      height: 0.34,
      depth: 0.06,
      color: floor % 3 === 0 ? "#7ba2a5" : "#668b90",
    });
  }
  urbanMass(geometry.accents, building, {
    y: 0.53,
    z: (north ? -1 : 1) * (building.depth / 2 + 0.2),
    width: Math.min(1.5, building.width * 0.34),
    height: 0.16,
    depth: 0.52,
    color: building.accentColor,
  });
  urbanMass(geometry.details, building, {
    y: 0.34,
    z: (north ? -1 : 1) * (building.depth / 2 + 0.23),
    width: Math.min(0.9, building.width * 0.22),
    height: 0.52,
    depth: 0.08,
    color: "#263638",
  });
}

function buildNarrowStreetBuilding(
  geometry: CampusGeometry,
  building: UrbanBuildingEnvelope,
  wall: string,
) {
  urbanMass(geometry.shells, building, {
    y: building.height / 2,
    width: building.width,
    height: building.height,
    depth: building.depth,
    color: wall,
  });
  urbanMass(geometry.roofs, building, {
    y: building.height + 0.14,
    width: building.width * 0.96,
    height: 0.28,
    depth: building.depth * 0.96,
    color: "#4f595a",
  });
  addUrbanFacadeRhythm(geometry, building, building.height);
}

function buildPerimeterCourtyard(
  geometry: CampusGeometry,
  building: UrbanBuildingEnvelope,
  wall: string,
) {
  const height = building.height * 0.72;
  const wingDepth = Math.max(0.75, building.depth * 0.18);
  const wingWidth = Math.max(0.8, building.width * 0.17);
  for (const side of [-1, 1]) {
    urbanMass(geometry.wings, building, {
      y: height / 2,
      z: side * (building.depth / 2 - wingDepth / 2),
      width: building.width,
      height,
      depth: wingDepth,
      color: wall,
    });
    urbanMass(geometry.wings, building, {
      x: side * (building.width / 2 - wingWidth / 2),
      y: height / 2,
      width: wingWidth,
      height,
      depth: Math.max(0.8, building.depth - wingDepth * 1.4),
      color: wall,
    });
  }
  urbanMass(geometry.lawns, building, {
    y: 0.07,
    width: Math.max(0.8, building.width - wingWidth * 2.3),
    height: 0.08,
    depth: Math.max(0.8, building.depth - wingDepth * 2.3),
    color: "#547759",
  });
  addUrbanFacadeRhythm(geometry, building, height);
}

function buildPodiumTower(
  geometry: CampusGeometry,
  building: UrbanBuildingEnvelope,
  wall: string,
) {
  const podiumHeight = Math.max(2.2, building.height * 0.28);
  const towerHeight = building.height - podiumHeight * 0.55;
  urbanMass(geometry.wings, building, {
    y: podiumHeight / 2,
    width: building.width,
    height: podiumHeight,
    depth: building.depth,
    color: wall,
  });
  urbanMass(geometry.shells, building, {
    x: building.width * 0.12,
    y: podiumHeight * 0.55 + towerHeight / 2,
    z: building.depth * 0.06,
    width: building.width * 0.5,
    height: towerHeight,
    depth: building.depth * 0.6,
    color: wall,
  });
  urbanMass(geometry.roofs, building, {
    x: building.width * 0.12,
    y: building.height + 0.18,
    z: building.depth * 0.06,
    width: building.width * 0.46,
    height: 0.32,
    depth: building.depth * 0.56,
    color: "#465155",
  });
  addUrbanFacadeRhythm(geometry, building, building.height);
}

function buildCivicLandmark(
  geometry: CampusGeometry,
  building: UrbanBuildingEnvelope,
  wall: string,
) {
  const baseHeight = building.height * 0.55;
  urbanMass(geometry.shells, building, {
    y: baseHeight / 2,
    width: building.width,
    height: baseHeight,
    depth: building.depth * 0.78,
    color: wall,
  });
  urbanMass(geometry.wings, building, {
    y: baseHeight * 0.46,
    width: building.width * 0.42,
    height: baseHeight * 0.92,
    depth: building.depth,
    color: "#b8b4a9",
  });
  urbanMass(geometry.roofs, building, {
    y: baseHeight + 0.42,
    width: building.width * 0.72,
    height: 0.82,
    depth: building.depth * 0.68,
    rotationZ: Math.PI * 0.045,
    color: "#596467",
  });
  geometry.cylinders.push({
    x: building.x,
    y: CAMPUS_BASE_Y + baseHeight + building.height * 0.22,
    z: building.z,
    radius: 0.3,
    height: building.height * 0.44,
    color: building.accentColor,
  });
  addUrbanFacadeRhythm(geometry, building, baseHeight);
}

function buildTechnicalHall(
  geometry: CampusGeometry,
  building: UrbanBuildingEnvelope,
  wall: string,
) {
  const height = Math.max(2.8, building.height * 0.5);
  urbanMass(geometry.shells, building, {
    y: height / 2,
    width: building.width,
    height,
    depth: building.depth,
    color: wall,
  });
  for (let bay = -2; bay <= 2; bay += 1) {
    urbanMass(geometry.roofs, building, {
      x: (bay * building.width) / 5,
      y: height + 0.18,
      width: building.width / 5.2,
      height: 0.22,
      depth: building.depth * 0.9,
      rotationZ: bay % 2 === 0 ? 0.14 : -0.14,
      color: "#596365",
    });
  }
  addUrbanFacadeRhythm(geometry, building, height);
}

function makeUrbanFabricGeometry(
  plan: UrbanFabricPlan,
  reservedEntityIds: ReadonlySet<string>,
  activeComponentIds: ReadonlySet<string> | null,
): CampusGeometry {
  const geometry = emptyCampusGeometry();
  const reservedBuildingIds = new Set(
    [...reservedEntityIds]
      .map((entityId) => plan.entityAddresses[entityId]?.buildingId)
      .filter((id): id is string => Boolean(id)),
  );
  for (const building of plan.buildings) {
    if (reservedBuildingIds.has(building.id)) continue;
    const wall = URBAN_MATERIAL_COLORS[building.material];
    switch (building.typology) {
      case "narrow-street":
        buildNarrowStreetBuilding(geometry, building, wall);
        break;
      case "perimeter-courtyard":
        buildPerimeterCourtyard(geometry, building, wall);
        break;
      case "podium-tower":
        buildPodiumTower(geometry, building, wall);
        break;
      case "civic-landmark":
        buildCivicLandmark(geometry, building, wall);
        break;
      case "technical-hall":
        buildTechnicalHall(geometry, building, wall);
        break;
    }
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
  }
  return geometry;
}

function UrbanBuildingHitTargets({
  buildings,
  reservedEntityIds,
  onHoverEntity,
  onSelectEntity,
}: {
  buildings: readonly UrbanBuildingEnvelope[];
  reservedEntityIds: ReadonlySet<string>;
  onHoverEntity?: (entityId: string | null) => void;
  onSelectEntity?: (entityId: string) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const interactiveBuildings = useMemo(
    () =>
      buildings.filter(
        (building) =>
          !building.entityIds.some((id) => reservedEntityIds.has(id)),
      ),
    [buildings, reservedEntityIds],
  );
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
      : interactiveBuildings[instanceId]?.primaryEntityId;
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
  routes,
  roadSamples,
  playing,
  showTraffic,
  showPedestrians,
  showWaterTraffic,
}: {
  routes: readonly SemanticMobilityRoute[];
  roadSamples: readonly RoadSurfaceSample[];
  playing: boolean;
  showTraffic: boolean;
  showPedestrians: boolean;
  showWaterTraffic: boolean;
}) {
  const agents = useMemo(
    () => makeMotionAgents(routes, roadSamples),
    [roadSamples, routes],
  );
  const cars = useMemo(
    () => agents.filter((agent) => agent.mode === "car"),
    [agents],
  );
  const freight = useMemo(
    () => agents.filter((agent) => agent.mode === "freight"),
    [agents],
  );
  const transit = useMemo(
    () => agents.filter((agent) => agent.mode === "transit"),
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
      <VehicleFleet
        agents={cars}
        kind="car"
        playing={playing}
        visible={showTraffic}
      />
      <VehicleFleet
        agents={freight}
        kind="freight"
        playing={playing}
        visible={showTraffic}
      />
      <VehicleFleet
        agents={transit}
        kind="transit"
        playing={playing}
        visible={showTraffic}
      />
      <PedestrianFleet
        agents={pedestrians}
        playing={playing}
        visible={showPedestrians}
      />
      <BoatFleet
        agents={boats}
        playing={playing}
        visible={showWaterTraffic}
      />
    </group>
  );
}

function makeMotionAgents(
  routes: readonly SemanticMobilityRoute[],
  roadSamples: readonly RoadSurfaceSample[],
): MotionAgent[] {
  const agents: MotionAgent[] = [];
  for (const route of routes) {
    if (route.points.length < 2) continue;
    const routePoints: THREE.Vector3[] = [];
    for (const point of route.points) {
      const routePoint = new THREE.Vector3(
        point.x,
        route.mode === "boat"
          ? WATER_Y + 0.13
          : route.mode === "pedestrian"
            ? CAMPUS_BASE_Y + 0.02
            : nearestRoadSurfaceY(point.x, point.z, roadSamples),
        point.z,
      );
      const previous = routePoints.at(-1);
      if (previous && previous.distanceToSquared(routePoint) < 0.000001) {
        continue;
      }
      routePoints.push(routePoint);
    }
    if (routePoints.length < 2) continue;
    const curve = makeSegmentedMotionCurve(routePoints);
    const prepared: PreparedMotionRoute = {
      id: route.id,
      mode: route.mode,
      curve,
      weight: route.weight,
      closed: false,
      length: Math.max(0.01, curve.getLength()),
    };
    const desired = explicitAgentCount(route.weight);
    for (let index = 0; index < desired; index += 1) {
      const seed = stableCityHash(`${route.id}:${route.mode}:${index}`);
      agents.push({
        id: `${route.id}:${index}`,
        mode: route.mode,
        route: prepared,
        phase: ((seed >>> 5) % 1000) / 1000,
        speed: motionSpeed(route.mode, seed),
        laneOffset:
          route.mode === "pedestrian"
            ? (((seed >>> 13) % 100) / 100 - 0.5) * 0.38
            : route.mode === "boat"
              ? (((seed >>> 13) % 100) / 100 - 0.5) * 0.55
              : index % 2 === 0
                ? -0.34
                : 0.34,
        color: agentColor(route.mode, seed),
        scale: 0.86 + ((seed >>> 17) % 25) / 100,
      });
    }
  }
  return agents;
}

/**
 * Keeps visible agents identical to the scenario fact. A route with weight N
 * produces exactly N instances; no ambient baseline or logarithmic inflation.
 */
function explicitAgentCount(weight: number): number {
  if (!Number.isSafeInteger(weight) || weight <= 0) return 0;
  return weight;
}

/**
 * Motion follows the semantic polyline exactly. Catmull-Rom interpolation
 * rounds corners outside narrow roads, so every adjacent pair is a LineCurve3.
 */
function makeSegmentedMotionCurve(
  points: readonly THREE.Vector3[],
): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>();
  for (let index = 1; index < points.length; index += 1) {
    path.add(
      new THREE.LineCurve3(
        points[index - 1]!.clone(),
        points[index]!.clone(),
      ),
    );
  }
  return path;
}

function motionSpeed(mode: MobilityMode, seed: number): number {
  const variation = ((seed >>> 9) % 17) / 1000;
  switch (mode) {
    case "pedestrian":
      return 0.022 + variation * 0.5;
    case "boat":
      return 0.018 + variation * 0.35;
    case "transit":
      return 0.027 + variation * 0.4;
    case "freight":
      return 0.024 + variation * 0.35;
    case "car":
      return 0.034 + variation;
  }
}

function agentColor(mode: MobilityMode, seed: number): string {
  const palettes: Record<MobilityMode, readonly string[]> = {
    car: ["#dc624f", "#e2b84e", "#6091c7", "#d8ddd5", "#6b9678"],
    freight: ["#e09555", "#c96b55", "#7393a2"],
    transit: ["#5ab7b0", "#e0c257", "#6e92cc"],
    pedestrian: ["#e78067", "#7298cb", "#dab85f", "#83b79d", "#a77cb4"],
    boat: ["#d3634c", "#e2b65c", "#6f9eb1"],
  };
  const palette = palettes[mode];
  return palette[seed % palette.length]!;
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

function VehicleFleet({
  agents,
  kind,
  playing,
  visible,
}: {
  agents: readonly MotionAgent[];
  kind: "car" | "freight" | "transit";
  playing: boolean;
  visible: boolean;
}) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const dimensions =
    kind === "car"
      ? { width: 0.44, height: 0.2, length: 0.82 }
      : kind === "freight"
        ? { width: 0.58, height: 0.36, length: 1.45 }
        : { width: 0.58, height: 0.42, length: 1.72 };

  useFrame((_, delta) => {
    const body = bodyRef.current;
    const cabin = cabinRef.current;
    if (!body || !cabin || !visible) return;
    if (playing) timeRef.current += delta;
    for (let index = 0; index < agents.length; index += 1) {
      const agent = agents[index]!;
      sampleMotionAgent(agent, timeRef.current, position, tangent);
      const sideX = -tangent.z * agent.laneOffset;
      const sideZ = tangent.x * agent.laneOffset;
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
    }
    body.instanceMatrix.needsUpdate = true;
    cabin.instanceMatrix.needsUpdate = true;
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
          roughness={0.46}
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
          color={kind === "transit" ? "#d8e0dc" : "#263b42"}
          metalness={0.3}
          roughness={0.34}
        />
      </instancedMesh>
    </group>
  );
}

function PedestrianFleet({
  agents,
  playing,
  visible,
}: {
  agents: readonly MotionAgent[];
  playing: boolean;
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
    if (playing) timeRef.current += delta;
    for (let index = 0; index < agents.length; index += 1) {
      const agent = agents[index]!;
      sampleMotionAgent(agent, timeRef.current, position, tangent);
      const sideX = -tangent.z * agent.laneOffset;
      const sideZ = tangent.x * agent.laneOffset;
      const stride = Math.sin(timeRef.current * 8 + agent.phase * 20) * 0.018;
      const rotationY = Math.atan2(tangent.x, tangent.z);
      dummy.position.set(
        position.x + sideX,
        position.y + 0.2 + stride,
        position.z + sideZ,
      );
      dummy.rotation.set(0, rotationY, 0);
      dummy.scale.set(0.085, 0.34, 0.085);
      dummy.updateMatrix();
      bodies.setMatrixAt(index, dummy.matrix);
      color.set(agent.color);
      bodies.setColorAt(index, color);

      dummy.position.set(
        position.x + sideX,
        position.y + 0.43 + stride,
        position.z + sideZ,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.11);
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
        <meshStandardMaterial color="#ffffff" />
      </instancedMesh>
      <instancedMesh
        ref={headRef}
        args={[undefined, undefined, agents.length]}
        castShadow
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#d4aa89" roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

function BoatFleet({
  agents,
  playing,
  visible,
}: {
  agents: readonly MotionAgent[];
  playing: boolean;
  visible: boolean;
}) {
  const hullRef = useRef<THREE.InstancedMesh>(null);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const wakeRef = useRef<THREE.InstancedMesh>(null);
  const timeRef = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    const hulls = hullRef.current;
    const cabins = cabinRef.current;
    const wakes = wakeRef.current;
    if (!hulls || !cabins || !wakes || !visible) return;
    if (playing) timeRef.current += delta;
    for (let index = 0; index < agents.length; index += 1) {
      const agent = agents[index]!;
      sampleMotionAgent(agent, timeRef.current, position, tangent);
      const sideX = -tangent.z * agent.laneOffset;
      const sideZ = tangent.x * agent.laneOffset;
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
    }
    hulls.instanceMatrix.needsUpdate = true;
    cabins.instanceMatrix.needsUpdate = true;
    wakes.instanceMatrix.needsUpdate = true;
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
        <meshStandardMaterial color="#ffffff" roughness={0.64} />
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
          roughness={0.46}
        />
      </instancedMesh>
      <instancedMesh
        ref={wakeRef}
        args={[undefined, undefined, agents.length]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#b7e2d9"
          depthWrite={false}
          opacity={0.34}
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
  const raw = (agent.phase + elapsed * agent.speed) % 1;
  const progress = raw < 0.5 ? raw * 2 : (1 - raw) * 2;
  const direction = raw < 0.5 ? 1 : -1;
  agent.route.curve.getPointAt(progress, positionTarget);
  agent.route.curve.getTangentAt(progress, tangentTarget);
  tangentTarget.multiplyScalar(direction).normalize();
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
}: {
  boxes: readonly BoxInstance[];
  color: string;
  material: "basic" | "standard";
  emissive?: string;
  emissiveIntensity?: number;
  metalness?: number;
  roughness?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  opacity?: number;
  transparent?: boolean;
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
      ) : (
        <meshStandardMaterial
          color={usesInstanceColors ? "#ffffff" : color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={metalness}
          roughness={roughness}
          opacity={opacity}
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
