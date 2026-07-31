"use client";

import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import type {
  CityPoint,
  LivingCityPlan,
  PlannedBuilding,
} from "@/app/lib/living-city";
import {
  findRoadPath,
  projectRoadAnchor,
  type RoadPathAnchor,
} from "@/app/lib/flow-route";
import { sampleFlowTokenProgress } from "@/app/lib/flow-simulation";
import {
  BLOCK_TOP_Y,
  BUILDING_BASE_Y,
  getRoadSurfaceHeight,
} from "./living-city-render-utils";
import {
  getJourneyLandmarkHeight,
  JourneyLandmark,
  type JourneyFacilityKind,
} from "./JourneyLandmarks";

export type FlowJourneyMode =
  | "pedestrian"
  | "car"
  | "transit"
  | "freight"
  | "boat";

export type FlowJourneyProvenance =
  | "simulated"
  | "inferred"
  | "observed";

export type FlowJourneyFacility = JourneyFacilityKind;

export interface FlowJourneyEvidenceView {
  id: string;
  kind: "import-relation" | "path-heuristic" | "city-placement";
  provenance: FlowJourneyProvenance;
  confidence: "high" | "medium";
  label: string;
  reason: string;
  relationIds: string[];
}

export interface FlowJourneyViewStep {
  id: string;
  entityId: string;
  label: string;
  detail: string;
  payloadLabel: string;
  sourcePath: string;
  symbolLabels: string[];
  evidenceIds: string[];
  facility: FlowJourneyFacility;
}

export interface FlowJourneyViewLeg {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  mode: FlowJourneyMode;
  weight: number;
  provenance: FlowJourneyProvenance;
  label: string;
  reason: string;
  relationIds: string[];
  evidenceIds: string[];
  points: CityPoint[];
}

export interface FlowJourneyTokenView {
  id: string;
  legId: string;
  mode: FlowJourneyMode;
  direction: "forward" | "return";
  provenance: FlowJourneyProvenance;
  payloadLabel: string;
  progress: number;
  speed: number;
  delay: number;
  evidenceIds: string[];
}

export interface FlowJourneyView {
  id: string;
  kind: "repository-pipeline" | "dependency-journey";
  title: string;
  summary: string;
  provenance: FlowJourneyProvenance;
  steps: FlowJourneyViewStep[];
  legs: FlowJourneyViewLeg[];
  tokens: FlowJourneyTokenView[];
  evidence: FlowJourneyEvidenceView[];
}

export interface FlowJourneyLayerProps {
  journey: FlowJourneyView;
  plan: LivingCityPlan;
  activeStepIndex: number;
  playing: boolean;
  hiddenDistrictIds: ReadonlySet<string>;
  /** Rejects legacy route fallbacks when a semantic projection is present. */
  strictRouteProjection?: boolean;
}

interface PreparedJourneyLeg {
  definition: FlowJourneyViewLeg;
  points: THREE.Vector3[];
  curve: THREE.CurvePath<THREE.Vector3>;
  feederPoints: THREE.Vector3[][];
  source: PlannedBuilding;
  target: PlannedBuilding;
}

type RenderableFlowToken = Pick<
  FlowJourneyTokenView,
  | "id"
  | "mode"
  | "direction"
  | "progress"
  | "speed"
  | "delay"
  | "evidenceIds"
  | "payloadLabel"
>;

const MODE_COLORS: Record<FlowJourneyMode, string> = {
  pedestrian: "#78f1c7",
  car: "#67c9ff",
  transit: "#b696ff",
  freight: "#ffb35d",
  boat: "#4ce0e7",
};

