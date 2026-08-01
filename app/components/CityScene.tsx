"use client";

import {
  Canvas,
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  Edges,
  ContactShadows,
  Environment,
  Html,
  Lightformer,
  Line,
  OrbitControls,
  Sky,
  Stars,
} from "@react-three/drei";
import {
  type CSSProperties,
  type ComponentRef,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import {
  CITY_ROLE_VISUALS,
  CITY_SCENE_COLORS,
  clampCityValue,
  isRelationVisibleAtCommit,
  normalizeCityRole,
  resolveEntityVisualState,
  stableCityHash,
  type CityDistrictInput,
  type CityEntityFrameState,
  type CityVisualEntity,
  type CityVisualRelation,
  type ResolvedEntityVisualState,
} from "@/app/lib/city-visuals";
import {
  planLivingCity,
  type CityPoint,
  type LivingCityPlan,
  type PlannedBuilding,
} from "@/app/lib/living-city";
import type { SemanticFlowProjection } from "@/app/lib/semantic-flow";
import type { SemanticCityPlan } from "@/app/lib/semantic-city";
import {
  projectUrbanJourneyLeg,
  type UrbanFabricPlan,
} from "@/app/lib/urban-fabric";
import type { VisualCityPlan } from "@/app/lib/visual-city";
import {
  makeAssetReviewCameraPresets,
  planAssetBackedHero,
  type AssetReviewCameraId,
} from "@/app/lib/asset-city";
import {
  getFacilityLabel,
  LivingCityBuildings,
} from "./city/LivingCityBuildings";
import {
  FlowJourneyLayer,
  type FlowJourneyView,
} from "./city/FlowJourneyLayer";
import { LivingCityInfrastructure } from "./city/LivingCityInfrastructure";
import { LivingCityMobility } from "./city/LivingCityMobility";
import { SemanticMetropolis } from "./city/SemanticMetropolis";
import {
  BLOCK_TOP_Y,
  BUILDING_BASE_Y,
  getLivingCityBounds,
  getSunPosition,
  getTimeOfDayPalette,
  type LivingCityRenderBounds,
} from "./city/living-city-render-utils";

export type CitySceneEntity = CityVisualEntity;
export type CitySceneRelation = CityVisualRelation;
export type CitySceneDistrict = CityDistrictInput;
export type CitySceneEntityFrameState = CityEntityFrameState;

const NO_SEMANTIC_MOBILITY = [] as const;

export interface CitySceneProps {
  /** Stable, all-history entities. Planning never uses replay-filtered arrays. */
  entities: readonly CitySceneEntity[];
  relations?: readonly CitySceneRelation[];
  districts?: readonly CitySceneDistrict[];
  /** Reuse a caller-owned deterministic plan when it is already available. */
  cityPlan?: LivingCityPlan;
  /** Component-first L0 projection used by the Flow experience. */
  semanticCityPlan?: SemanticCityPlan;
  /** Road-first spatial projection used by the Flow experience. */
  urbanFabricPlan?: UrbanFabricPlan;
  /** Non-semantic V4.1 hero framing and contextual city projection. */
  visualCityPlan?: VisualCityPlan;
  /** Explicit journey agents projected onto semantic infrastructure. */
  semanticFlowProjection?: SemanticFlowProjection | null;
  commitIndex?: number | null;
  entityFrameStates?: Readonly<Record<string, CitySceneEntityFrameState>>;
  changedEntityIds?: readonly string[] | ReadonlySet<string>;
  selectedEntityId?: string | null;
  defaultSelectedEntityId?: string | null;
  onSelectEntity?: (entityId: string) => void;
  onClearSelection?: () => void;
  onHoverEntity?: (entityId: string | null) => void;
  onFocusEntity?: (entityId: string) => void;
  focusEntityId?: string | null;
  followConstruction?: boolean;
  showDistrictLabels?: boolean;
  showEntityLabel?: boolean;
  /** District filters hide buildings and labels, but preserve city geography. */
  hiddenDistrictIds?: readonly string[] | ReadonlySet<string>;
  /** Replay reducer output. If omitted, all time-visible relations are eligible. */
  activeRelationIds?: readonly string[] | ReadonlySet<string>;
  /** Local solar hour, 0...24. */
  timeOfDay?: number;
  showTraffic?: boolean;
  showPedestrians?: boolean;
  showWaterTraffic?: boolean;
  flowJourney?: FlowJourneyView | null;
  flowFollow?: boolean;
  flowStepIndex?: number;
  flowPlaying?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  emptyState?: ReactNode;
}

interface FocusRequest {
  entityId: string;
  nonce: number;
}

/**
 * A deterministic city-simulation view over repository facts.
 *
 * The plan is derived from complete history data once. Replay and UI filters
 * only alter runtime height, visibility and dependency overlays, so roads,
 * districts, bridges and camera framing never jump between commits.
 */
export function CityScene({
  entities,
  relations = [],
  districts = [],
  cityPlan,
  semanticCityPlan,
  urbanFabricPlan,
  visualCityPlan,
  semanticFlowProjection,
  commitIndex,
  entityFrameStates,
  changedEntityIds = [],
  selectedEntityId: controlledSelectedEntityId,
  defaultSelectedEntityId = null,
  onSelectEntity,
  onClearSelection,
  onHoverEntity,
  onFocusEntity,
  focusEntityId,
  followConstruction = false,
  showDistrictLabels = true,
  showEntityLabel = true,
  hiddenDistrictIds = [],
  activeRelationIds,
  timeOfDay = 14,
  showTraffic = true,
  showPedestrians = true,
  showWaterTraffic = true,
  flowJourney = null,
  flowFollow = false,
  flowStepIndex = 0,
  flowPlaying = false,
  className,
  style,
  ariaLabel = "Interactive 3D repository city",
  emptyState,
}: CitySceneProps) {
  const [localSelectedEntityId, setLocalSelectedEntityId] = useState<
    string | null
  >(defaultSelectedEntityId);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(
    null,
  );
  const hoveredEntityIdRef = useRef<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(
    () =>
      focusEntityId
        ? { entityId: focusEntityId, nonce: 1 }
        : null,
  );
  const selectedEntityId =
    controlledSelectedEntityId === undefined
      ? localSelectedEntityId
      : controlledSelectedEntityId;

  const plan = useMemo(
    () =>
      cityPlan ??
      planLivingCity({
        entities,
        relations,
        districts: districts.map((district) => ({
          id: district.id,
          name: district.name ?? district.label ?? district.id,
          color: district.color,
        })),
      }),
    [cityPlan, districts, entities, relations],
  );
  const bounds = useMemo(
    () =>
      semanticCityPlan && urbanFabricPlan
        ? getSemanticMetropolisBounds(semanticCityPlan, urbanFabricPlan, visualCityPlan)
        : getLivingCityBounds(plan),
    [plan, semanticCityPlan, urbanFabricPlan, visualCityPlan],
  );
  const hiddenDistrictSet = useMemo(
    () => new Set<string>(hiddenDistrictIds),
    [hiddenDistrictIds],
  );
  const activeRelationSet = useMemo(
    () =>
      activeRelationIds === undefined
        ? null
        : new Set<string>(activeRelationIds),
    [activeRelationIds],
  );
  const changedIds = useMemo(() => {
    const result = new Set<string>(changedEntityIds);
    if (entityFrameStates) {
      for (const [entityId, state] of Object.entries(entityFrameStates)) {
        if (state.modified) result.add(entityId);
      }
    }
    return result;
  }, [changedEntityIds, entityFrameStates]);
  const pulseSignature = useMemo(
    () =>
      `${commitIndex ?? "head"}:${[...changedIds].sort().join("\u001f")}`,
    [changedIds, commitIndex],
  );

  const selectEntity = useCallback(
    (entityId: string | null) => {
      if (controlledSelectedEntityId === undefined) {
        setLocalSelectedEntityId(entityId);
      }
      if (entityId) onSelectEntity?.(entityId);
      else onClearSelection?.();
    },
    [controlledSelectedEntityId, onClearSelection, onSelectEntity],
  );
  const hoverEntity = useCallback(
    (entityId: string | null) => {
      if (hoveredEntityIdRef.current === entityId) return;
      hoveredEntityIdRef.current = entityId;
      setHoveredEntityId(entityId);
      onHoverEntity?.(entityId);
    },
    [onHoverEntity],
  );
  const requestFocus = useCallback(
    (entityId: string) => {
      setFocusRequest((current) => ({
        entityId,
        nonce: (current?.nonce ?? 0) + 1,
      }));
      onFocusEntity?.(entityId);
    },
    [onFocusEntity],
  );

  const followFocusRequest = useMemo<FocusRequest | null>(() => {
    if (
      !followConstruction ||
      commitIndex === undefined ||
      commitIndex === null
    ) {
      return null;
    }
    const changedEntity = entities.find((entity) => {
      if (
        !changedIds.has(entity.id) ||
        hiddenDistrictSet.has(entity.districtId)
      ) {
        return false;
      }
      return resolveEntityVisualState(
        entity,
        commitIndex,
        entityFrameStates?.[entity.id],
      ).visible;
    });
    return changedEntity
      ? { entityId: changedEntity.id, nonce: commitIndex + 1 }
      : null;
  }, [
    changedIds,
    commitIndex,
    entities,
    entityFrameStates,
    followConstruction,
    hiddenDistrictSet,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || event.metaKey || event.ctrlKey) {
        return;
      }
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'button, a, input, select, textarea, [role="button"], [contenteditable="true"]',
        )
      ) {
        return;
      }
      if (selectedEntityId) {
        event.preventDefault();
        requestFocus(selectedEntityId);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [requestFocus, selectedEntityId]);

  const initialCameraPosition = useMemo<[number, number, number]>(() => {
    const distance = Math.max(18, bounds.radius * (visualCityPlan ? 0.72 : 1.32));
    if (visualCityPlan) {
      return [
        visualCityPlan.hero.cameraTarget.x - distance * 0.86,
        Math.max(bounds.maxHeight * 0.52, distance * 0.44),
        visualCityPlan.hero.cameraTarget.z + distance * 0.76,
      ];
    }
    return [
      bounds.centerX + distance * 0.78,
      Math.max(bounds.maxHeight * 0.88, distance * 0.64),
      bounds.centerZ + distance * 0.86,
    ];
  }, [bounds, visualCityPlan]);

  return (
    <div
      aria-label={ariaLabel}
      className={className}
      onPointerLeave={() => hoverEntity(null)}
      role="region"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 320,
        overflow: "hidden",
        cursor: hoveredEntityId ? "pointer" : "grab",
        background: getTimeOfDayPalette(timeOfDay).background,
        ...style,
      }}
    >
      <Canvas
        camera={{
          position: initialCameraPosition,
          fov: 42,
          near: 0.1,
          far: Math.max(480, bounds.radius * 18),
        }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = visualCityPlan ? 1.02 : 1.08;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
        onPointerMissed={() => {
          hoverEntity(null);
          selectEntity(null);
        }}
        shadows
      >
        <SceneContents
          activeRelationIds={activeRelationSet}
          bounds={bounds}
          changedEntityIds={changedIds}
          commitIndex={commitIndex}
          emptyState={emptyState}
          entities={entities}
          entityFrameStates={entityFrameStates}
          externalFocusEntityId={focusEntityId}
          followFocusRequest={followFocusRequest}
          flowJourney={flowJourney}
          flowFollow={flowFollow}
          flowPlaying={flowPlaying}
          flowStepIndex={flowStepIndex}
          hiddenDistrictIds={hiddenDistrictSet}
          hoveredEntityId={hoveredEntityId}
          internalFocusRequest={focusRequest}
          onFocusEntity={requestFocus}
          onHoverEntity={hoverEntity}
          onSelectEntity={(entityId) => selectEntity(entityId)}
          plan={plan}
          semanticCityPlan={semanticCityPlan}
          urbanFabricPlan={urbanFabricPlan}
          visualCityPlan={visualCityPlan}
          semanticFlowProjection={semanticFlowProjection}
          pulseSignature={pulseSignature}
          relations={relations}
          selectedEntityId={selectedEntityId ?? null}
          showDistrictLabels={showDistrictLabels}
          showEntityLabel={showEntityLabel}
          showPedestrians={showPedestrians}
          showTraffic={showTraffic}
          showWaterTraffic={showWaterTraffic}
          timeOfDay={timeOfDay}
        />
      </Canvas>
    </div>
  );
}

