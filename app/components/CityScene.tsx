"use client";

import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import { Edges, Html, Line, OrbitControls } from "@react-three/drei";
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
  calculateCityBounds,
  CITY_BUILDING_ROLES,
  CITY_ROLE_VISUALS,
  CITY_SCENE_COLORS,
  clampCityValue,
  getRoleBuildingColor,
  isRelationVisibleAtCommit,
  normalizeCityRole,
  resolveCityDistricts,
  resolveEntityVisualState,
  stableCityHash,
  type CityBounds,
  type CityBuildingRole,
  type CityDistrictInput,
  type CityEntityFrameState,
  type CityVisualEntity,
  type CityVisualRelation,
  type ResolvedCityDistrict,
  type ResolvedEntityVisualState,
} from "@/app/lib/city-visuals";

export type CitySceneEntity = CityVisualEntity;
export type CitySceneRelation = CityVisualRelation;
export type CitySceneDistrict = CityDistrictInput;
export type CitySceneEntityFrameState = CityEntityFrameState;

export interface CitySceneProps {
  /** The stable, all-history entity union produced by the city compiler. */
  entities: readonly CitySceneEntity[];
  relations?: readonly CitySceneRelation[];
  /**
   * Optional compiler-provided district rectangles. If omitted, padded
   * rectangles are deterministically derived from the entities.
   */
  districts?: readonly CitySceneDistrict[];
  /**
   * Omit/null for HEAD exploration. A number switches to replay semantics:
   * bornAt is inclusive and diedAt is exclusive.
   */
  commitIndex?: number | null;
  /**
   * Optional exact replay state from a keyframe/delta reducer. The renderer
   * otherwise uses a deterministic height approximation.
   */
  entityFrameStates?: Readonly<Record<string, CitySceneEntityFrameState>>;
  /** Entity IDs changed by the current commit; these receive a renovation pulse. */
  changedEntityIds?: readonly string[] | ReadonlySet<string>;
  /** Controlled selection. Leave undefined to use the component's local selection. */
  selectedEntityId?: string | null;
  defaultSelectedEntityId?: string | null;
  onSelectEntity?: (entityId: string) => void;
  onClearSelection?: () => void;
  onHoverEntity?: (entityId: string | null) => void;
  onFocusEntity?: (entityId: string) => void;
  /**
   * Changing this value flies the camera to that building. Double-click and F
   * issue the same focus request internally.
   */
  focusEntityId?: string | null;
  /** Follow the first changed, visible building as commitIndex advances. */
  followConstruction?: boolean;
  showDistrictLabels?: boolean;
  showEntityLabel?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  emptyState?: ReactNode;
}

interface FocusRequest {
  entityId: string;
  nonce: number;
}

interface SceneContentsProps {
  entities: readonly CitySceneEntity[];
  relations: readonly CitySceneRelation[];
  districts: readonly ResolvedCityDistrict[];
  bounds: CityBounds;
  commitIndex?: number | null;
  entityFrameStates?: Readonly<Record<string, CitySceneEntityFrameState>>;
  changedEntityIds: ReadonlySet<string>;
  pulseSignature: string;
  selectedEntityId: string | null;
  hoveredEntityId: string | null;
  internalFocusRequest: FocusRequest | null;
  externalFocusEntityId?: string | null;
  followFocusRequest: FocusRequest | null;
  showDistrictLabels: boolean;
  showEntityLabel: boolean;
  emptyState?: ReactNode;
  onHoverEntity: (entityId: string | null) => void;
  onSelectEntity: (entityId: string) => void;
  onFocusEntity: (entityId: string) => void;
}

const BUILDING_BASE_Y = 0.13;
const HIDDEN_SCALE = 0.00001;

/**
 * Instanced 3D code city with stable picking and replay-aware visuals.
 *
 * The Canvas lives inside a plain responsive div, so callers only need to size
 * this component; no Three.js objects escape into application state.
 */