export function FlowJourneyLayer({
  journey,
  plan,
  activeStepIndex,
  playing,
  hiddenDistrictIds,
  strictRouteProjection = false,
}: FlowJourneyLayerProps) {
  const [selectedLegId, setSelectedLegId] = useState<string | null>(
    null,
  );
  const simulationTimeRef = useRef(0);
  useEffect(() => {
    simulationTimeRef.current = 0;
    const frame = window.requestAnimationFrame(() => {
      setSelectedLegId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeStepIndex, journey.id]);
  useFrame((_, delta) => {
    if (playing) {
      simulationTimeRef.current += Math.min(0.1, delta);
    }
  });
  const buildingByEntityId = useMemo(
    () =>
      new Map(
        plan.buildings.map((building) => [
          building.entityId,
          building,
        ]),
      ),
    [plan],
  );
  const legs = useMemo(
    () =>
      journey.legs.flatMap((leg): PreparedJourneyLeg[] => {
        const source = buildingByEntityId.get(leg.sourceEntityId);
        const target = buildingByEntityId.get(leg.targetEntityId);
        if (
          !source ||
          !target ||
          hiddenDistrictIds.has(source.districtId) ||
          hiddenDistrictIds.has(target.districtId)
        ) {
          return [];
        }
        const route = routePoints(
          plan,
          source,
          target,
          leg.mode,
          leg.points ?? [],
          strictRouteProjection,
        );
        if (!route) return [];
        const points = route.main.map(
          (candidate) =>
            new THREE.Vector3(
              candidate.x,
              routeHeight(
                plan,
                candidate,
                leg.mode,
                strictRouteProjection,
              ),
              candidate.z,
            ),
        );
        return [
          {
            definition: leg,
            points,
            curve: polylineCurve(points),
            feederPoints: route.feeders.map((feeder) =>
              feeder.map(
                (candidate) =>
                  new THREE.Vector3(
                    candidate.x,
                    strictRouteProjection
                      ? 0.34
                      : getRoadSurfaceHeight(
                          plan,
                          candidate.x,
                          candidate.z,
                        ) + 0.1,
                    candidate.z,
                  ),
              ),
            ),
            source,
            target,
          },
        ];
      }),
    [
      buildingByEntityId,
      hiddenDistrictIds,
      journey.legs,
      plan,
      strictRouteProjection,
    ],
  );
  const tokensByLegId = useMemo(() => {
    const result = new Map<string, FlowJourneyTokenView[]>();
    for (const token of journey.tokens ?? []) {
      const tokens = result.get(token.legId) ?? [];
      tokens.push(token);
      result.set(token.legId, tokens);
    }
    return result;
  }, [journey.tokens]);
  const safeActiveStepIndex =
    journey.steps.length === 0
      ? -1
      : Math.max(
          0,
          Math.min(journey.steps.length - 1, activeStepIndex),
        );
  const activeStep = journey.steps[safeActiveStepIndex];
  const stepIndexByEntityId = useMemo(
    () =>
      new Map(
        journey.steps.map((step, index) => [step.entityId, index]),
      ),
    [journey.steps],
  );
  const activeLegIndexes = useMemo(() => {
    if (!activeStep) return new Set<number>();
    const incoming = new Set<number>();
    legs.forEach((leg, index) => {
      if (leg.definition.targetEntityId === activeStep.entityId) {
        incoming.add(index);
      }
    });
    if (incoming.size === 0 && safeActiveStepIndex === 0) {
      legs.forEach((leg, index) => {
        if (leg.definition.sourceEntityId === activeStep.entityId) {
          incoming.add(index);
        }
      });
    }
    return incoming;
  }, [activeStep, legs, safeActiveStepIndex]);
  const activeLeg = legs[[...activeLegIndexes][0] ?? -1];
  const activeBuilding = activeStep
    ? buildingByEntityId.get(activeStep.entityId)
    : undefined;
  const visibleActiveBuilding =
    activeBuilding &&
    !hiddenDistrictIds.has(activeBuilding.districtId)
      ? activeBuilding
      : undefined;

  return (
    <group>
      {legs.map((leg, index) => {
        const active = activeLegIndexes.has(index);
        const inspected = selectedLegId === leg.definition.id;
        const targetStepIndex =
          stepIndexByEntityId.get(leg.definition.targetEntityId) ??
          Number.POSITIVE_INFINITY;
        const completed = targetStepIndex < safeActiveStepIndex;
        const color = MODE_COLORS[leg.definition.mode];
        const densityEmphasis = Math.min(
          2.4,
          Math.log2(Math.max(1, leg.definition.weight) + 1) * 0.65,
        );
        const toggleEvidence = () => {
          setSelectedLegId((current) =>
            current === leg.definition.id
              ? null
              : leg.definition.id,
          );
        };
        return (
          <group key={leg.definition.id}>
            <mesh
              onClick={(event) => {
                event.stopPropagation();
                toggleEvidence();
              }}
            >
              <tubeGeometry
                args={[
                  leg.curve,
                  Math.max(8, leg.points.length * 8),
                  0.4,
                  5,
                  false,
                ]}
              />
              <meshBasicMaterial
                depthWrite={false}
                opacity={0}
                transparent
              />
            </mesh>
            <Line
              color="#061312"
              depthTest={false}
              depthWrite={false}
              lineWidth={
                (active ? 8 : 4.5) + densityEmphasis * (active ? 1.2 : 0.5)
              }
              opacity={active ? 0.72 : 0.32}
              points={leg.points}
              renderOrder={20}
              transparent
            />
            <Line
              color={color}
              dashed={!active && !completed}
              dashScale={2}
              dashSize={0.55}
              depthTest={false}
              depthWrite={false}
              lineWidth={
                (inspected ? 5.1 : active ? 3.7 : completed ? 2 : 1.35) +
                densityEmphasis * (active || inspected ? 0.72 : 0.28)
              }
              onClick={(event) => {
                event.stopPropagation();
                toggleEvidence();
              }}
              opacity={
                inspected ? 1 : active ? 1 : completed ? 0.44 : 0.28
              }
              points={leg.points}
              renderOrder={21}
              transparent
            />
            {inspected ? (
              <RouteEvidenceCard
                evidence={(journey.evidence ?? []).find((candidate) =>
                  leg.definition.evidenceIds.includes(candidate.id),
                )}
                leg={leg}
                onClose={() => setSelectedLegId(null)}
              />
            ) : active ? (
              <RouteEvidenceTrigger
                leg={leg}
                onOpen={toggleEvidence}
              />
            ) : null}
            {leg.feederPoints.map((feeder, feederIndex) => (
              <Line
                color="#ffcf7a"
                dashed
                dashScale={2.4}
                dashSize={0.34}
                depthTest={false}
                depthWrite={false}
                key={`${leg.definition.id}:feeder:${feederIndex}`}
                lineWidth={active ? 2.6 : 1.2}
                opacity={active ? 0.84 : 0.24}
                points={feeder}
                renderOrder={21}
                transparent
              />
            ))}
            {active ? (
              <FlowAgents
                leg={leg}
                simulationTimeRef={simulationTimeRef}
                tokens={tokensByLegId.get(leg.definition.id) ?? []}
              />
            ) : null}
          </group>
        );
      })}

      {journey.steps.map((step, index) => {
        const building = buildingByEntityId.get(step.entityId);
        if (
          !building ||
          hiddenDistrictIds.has(building.districtId)
        ) {
          return null;
        }
        const active = index === safeActiveStepIndex;
        const connectedLeg =
          journey.legs.find(
            (leg) =>
              leg.targetEntityId === step.entityId &&
              stepIndexByEntityId.get(leg.sourceEntityId) === index - 1,
          ) ??
          journey.legs.find(
            (leg) => leg.sourceEntityId === step.entityId,
          );
        return (
          <group key={step.id}>
            {active ? (
              <JourneyLandmark
                active
                building={building}
                color={
                  connectedLeg
                    ? MODE_COLORS[connectedLeg.mode]
                    : MODE_COLORS.pedestrian
                }
                kind={step.facility}
              />
            ) : null}
            <JourneyStop
              active={active}
              building={building}
              color={
                connectedLeg
                  ? MODE_COLORS[connectedLeg.mode]
                  : MODE_COLORS.pedestrian
              }
              index={index}
            />
          </group>
        );
      })}

      {visibleActiveBuilding ? (
        <BuildingFlowCutaway
          building={visibleActiveBuilding}
          color={
            activeLeg
              ? MODE_COLORS[activeLeg.definition.mode]
              : MODE_COLORS.pedestrian
          }
          simulationTimeRef={simulationTimeRef}
          step={activeStep}
        />
      ) : null}
    </group>
  );
}

function RouteEvidenceTrigger({
  leg,
  onOpen,
}: {
  leg: PreparedJourneyLeg;
  onOpen: () => void;
}) {
  const point = leg.curve.getPointAt(0.5);
  return (
    <Html
      center
      distanceFactor={36}
      position={[point.x, point.y + 0.48, point.z]}
      zIndexRange={[31, 0]}
    >
      <button
        aria-label={`查看路线证据：${leg.definition.label}`}
        className="route-evidence-trigger"
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
        type="button"
      >
        EVIDENCE
      </button>
    </Html>
  );
}

function RouteEvidenceCard({
  evidence,
  leg,
  onClose,
}: {
  evidence: FlowJourneyEvidenceView | undefined;
  leg: PreparedJourneyLeg;
  onClose: () => void;
}) {
  const point = leg.curve.getPointAt(0.5);
  return (
    <Html
      center
      distanceFactor={38}
      position={[point.x, point.y + 0.72, point.z]}
      zIndexRange={[32, 0]}
    >
      <div className="route-evidence-card">
        <button
          aria-label="关闭路线证据"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          type="button"
        >
          ×
        </button>
        <span>
          {leg.definition.provenance === "inferred"
            ? "INFERRED RELATION"
            : "STRUCTURAL SIMULATION"}
        </span>
        <strong>{leg.definition.label}</strong>
        <small>
          {evidence?.label ??
            (leg.definition.relationIds.length > 0
              ? `${leg.definition.relationIds.length} 条静态关系`
              : "显式场景规则")}
          {evidence
            ? ` · ${evidence.confidence === "high" ? "高" : "中"}置信度`
            : ""}
        </small>
        <p>{evidence?.reason ?? leg.definition.reason}</p>
      </div>
    </Html>
  );
}

function JourneyStop({
  active,
  building,
  color,
  index,
}: {
  active: boolean;
  building: PlannedBuilding;
  color: string;
  index: number;
}) {
  const y =
    active
      ? BUILDING_BASE_Y +
        getJourneyLandmarkHeight(building) +
        1.1
      : BUILDING_BASE_Y + 0.52;
  return (
    <group position={[building.x, y, building.z]}>
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[active ? 0.62 : 0.32, active ? 0.74 : 0.4, 28]} />
        <meshBasicMaterial
          color={active ? "#fff1a6" : color}
          depthTest={false}
          opacity={active ? 0.96 : 0.5}
          side={THREE.DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      {!active ? (
        <mesh position={[0, -0.26, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.52, 6]} />
          <meshBasicMaterial
            color={color}
            depthTest={false}
            opacity={0.42}
            toneMapped={false}
            transparent
          />
        </mesh>
      ) : null}
      <Html
        center
        distanceFactor={42}
        position={[0, active ? 0.6 : 0.3, 0]}
        style={{ pointerEvents: "none" }}
        zIndexRange={[30, 0]}
      >
        <span
          className={`journey-stop-label ${active ? "is-active" : ""}`}
          aria-hidden="true"
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      </Html>
    </group>
  );
}

function BuildingFlowCutaway({
  building,
  color,
  simulationTimeRef,
  step,
}: {
  building: PlannedBuilding;
  color: string;
  simulationTimeRef: MutableRefObject<number>;
  step: FlowJourneyViewStep;
}) {
  const tokenRef = useRef<THREE.Mesh>(null);
  const hasInternalFacts = step.symbolLabels.length > 0;
  const floorLabels = useMemo(
    () =>
      hasInternalFacts
        ? [
            `${step.payloadLabel} 接入层`,
            ...step.symbolLabels.slice(0, 5),
          ]
        : [],
    [hasInternalFacts, step.payloadLabel, step.symbolLabels],
  );
  const floors = floorLabels.length;
  const height = Math.max(
    1.8,
    Math.min(4.8, 1.15 + floorLabels.length * 0.62),
  );
  const footprintWidth = building.width * 1.08;
  const footprintDepth = building.depth * 1.08;
  const rings = useMemo(
    () =>
      Array.from({ length: floors }, (_, index) => {
        const y =
          BUILDING_BASE_Y + ((index + 1) / (floors + 0.35)) * height;
        return [
          [-footprintWidth / 2, y, -footprintDepth / 2],
          [footprintWidth / 2, y, -footprintDepth / 2],
          [footprintWidth / 2, y, footprintDepth / 2],
          [-footprintWidth / 2, y, footprintDepth / 2],
          [-footprintWidth / 2, y, -footprintDepth / 2],
        ] as [number, number, number][];
      }),
    [floors, footprintDepth, footprintWidth, height],
  );
  useFrame(() => {
    const token = tokenRef.current;
    if (!token) return;
    const simulationTime = simulationTimeRef.current;
    const progress = (simulationTime * 0.22) % 1;
    token.position.y =
      BUILDING_BASE_Y + 0.24 + progress * Math.max(0.4, height - 0.38);
    const pulse = 0.82 + Math.sin(simulationTime * 5.5) * 0.18;
    token.scale.setScalar(pulse);
  });

  if (!hasInternalFacts) {
    return (
      <UnavailableInternalFactsCutaway
        building={building}
        color={color}
      />
    );
  }

  const shaftX =
    building.x +
    (building.frontage.side === "east"
      ? footprintWidth * 0.28
      : building.frontage.side === "west"
        ? -footprintWidth * 0.28
        : 0);
  const shaftZ =
    building.z +
    (building.frontage.side === "south"
      ? footprintDepth * 0.28
      : building.frontage.side === "north"
        ? -footprintDepth * 0.28
        : 0);

  return (
    <group>
      {rings.map((points, index) => (
        <group key={index}>
          <mesh
            position={[
              building.x,
              points[0]![1],
              building.z,
            ]}
            renderOrder={22}
          >
            <boxGeometry
              args={[footprintWidth * 0.92, 0.045, footprintDepth * 0.92]}
            />
            <meshBasicMaterial
              color={color}
              depthTest={false}
              opacity={0.1 + index * 0.012}
              transparent
            />
          </mesh>
          <Line
            color={color}
            depthTest={false}
            depthWrite={false}
            lineWidth={index === rings.length - 1 ? 3.4 : 2}
            opacity={0.52 + index * 0.045}
            points={points.map(([x, y, z]) => [
              x + building.x,
              y,
              z + building.z,
            ])}
            renderOrder={23}
            transparent
          />
          <Html
            center
            distanceFactor={36}
            position={[
              building.x + footprintWidth * 0.7,
              points[0]![1] + 0.08,
              building.z,
            ]}
            style={{ pointerEvents: "none" }}
            zIndexRange={[28, 0]}
          >
            <span className="cutaway-floor-label" aria-hidden="true">
              <i>{String(index + 1).padStart(2, "0")}</i>
              {floorLabels[index]}
            </span>
          </Html>
        </group>
      ))}
      <mesh
        position={[
          building.x - footprintWidth * 0.47,
          BUILDING_BASE_Y + height / 2,
          building.z,
        ]}
        renderOrder={22}
      >
        <boxGeometry args={[0.035, height, footprintDepth * 0.94]} />
        <meshBasicMaterial
          color={color}
          depthTest={false}
          opacity={0.13}
          transparent
        />
      </mesh>
      <mesh
        position={[
          shaftX,
          BUILDING_BASE_Y + height / 2,
          shaftZ,
        ]}
      >
        <cylinderGeometry args={[0.08, 0.08, height, 8]} />
        <meshBasicMaterial
          color={color}
          depthTest={false}
          opacity={0.46}
          transparent
        />
      </mesh>
      <mesh ref={tokenRef} position={[shaftX, BUILDING_BASE_Y + 0.4, shaftZ]}>
        <sphereGeometry args={[0.17, 12, 8]} />
        <meshBasicMaterial color="#fff6c8" depthTest={false} toneMapped={false} />
      </mesh>
      <mesh position={[building.x, BUILDING_BASE_Y + 0.035, building.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[
          Math.max(building.width, building.depth) * 0.7,
          Math.max(building.width, building.depth) * 0.76,
          40,
        ]} />
        <meshBasicMaterial
          color={color}
          depthTest={false}
          opacity={0.5}
          side={THREE.DoubleSide}
          transparent
        />
      </mesh>
    </group>
  );
}

function UnavailableInternalFactsCutaway({
  building,
  color,
}: {
  building: PlannedBuilding;
  color: string;
}) {
  const halfWidth = building.width * 0.54;
  const halfDepth = building.depth * 0.54;
  const outline = [
    [building.x - halfWidth, BUILDING_BASE_Y + 0.08, building.z - halfDepth],
    [building.x + halfWidth, BUILDING_BASE_Y + 0.08, building.z - halfDepth],
    [building.x + halfWidth, BUILDING_BASE_Y + 0.08, building.z + halfDepth],
    [building.x - halfWidth, BUILDING_BASE_Y + 0.08, building.z + halfDepth],
    [building.x - halfWidth, BUILDING_BASE_Y + 0.08, building.z - halfDepth],
  ] as [number, number, number][];

  return (
    <group name="journey-cutaway-unavailable">
      <Line
        color={color}
        dashed
        dashScale={2.2}
        dashSize={0.22}
        depthTest={false}
        depthWrite={false}
        lineWidth={2}
        opacity={0.62}
        points={outline}
        renderOrder={23}
        transparent
      />
      <mesh
        position={[building.x, BUILDING_BASE_Y + 0.035, building.z]}
        rotation-x={-Math.PI / 2}
      >
        <ringGeometry
          args={[
            Math.max(building.width, building.depth) * 0.64,
            Math.max(building.width, building.depth) * 0.72,
            36,
          ]}
        />
        <meshBasicMaterial
          color={color}
          depthTest={false}
          opacity={0.36}
          side={THREE.DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      <Html
        center
        distanceFactor={36}
        position={[
          building.x,
          BUILDING_BASE_Y + 1.18,
          building.z,
        ]}
        style={{ pointerEvents: "none" }}
        zIndexRange={[28, 0]}
      >
        <span className="cutaway-floor-label" aria-hidden="true">
          <i>—</i>
          内部事实未采集 · 未生成内部层级或人流
        </span>
      </Html>
    </group>
  );
}

function FlowAgents({
  leg,
  simulationTimeRef,
  tokens,
}: {
  leg: PreparedJourneyLeg;
  simulationTimeRef: MutableRefObject<number>;
  tokens: readonly FlowJourneyTokenView[];
}) {
  return (
    <group>
      {tokens.map((token, index) => (
        <FlowAgent
          curve={leg.curve}
          key={token.id}
          label={
            leg.definition.mode === "boat"
              ? leg.definition.label
              : token.payloadLabel
          }
          primary={index === 0 || token.direction === "return"}
          simulationTimeRef={simulationTimeRef}
          token={token}
        />
      ))}
    </group>
  );
}

function FlowAgent({
  curve,
  label,
  primary = false,
  simulationTimeRef,
  token,
}: {
  curve: THREE.Curve<THREE.Vector3>;
  label?: string;
  primary?: boolean;
  simulationTimeRef: MutableRefObject<number>;
  token: RenderableFlowToken;
}) {
  const ref = useRef<THREE.Group>(null);
  const color =
    token.direction === "return"
      ? "#ffd36a"
      : MODE_COLORS[token.mode];

  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    const simulationTime = simulationTimeRef.current;
    const progress = sampleFlowTokenProgress(token, simulationTime);
    const point = curve.getPointAt(progress);
    const tangent = curve.getTangentAt(Math.min(0.999, progress));
    group.position.copy(point);
    group.rotation.y =
      Math.atan2(tangent.x, tangent.z) +
      (token.direction === "return" ? Math.PI : 0);
    const bob =
      token.mode === "pedestrian"
        ? Math.abs(
            Math.sin(
              simulationTime * 7 +
                token.delay * 5,
            ),
          ) * 0.035
        : token.mode === "boat"
          ? Math.sin(simulationTime * 2 + token.delay * 3) * 0.035
          : 0;
    group.position.y += bob;
  });

  return (
    <group ref={ref} renderOrder={24}>
      {token.mode === "pedestrian" ? (
        <>
          <mesh position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.06, 0.075, 0.28, 6]} />
            <meshBasicMaterial color={color} depthTest={false} />
          </mesh>
          <mesh position={[0, 0.39, 0]}>
            <sphereGeometry args={[0.09, 8, 6]} />
            <meshBasicMaterial color="#ffe0bd" depthTest={false} />
          </mesh>
        </>
      ) : token.mode === "boat" ? (
        <>
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[1.45, 0.32, 3.2]} />
            <meshStandardMaterial color="#144e59" emissive={color} emissiveIntensity={0.28} />
          </mesh>
          <mesh position={[0, 0.42, 0.38]}>
            <boxGeometry args={[0.86, 0.42, 0.9]} />
            <meshStandardMaterial color="#d9eee8" />
          </mesh>
          <mesh position={[0, 0.45, -0.68]}>
            <boxGeometry args={[0.8, 0.46, 1]} />
            <meshStandardMaterial color="#ff9b52" />
          </mesh>
          <mesh position={[0, 0.03, 2.15]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[1.9, 1.8]} />
            <meshBasicMaterial
              color="#8af7f1"
              depthWrite={false}
              opacity={0.22}
              transparent
            />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 0.12, 0]}>
            <boxGeometry
              args={[
                token.mode === "transit" ? 0.74 : 0.58,
                token.mode === "freight" ? 0.4 : 0.3,
                token.mode === "transit"
                  ? 2.1
                  : token.mode === "freight"
                    ? 1.8
                    : 1.15,
              ]}
            />
            <meshStandardMaterial
              color={token.mode === "freight" ? "#453023" : "#17353e"}
              emissive={color}
              emissiveIntensity={0.3}
              metalness={0.25}
              roughness={0.45}
            />
          </mesh>
          <mesh
            position={[
              0,
              token.mode === "freight" ? 0.34 : 0.27,
              token.mode === "freight" ? 0.42 : 0,
            ]}
          >
            <boxGeometry
              args={[
                token.mode === "transit" ? 0.62 : 0.46,
                0.3,
                token.mode === "transit" ? 1.55 : 0.52,
              ]}
            />
            <meshStandardMaterial
              color={token.mode === "freight" ? "#ffc46d" : "#bde7e4"}
            />
          </mesh>
        </>
      )}
      {primary && token.mode !== "pedestrian" ? (
        <Html
          center
          distanceFactor={32}
          position={[0, token.mode === "boat" ? 1.2 : 0.82, 0]}
          style={{ pointerEvents: "none" }}
          zIndexRange={[27, 0]}
        >
          <span
            className={`flow-agent-label is-${token.direction}`}
            aria-hidden="true"
          >
            {token.direction === "return"
              ? "RESPONSE"
              : label ?? token.payloadLabel}
          </span>
        </Html>
      ) : null}
    </group>
  );
}