export default CityScene;

interface SceneContentsProps {
  plan: LivingCityPlan;
  semanticCityPlan?: SemanticCityPlan;
  urbanFabricPlan?: UrbanFabricPlan;
  visualCityPlan?: VisualCityPlan;
  semanticFlowProjection?: SemanticFlowProjection | null;
  bounds: LivingCityRenderBounds;
  entities: readonly CitySceneEntity[];
  relations: readonly CitySceneRelation[];
  commitIndex?: number | null;
  entityFrameStates?: Readonly<Record<string, CitySceneEntityFrameState>>;
  changedEntityIds: ReadonlySet<string>;
  pulseSignature: string;
  selectedEntityId: string | null;
  hoveredEntityId: string | null;
  internalFocusRequest: FocusRequest | null;
  externalFocusEntityId?: string | null;
  followFocusRequest: FocusRequest | null;
  hiddenDistrictIds: ReadonlySet<string>;
  activeRelationIds: ReadonlySet<string> | null;
  showDistrictLabels: boolean;
  showEntityLabel: boolean;
  showTraffic: boolean;
  showPedestrians: boolean;
  showWaterTraffic: boolean;
  flowJourney: FlowJourneyView | null;
  flowFollow: boolean;
  flowStepIndex: number;
  flowPlaying: boolean;
  timeOfDay: number;
  emptyState?: ReactNode;
  onHoverEntity: (entityId: string | null) => void;
  onSelectEntity: (entityId: string) => void;
  onFocusEntity: (entityId: string) => void;
}

