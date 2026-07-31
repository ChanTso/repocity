"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import * as THREE from "three";
import {
  CITY_ROLE_VISUALS,
  CITY_SCENE_COLORS,
  getRoleBuildingColor,
  normalizeCityRole,
  stableCityHash,
  type CityVisualEntity,
  type ResolvedEntityVisualState,
} from "@/app/lib/city-visuals";
import type {
  BuildingArchetype,
  FacilityKind,
  LivingCityPlan,
  PlannedBuilding,
} from "@/app/lib/living-city";
import {
  BUILDING_BASE_Y,
  HIDDEN_SCALE,
  type TimeOfDayPalette,
} from "./living-city-render-utils";

interface BuildingRuntime {
  height: number;
  pulse: number;
}

interface MassProfile {
  podiumTop: number;
  mainTop: number;
  podiumScale: [number, number];
  mainScale: [number, number];
  crownScale: [number, number];
}

interface BuildingLayer {
  bottom: number;
  top: number;
  widthScale: number;
  depthScale: number;
}

export interface LivingCityBuildingsProps {
  plan: LivingCityPlan;
  entityById: ReadonlyMap<string, CityVisualEntity>;
  visualStates: ReadonlyMap<string, ResolvedEntityVisualState>;
  hiddenDistrictIds: ReadonlySet<string>;
  changedEntityIds: ReadonlySet<string>;
  pulseSignature: string;
  commitIndex?: number | null;
  selectedEntityId: string | null;
  hoveredEntityId: string | null;
  palette: TimeOfDayPalette;
  emphasizedEntityIds?: ReadonlySet<string> | null;
  replacedEntityIds?: ReadonlySet<string> | null;
  contextHeightScale?: number;
  onHoverEntity: (entityId: string | null) => void;
  onSelectEntity: (entityId: string) => void;
  onFocusEntity: (entityId: string) => void;
}

/**
 * A building remains one semantic pick target while its silhouette is composed
 * from several shared instanced layers. This keeps hundreds of distinct files
 * visually legible without creating hundreds of React meshes or materials.
 */