function routePoints(
  plan: LivingCityPlan,
  source: PlannedBuilding,
  target: PlannedBuilding,
  mode: FlowJourneyMode,
  plannedPoints: readonly CityPoint[],
  strictProjection: boolean,
): {
  main: CityPoint[];
  feeders: CityPoint[][];
} | null {
  const start = source.frontage.point;
  const end = target.frontage.point;
  if (strictProjection) {
    if (plannedPoints.length < 2) return null;
    const projected = compactRoute(plannedPoints);
    if (mode === "boat") {
      const feeders: CityPoint[][] = [];
      if (pointDistance(start, projected[0]!) > 0.01) {
        feeders.push(compactRoute([start, projected[0]!]));
      }
      if (pointDistance(projected.at(-1)!, end) > 0.01) {
        feeders.push(compactRoute([projected.at(-1)!, end]));
      }
      return { main: projected, feeders };
    }
    return {
      main: compactRoute([start, ...projected, end]),
      feeders: [],
    };
  }
  if (mode === "boat" && plan.geography.river) {
    const riverX = plan.geography.river.x;
    const sourceAnchor = projectRoadAnchor(plan, {
      roadId: source.frontage.roadId,
      point: start,
    });
    const targetAnchor = projectRoadAnchor(plan, {
      roadId: target.frontage.roadId,
      point: end,
    });
    const sourceBank = nearestRiverBankAnchor(plan, source);
    const targetBank = nearestRiverBankAnchor(plan, target);
    if (!sourceAnchor || !targetAnchor || !sourceBank || !targetBank) {
      return null;
    }
    const sourceRoadPath = findRoadPath(plan, sourceAnchor, sourceBank);
    const targetRoadPath = findRoadPath(plan, targetBank, targetAnchor);
    if (!sourceRoadPath || !targetRoadPath) return null;
    const riverStart = { x: riverX, z: sourceBank.point.z };
    const riverEnd = { x: riverX, z: targetBank.point.z };
    const main =
      Math.abs(riverEnd.z - riverStart.z) < 3
        ? [
            riverStart,
            {
              x: riverX,
              z:
                riverEnd.z +
                (riverEnd.z >= plan.bounds.z ? 6 : -6),
            },
            riverEnd,
          ]
        : [riverStart, riverEnd];
    return {
      main: compactRoute(main),
      feeders: [
        compactRoute([start, ...sourceRoadPath, riverStart]),
        compactRoute([riverEnd, ...targetRoadPath, end]),
      ],
    };
  }

  if (mode === "car" || mode === "freight" || mode === "transit") {
    return plannedPoints.length >= 2
      ? {
          main: compactRoute([
            start,
            ...plannedPoints.slice(1, -1),
            end,
          ]),
          feeders: [],
        }
      : null;
  }

  const crossesRiver =
    Boolean(plan.geography.river) &&
    Math.sign(start.x - plan.geography.river!.x) !==
      Math.sign(end.x - plan.geography.river!.x);
  if (crossesRiver && plan.bridges.length > 0) {
    const bridge = [...plan.bridges].sort(
      (left, right) =>
        Math.abs(left.z - (start.z + end.z) / 2) -
        Math.abs(right.z - (start.z + end.z) / 2),
    )[0]!;
    return {
      main: compactRoute([
        start,
        { x: start.x, z: bridge.z },
        { x: end.x, z: bridge.z },
        end,
      ]),
      feeders: [],
    };
  }

  if (plannedPoints.length >= 2) {
    return {
      main: compactRoute([
        start,
        ...plannedPoints.slice(1, -1),
        end,
      ]),
      feeders: [],
    };
  }

  const bend =
    Math.abs(start.x - end.x) >= Math.abs(start.z - end.z)
      ? { x: end.x, z: start.z }
      : { x: start.x, z: end.z };
  return {
    main: compactRoute([start, bend, end]),
    feeders: [],
  };
}