interface JourneyCameraFocus {
  key: string;
  points: CityPoint[];
  focusPoint: CityPoint;
}

function getSemanticMetropolisBounds(
  plan: SemanticCityPlan,
  urbanFabric?: UrbanFabricPlan,
  visualCity?: VisualCityPlan,
): LivingCityRenderBounds {
  if (urbanFabric && urbanFabric.blocks.length > 0) {
    const bounds = visualCity?.hero.bounds ?? urbanFabric.bounds;
    const heroIds = new Set(visualCity?.hero.blockIds ?? []);
    const maxHeight = Math.max(
      8,
      ...urbanFabric.architecturalEnvelopes
        .filter((building) => heroIds.size === 0 || heroIds.has(building.blockId))
        .map((building) => building.height),
    );
    const centerX = visualCity?.hero.cameraTarget.x ?? bounds.x;
    const centerZ = visualCity?.hero.cameraTarget.z ?? bounds.z;
    return {
      minX: bounds.minX,
      maxX: bounds.maxX,
      minZ: bounds.minZ,
      maxZ: bounds.maxZ,
      centerX,
      centerZ,
      width: bounds.width,
      depth: bounds.depth,
      maxHeight,
      radius: Math.max(16, Math.hypot(bounds.width, bounds.depth) / 2),
    };
  }
  if (plan.campuses.length === 0) {
    const radius = Math.max(
      12,
      Math.hypot(plan.bounds.width, plan.bounds.depth) / 2,
    );
    return {
      minX: plan.bounds.minX,
      maxX: plan.bounds.maxX,
      minZ: plan.bounds.minZ,
      maxZ: plan.bounds.maxZ,
      centerX: plan.bounds.x,
      centerZ: plan.bounds.z,
      width: plan.bounds.width,
      depth: plan.bounds.depth,
      maxHeight: 8,
      radius,
    };
  }

  const margin = 7;
  const xValues = plan.campuses.flatMap((campus) => [
    campus.x - campus.width * 0.72,
    campus.x + campus.width * 0.72,
  ]);
  const zValues = plan.campuses.flatMap((campus) => [
    campus.z - campus.depth * 0.72,
    campus.z + campus.depth * 0.72,
  ]);
  for (const corridor of plan.corridors) {
    for (const point of corridor.points) {
      xValues.push(point.x);
      zValues.push(point.z);
    }
  }
  const minX = Math.min(...xValues) - margin;
  const maxX = Math.max(...xValues) + margin;
  const minZ = Math.min(...zValues) - margin;
  const maxZ = Math.max(...zValues) + margin;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    width,
    depth,
    maxHeight: Math.max(
      8,
      ...plan.campuses.map((campus) => campus.height),
    ),
    radius: Math.max(16, Math.hypot(width, depth) / 2),
  };
}

