import * as THREE from "three";
import type {
  LivingCityPlan,
  MobilityRoute,
  PlannedBuilding,
} from "@/app/lib/living-city";

export const WORLD_GROUND_Y = 0;
export const ROAD_TOP_Y = 0.16;
export const BLOCK_TOP_Y = 0.24;
export const BUILDING_BASE_Y = BLOCK_TOP_Y;
export const ELEVATED_ROAD_Y = 2.65;
export const HIDDEN_SCALE = 0.00001;

export interface LivingCityRenderBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  maxHeight: number;
  radius: number;
}

export interface TimeOfDayPalette {
  daylight: number;
  night: number;
  sunset: number;
  background: string;
  fog: string;
  horizon: string;
  sun: string;
  ambient: string;
  water: string;
}

export interface PreparedRoute {
  route: MobilityRoute;
  segments: {
    fromX: number;
    fromZ: number;
    toX: number;
    toZ: number;
    dx: number;
    dz: number;
    length: number;
    start: number;
  }[];
  length: number;
}

export interface RouteSample {
  x: number;
  z: number;
  dx: number;
  dz: number;
}

export function getLivingCityBounds(
  plan: LivingCityPlan,
): LivingCityRenderBounds {
  const maxHeight = Math.max(5, ...plan.buildings.map((item) => item.height));
  return {
    minX: plan.bounds.minX,
    maxX: plan.bounds.maxX,
    minZ: plan.bounds.minZ,
    maxZ: plan.bounds.maxZ,
    centerX: plan.bounds.x,
    centerZ: plan.bounds.z,
    width: plan.bounds.width,
    depth: plan.bounds.depth,
    maxHeight,
    radius: Math.max(12, Math.hypot(plan.bounds.width, plan.bounds.depth) / 2),
  };
}

export function getTimeOfDayPalette(hourInput = 14): TimeOfDayPalette {
  const hour = ((hourInput % 24) + 24) % 24;
  const sunElevation = Math.sin(((hour - 6) / 24) * Math.PI * 2);
  const daylight = THREE.MathUtils.smoothstep(sunElevation, -0.16, 0.38);
  const sunset = Math.max(
    0,
    1 -
      Math.min(
        Math.abs(hour - 6),
        Math.abs(hour - 18),
        Math.abs(hour + 6),
        Math.abs(hour - 30),
      ) /
        2.2,
  );
  const night = 1 - daylight;
  const background = mixHex(
    mixHex("#030911", "#101d32", Math.min(1, sunset * 0.75)),
    sunset > 0.08 ? "#9b5860" : "#79a9bd",
    daylight * (0.76 - sunset * 0.34),
  );
  const fog = mixHex("#06101a", "#8eafad", daylight * 0.56);

  return {
    daylight,
    night,
    sunset,
    background,
    fog,
    horizon: mixHex("#10192a", "#cad8c4", daylight),
    sun: mixHex("#9db6d7", sunset > 0.18 ? "#ff9c63" : "#fff2cf", daylight),
    ambient: mixHex("#29405b", "#c7d9cf", daylight),
    water: mixHex("#07192a", "#247d87", daylight * 0.82),
  };
}

export function getSunPosition(
  hourInput: number,
  bounds: LivingCityRenderBounds,
): [number, number, number] {
  const hour = ((hourInput % 24) + 24) % 24;
  const angle = ((hour - 6) / 24) * Math.PI * 2;
  const radius = Math.max(40, bounds.radius * 1.7);
  return [
    bounds.centerX + Math.cos(angle) * radius,
    Math.max(4, Math.sin(angle) * radius),
    bounds.centerZ + Math.sin(angle * 0.62 + 0.7) * radius * 0.7,
  ];
}

export function prepareRoute(route: MobilityRoute): PreparedRoute {
  const segments: PreparedRoute["segments"] = [];
  let total = 0;
  for (let index = 0; index < route.points.length - 1; index += 1) {
    const from = route.points[index]!;
    const to = route.points[index + 1]!;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.0001) continue;
    segments.push({
      fromX: from.x,
      fromZ: from.z,
      toX: to.x,
      toZ: to.z,
      dx: dx / length,
      dz: dz / length,
      length,
      start: total,
    });
    total += length;
  }

  return { route, segments, length: Math.max(0.0001, total) };
}

export function sampleRoute(
  prepared: PreparedRoute,
  normalizedProgress: number,
): RouteSample {
  if (prepared.segments.length === 0) {
    const fallback = prepared.route.points[0] ?? { x: 0, z: 0 };
    return { x: fallback.x, z: fallback.z, dx: 0, dz: 1 };
  }

  const normalized =
    ((normalizedProgress % 1) + 1) % 1;
  const distance = normalized * prepared.length;
  const segment =
    prepared.segments.find(
      (candidate) => distance <= candidate.start + candidate.length,
    ) ?? prepared.segments.at(-1)!;
  const local = THREE.MathUtils.clamp(
    (distance - segment.start) / segment.length,
    0,
    1,
  );

  return {
    x: THREE.MathUtils.lerp(segment.fromX, segment.toX, local),
    z: THREE.MathUtils.lerp(segment.fromZ, segment.toZ, local),
    dx: segment.dx,
    dz: segment.dz,
  };
}

export function getRoadSurfaceHeight(
  plan: LivingCityPlan,
  x: number,
  z: number,
): number {
  for (const bridge of plan.bridges) {
    const minX = bridge.x - bridge.width / 2;
    const maxX = bridge.x + bridge.width / 2;
    if (
      x >= minX - 0.15 &&
      x <= maxX + 0.15 &&
      Math.abs(z - bridge.z) <= bridge.depth * 0.62
    ) {
      const progress = THREE.MathUtils.clamp(
        (x - minX) / Math.max(0.001, bridge.width),
        0,
        1,
      );
      return ROAD_TOP_Y + Math.sin(progress * Math.PI) * 0.7;
    }
  }

  return ROAD_TOP_Y;
}

export function getBuildingPosition(
  building: PlannedBuilding,
  height: number,
): [number, number, number] {
  return [
    building.x,
    BUILDING_BASE_Y + Math.max(0, height) / 2,
    building.z,
  ];
}

export function mixHex(from: string, to: string, amount: number): string {
  return `#${new THREE.Color(from)
    .lerp(new THREE.Color(to), THREE.MathUtils.clamp(amount, 0, 1))
    .getHexString()}`;
}