function nearestRiverBankAnchor(
  plan: LivingCityPlan,
  building: PlannedBuilding,
): RoadPathAnchor | null {
  const river = plan.geography.river;
  if (!river) return null;
  const buildingSide = Math.sign(building.x - river.x);
  const roads = plan.roads
    .filter(
      (road) =>
        road.level === "ground" &&
        road.axis === "z" &&
        Math.sign(road.start.x - river.x) === buildingSide,
    )
    .sort(
      (left, right) =>
        Math.abs(left.start.x - river.x) -
          Math.abs(right.start.x - river.x) ||
        left.id.localeCompare(right.id),
    );
  const road = roads[0];
  if (!road) return null;
  const minZ = Math.min(road.start.z, road.end.z);
  const maxZ = Math.max(road.start.z, road.end.z);
  return {
    roadId: road.id,
    point: {
      x: road.start.x,
      z: Math.min(maxZ, Math.max(minZ, building.frontage.point.z)),
    },
  };
}

function polylineCurve(
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

function routeHeight(
  plan: LivingCityPlan,
  point: CityPoint,
  mode: FlowJourneyMode,
  semanticProjection = false,
): number {
  if (semanticProjection) {
    if (mode === "boat") return -0.05;
    if (mode === "pedestrian") return 0.3;
    return 0.34;
  }
  if (mode === "boat") return 0.22;
  if (mode === "pedestrian") return BLOCK_TOP_Y + 0.055;
  return getRoadSurfaceHeight(plan, point.x, point.z) + 0.12;
}

function pointDistance(left: CityPoint, right: CityPoint): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

function compactRoute(points: readonly CityPoint[]): CityPoint[] {
  const result: CityPoint[] = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (
      !previous ||
      Math.abs(previous.x - point.x) > 0.001 ||
      Math.abs(previous.z - point.z) > 0.001
    ) {
      result.push(point);
    }
  }
  if (result.length === 1) {
    result.push({ x: result[0]!.x + 0.01, z: result[0]!.z });
  }
  return result;
}
