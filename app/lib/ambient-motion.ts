import type {
  AmbientAgentPlan,
  AmbientMobilityRoute,
  AmbientRoutePoint,
} from "./ambient-mobility";

export interface AmbientMotionVector {
  x: number;
  z: number;
}

export interface PreparedAmbientMotionRoute {
  id: string;
  strategy: AmbientMobilityRoute["motionStrategy"];
  direction: 1 | -1;
  points: AmbientRoutePoint[];
  cumulativeLengths: number[];
  length: number;
  cycleDistance: number;
  stopDistances: number[];
}

export interface AmbientMotionSample {
  position: AmbientMotionVector;
  tangent: AmbientMotionVector;
  routeProgress: number;
  cycleProgress: number;
}

const EPSILON = 0.000_001;

const wrap = (value: number, length = 1): number => {
  const wrapped = value % length;
  return wrapped < 0 ? wrapped + length : wrapped;
};

function samePoint(left: AmbientMotionVector, right: AmbientMotionVector): boolean {
  return Math.hypot(left.x - right.x, left.z - right.z) <= EPSILON;
}

export function prepareAmbientMotionRoute(
  route: AmbientMobilityRoute,
): PreparedAmbientMotionRoute | null {
  const points: AmbientRoutePoint[] = [];
  for (const candidate of route.points) {
    if (!points.at(-1) || !samePoint(points.at(-1)!, candidate)) {
      points.push({ ...candidate });
    }
  }
  if (route.motionStrategy === "closed-loop" && points.length > 1) {
    points.push({ ...points[0]! });
  }
  if (points.length < 2) return null;

  const cumulativeLengths = [0];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    cumulativeLengths.push(
      cumulativeLengths[index - 1]! +
        Math.hypot(current.x - previous.x, current.z - previous.z),
    );
  }
  const length = cumulativeLengths.at(-1) ?? 0;
  if (length <= EPSILON) return null;
  const cycleDistance = route.motionStrategy === "ping-pong" ? 2 : 1;
  const stopDistances =
    route.motionStrategy === "ping-pong"
      ? [
          ...route.stopProgresses,
          ...route.stopProgresses.map((progress) => 2 - progress),
        ].sort((left, right) => left - right)
      : [...route.stopProgresses].sort((left, right) => left - right);
  return {
    id: route.id,
    strategy: route.motionStrategy,
    direction: route.direction,
    points,
    cumulativeLengths,
    length,
    cycleDistance,
    stopDistances,
  };
}

export function samplePreparedAmbientRouteInto(
  route: PreparedAmbientMotionRoute,
  routeProgress: number,
  positionTarget: AmbientMotionVector,
  tangentTarget: AmbientMotionVector,
): void {
  const progress = Math.max(0, Math.min(1, routeProgress));
  const targetLength = progress * route.length;
  let segmentIndex = route.cumulativeLengths.length - 1;
  for (let index = 1; index < route.cumulativeLengths.length; index += 1) {
    if (targetLength <= route.cumulativeLengths[index]! + EPSILON) {
      segmentIndex = index;
      break;
    }
  }
  const start = route.points[Math.max(0, segmentIndex - 1)]!;
  const end = route.points[segmentIndex]!;
  const segmentStart = route.cumulativeLengths[Math.max(0, segmentIndex - 1)]!;
  const segmentLength = Math.max(
    EPSILON,
    route.cumulativeLengths[segmentIndex]! - segmentStart,
  );
  const localProgress = Math.max(
    0,
    Math.min(1, (targetLength - segmentStart) / segmentLength),
  );
  positionTarget.x = start.x + (end.x - start.x) * localProgress;
  positionTarget.z = start.z + (end.z - start.z) * localProgress;
  tangentTarget.x = (end.x - start.x) / segmentLength;
  tangentTarget.z = (end.z - start.z) / segmentLength;
}

/**
 * Advances a shared route clock through travel and dwell segments. Road agents
 * add their fixed phase after this value, so a stop pauses the convoy clock
 * without allowing independently timed vehicles to overtake or overlap.
 */