function SceneContents({
  plan,
  semanticCityPlan,
  urbanFabricPlan,
  visualCityPlan,
  semanticFlowProjection,
  bounds,
  entities,
  relations,
  commitIndex,
  entityFrameStates,
  changedEntityIds,
  pulseSignature,
  selectedEntityId,
  hoveredEntityId,
  internalFocusRequest,
  externalFocusEntityId,
  followFocusRequest,
  hiddenDistrictIds,
  activeRelationIds,
  showDistrictLabels,
  showEntityLabel,
  showTraffic,
  showPedestrians,
  showWaterTraffic,
  flowJourney,
  flowFollow,
  flowStepIndex,
  flowPlaying,
  timeOfDay,
  emptyState,
  onHoverEntity,
  onSelectEntity,
  onFocusEntity,
}: SceneContentsProps) {
  const palette = useMemo(
    () => getTimeOfDayPalette(timeOfDay),
    [timeOfDay],
  );
  const sunPosition = useMemo(
    () => getSunPosition(timeOfDay, bounds),
    [bounds, timeOfDay],
  );
  const entityById = useMemo(
    () => new Map(entities.map((entity) => [entity.id, entity])),
    [entities],
  );
  const journeyPlan = useMemo<LivingCityPlan>(() => {
    if (!flowJourney || !semanticCityPlan) return plan;
    const urbanBuildingById = new Map(
      urbanFabricPlan?.buildings.map((building) => [building.id, building]) ??
        [],
    );
    const slotByEntityId = new Map(
      semanticCityPlan.campuses.flatMap((campus) =>
        campus.fileSlots.map(
          (slot) => [slot.entityId, slot] as const,
        ),
      ),
    );
    return {
      ...plan,
      // Semantic water is rendered from typed boundaries. The Flow layer must
      // not fall back to the legacy decorative river heuristic.
      geography: { river: null },
      buildings: plan.buildings.map((building) => {
        const urbanAddress =
          urbanFabricPlan?.entityAddresses[building.entityId];
        const address =
          urbanAddress ?? semanticCityPlan.entityAddresses[building.entityId];
        const slot = slotByEntityId.get(building.entityId);
        const urbanBuilding = urbanAddress
          ? urbanBuildingById.get(urbanAddress.buildingId)
          : undefined;
        if (!address || (!slot && !urbanBuilding)) return building;
        return {
          ...building,
          x: address.worldPoint.x,
          z: address.worldPoint.z,
          width: urbanBuilding
            ? Math.max(1.4, Math.min(3.4, urbanBuilding.width * 0.42))
            : Math.max(1.2, Math.min(3.2, slot!.width * 2.6)),
          depth: urbanBuilding
            ? Math.max(1.4, Math.min(3.4, urbanBuilding.depth * 0.42))
            : Math.max(1.2, Math.min(3.2, slot!.depth * 2.6)),
          frontage: {
            ...building.frontage,
            point: {
              ...(urbanAddress?.entrance ?? address.worldPoint),
            },
          },
        };
      }),
    };
  }, [flowJourney, plan, semanticCityPlan, urbanFabricPlan]);
  const projectedFlowJourney = useMemo<FlowJourneyView | null>(() => {
    if (!flowJourney || !semanticFlowProjection) return flowJourney;
    return {
      ...flowJourney,
      legs: flowJourney.legs.map((leg) => ({
        ...leg,
        points: urbanFabricPlan
          ? projectUrbanJourneyLeg(
              urbanFabricPlan,
              leg.sourceEntityId,
              leg.targetEntityId,
              leg.mode,
              semanticFlowProjection.legPoints[leg.id] ?? [],
            )
          : [...(semanticFlowProjection.legPoints[leg.id] ?? [])],
      })),
    };
  }, [flowJourney, semanticFlowProjection, urbanFabricPlan]);
  const buildingByEntityId = useMemo(
    () =>
      new Map(
        journeyPlan.buildings.map((building) => [
          building.entityId,
          building,
        ]),
      ),
    [journeyPlan],
  );
  const activeFlowEntityIds = useMemo(() => {
    if (!flowJourney || flowJourney.steps.length === 0) return null;
    const safeIndex = Math.max(
      0,
      Math.min(flowJourney.steps.length - 1, flowStepIndex),
    );
    return new Set([flowJourney.steps[safeIndex]!.entityId]);
  }, [flowJourney, flowStepIndex]);
  const flowComponentIds = useMemo(() => {
    if (!semanticCityPlan || !flowJourney) return null;
    const ids = new Set<string>();
    for (const entityId of [
      selectedEntityId,
      hoveredEntityId,
    ]) {
      if (!entityId) continue;
      const componentId =
        urbanFabricPlan?.entityAddresses[entityId]?.componentId ??
        semanticCityPlan.entityAddresses[entityId]?.componentId;
      if (componentId) ids.add(componentId);
    }
    return ids;
  }, [
    flowJourney,
    hoveredEntityId,
    selectedEntityId,
    semanticCityPlan,
    urbanFabricPlan,
  ]);
  const journeyCameraFocus = useMemo<JourneyCameraFocus | null>(() => {
    if (
      !projectedFlowJourney ||
      !flowFollow ||
      projectedFlowJourney.steps.length === 0
    ) {
      return null;
    }
    const safeStepIndex = Math.max(
      0,
      Math.min(projectedFlowJourney.steps.length - 1, flowStepIndex),
    );
    const activeStep = projectedFlowJourney.steps[safeStepIndex]!;
    let activeLegs = projectedFlowJourney.legs.filter(
      (leg) => leg.targetEntityId === activeStep.entityId,
    );
    if (activeLegs.length === 0 && safeStepIndex === 0) {
      activeLegs = projectedFlowJourney.legs.filter(
        (leg) => leg.sourceEntityId === activeStep.entityId,
      );
    }
    const points: CityPoint[] = [];
    const legIds: string[] = [];
    for (const leg of activeLegs) {
      const source = buildingByEntityId.get(leg.sourceEntityId);
      const target = buildingByEntityId.get(leg.targetEntityId);
      if (
        !source ||
        !target ||
        hiddenDistrictIds.has(source.districtId) ||
        hiddenDistrictIds.has(target.districtId)
      ) {
        continue;
      }
      legIds.push(leg.id);
      points.push(
        { x: source.x, z: source.z },
        ...leg.points.map((point) => ({ x: point.x, z: point.z })),
        { x: target.x, z: target.z },
      );
    }
    if (points.length === 0) {
      const building = buildingByEntityId.get(activeStep.entityId);
      if (!building || hiddenDistrictIds.has(building.districtId)) {
        return null;
      }
      points.push({ x: building.x, z: building.z });
    }
    return {
      key: `${projectedFlowJourney.id}:${safeStepIndex}:${legIds.sort().join(",")}`,
      points,
      focusPoint: {
        x: buildingByEntityId.get(activeStep.entityId)?.x ?? points[0]!.x,
        z: buildingByEntityId.get(activeStep.entityId)?.z ?? points[0]!.z,
      },
    };
  }, [
    buildingByEntityId,
    flowFollow,
    flowStepIndex,
    hiddenDistrictIds,
    projectedFlowJourney,
  ]);
  const visualStates = useMemo(() => {
    const states = new Map<string, ResolvedEntityVisualState>();
    for (const entity of entities) {
      states.set(
        entity.id,
        resolveEntityVisualState(
          entity,
          commitIndex,
          entityFrameStates?.[entity.id],
        ),
      );
    }
    return states;
  }, [commitIndex, entities, entityFrameStates]);

  const isRenderable = useCallback(
    (entityId: string) => {
      const building = buildingByEntityId.get(entityId);
      return Boolean(
        building &&
          visualStates.get(entityId)?.visible &&
          !hiddenDistrictIds.has(building.districtId),
      );
    },
    [buildingByEntityId, hiddenDistrictIds, visualStates],
  );
  const targetHeight = useCallback(
    (entityId: string) => {
      const building = buildingByEntityId.get(entityId);
      const state = visualStates.get(entityId);
      return building && state && isRenderable(entityId)
        ? building.height * state.heightRatio
        : 0;
    },
    [buildingByEntityId, isRenderable, visualStates],
  );

  const labelEntity = useMemo(() => {
    if (hoveredEntityId && isRenderable(hoveredEntityId)) {
      return entityById.get(hoveredEntityId);
    }
    if (selectedEntityId && isRenderable(selectedEntityId)) {
      return entityById.get(selectedEntityId);
    }
    return undefined;
  }, [
    entityById,
    hoveredEntityId,
    isRenderable,
    selectedEntityId,
  ]);
  const selectedBuilding =
    selectedEntityId && isRenderable(selectedEntityId)
      ? buildingByEntityId.get(selectedEntityId)
      : undefined;
  const hoveredBuilding =
    hoveredEntityId &&
    hoveredEntityId !== selectedEntityId &&
    isRenderable(hoveredEntityId)
      ? buildingByEntityId.get(hoveredEntityId)
      : undefined;

  const fogNear = visualCityPlan
    ? Math.max(150, bounds.radius * 5.5)
    : Math.max(35, bounds.radius * 1.65);
  const fogFar = visualCityPlan
    ? Math.max(360, bounds.radius * 11)
    : Math.max(110, bounds.radius * 5.2);

  return (
    <>
      <color attach="background" args={[visualCityPlan ? "#b9c5c8" : palette.background]} />
      <fog attach="fog" args={[visualCityPlan ? "#aebabc" : palette.fog, fogNear, fogFar]} />
      {palette.daylight > 0.14 ? (
        <Sky
          distance={Math.max(450, bounds.radius * 8)}
          mieCoefficient={0.0028}
          mieDirectionalG={0.72}
          rayleigh={3.1 - palette.sunset * 0.8}
          sunPosition={sunPosition}
          turbidity={3.4 + palette.sunset * 3.2}
        />
      ) : (
        <Stars
          count={1500}
          depth={40}
          factor={3}
          fade
          radius={Math.max(80, bounds.radius * 2.5)}
          saturation={0.2}
          speed={0.1}
        />
      )}
      {visualCityPlan ? (
        <Environment resolution={128}>
          <Lightformer
            color="#e7ece8"
            intensity={1.25}
            position={[-18, 24, 12]}
            rotation-x={-Math.PI / 2.6}
            scale={[24, 18, 1]}
          />
          <Lightformer
            color="#edcaa5"
            intensity={0.72}
            position={[22, 10, -16]}
            rotation-y={Math.PI / 2.8}
            scale={[14, 8, 1]}
          />
          <Lightformer
            color="#879fa8"
            intensity={0.4}
            position={[0, 6, 24]}
            scale={[18, 5, 1]}
          />
        </Environment>
      ) : null}
      <hemisphereLight
        args={[
          visualCityPlan ? "#d9e1df" : palette.ambient,
          visualCityPlan ? "#69645c" : "#07100f",
          0.42 + palette.daylight * 1.05,
        ]}
        position={[0, bounds.maxHeight + 12, 0]}
      />
      <ambientLight
        color={visualCityPlan ? "#c9cfca" : palette.ambient}
        intensity={0.12 + palette.daylight * 0.32}
      />
      <directionalLight
        castShadow
        color={visualCityPlan ? "#fff0d8" : palette.sun}
        intensity={0.18 + palette.daylight * 2.35}
        position={sunPosition}
        shadow-bias={-0.00028}
        shadow-camera-bottom={-bounds.radius * 1.15}
        shadow-camera-far={Math.max(90, bounds.radius * 4)}
        shadow-camera-left={-bounds.radius * 1.15}
        shadow-camera-right={bounds.radius * 1.15}
        shadow-camera-top={bounds.radius * 1.15}
        shadow-mapSize-height={1024}
        shadow-mapSize-width={1024}
      />
      {palette.night > 0.35 ? (
        <pointLight
          color="#739bb9"
          decay={1.5}
          distance={bounds.radius * 2.2}
          intensity={palette.night * 1.2}
          position={[
            bounds.centerX,
            bounds.maxHeight + 10,
            bounds.centerZ,
          ]}
        />
      ) : null}
      {visualCityPlan ? (
        <ContactShadows
          blur={2.4}
          far={28}
          frames={1}
          opacity={0.24}
          position={[
            visualCityPlan.hero.cameraTarget.x,
            0.245,
            visualCityPlan.hero.cameraTarget.z,
          ]}
          resolution={512}
          scale={Math.max(70, bounds.radius * 2.2)}
        />
      ) : null}

      {semanticCityPlan && urbanFabricPlan ? (
        <SemanticMetropolis
          activeComponentIds={flowComponentIds}
          // FlowJourneyLayer is the single renderer for scenario tokens.
          // Keeping the metropolis fleet empty prevents the same observed
          // token cohort from becoming an unexplained ambient population.
          mobilityRoutes={NO_SEMANTIC_MOBILITY}
          plan={semanticCityPlan}
          urbanFabric={urbanFabricPlan}
          visualCity={visualCityPlan}
          onHoverEntity={onHoverEntity}
          onSelectEntity={onSelectEntity}
          playing={flowPlaying}
          // Only the currently inspected cutaway owns physical space. Other
          // journey stops remain lightweight semantic beacons, so a ten-step
          // tour cannot hollow ten unrelated holes out of the metropolis.
          reservedEntityIds={activeFlowEntityIds ?? undefined}
          selectedEntityId={selectedEntityId}
          showPedestrians
          showTraffic
          showWaterTraffic
          timeOfDay={timeOfDay}
        />
      ) : (
        <>
          <LivingCityInfrastructure
            hiddenDistrictIds={hiddenDistrictIds}
            palette={palette}
            plan={plan}
            showDistrictLabels={showDistrictLabels}
          />
          <LivingCityBuildings
            changedEntityIds={changedEntityIds}
            commitIndex={commitIndex}
            entityById={entityById}
            hiddenDistrictIds={hiddenDistrictIds}
            hoveredEntityId={hoveredEntityId}
            onFocusEntity={onFocusEntity}
            onHoverEntity={onHoverEntity}
            onSelectEntity={onSelectEntity}
            palette={palette}
            plan={plan}
            pulseSignature={pulseSignature}
            selectedEntityId={selectedEntityId}
            visualStates={visualStates}
          />
          <LivingCityMobility
            palette={palette}
            plan={plan}
            showPedestrians={showPedestrians}
            showTraffic={showTraffic}
            showWaterTraffic={showWaterTraffic}
          />
        </>
      )}
      {flowJourney ? (
        <FlowJourneyLayer
          activeStepIndex={flowStepIndex}
          hiddenDistrictIds={hiddenDistrictIds}
          journey={projectedFlowJourney ?? flowJourney}
          plan={journeyPlan}
          playing={flowPlaying}
          strictRouteProjection={Boolean(semanticFlowProjection)}
        />
      ) : null}

      {!flowJourney && !(semanticCityPlan && urbanFabricPlan) ? (
        <DependencyLines
          activeRelationIds={activeRelationIds}
          buildingByEntityId={buildingByEntityId}
          commitIndex={commitIndex}
          isRenderable={isRenderable}
          relations={relations}
          selectedEntityId={selectedEntityId}
          targetHeight={targetHeight}
        />
      ) : null}

      {!flowJourney && !(semanticCityPlan && urbanFabricPlan) && selectedBuilding ? (
        <BuildingMarker
          building={selectedBuilding}
          color={CITY_SCENE_COLORS.selection}
          height={targetHeight(selectedBuilding.entityId)}
          kind="selected"
        />
      ) : null}
      {!flowJourney && !(semanticCityPlan && urbanFabricPlan) && hoveredBuilding ? (
        <BuildingMarker
          building={hoveredBuilding}
          color={CITY_SCENE_COLORS.hover}
          height={targetHeight(hoveredBuilding.entityId)}
          kind="hover"
        />
      ) : null}

      {!flowJourney && !(semanticCityPlan && urbanFabricPlan) && showEntityLabel && labelEntity ? (
        <EntityLabel
          building={buildingByEntityId.get(labelEntity.id)!}
          entity={labelEntity}
          height={targetHeight(labelEntity.id)}
          selected={labelEntity.id === selectedEntityId}
        />
      ) : null}

      {entities.length === 0 ? (
        <Html center position={[bounds.centerX, 2, bounds.centerZ]}>
          {emptyState ?? <DefaultEmptyState />}
        </Html>
      ) : null}

      <CameraRig
        bounds={bounds}
        buildingByEntityId={buildingByEntityId}
        cityKey={`${semanticCityPlan?.seed ?? plan.seed}:${journeyPlan.buildings.length}`}
        externalFocusEntityId={externalFocusEntityId}
        followFocusRequest={followFocusRequest}
        internalFocusRequest={internalFocusRequest}
        isRenderable={isRenderable}
        journeyFocus={journeyCameraFocus}
        journeyActive={flowJourney !== null}
        targetHeight={targetHeight}
        urbanFabric={urbanFabricPlan}
        visualCity={visualCityPlan}
      />
    </>
  );
}