export function CityScene({
  entities,
  relations = [],
  districts: districtInputs,
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
  className,
  style,
  ariaLabel = "Interactive 3D repository city",
  emptyState,
}: CitySceneProps) {
  const [localSelectedEntityId, setLocalSelectedEntityId] = useState<
    string | null
  >(defaultSelectedEntityId);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const hoveredEntityIdRef = useRef<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(() =>
    focusEntityId ? { entityId: focusEntityId, nonce: 1 } : null,
  );
  const selectedEntityId =
    controlledSelectedEntityId === undefined
      ? localSelectedEntityId
      : controlledSelectedEntityId;

  const bounds = useMemo(() => calculateCityBounds(entities), [entities]);
  const districts = useMemo(
    () => resolveCityDistricts(entities, districtInputs),
    [districtInputs, entities],
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
    const changedEntity = entities.find(
      (entity) =>
        changedIds.has(entity.id) &&
        resolveEntityVisualState(
          entity,
          commitIndex,
          entityFrameStates?.[entity.id],
        ).visible,
    );
    return changedEntity
      ? { entityId: changedEntity.id, nonce: commitIndex + 1 }
      : null;
  }, [
    changedIds,
    commitIndex,
    entities,
    entityFrameStates,
    followConstruction,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || event.metaKey || event.ctrlKey) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
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
    const distance = Math.max(12, bounds.radius * 1.45);
    return [
      bounds.centerX + distance * 0.82,
      Math.max(bounds.maxHeight * 1.05, distance * 0.72),
      bounds.centerZ + distance * 0.82,
    ];
  }, [bounds]);

  return (
    <div
      aria-label={ariaLabel}
      className={className}
      onPointerLeave={() => hoverEntity(null)}
      role="img"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 320,
        overflow: "hidden",
        cursor: hoveredEntityId ? "pointer" : "grab",
        background: CITY_SCENE_COLORS.background,
        ...style,
      }}
    >
      <Canvas
        camera={{
          position: initialCameraPosition,
          fov: 40,
          near: 0.1,
          far: Math.max(400, bounds.radius * 16),
        }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onPointerMissed={() => {
          hoverEntity(null);
          selectEntity(null);
        }}
        shadows
      >
        <SceneContents
          bounds={bounds}
          changedEntityIds={changedIds}
          commitIndex={commitIndex}
          districts={districts}
          emptyState={emptyState}
          entities={entities}
          entityFrameStates={entityFrameStates}
          externalFocusEntityId={focusEntityId}
          followFocusRequest={followFocusRequest}
          hoveredEntityId={hoveredEntityId}
          internalFocusRequest={focusRequest}
          onFocusEntity={requestFocus}
          onHoverEntity={hoverEntity}
          onSelectEntity={(entityId) => selectEntity(entityId)}
          pulseSignature={pulseSignature}
          relations={relations}
          selectedEntityId={selectedEntityId ?? null}
          showDistrictLabels={showDistrictLabels}
          showEntityLabel={showEntityLabel}
        />
      </Canvas>
    </div>
  );
}

export default CityScene;