export function LivingCityBuildings({
  plan,
  entityById,
  visualStates,
  hiddenDistrictIds,
  changedEntityIds,
  pulseSignature,
  commitIndex,
  selectedEntityId,
  hoveredEntityId,
  palette,
  emphasizedEntityIds = null,
  replacedEntityIds = null,
  contextHeightScale = 1,
  onHoverEntity,
  onSelectEntity,
  onFocusEntity,
}: LivingCityBuildingsProps) {
  const buildings = plan.buildings;
  const podiumRef = useRef<THREE.InstancedMesh>(null);
  const mainRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const hitboxRef = useRef<THREE.InstancedMesh>(null);
  const facadeRef = useRef<THREE.InstancedMesh>(null);
  const accentBoxRef = useRef<THREE.InstancedMesh>(null);
  const accentCylinderRef = useRef<THREE.InstancedMesh>(null);
  const facadeMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const runtimesRef = useRef(new Map<string, BuildingRuntime>());
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const workingColor = useMemo(() => new THREE.Color(), []);
  const selectionColor = useMemo(
    () => new THREE.Color(CITY_SCENE_COLORS.selection),
    [],
  );
  const hoverColor = useMemo(
    () => new THREE.Color(CITY_SCENE_COLORS.hover),
    [],
  );
  const pulseColor = useMemo(() => new THREE.Color("#fff0b0"), []);
  const dimmedColor = useMemo(() => new THREE.Color("#071313"), []);
  const baseColors = useMemo(
    () =>
      buildings.map((building) => {
        const entity = entityById.get(building.entityId);
        const role = normalizeCityRole(entity?.role ?? "other");
        return new THREE.Color(
          getRoleBuildingColor(
            role,
            entity?.layout.styleVariant ??
              stableCityHash(building.entityId),
          ),
        );
      }),
    [buildings, entityById],
  );
  const facadeSeeds = useMemo(
    () =>
      Float32Array.from(
        buildings.flatMap((building) =>
          [0, 1, 2, 3].map(
            (side) =>
              ((stableCityHash(`${building.entityId}:${side}`) % 997) + 1) /
              997,
          ),
        ),
      ),
    [buildings],
  );
  const facadeEmphasis = useMemo(
    () =>
      Float32Array.from(
        buildings.flatMap((building) =>
          Array.from(
            { length: 4 },
            () =>
              emphasizedEntityIds === null ||
              emphasizedEntityIds.has(building.entityId)
                ? 1
                : 0,
          ),
        ),
      ),
    [buildings, emphasizedEntityIds],
  );
  const facadeUniforms = useMemo(
    () => ({
      uNight: { value: palette.night },
      uDaylight: { value: palette.daylight },
    }),
    [palette.daylight, palette.night],
  );

  const targetHeight = useCallback(
    (building: PlannedBuilding): number => {
      const state = visualStates.get(building.entityId);
      if (
        !state?.visible ||
        hiddenDistrictIds.has(building.districtId) ||
        replacedEntityIds?.has(building.entityId)
      ) {
        return 0;
      }
      const contextScale =
        emphasizedEntityIds !== null &&
        !emphasizedEntityIds.has(building.entityId)
          ? contextHeightScale
          : 1;
      return building.height * state.heightRatio * contextScale;
    },
    [
      contextHeightScale,
      emphasizedEntityIds,
      hiddenDistrictIds,
      replacedEntityIds,
      visualStates,
    ],
  );

  const writeBuilding = useCallback(
    (
      building: PlannedBuilding,
      buildingIndex: number,
      height: number,
      pulseScale: number,
    ) => {
      const podium = podiumRef.current;
      const main = mainRef.current;
      const crown = crownRef.current;
      const hitbox = hitboxRef.current;
      const facade = facadeRef.current;
      if (!podium || !main || !crown || !hitbox || !facade) return;

      const profile = profileFor(building.archetype);
      const layers: [THREE.InstancedMesh, BuildingLayer][] = [
        [
          podium,
          {
            bottom: 0,
            top: profile.podiumTop,
            widthScale: profile.podiumScale[0],
            depthScale: profile.podiumScale[1],
          },
        ],
        [
          main,
          {
            bottom: profile.podiumTop,
            top: profile.mainTop,
            widthScale: profile.mainScale[0],
            depthScale: profile.mainScale[1],
          },
        ],
        [
          crown,
          {
            bottom: profile.mainTop,
            top: 1,
            widthScale: profile.crownScale[0],
            depthScale: profile.crownScale[1],
          },
        ],
      ];

      for (const [mesh, layer] of layers) {
        const layerHeight = Math.max(
          HIDDEN_SCALE,
          height * (layer.top - layer.bottom),
        );
        const width =
          Math.max(HIDDEN_SCALE, building.width * layer.widthScale) *
          pulseScale;
        const depth =
          Math.max(HIDDEN_SCALE, building.depth * layer.depthScale) *
          pulseScale;
        dummy.position.set(
          building.x,
          BUILDING_BASE_Y +
            height * layer.bottom +
            layerHeight / 2,
          building.z,
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(width, layerHeight, depth);
        dummy.updateMatrix();
        mesh.setMatrixAt(buildingIndex, dummy.matrix);
      }

      const visibleHeight = Math.max(HIDDEN_SCALE, height);
      dummy.position.set(
        building.x,
        BUILDING_BASE_Y + visibleHeight / 2,
        building.z,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(
        height > 0.01 ? building.width : HIDDEN_SCALE,
        visibleHeight,
        height > 0.01 ? building.depth : HIDDEN_SCALE,
      );
      dummy.updateMatrix();
      hitbox.setMatrixAt(buildingIndex, dummy.matrix);

      writeFacadeSide(
        facade,
        dummy,
        building,
        buildingIndex * 4,
        height,
        "north",
      );
      writeFacadeSide(
        facade,
        dummy,
        building,
        buildingIndex * 4 + 1,
        height,
        "south",
      );
      writeFacadeSide(
        facade,
        dummy,
        building,
        buildingIndex * 4 + 2,
        height,
        "east",
      );
      writeFacadeSide(
        facade,
        dummy,
        building,
        buildingIndex * 4 + 3,
        height,
        "west",
      );

      writeFacilityAccents(
        accentBoxRef.current,
        accentCylinderRef.current,
        dummy,
        building,
        buildingIndex,
        height,
      );
    },
    [dummy],
  );

  useLayoutEffect(() => {
    const meshes = [
      podiumRef.current,
      mainRef.current,
      crownRef.current,
      hitboxRef.current,
      facadeRef.current,
      accentBoxRef.current,
      accentCylinderRef.current,
    ].filter((mesh): mesh is THREE.InstancedMesh => Boolean(mesh));
    if (meshes.length < 7) return;

    const facade = facadeRef.current!;
    facade.geometry.setAttribute(
      "instanceSeed",
      new THREE.InstancedBufferAttribute(facadeSeeds, 1),
    );
    facade.geometry.setAttribute(
      "instanceEmphasis",
      new THREE.InstancedBufferAttribute(facadeEmphasis, 1),
    );
    const activeIds = new Set(
      buildings.map((building) => building.entityId),
    );
    for (const id of runtimesRef.current.keys()) {
      if (!activeIds.has(id)) runtimesRef.current.delete(id);
    }
    buildings.forEach((building, index) => {
      let runtime = runtimesRef.current.get(building.entityId);
      if (!runtime) {
        runtime = {
          height:
            commitIndex === undefined || commitIndex === null
              ? targetHeight(building)
              : 0,
          pulse: 0,
        };
        runtimesRef.current.set(building.entityId, runtime);
      }
      writeBuilding(building, index, runtime.height, 1);
      for (const mesh of [
        podiumRef.current!,
        mainRef.current!,
        crownRef.current!,
      ]) {
        mesh.setColorAt(index, baseColors[index]!);
      }
    });

    for (const mesh of meshes) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }, [
    baseColors,
    buildings,
    commitIndex,
    facadeEmphasis,
    facadeSeeds,
    targetHeight,
    writeBuilding,
  ]);

  useEffect(() => {
    for (const building of buildings) {
      if (changedEntityIds.has(building.entityId)) {
        const runtime = runtimesRef.current.get(building.entityId);
        if (runtime) runtime.pulse = 1;
      }
    }
    // The signature includes commitIndex, allowing the same entity to pulse in
    // adjacent commits without rebuilding planner geometry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseSignature]);

  useFrame(({ clock }, delta) => {
    const podium = podiumRef.current;
    const main = mainRef.current;
    const crown = crownRef.current;
    const hitbox = hitboxRef.current;
    const facade = facadeRef.current;
    const accentBox = accentBoxRef.current;
    const accentCylinder = accentCylinderRef.current;
    const material = facadeMaterialRef.current;
    if (
      !podium ||
      !main ||
      !crown ||
      !hitbox ||
      !facade ||
      !accentBox ||
      !accentCylinder
    ) {
      return;
    }
    if (material) {
      material.uniforms.uNight!.value = palette.night;
      material.uniforms.uDaylight!.value = palette.daylight;
    }

    buildings.forEach((building, index) => {
      const runtime = runtimesRef.current.get(building.entityId);
      if (!runtime) return;
      const target = targetHeight(building);
      runtime.height = THREE.MathUtils.damp(
        runtime.height,
        target,
        target > 0 ? 7.6 : 11,
        delta,
      );
      if (target === 0 && runtime.height < 0.002) runtime.height = 0;
      runtime.pulse = Math.max(0, runtime.pulse - delta * 0.78);
      const wave =
        Math.sin(
          clock.elapsedTime * 8.8 +
            (stableCityHash(building.entityId) % 37) * 0.17,
        ) * runtime.pulse;
      writeBuilding(
        building,
        index,
        runtime.height,
        1 + Math.max(0, wave) * 0.055,
      );

      workingColor.copy(baseColors[index]!);
      if (
        emphasizedEntityIds !== null &&
        !emphasizedEntityIds.has(building.entityId)
      ) {
        workingColor.lerp(dimmedColor, 0.68);
      }
      if (runtime.pulse > 0) {
        workingColor.lerp(
          pulseColor,
          runtime.pulse * (0.4 + Math.max(0, wave) * 0.1),
        );
      }
      if (building.entityId === hoveredEntityId) {
        workingColor.lerp(hoverColor, 0.42);
      }
      if (building.entityId === selectedEntityId) {
        workingColor.lerp(selectionColor, 0.5);
      }
      podium.setColorAt(index, workingColor);
      main.setColorAt(index, workingColor);
      crown.setColorAt(index, workingColor);
    });

    for (const mesh of [
      podium,
      main,
      crown,
      hitbox,
      facade,
      accentBox,
      accentCylinder,
    ]) {
      mesh.instanceMatrix.needsUpdate = true;
    }
    podium.instanceColor!.needsUpdate = true;
    main.instanceColor!.needsUpdate = true;
    crown.instanceColor!.needsUpdate = true;
  });

  const buildingFromEvent = useCallback(
    (event: ThreeEvent<PointerEvent | MouseEvent>) => {
      if (event.instanceId === undefined) return undefined;
      const building = buildings[event.instanceId];
      const state = building
        ? visualStates.get(building.entityId)
        : undefined;
      return building &&
        state?.visible &&
        !hiddenDistrictIds.has(building.districtId)
        ? building
        : undefined;
    },
    [buildings, hiddenDistrictIds, visualStates],
  );

  if (buildings.length === 0) return null;
  return (
    <group>
      <instancedMesh
        ref={podiumRef}
        args={[undefined, undefined, buildings.length]}
        castShadow
        frustumCulled={false}
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          metalness={0.08}
          roughness={0.72}
          vertexColors
        />
      </instancedMesh>
      <instancedMesh
        ref={mainRef}
        args={[undefined, undefined, buildings.length]}
        castShadow
        frustumCulled={false}
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          metalness={0.11}
          roughness={0.65}
          vertexColors
        />
      </instancedMesh>
      <instancedMesh
        ref={crownRef}
        args={[undefined, undefined, buildings.length]}
        castShadow
        frustumCulled={false}
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          metalness={0.16}
          roughness={0.6}
          vertexColors
        />
      </instancedMesh>

      <instancedMesh
        ref={facadeRef}
        args={[undefined, undefined, buildings.length * 4]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          ref={facadeMaterialRef}
          depthWrite
          fragmentShader={`
            uniform float uNight;
            uniform float uDaylight;
            varying vec2 vUv;
            varying float vSeed;
            varying float vEmphasis;
            float hash(float n) { return fract(sin(n) * 43758.5453123); }
            void main() {
              float columns = 4.0 + floor(vSeed * 4.0);
              float rows = 5.0 + floor(vSeed * 9.0);
              vec2 cell = fract(vec2(vUv.x * columns, vUv.y * rows));
              float aperture = step(.17, cell.x) * step(cell.x, .83)
                * step(.2, cell.y) * step(cell.y, .78);
              float room = hash(floor(vUv.x * columns) + floor(vUv.y * rows) * 17. + vSeed * 91.);
              float lit = step(.44 + uDaylight * .25, room);
              vec3 wall = mix(vec3(.11, .16, .17), vec3(.22, .3, .3), uDaylight);
              vec3 glass = mix(vec3(.08, .19, .24), vec3(.34, .52, .56), uDaylight);
              vec3 warm = vec3(1., .63, .24) * (lit * uNight * 1.5);
              vec3 color = mix(wall, glass + warm, aperture);
              color *= mix(.24, 1., vEmphasis);
              gl_FragColor = vec4(color, .96);
            }
          `}
          transparent
          uniforms={facadeUniforms}
          vertexShader={`
            attribute float instanceSeed;
            attribute float instanceEmphasis;
            varying vec2 vUv;
            varying float vSeed;
            varying float vEmphasis;
            void main() {
              vUv = uv;
              vSeed = instanceSeed;
              vEmphasis = instanceEmphasis;
              vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * viewMatrix * world;
            }
          `}
        />
      </instancedMesh>

      <instancedMesh
        ref={accentBoxRef}
        args={[undefined, undefined, buildings.length * 2]}
        castShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#9fc4bb"
          emissive="#335d58"
          emissiveIntensity={0.18 + palette.night * 0.45}
          metalness={0.12}
          roughness={0.52}
        />
      </instancedMesh>
      <instancedMesh
        ref={accentCylinderRef}
        args={[undefined, undefined, buildings.length * 4]}
        castShadow
        frustumCulled={false}
      >
        <cylinderGeometry args={[1, 1, 1, 8]} />
        <meshStandardMaterial
          color="#789b94"
          emissive="#2a625d"
          emissiveIntensity={0.1 + palette.night * 0.35}
          metalness={0.18}
          roughness={0.5}
        />
      </instancedMesh>

      <instancedMesh
        ref={hitboxRef}
        args={[undefined, undefined, buildings.length]}
        frustumCulled={false}
        onClick={(event) => {
          const building = buildingFromEvent(event);
          if (!building) return;
          event.stopPropagation();
          onSelectEntity(building.entityId);
        }}
        onDoubleClick={(event) => {
          const building = buildingFromEvent(event);
          if (!building) return;
          event.stopPropagation();
          onSelectEntity(building.entityId);
          onFocusEntity(building.entityId);
        }}
        onPointerMove={(event) => {
          const building = buildingFromEvent(event);
          if (!building) return;
          event.stopPropagation();
          onHoverEntity(building.entityId);
        }}
        onPointerOut={() => onHoverEntity(null)}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          colorWrite={false}
          depthWrite={false}
          opacity={0}
          transparent
        />
      </instancedMesh>
    </group>
  );
}

function writeFacadeSide(
  mesh: THREE.InstancedMesh,
  dummy: THREE.Object3D,
  building: PlannedBuilding,
  index: number,
  height: number,
  side: "north" | "south" | "east" | "west",
) {
  if (height < 0.01) {
    dummy.position.set(building.x, BUILDING_BASE_Y, building.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(HIDDEN_SCALE);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    return;
  }
  const inset = 0.035;
  const panelHeight = Math.max(0.08, height * 0.82);
  const panelY = BUILDING_BASE_Y + height * 0.49;
  if (side === "north" || side === "south") {
    dummy.position.set(
      building.x,
      panelY,
      building.z +
        (side === "north" ? -1 : 1) *
          (building.depth / 2 + inset),
    );
    dummy.rotation.set(0, side === "north" ? Math.PI : 0, 0);
    dummy.scale.set(building.width * 0.82, panelHeight, 1);
  } else {
    dummy.position.set(
      building.x +
        (side === "west" ? -1 : 1) *
          (building.width / 2 + inset),
      panelY,
      building.z,
    );
    dummy.rotation.set(
      0,
      side === "west" ? -Math.PI / 2 : Math.PI / 2,
      0,
    );
    dummy.scale.set(building.depth * 0.82, panelHeight, 1);
  }
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function writeFacilityAccents(
  boxMesh: THREE.InstancedMesh | null,
  cylinderMesh: THREE.InstancedMesh | null,
  dummy: THREE.Object3D,
  building: PlannedBuilding,
  buildingIndex: number,
  height: number,
) {
  if (!boxMesh || !cylinderMesh) return;
  const boxStart = buildingIndex * 2;
  const cylinderStart = buildingIndex * 4;
  for (let index = 0; index < 2; index += 1) {
    writeHidden(boxMesh, dummy, boxStart + index, building);
  }
  for (let index = 0; index < 4; index += 1) {
    writeHidden(
      cylinderMesh,
      dummy,
      cylinderStart + index,
      building,
    );
  }
  if (!building.facility || height < 0.08) return;

  const roofY = BUILDING_BASE_Y + height;
  const frontDirection = building.frontage.side === "north" ? -1 : 1;
  const frontZ =
    building.z + frontDirection * (building.depth / 2 + 0.14);
  switch (building.facility) {
    case "library": {
      writeBox(
        boxMesh,
        dummy,
        boxStart,
        building.x,
        BUILDING_BASE_Y + Math.min(height * 0.43, 0.75),
        frontZ,
        building.width * 0.9,
        Math.min(height * 0.18, 0.3),
        0.42,
      );
      const columnHeight = Math.min(height * 0.55, 1.05);
      for (let index = 0; index < 4; index += 1) {
        writeCylinder(
          cylinderMesh,
          dummy,
          cylinderStart + index,
          building.x +
            THREE.MathUtils.lerp(
              -building.width * 0.34,
              building.width * 0.34,
              index / 3,
            ),
          BUILDING_BASE_Y + columnHeight / 2,
          frontZ,
          0.055,
          columnHeight,
        );
      }
      break;
    }
    case "quality-lab": {
      writeBox(
        boxMesh,
        dummy,
        boxStart,
        building.x,
        BUILDING_BASE_Y + Math.min(0.42, height * 0.22),
        frontZ,
        building.width * 0.7,
        Math.min(0.6, height * 0.32),
        0.52,
      );
      writeCylinder(
        cylinderMesh,
        dummy,
        cylinderStart,
        building.x + building.width * 0.2,
        roofY + 0.18,
        building.z,
        0.23,
        0.34,
      );
      break;
    }
    case "maintenance": {
      for (let index = 0; index < 2; index += 1) {
        writeCylinder(
          cylinderMesh,
          dummy,
          cylinderStart + index,
          building.x + (index === 0 ? -1 : 1) * building.width * 0.23,
          roofY + 0.42,
          building.z,
          0.12,
          0.84,
        );
      }
      writeBox(
        boxMesh,
        dummy,
        boxStart,
        building.x,
        BUILDING_BASE_Y + Math.min(height * 0.42, 0.7),
        frontZ,
        building.width * 0.74,
        Math.min(height * 0.32, 0.55),
        0.4,
      );
      break;
    }
    case "control-center":
    case "data-center": {
      const mastCount =
        building.facility === "control-center" ? 3 : 4;
      for (let index = 0; index < mastCount; index += 1) {
        const angle = (index / mastCount) * Math.PI * 2;
        writeCylinder(
          cylinderMesh,
          dummy,
          cylinderStart + index,
          building.x + Math.cos(angle) * building.width * 0.16,
          roofY + 0.36 + index * 0.04,
          building.z + Math.sin(angle) * building.depth * 0.16,
          0.045,
          0.72 + index * 0.08,
        );
      }
      writeBox(
        boxMesh,
        dummy,
        boxStart,
        building.x,
        roofY + 0.12,
        building.z,
        building.width * 0.48,
        0.24,
        building.depth * 0.46,
      );
      break;
    }
    case "gateway": {
      writeBox(
        boxMesh,
        dummy,
        boxStart,
        building.x,
        roofY + 0.16,
        building.z,
        building.width * 0.56,
        0.32,
        building.depth * 0.56,
      );
      writeCylinder(
        cylinderMesh,
        dummy,
        cylinderStart,
        building.x,
        roofY + 0.85,
        building.z,
        0.075,
        1.7,
      );
      break;
    }
  }
}

function writeHidden(
  mesh: THREE.InstancedMesh,
  dummy: THREE.Object3D,
  index: number,
  building: PlannedBuilding,
) {
  dummy.position.set(building.x, BUILDING_BASE_Y, building.z);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.setScalar(HIDDEN_SCALE);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function writeBox(
  mesh: THREE.InstancedMesh,
  dummy: THREE.Object3D,
  index: number,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(width, Math.max(HIDDEN_SCALE, height), depth);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function writeCylinder(
  mesh: THREE.InstancedMesh,
  dummy: THREE.Object3D,
  index: number,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
) {
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, 0, 0);
  dummy.scale.set(radius, Math.max(HIDDEN_SCALE, height), radius);
  dummy.updateMatrix();
  mesh.setMatrixAt(index, dummy.matrix);
}

function profileFor(archetype: BuildingArchetype): MassProfile {
  const profiles: Record<BuildingArchetype, MassProfile> = {
    "low-rise-studio": {
      podiumTop: 0.18,
      mainTop: 0.88,
      podiumScale: [1, 1],
      mainScale: [0.92, 0.92],
      crownScale: [0.78, 0.78],
    },
    "mid-rise-mixed": {
      podiumTop: 0.2,
      mainTop: 0.82,
      podiumScale: [1, 1],
      mainScale: [0.82, 0.86],
      crownScale: [0.64, 0.68],
    },
    "office-slab": {
      podiumTop: 0.13,
      mainTop: 0.9,
      podiumScale: [1, 1],
      mainScale: [0.82, 0.96],
      crownScale: [0.62, 0.72],
    },
    "city-tower": {
      podiumTop: 0.12,
      mainTop: 0.76,
      podiumScale: [1, 1],
      mainScale: [0.7, 0.72],
      crownScale: [0.48, 0.5],
    },
    "industrial-shed": {
      podiumTop: 0.12,
      mainTop: 0.92,
      podiumScale: [1, 1],
      mainScale: [0.98, 0.98],
      crownScale: [0.78, 0.74],
    },
    "library-hall": {
      podiumTop: 0.22,
      mainTop: 0.8,
      podiumScale: [1, 1],
      mainScale: [0.94, 0.9],
      crownScale: [0.72, 0.68],
    },
    "quality-laboratory": {
      podiumTop: 0.2,
      mainTop: 0.76,
      podiumScale: [1, 1],
      mainScale: [0.84, 0.9],
      crownScale: [0.58, 0.64],
    },
    "maintenance-depot": {
      podiumTop: 0.16,
      mainTop: 0.9,
      podiumScale: [1, 1],
      mainScale: [0.96, 0.96],
      crownScale: [0.76, 0.72],
    },
    "control-data-center": {
      podiumTop: 0.22,
      mainTop: 0.78,
      podiumScale: [1, 1],
      mainScale: [0.86, 0.88],
      crownScale: [0.62, 0.66],
    },
    "gateway-landmark": {
      podiumTop: 0.14,
      mainTop: 0.7,
      podiumScale: [1, 1],
      mainScale: [0.72, 0.74],
      crownScale: [0.42, 0.44],
    },
  };
  return profiles[archetype];
}

export function getFacilityLabel(
  facility: FacilityKind | null,
): string | null {
  if (!facility) return null;
  const labels: Record<FacilityKind, string> = {
    library: "LIBRARY",
    "quality-lab": "QUALITY LAB",
    maintenance: "MAINTENANCE",
    "control-center": "CONTROL",
    "data-center": "DATA CENTER",
    gateway: "GATEWAY",
  };
  return labels[facility];
}

export function roleAccentForEntity(
  entity: CityVisualEntity,
): string {
  return CITY_ROLE_VISUALS[normalizeCityRole(entity.role)].accent;
}