function DependencyLines({
  selectedEntityId,
  relations,
  buildingByEntityId,
  commitIndex,
  activeRelationIds,
  isRenderable,
  targetHeight,
}: {
  selectedEntityId: string | null;
  relations: readonly CitySceneRelation[];
  buildingByEntityId: ReadonlyMap<string, PlannedBuilding>;
  commitIndex?: number | null;
  activeRelationIds: ReadonlySet<string> | null;
  isRenderable: (entityId: string) => boolean;
  targetHeight: (entityId: string) => number;
}) {
  const visibleRelations = useMemo(() => {
    if (!selectedEntityId) return [];
    return relations.filter((relation) => {
      if (
        relation.sourceId !== selectedEntityId &&
        relation.targetId !== selectedEntityId
      ) {
        return false;
      }
      if (
        activeRelationIds &&
        !activeRelationIds.has(relation.id)
      ) {
        return false;
      }
      return (
        isRelationVisibleAtCommit(relation, commitIndex) &&
        isRenderable(relation.sourceId) &&
        isRenderable(relation.targetId)
      );
    });
  }, [
    activeRelationIds,
    commitIndex,
    isRenderable,
    relations,
    selectedEntityId,
  ]);

  return (
    <group>
      {visibleRelations.map((relation) => {
        const source = buildingByEntityId.get(relation.sourceId);
        const target = buildingByEntityId.get(relation.targetId);
        if (!source || !target) return null;
        const outgoing = relation.sourceId === selectedEntityId;
        return (
          <Line
            key={relation.id}
            color={
              outgoing
                ? CITY_SCENE_COLORS.dependencyOut
                : CITY_SCENE_COLORS.dependencyIn
            }
            depthWrite={false}
            lineWidth={clampCityValue(
              1.15 + relation.weight * 0.42,
              1.15,
              3.6,
            )}
            opacity={0.86}
            points={dependencyArcPoints(
              source,
              target,
              targetHeight(source.entityId),
              targetHeight(target.entityId),
            )}
            transparent
          />
        );
      })}
    </group>
  );
}