function SceneContents({
  entities,
  relations,
  districts,
  bounds,
  commitIndex,
  entityFrameStates,
  changedEntityIds,
  pulseSignature,
  selectedEntityId,
  hoveredEntityId,
  internalFocusRequest,
  externalFocusEntityId,
  followFocusRequest,
  showDistrictLabels,
  showEntityLabel,
  emptyState,
  onHoverEntity,
  onSelectEntity,
  onFocusEntity,
}: SceneContentsProps) {
  const entityById = useMemo(
    () => new Map(entities.map((entity) => [entity.id, entity])),
    [entities],
  );
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
  const roleBatches = useMemo(() => {
    const batches = Object.fromEntries(
      CITY_BUILDING_ROLES.map((role) => [role, [] as CitySceneEntity[]]),
    ) as Record<CityBuildingRole, CitySceneEntity[]>;

    for (const entity of entities) {
      batches[normalizeCityRole(entity.role)].push(entity);
    }
    for (const role of CITY_BUILDING_ROLES) {
      batches[role].sort((left, right) => left.id.localeCompare(right.id));
    }
    return batches;
  }, [entities]);

  const labelEntity = useMemo(() => {
    const hovered = hoveredEntityId
      ? entityById.get(hoveredEntityId)
      : undefined;
    if (hovered && visualStates.get(hovered.id)?.visible) return hovered;

    const selected = selectedEntityId
      ? entityById.get(selectedEntityId)
      : undefined;
    return selected && visualStates.get(selected.id)?.visible
      ? selected
      : undefined;
  }, [entityById, hoveredEntityId, selectedEntityId, visualStates]);
  const selectedEntity = selectedEntityId
    ? entityById.get(selectedEntityId)
    : undefined;
  const hoveredEntity = hoveredEntityId
    ? entityById.get(hoveredEntityId)
    : undefined;

  const worldSize = Math.max(60, bounds.radius * 4.5);
  const fogNear = Math.max(28, bounds.radius * 1.7);
  const fogFar = Math.max(90, bounds.radius * 5.4);

  return (
    <>
      <color attach="background" args={[CITY_SCENE_COLORS.background]} />
      <fog attach="fog" args={[CITY_SCENE_COLORS.fog, fogNear, fogFar]} />
      <hemisphereLight
        args={["#b9d8d2", "#081013", 1.2]}
        position={[0, bounds.maxHeight + 10, 0]}
      />
      <ambientLight color="#6d8d88" intensity={0.32} />
      <directionalLight
        castShadow
        color="#ffe4bc"
        intensity={2.15}
        position={[
          bounds.centerX + bounds.radius * 0.8,
          Math.max(20, bounds.maxHeight * 2.4),
          bounds.centerZ + bounds.radius * 0.55,
        ]}
        shadow-bias={-0.00025}
        shadow-camera-bottom={-bounds.radius * 1.5}
        shadow-camera-far={Math.max(80, bounds.radius * 5)}
        shadow-camera-left={-bounds.radius * 1.5}
        shadow-camera-right={bounds.radius * 1.5}
        shadow-camera-top={bounds.radius * 1.5}
        shadow-mapSize-height={1536}
        shadow-mapSize-width={1536}
      />

      <mesh
        position={[bounds.centerX, -0.08, bounds.centerZ]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[worldSize, worldSize]} />
        <meshStandardMaterial
          color={CITY_SCENE_COLORS.worldGround}
          metalness={0}
          roughness={1}
        />
      </mesh>
      <gridHelper
        args={[
          worldSize,
          Math.max(24, Math.round(worldSize / 2)),
          "#204044",
          "#102a2d",
        ]}
        position={[bounds.centerX, 0.005, bounds.centerZ]}
      />

      <DistrictLayer
        districts={districts}
        showLabels={showDistrictLabels}
      />

      {CITY_BUILDING_ROLES.map((role) => {
        const items = roleBatches[role];
        return items.length > 0 ? (
          <BuildingBatch
            key={role}
            bounds={bounds}
            changedEntityIds={changedEntityIds}
            commitIndex={commitIndex}
            hoveredEntityId={hoveredEntityId}
            items={items}
            onFocusEntity={onFocusEntity}
            onHoverEntity={onHoverEntity}
            onSelectEntity={onSelectEntity}
            pulseSignature={pulseSignature}
            role={role}
            selectedEntityId={selectedEntityId}
            visualStates={visualStates}
          />
        ) : null;
      })}

      <DependencyLines
        commitIndex={commitIndex}
        entityById={entityById}
        relations={relations}
        selectedEntityId={selectedEntityId}
        visualStates={visualStates}
      />

      {selectedEntity && visualStates.get(selectedEntity.id)?.visible ? (
        <BuildingMarker
          color={CITY_SCENE_COLORS.selection}
          entity={selectedEntity}
          height={visualStates.get(selectedEntity.id)?.height ?? 0}
          kind="selected"
        />
      ) : null}
      {hoveredEntity &&
      hoveredEntity.id !== selectedEntity?.id &&
      visualStates.get(hoveredEntity.id)?.visible ? (
        <BuildingMarker
          color={CITY_SCENE_COLORS.hover}
          entity={hoveredEntity}
          height={visualStates.get(hoveredEntity.id)?.height ?? 0}
          kind="hover"
        />
      ) : null}

      {showEntityLabel && labelEntity ? (
        <EntityLabel
          entity={labelEntity}
          height={visualStates.get(labelEntity.id)?.height ?? 0}
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
        cityKey={`${entities.length}:${entities[0]?.id ?? "empty"}:${entities.at(-1)?.id ?? "empty"}`}
        entityById={entityById}
        externalFocusEntityId={externalFocusEntityId}
        followFocusRequest={followFocusRequest}
        internalFocusRequest={internalFocusRequest}
        visualStates={visualStates}
      />
    </>
  );
}

interface BuildingBatchProps {
  role: CityBuildingRole;
  items: readonly CitySceneEntity[];
  visualStates: ReadonlyMap<string, ResolvedEntityVisualState>;
  bounds: CityBounds;
  commitIndex?: number | null;
  changedEntityIds: ReadonlySet<string>;
  pulseSignature: string;
  hoveredEntityId: string | null;
  selectedEntityId: string | null;
  onHoverEntity: (entityId: string | null) => void;
  onSelectEntity: (entityId: string) => void;
  onFocusEntity: (entityId: string) => void;
}

interface BuildingRuntime {
  height: number;
  pulse: number;
}

function BuildingBatch({
  role,
  items,
  visualStates,
  bounds,
  commitIndex,
  changedEntityIds,
  pulseSignature,
  hoveredEntityId,
  selectedEntityId,
  onHoverEntity,
  onSelectEntity,
  onFocusEntity,
}: BuildingBatchProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const runtimesRef = useRef(new Map<string, BuildingRuntime>());
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const workingColor = useMemo(() => new THREE.Color(), []);
  const pulseColor = useMemo(
    () => new THREE.Color(CITY_ROLE_VISUALS[role].accent),
    [role],
  );
  const selectionColor = useMemo(
    () => new THREE.Color(CITY_SCENE_COLORS.selection),
    [],
  );
  const hoverColor = useMemo(
    () => new THREE.Color(CITY_SCENE_COLORS.hover),
    [],
  );
  const baseColors = useMemo(
    () =>
      items.map(
        (entity) =>
          new THREE.Color(
            getRoleBuildingColor(role, entity.layout.styleVariant),
          ),
      ),
    [items, role],
  );

  const writeInstance = useCallback(
    (
      mesh: THREE.InstancedMesh,
      entity: CitySceneEntity,
      instanceId: number,
      height: number,
      pulseScale: number,
    ) => {
      const variant = Math.abs(entity.layout.styleVariant);
      const footprintScale = 0.94 + (variant % 3) * 0.03;
      const visibleHeight = Math.max(HIDDEN_SCALE, height);
      const visibilityScale = clampCityValue(
        height / Math.max(0.001, entity.layout.maxHeight * 0.05),
        HIDDEN_SCALE,
        1,
      );

      dummy.position.set(
        entity.layout.x,
        BUILDING_BASE_Y + visibleHeight / 2,
        entity.layout.z,
      );
      dummy.rotation.set(0, entity.layout.rotationY, 0);
      dummy.scale.set(
        Math.max(
          HIDDEN_SCALE,
          entity.layout.width *
            footprintScale *
            pulseScale *
            visibilityScale,
        ),
        visibleHeight,
        Math.max(
          HIDDEN_SCALE,
          entity.layout.depth *
            footprintScale *
            pulseScale *
            visibilityScale,
        ),
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(instanceId, dummy.matrix);
    },
    [dummy],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const activeIds = new Set(items.map((entity) => entity.id));
    for (const entityId of runtimesRef.current.keys()) {
      if (!activeIds.has(entityId)) runtimesRef.current.delete(entityId);
    }

    items.forEach((entity, instanceId) => {
      const target = visualStates.get(entity.id);
      let runtime = runtimesRef.current.get(entity.id);
      if (!runtime) {
        runtime = {
          height:
            commitIndex === undefined || commitIndex === null
              ? (target?.height ?? entity.layout.maxHeight)
              : 0,
          pulse: 0,
        };
        runtimesRef.current.set(entity.id, runtime);
      }
      writeInstance(mesh, entity, instanceId, runtime.height, 1);
      mesh.setColorAt(instanceId, baseColors[instanceId]);
    });

    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(
        bounds.centerX,
        bounds.maxHeight / 2,
        bounds.centerZ,
      ),
      Math.hypot(bounds.radius, bounds.maxHeight),
    );
  }, [
    baseColors,
    bounds,
    commitIndex,
    items,
    visualStates,
    writeInstance,
  ]);

  useEffect(() => {
    for (const entity of items) {
      if (changedEntityIds.has(entity.id)) {
        const runtime = runtimesRef.current.get(entity.id);
        if (runtime) runtime.pulse = 1;
      }
    }
    // pulseSignature deliberately includes commitIndex so the same file can
    // pulse in consecutive commits without rebuilding its instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseSignature]);

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    items.forEach((entity, instanceId) => {
      const runtime = runtimesRef.current.get(entity.id);
      const target = visualStates.get(entity.id);
      if (!runtime || !target) return;

      runtime.height = THREE.MathUtils.damp(
        runtime.height,
        target.height,
        target.visible ? 8.5 : 11,
        delta,
      );
      if (runtime.height < 0.001 && !target.visible) runtime.height = 0;
      runtime.pulse = Math.max(0, runtime.pulse - delta * 0.82);

      const wave =
        Math.sin(
          clock.elapsedTime * 9.5 + (stableCityHash(entity.id) % 31) * 0.17,
        ) *
        runtime.pulse;
      const pulseScale = 1 + Math.max(0, wave) * 0.075;
      writeInstance(
        mesh,
        entity,
        instanceId,
        runtime.height,
        pulseScale,
      );

      workingColor.copy(baseColors[instanceId]);
      if (runtime.pulse > 0) {
        workingColor.lerp(pulseColor, runtime.pulse * (0.42 + wave * 0.12));
      }
      if (entity.id === hoveredEntityId) {
        workingColor.lerp(hoverColor, 0.46);
      }
      if (entity.id === selectedEntityId) {
        workingColor.lerp(selectionColor, 0.52);
      }
      mesh.setColorAt(instanceId, workingColor);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  const entityFromEvent = useCallback(
    (event: ThreeEvent<PointerEvent | MouseEvent>) => {
      if (event.instanceId === undefined) return undefined;
      const entity = items[event.instanceId];
      return entity && visualStates.get(entity.id)?.visible
        ? entity
        : undefined;
    },
    [items, visualStates],
  );

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, items.length]}
      castShadow
      frustumCulled
      onClick={(event) => {
        const entity = entityFromEvent(event);
        if (!entity) return;
        event.stopPropagation();
        onSelectEntity(entity.id);
      }}
      onDoubleClick={(event) => {
        const entity = entityFromEvent(event);
        if (!entity) return;
        event.stopPropagation();
        onSelectEntity(entity.id);
        onFocusEntity(entity.id);
      }}
      onPointerMove={(event) => {
        const entity = entityFromEvent(event);
        if (!entity) return;
        event.stopPropagation();
        onHoverEntity(entity.id);
      }}
      onPointerOut={() => onHoverEntity(null)}
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#ffffff"
        emissive={CITY_ROLE_VISUALS[role].emissive}
        emissiveIntensity={0.2}
        flatShading
        metalness={0.06}
        roughness={0.78}
      />
    </instancedMesh>
  );
}

function DistrictLayer({
  districts,
  showLabels,
}: {
  districts: readonly ResolvedCityDistrict[];
  showLabels: boolean;
}) {
  return (
    <group>
      {districts.map((district) => (
        <group key={district.id}>
          <mesh
            position={[district.x, 0.055, district.z]}
            receiveShadow
          >
            <boxGeometry
              args={[district.width, 0.1, district.depth]}
            />
            <meshStandardMaterial
              color={district.color}
              metalness={0.02}
              roughness={0.96}
            />
            <Edges
              color={CITY_SCENE_COLORS.districtBorder}
              opacity={0.64}
              transparent
            />
          </mesh>
          {showLabels ? (
            <Html
              center
              position={[
                district.x - district.width / 2 + 0.72,
                0.34,
                district.z - district.depth / 2 + 0.52,
              ]}
              zIndexRange={[20, 0]}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "5px 8px",
                  border: "1px solid rgba(137, 176, 167, 0.28)",
                  borderRadius: 7,
                  color: CITY_SCENE_COLORS.districtLabel,
                  background: "rgba(6, 17, 21, 0.82)",
                  boxShadow: "0 5px 18px rgba(0, 0, 0, 0.24)",
                  fontFamily:
                    "var(--font-geist-mono), ui-monospace, monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  lineHeight: 1,
                  pointerEvents: "none",
                  textTransform: "uppercase",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{district.name}</span>
                <span
                  style={{
                    color: CITY_SCENE_COLORS.districtLabelMuted,
                    fontSize: 9,
                    fontWeight: 600,
                  }}
                >
                  {district.entityCount}
                </span>
              </div>
            </Html>
          ) : null}
        </group>
      ))}
    </group>
  );
}

interface DependencyLinesProps {
  selectedEntityId: string | null;
  relations: readonly CitySceneRelation[];
  entityById: ReadonlyMap<string, CitySceneEntity>;
  visualStates: ReadonlyMap<string, ResolvedEntityVisualState>;
  commitIndex?: number | null;
}

function DependencyLines({
  selectedEntityId,
  relations,
  entityById,
  visualStates,
  commitIndex,
}: DependencyLinesProps) {
  const visibleRelations = useMemo(() => {
    if (!selectedEntityId) return [];
    return relations.filter((relation) => {
      if (
        relation.sourceId !== selectedEntityId &&
        relation.targetId !== selectedEntityId
      ) {
        return false;
      }
      if (!isRelationVisibleAtCommit(relation, commitIndex)) return false;
      return (
        visualStates.get(relation.sourceId)?.visible === true &&
        visualStates.get(relation.targetId)?.visible === true
      );
    });
  }, [commitIndex, relations, selectedEntityId, visualStates]);

  return (
    <group>
      {visibleRelations.map((relation) => {
        const source = entityById.get(relation.sourceId);
        const target = entityById.get(relation.targetId);
        if (!source || !target) return null;

        const outgoing = relation.sourceId === selectedEntityId;
        const points = dependencyArcPoints(
          source,
          target,
          visualStates.get(source.id)?.height ?? 0,
          visualStates.get(target.id)?.height ?? 0,
        );
        return (
          <Line
            key={relation.id}
            color={
              outgoing
                ? CITY_SCENE_COLORS.dependencyOut
                : CITY_SCENE_COLORS.dependencyIn
            }
            depthWrite={false}
            lineWidth={clampCityValue(1.2 + relation.weight * 0.55, 1.2, 4)}
            opacity={0.84}
            points={points}
            transparent
          />
        );
      })}
    </group>
  );
}

function dependencyArcPoints(
  source: CitySceneEntity,
  target: CitySceneEntity,
  sourceHeight: number,
  targetHeight: number,
): [number, number, number][] {
  const start = new THREE.Vector3(
    source.layout.x,
    BUILDING_BASE_Y + Math.max(0.35, sourceHeight * 0.82),
    source.layout.z,
  );
  const end = new THREE.Vector3(
    target.layout.x,
    BUILDING_BASE_Y + Math.max(0.35, targetHeight * 0.82),
    target.layout.z,
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
  entity,
  height,
  color,
  kind,
}: {
  entity: CitySceneEntity;
  height: number;
  color: string;
  kind: "selected" | "hover";
}) {
  const groupRef = useRef<THREE.Group>(null);
  const phase = (stableCityHash(entity.id) % 19) * 0.23;

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const pulse =
      kind === "selected"
        ? 1 + Math.sin(clock.elapsedTime * 2.8 + phase) * 0.025
        : 1;
    groupRef.current.scale.setScalar(pulse);
  });

  const markerHeight = Math.max(0.16, height);
  return (
    <group
      ref={groupRef}
      position={[
        entity.layout.x,
        BUILDING_BASE_Y + markerHeight / 2,
        entity.layout.z,
      ]}
      rotation={[0, entity.layout.rotationY, 0]}
    >
      <mesh
        scale={[
          entity.layout.width * 1.08,
          markerHeight + 0.12,
          entity.layout.depth * 1.08,
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
              Math.max(entity.layout.width, entity.layout.depth) * 0.62,
              Math.max(entity.layout.width, entity.layout.depth) * 0.72,
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
  height,
  selected,
}: {
  entity: CitySceneEntity;
  height: number;
  selected: boolean;
}) {
  const role = CITY_ROLE_VISUALS[normalizeCityRole(entity.role)];
  return (
    <Html
      center
      position={[
        entity.layout.x,
        BUILDING_BASE_Y + height + 0.72,
        entity.layout.z,
      ]}
      zIndexRange={[50, 21]}
    >
      <div
        style={{
          minWidth: 150,
          maxWidth: 260,
          padding: "9px 11px",
          border: `1px solid ${selected ? "rgba(246, 228, 168, .68)" : "rgba(184, 220, 211, .3)"}`,
          borderRadius: 9,
          color: "#e8f2ee",
          background: "rgba(5, 15, 19, 0.94)",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.42)",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
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
        </div>
        <div
          style={{
            overflow: "hidden",
            color: "#87a49e",
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: 9,
            lineHeight: 1.35,
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entity.path}
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

interface CameraRigProps {
  bounds: CityBounds;
  cityKey: string;
  internalFocusRequest: FocusRequest | null;
  externalFocusEntityId?: string | null;
  followFocusRequest: FocusRequest | null;
  entityById: ReadonlyMap<string, CitySceneEntity>;
  visualStates: ReadonlyMap<string, ResolvedEntityVisualState>;
}

function CameraRig({
  bounds,
  cityKey,
  internalFocusRequest,
  externalFocusEntityId,
  followFocusRequest,
  entityById,
  visualStates,
}: CameraRigProps) {
  const { camera } = useThree();
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const focusingRef = useRef(false);
  const desiredPosition = useRef(new THREE.Vector3());
  const desiredTarget = useRef(new THREE.Vector3());
  const lastCityKey = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (lastCityKey.current === cityKey) return;
    lastCityKey.current = cityKey;

    const distance = Math.max(12, bounds.radius * 1.45);
    const target = new THREE.Vector3(
      bounds.centerX,
      Math.min(bounds.maxHeight * 0.22, distance * 0.12),
      bounds.centerZ,
    );
    camera.position.set(
      bounds.centerX + distance * 0.82,
      Math.max(bounds.maxHeight * 1.05, distance * 0.72),
      bounds.centerZ + distance * 0.82,
    );
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }
    focusingRef.current = false;
  }, [bounds, camera, cityKey]);

  const beginFocus = useCallback(
    (entityId: string, framing: "building" | "district" = "building") => {
      const entity = entityById.get(entityId);
      const state = entity ? visualStates.get(entity.id) : undefined;
      if (!entity || !state?.visible) return;

      const focusHeight = Math.max(0.4, state.height);
      const target = new THREE.Vector3(
        entity.layout.x,
        BUILDING_BASE_Y + focusHeight * 0.42,
        entity.layout.z,
      );
      const focusSize = Math.max(
        entity.layout.width,
        entity.layout.depth,
        focusHeight * 0.7,
      );
      const distance =
        framing === "district"
          ? clampCityValue(bounds.radius * 0.52, 15, 34)
          : clampCityValue(focusSize * 4.8, 8, 28);
      const currentTarget =
        controlsRef.current?.target ??
        new THREE.Vector3(bounds.centerX, 0, bounds.centerZ);
      const horizontalDirection = new THREE.Vector2(
        camera.position.x - currentTarget.x,
        camera.position.z - currentTarget.z,
      );
      if (horizontalDirection.lengthSq() < 0.001) {
        horizontalDirection.set(1, 1);
      }
      horizontalDirection.normalize();

      desiredTarget.current.copy(target);
      desiredPosition.current.set(
        target.x + horizontalDirection.x * distance * 0.78,
        target.y + distance * 0.66,
        target.z + horizontalDirection.y * distance * 0.78,
      );
      focusingRef.current = true;
    },
    [
      bounds.centerX,
      bounds.centerZ,
      bounds.radius,
      camera,
      entityById,
      visualStates,
    ],
  );

  useEffect(() => {
    if (followFocusRequest) {
      beginFocus(followFocusRequest.entityId, "district");
    }
  }, [beginFocus, followFocusRequest]);

  useEffect(() => {
    if (externalFocusEntityId) beginFocus(externalFocusEntityId);
  }, [beginFocus, externalFocusEntityId]);

  useEffect(() => {
    if (internalFocusRequest) beginFocus(internalFocusRequest.entityId);
  }, [beginFocus, internalFocusRequest]);

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
      maxDistance={Math.max(80, bounds.radius * 5)}
      maxPolarAngle={Math.PI * 0.475}
      minDistance={3.5}
      minPolarAngle={0.18}
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
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
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