export function sampleAmbientCycleDistance(
  route: PreparedAmbientMotionRoute,
  speed: number,
  dwellSeconds: number,
  elapsed: number,
  delay = 0,
): number {
  const safeSpeed = Math.max(0.0001, speed);
  const travelDuration = route.cycleDistance / safeSpeed;
  const totalDuration = travelDuration + route.stopDistances.length * dwellSeconds;
  let cycleTime = wrap(elapsed + delay, Math.max(EPSILON, totalDuration));
  let previousDistance = 0;
  for (const stopDistance of route.stopDistances) {
    const segmentDuration = (stopDistance - previousDistance) / safeSpeed;
    if (cycleTime <= segmentDuration) {
      return previousDistance + cycleTime * safeSpeed;
    }
    cycleTime -= segmentDuration;
    if (cycleTime <= dwellSeconds) return stopDistance;
    cycleTime -= dwellSeconds;
    previousDistance = stopDistance;
  }
  return Math.min(
    route.cycleDistance,
    previousDistance + cycleTime * safeSpeed,
  );
}

export function sampleAmbientAgentInto(
  route: PreparedAmbientMotionRoute,
  agent: Pick<
    AmbientAgentPlan,
    "mode" | "phase" | "speed" | "delay" | "dwellSeconds"
  >,
  elapsed: number,
  positionTarget: AmbientMotionVector,
  tangentTarget: AmbientMotionVector,
  progressTarget?: { routeProgress: number; cycleProgress: number },
): void {
  let cycleDistance = sampleAmbientCycleDistance(
    route,
    agent.speed,
    agent.dwellSeconds,
    elapsed,
    agent.delay,
  );

  // Vehicles on a closed road share the route clock and keep a fixed spatial
  // offset. Other agents retain time-offset phases for natural variation.
  if (agent.mode === "car" || agent.mode === "freight" || agent.mode === "transit") {
    cycleDistance = wrap(cycleDistance + agent.phase, route.cycleDistance);
  } else {
    const safeSpeed = Math.max(0.0001, agent.speed);
    const travelDuration = route.cycleDistance / safeSpeed;
    const totalDuration = travelDuration + route.stopDistances.length * agent.dwellSeconds;
    cycleDistance = sampleAmbientCycleDistance(
      route,
      agent.speed,
      agent.dwellSeconds,
      elapsed + agent.phase * totalDuration,
      agent.delay,
    );
  }

  let routeProgress: number;
  let tangentDirection = 1;
  if (route.strategy === "ping-pong") {
    routeProgress = cycleDistance <= 1 ? cycleDistance : 2 - cycleDistance;
    tangentDirection = cycleDistance <= 1 ? 1 : -1;
  } else {
    // Closed loops and offscreen wraps store canonical forward points. Their
    // declared direction is the only source of truth for runtime traversal.
    const forwardProgress = wrap(cycleDistance, 1);
    routeProgress = route.direction > 0 ? forwardProgress : 1 - forwardProgress;
    tangentDirection = route.direction;
  }
  samplePreparedAmbientRouteInto(
    route,
    routeProgress,
    positionTarget,
    tangentTarget,
  );
  tangentTarget.x *= tangentDirection;
  tangentTarget.z *= tangentDirection;
  const tangentLength = Math.max(EPSILON, Math.hypot(tangentTarget.x, tangentTarget.z));
  tangentTarget.x /= tangentLength;
  tangentTarget.z /= tangentLength;
  if (progressTarget) {
    progressTarget.routeProgress = routeProgress;
    progressTarget.cycleProgress = cycleDistance;
  }
}

export function sampleAmbientAgent(
  route: PreparedAmbientMotionRoute,
  agent: Pick<
    AmbientAgentPlan,
    "mode" | "phase" | "speed" | "delay" | "dwellSeconds"
  >,
  elapsed: number,
): AmbientMotionSample {
  const position = { x: 0, z: 0 };
  const tangent = { x: 0, z: 0 };
  const progress = { routeProgress: 0, cycleProgress: 0 };
  sampleAmbientAgentInto(
    route,
    agent,
    elapsed,
    position,
    tangent,
    progress,
  );
  return { position, tangent, routeProgress: progress.routeProgress, cycleProgress: progress.cycleProgress };
}