function dependencyArcPoints(
  source: PlannedBuilding,
  target: PlannedBuilding,
  sourceHeight: number,
  targetHeight: number,
): [number, number, number][] {
  const start = new THREE.Vector3(
    source.x,
    BUILDING_BASE_Y + Math.max(0.42, sourceHeight * 0.78),
    source.z,
  );
  const end = new THREE.Vector3(
    target.x,
    BUILDING_BASE_Y + Math.max(0.42, targetHeight * 0.78),
    target.z,
  );
  const distance = start.distanceTo(end);
  const control = start
    .clone()
    .lerp(end, 0.5)
    .add(new THREE.Vector3(0, Math.max(1.1, distance * 0.2), 0));
  const points: [number, number, number][] = [];
  for (let step = 0; step <= 14; step += 1) {
    const time = step / 14;
    const inverse = 1 - time;
    points.push([
      inverse * inverse * start.x +
        2 * inverse * time * control.x +
        time * time * end.x,
      inverse * inverse * start.y +
        2 * inverse * time * control.y +
        time * time * end.y,
      inverse * inverse * start.z +
        2 * inverse * time * control.z +
        time * time * end.z,
    ]);
  }
  return points;
}

function BuildingMarker({
  building,
  height,
  color,
  kind,
}: {
  building: PlannedBuilding;
  height: number;
  color: string;
  kind: "selected" | "hover";
}) {
  const groupRef = useRef<THREE.Group>(null);
  const phase = (stableCityHash(building.entityId) % 19) * 0.23;
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const pulse =
      kind === "selected"
        ? 1 + Math.sin(clock.elapsedTime * 2.8 + phase) * 0.026
        : 1;
    groupRef.current.scale.setScalar(pulse);
  });

  const markerHeight = Math.max(0.18, height);
  return (
    <group
      ref={groupRef}
      position={[
        building.x,
        BUILDING_BASE_Y + markerHeight / 2,
        building.z,
      ]}
    >
      <mesh
        scale={[
          building.width * 1.08,
          markerHeight + 0.12,
          building.depth * 1.08,
        ]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={color}
          depthWrite={false}
          opacity={0}
          transparent
        />
        <Edges color={color} />
      </mesh>
      {kind === "selected" ? (
        <mesh
          position={[0, -markerHeight / 2 + 0.018, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry
            args={[
              Math.max(building.width, building.depth) * 0.62,
              Math.max(building.width, building.depth) * 0.72,
              32,
            ]}
          />
          <meshBasicMaterial
            color={color}
            depthWrite={false}
            opacity={0.72}
            side={THREE.DoubleSide}
            transparent
          />
        </mesh>
      ) : null}
    </group>
  );
}

function EntityLabel({
  entity,
  building,
  height,
  selected,
}: {
  entity: CitySceneEntity;
  building: PlannedBuilding;
  height: number;
  selected: boolean;
}) {
  const role = CITY_ROLE_VISUALS[normalizeCityRole(entity.role)];
  const facility = getFacilityLabel(building.facility);
  return (
    <Html
      center
      position={[
        building.x,
        BUILDING_BASE_Y + height + 0.78,
        building.z,
      ]}
      zIndexRange={[50, 21]}
    >
      <div
        style={{
          minWidth: 165,
          maxWidth: 270,
          padding: "9px 11px",
          border: `1px solid ${
            selected
              ? "rgba(246, 228, 168, .7)"
              : "rgba(184, 220, 211, .3)"
          }`,
          borderRadius: 9,
          color: "#e8f2ee",
          background: "rgba(5, 15, 19, .94)",
          boxShadow: "0 12px 32px rgba(0, 0, 0, .42)",
          fontFamily:
            "var(--font-geist-sans), system-ui, sans-serif",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 7,
              height: 7,
              flex: "0 0 auto",
              borderRadius: 999,
              background: role.accent,
              boxShadow: `0 0 10px ${role.accent}`,
            }}
          />
          <strong
            style={{
              overflow: "hidden",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1.2,
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entity.name}
          </strong>
          {facility ? (
            <span
              style={{
                marginLeft: "auto",
                color: "#86cfc1",
                fontFamily:
                  "var(--font-geist-mono), ui-monospace, monospace",
                fontSize: 7,
                fontWeight: 800,
                letterSpacing: ".08em",
                whiteSpace: "nowrap",
              }}
            >
              {facility}
            </span>
          ) : null}
        </div>
        <div
          style={{
            overflow: "hidden",
            color: "#87a49e",
            fontFamily:
              "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: 9,
            lineHeight: 1.35,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entity.path}
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 6,
            color: "#9db0aa",
            fontFamily:
              "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: 8,
          }}
        >
          <span>{building.floors} FLOORS</span>
          <span>{building.archetype.replaceAll("-", " ").toUpperCase()}</span>
        </div>
        {entity.summary ? (
          <div
            style={{
              display: "-webkit-box",
              marginTop: 6,
              overflow: "hidden",
              color: "#b7c9c4",
              fontSize: 10,
              lineHeight: 1.4,
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
            }}
          >
            {entity.summary}
          </div>
        ) : null}
      </div>
    </Html>
  );
}

function CameraRig({
  bounds,
  cityKey,
  internalFocusRequest,
  externalFocusEntityId,
  followFocusRequest,
  buildingByEntityId,
  isRenderable,
  journeyFocus,
  journeyActive,
  targetHeight,
  urbanFabric,
  visualCity,
}: {
  bounds: LivingCityRenderBounds;
  cityKey: string;
  internalFocusRequest: FocusRequest | null;
  externalFocusEntityId?: string | null;
  followFocusRequest: FocusRequest | null;
  buildingByEntityId: ReadonlyMap<string, PlannedBuilding>;
  isRenderable: (entityId: string) => boolean;
  journeyFocus: JourneyCameraFocus | null;
  journeyActive: boolean;
  targetHeight: (entityId: string) => number;
  urbanFabric?: UrbanFabricPlan;
  visualCity?: VisualCityPlan;
}) {
  const { camera } = useThree();
  const cameraAspect =
    camera instanceof THREE.PerspectiveCamera ? camera.aspect : 1;
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const focusingRef = useRef(false);
  const desiredPosition = useRef(new THREE.Vector3());
  const desiredTarget = useRef(new THREE.Vector3());
  const lastCityKey = useRef<string | null>(null);
  const assetHero = useMemo(
    () => urbanFabric && visualCity ? planAssetBackedHero(urbanFabric, visualCity) : null,
    [urbanFabric, visualCity],
  );
  const reviewPresets = useMemo(
    () => assetHero && visualCity ? makeAssetReviewCameraPresets(assetHero, visualCity) : [],
    [assetHero, visualCity],
  );
  const applyVisualBookmark = useCallback(
    (bookmark: AssetReviewCameraId) => {
      if (!visualCity || !controlsRef.current || !(camera instanceof THREE.PerspectiveCamera)) return;
      const preset = reviewPresets.find((candidate) => candidate.id === bookmark);
      if (!preset) return;
      camera.position.fromArray(preset.position);
      controlsRef.current.target.fromArray(preset.target);
      controlsRef.current.update();
      focusingRef.current = false;
    },
    [camera, reviewPresets, visualCity],
  );

  useLayoutEffect(() => {
    if (lastCityKey.current === cityKey) return;
    lastCityKey.current = cityKey;
    const distance = Math.max(18, bounds.radius * (visualCity ? 0.72 : 1.32));
    const target = new THREE.Vector3(
      visualCity?.hero.cameraTarget.x ?? bounds.centerX,
      visualCity?.hero.cameraTarget.y ?? Math.min(bounds.maxHeight * 0.18, distance * 0.1),
      visualCity?.hero.cameraTarget.z ?? bounds.centerZ,
    );
    if (visualCity && reviewPresets.length > 0) {
      const preset = reviewPresets.find((candidate) => candidate.id === "urban-composition") ?? reviewPresets[0]!;
      camera.position.fromArray(preset.position);
      target.fromArray(preset.target);
    } else {
      camera.position.set(
        bounds.centerX + distance * 0.78,
        Math.max(bounds.maxHeight * 0.88, distance * 0.64),
        bounds.centerZ + distance * 0.86,
      );
    }
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }
    focusingRef.current = false;
  }, [bounds, camera, cityKey, reviewPresets, visualCity]);

  const beginFocus = useCallback(
    (
      entityId: string,
      framing: "building" | "district" | "journey" = "building",
    ) => {
      const building = buildingByEntityId.get(entityId);
      if (!building || !isRenderable(entityId)) return;
      const focusHeight =
        framing === "journey"
          ? Math.max(3.2, Math.min(5.2, targetHeight(entityId)))
          : Math.max(0.5, targetHeight(entityId));
      const target = new THREE.Vector3(
        building.x,
        BUILDING_BASE_Y + focusHeight * 0.4,
        building.z,
      );
      const focusSize = Math.max(
        building.width,
        building.depth,
        focusHeight * 0.7,
      );
      const distance =
        framing === "district"
          ? clampCityValue(bounds.radius * 0.48, 15, 38)
          : framing === "journey"
            ? clampCityValue(bounds.radius * 0.4, 24, 46)
          : clampCityValue(focusSize * 4.5, 8, 30);
      const currentTarget =
        controlsRef.current?.target ??
        new THREE.Vector3(bounds.centerX, 0, bounds.centerZ);
      const direction = new THREE.Vector2(
        camera.position.x - currentTarget.x,
        camera.position.z - currentTarget.z,
      );
      if (direction.lengthSq() < 0.001) direction.set(1, 1);
      direction.normalize();

      desiredTarget.current.copy(target);
      desiredPosition.current.set(
        target.x + direction.x * distance * 0.78,
        target.y + distance * 0.66,
        target.z + direction.y * distance * 0.78,
      );
      focusingRef.current = true;
    },
    [
      bounds.centerX,
      bounds.centerZ,
      bounds.radius,
      buildingByEntityId,
      camera,
      isRenderable,
      targetHeight,
    ],
  );
  const beginFocusBounds = useCallback(
    (focus: JourneyCameraFocus) => {
      if (focus.points.length === 0) return;
      const xs = focus.points.map((point) => point.x);
      const zs = focus.points.map((point) => point.z);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minZ = Math.min(...zs);
      const maxZ = Math.max(...zs);
      const target = new THREE.Vector3(
        (minX + maxX) * 0.05 + focus.focusPoint.x * 0.9,
        BLOCK_TOP_Y + 1.5,
        (minZ + maxZ) * 0.05 + focus.focusPoint.z * 0.9,
      );
      const span = Math.max(maxX - minX, maxZ - minZ, 10);
      const aspect = Math.max(0.62, Math.min(1, cameraAspect));
      const distance = clampCityValue(
        (span * 1.55) / Math.sqrt(aspect) + 10,
        26,
        72,
      );
      const direction = new THREE.Vector2(
        target.x - bounds.centerX,
        target.z - bounds.centerZ,
      );
      if (direction.lengthSq() < 0.001) direction.set(0.72, 0.69);
      direction.normalize();

      desiredTarget.current.copy(target);
      desiredPosition.current.set(
        target.x + direction.x * distance * 0.78,
        target.y + distance * 0.66,
        target.z + direction.y * distance * 0.78,
      );
      focusingRef.current = true;
    },
    [bounds.centerX, bounds.centerZ, cameraAspect],
  );

  useEffect(() => {
    if (followFocusRequest) {
      beginFocus(followFocusRequest.entityId, "district");
    }
  }, [beginFocus, followFocusRequest]);
  useEffect(() => {
    if (externalFocusEntityId) {
      beginFocus(
        externalFocusEntityId,
        journeyActive ? "journey" : "building",
      );
    }
  }, [beginFocus, externalFocusEntityId, journeyActive]);
  useEffect(() => {
    if (internalFocusRequest) beginFocus(internalFocusRequest.entityId);
  }, [beginFocus, internalFocusRequest]);
  useEffect(() => {
    if (journeyFocus) {
      beginFocusBounds(journeyFocus);
    } else if (journeyActive) {
      focusingRef.current = false;
    }
  }, [beginFocusBounds, journeyActive, journeyFocus]);
  useEffect(() => {
    if (!visualCity) return;
    const handleBookmark = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']")) return;
      const bookmark = ({
        "1": "street-corner",
        "2": "storefront-street",
        "3": "river-bridge",
        "4": "glass-facade",
        "5": "urban-composition",
        "6": "public-alpha-hero",
      } as const)[event.key];
      if (!bookmark) return;
      event.preventDefault();
      applyVisualBookmark(bookmark);
    };
    window.addEventListener("keydown", handleBookmark);
    return () => window.removeEventListener("keydown", handleBookmark);
  }, [applyVisualBookmark, visualCity]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || !focusingRef.current) return;
    const blend = 1 - Math.exp(-delta * 5.5);
    camera.position.lerp(desiredPosition.current, blend);
    controls.target.lerp(desiredTarget.current, blend);
    controls.update();
    if (
      camera.position.distanceToSquared(desiredPosition.current) < 0.0025 &&
      controls.target.distanceToSquared(desiredTarget.current) < 0.001
    ) {
      camera.position.copy(desiredPosition.current);
      controls.target.copy(desiredTarget.current);
      controls.update();
      focusingRef.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      dampingFactor={0.075}
      enableDamping
      enablePan
      makeDefault
      maxDistance={Math.max(90, bounds.radius * 5)}
      maxPolarAngle={Math.PI * 0.475}
      minDistance={4}
      minPolarAngle={0.16}
      onStart={() => {
        focusingRef.current = false;
      }}
      screenSpacePanning
    />
  );
}

function DefaultEmptyState() {
  return (
    <div
      style={{
        width: 250,
        padding: "18px 20px",
        border: "1px solid rgba(134, 173, 165, .24)",
        borderRadius: 12,
        color: "#a9c2bc",
        background: "rgba(6, 17, 21, .9)",
        boxShadow: "0 16px 40px rgba(0, 0, 0, .35)",
        fontFamily:
          "var(--font-geist-sans), system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <strong
        style={{
          display: "block",
          marginBottom: 5,
          color: "#e1ede9",
          fontSize: 13,
        }}
      >
        This district is still open ground
      </strong>
      <span style={{ fontSize: 11, lineHeight: 1.5 }}>
        No JavaScript or TypeScript buildings exist in this snapshot.
      </span>
    </div>
  );
}
