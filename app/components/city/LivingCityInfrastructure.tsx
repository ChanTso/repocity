"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { LivingCityPlan } from "@/app/lib/living-city";
import {
  BLOCK_TOP_Y,
  ELEVATED_ROAD_Y,
  ROAD_TOP_Y,
  type TimeOfDayPalette,
  WORLD_GROUND_Y,
} from "./living-city-render-utils";

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

export interface LivingCityInfrastructureProps {
  plan: LivingCityPlan;
  palette: TimeOfDayPalette;
  hiddenDistrictIds: ReadonlySet<string>;
  showDistrictLabels: boolean;
}

export function LivingCityInfrastructure({
  plan,
  palette,
  hiddenDistrictIds,
  showDistrictLabels,
}: LivingCityInfrastructureProps) {
  const worldPadding = Math.max(18, Math.min(42, plan.bounds.width * 0.22));
  const roadGeometry = useMemo(() => makeRoadGeometry(plan), [plan]);
  const blockGeometry = useMemo(() => makeBlockGeometry(plan), [plan]);
  const parkGeometry = useMemo(() => makeParkGeometry(plan), [plan]);
  const propGeometry = useMemo(() => makePropGeometry(plan), [plan]);

  return (
    <group>
      <mesh
        position={[
          plan.bounds.x,
          WORLD_GROUND_Y - 0.11,
          plan.bounds.z,
        ]}
        receiveShadow
      >
        <boxGeometry
          args={[
            plan.bounds.width + worldPadding,
            0.2,
            plan.bounds.depth + worldPadding,
          ]}
        />
        <meshStandardMaterial
          color={palette.night > 0.55 ? "#071111" : "#172522"}
          metalness={0}
          roughness={1}
        />
      </mesh>

      {plan.geography.river ? (
        <River
          palette={palette}
          river={plan.geography.river}
        />
      ) : null}

      <StaticBoxInstances
        boxes={blockGeometry.sidewalks}
        color="#58625d"
        material="standard"
        receiveShadow
      />
      <StaticBoxInstances
        boxes={blockGeometry.curbs}
        color="#99a39b"
        material="standard"
        receiveShadow
      />
      <StaticBoxInstances
        boxes={parkGeometry.lawns}
        color="#315d3e"
        material="standard"
        receiveShadow
      />
      <StaticBoxInstances
        boxes={parkGeometry.paths}
        color="#b1a78d"
        material="standard"
        receiveShadow
      />

      <StaticBoxInstances
        boxes={roadGeometry.groundDecks}
        color="#222a2c"
        material="standard"
        receiveShadow
      />
      <StaticBoxInstances
        boxes={roadGeometry.elevatedDecks}
        castShadow
        color="#343c3f"
        material="standard"
        receiveShadow
      />
      <StaticBoxInstances
        boxes={roadGeometry.bridgeDecks}
        castShadow
        color="#394246"
        material="standard"
        receiveShadow
      />
      <StaticBoxInstances
        boxes={roadGeometry.guardRails}
        castShadow
        color="#859096"
        material="standard"
      />
      <StaticCylinderInstances
        cylinders={roadGeometry.pillars}
        castShadow
        color="#697477"
        receiveShadow
        radialSegments={8}
      />
      <StaticBoxInstances
        boxes={roadGeometry.laneMarkings}
        color="#e1cc78"
        material="basic"
      />
      <StaticBoxInstances
        boxes={roadGeometry.crosswalks}
        color="#e6e9df"
        material="basic"
      />

      <StaticCylinderInstances
        cylinders={parkGeometry.fountains}
        color="#8ba8a4"
        receiveShadow
        radialSegments={18}
      />
      <StaticCylinderInstances
        cylinders={propGeometry.trunks}
        castShadow
        color="#67513d"
        radialSegments={6}
      />
      <StaticCylinderInstances
        cylinders={propGeometry.treeCrowns}
        castShadow
        color="#3f764a"
        radialSegments={7}
      />
      <StaticCylinderInstances
        cylinders={propGeometry.lightPoles}
        color="#293338"
        radialSegments={6}
      />
      <StreetlightBulbs
        bulbs={propGeometry.lightBulbs}
        palette={palette}
      />

      {showDistrictLabels
        ? plan.districts.map((district) =>
            hiddenDistrictIds.has(district.id) ? null : (
              <DistrictLabel
                district={district}
                key={district.id}
              />
            ),
          )
        : null}
    </group>
  );
}

function River({
  river,
  palette,
}: {
  river: NonNullable<LivingCityPlan["geography"]["river"]>;
  palette: TimeOfDayPalette;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(palette.water) },
      uNight: { value: palette.night },
    }),
    [palette.night, palette.water],
  );

  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    material.uniforms.uTime!.value = clock.elapsedTime;
    (
      material.uniforms.uColor!.value as THREE.Color
    ).set(palette.water);
    material.uniforms.uNight!.value = palette.night;
  });

  return (
    <group>
      <mesh
        position={[river.x, 0.035, river.z]}
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[river.width, river.depth, 1, 1]} />
        <shaderMaterial
          ref={materialRef}
          fragmentShader={`
            uniform float uTime;
            uniform float uNight;
            uniform vec3 uColor;
            varying vec3 vWorld;
            void main() {
              float waveA = sin(vWorld.z * .62 + uTime * 1.25);
              float waveB = sin(vWorld.x * 2.2 - uTime * 1.8);
              float glint = smoothstep(.62, 1., waveA * .55 + waveB * .45);
              vec3 color = mix(uColor * .72, uColor + vec3(.18, .24, .22), glint * (.32 + uNight * .18));
              gl_FragColor = vec4(color, .94);
            }
          `}
          transparent
          uniforms={uniforms}
          vertexShader={`
            varying vec3 vWorld;
            void main() {
              vec4 world = modelMatrix * vec4(position, 1.0);
              vWorld = world.xyz;
              gl_Position = projectionMatrix * viewMatrix * world;
            }
          `}
        />
      </mesh>
      <StaticBoxInstances
        boxes={[
          {
            x: river.x - river.width / 2 - 0.72,
            y: 0.04,
            z: river.z,
            width: 1.45,
            height: 0.14,
            depth: river.depth,
          },
          {
            x: river.x + river.width / 2 + 0.72,
            y: 0.04,
            z: river.z,
            width: 1.45,
            height: 0.14,
            depth: river.depth,
          },
        ]}
        color="#52664b"
        material="standard"
        receiveShadow
      />
    </group>
  );
}

function DistrictLabel({
  district,
}: {
  district: LivingCityPlan["districts"][number];
}) {
  return (
    <Html
      center
      position={[
        district.x - district.width / 2 + 2.2,
        BLOCK_TOP_Y + 0.44,
        district.z - district.depth / 2 + 1.35,
      ]}
      zIndexRange={[20, 0]}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 8px",
          border: `1px solid ${district.color}70`,
          borderRadius: 7,
          color: "#dceae4",
          background: "rgba(5, 14, 18, .82)",
          boxShadow: "0 5px 18px rgba(0, 0, 0, .24)",
          fontFamily:
            "var(--font-geist-mono), ui-monospace, monospace",
          fontSize: 9,
          fontWeight: 750,
          letterSpacing: ".09em",
          lineHeight: 1,
          pointerEvents: "none",
          textTransform: "uppercase",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 99,
            background: district.color,
          }}
        />
        <span>{district.name}</span>
        <span style={{ color: "#7f9a91", fontSize: 8 }}>
          {district.entityIds.length}
        </span>
      </div>
    </Html>
  );
}

function StreetlightBulbs({
  bulbs,
  palette,
}: {
  bulbs: readonly CylinderInstance[];
  palette: TimeOfDayPalette;
}) {
  const boxes = useMemo(
    () =>
      bulbs.map(
        (bulb): BoxInstance => ({
          x: bulb.x,
          y: bulb.y,
          z: bulb.z,
          width: 0.12,
          height: 0.12,
          depth: 0.12,
        }),
      ),
    [bulbs],
  );
  return (
    <StaticBoxInstances
      boxes={boxes}
      color={palette.night > 0.15 ? "#ffe29a" : "#b9c4ba"}
      emissive="#ffbc57"
      emissiveIntensity={0.15 + palette.night * 3.6}
      material="standard"
    />
  );
}

function StaticBoxInstances({
  boxes,
  color,
  emissive = "#000000",
  emissiveIntensity = 0,
  material,
  castShadow = false,
  receiveShadow = false,
}: {
  boxes: readonly BoxInstance[];
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
  material: "basic" | "standard";
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const workingColor = useMemo(() => new THREE.Color(), []);

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
      if (box.color) {
        workingColor.set(box.color);
        mesh.setColorAt(index, workingColor);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [boxes, dummy, workingColor]);

  if (boxes.length === 0) return null;
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, boxes.length]}
      castShadow={castShadow}
      frustumCulled={false}
      receiveShadow={receiveShadow}
    >
      <boxGeometry args={[1, 1, 1]} />
      {material === "basic" ? (
        <meshBasicMaterial color={color} toneMapped={false} />
      ) : (
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          metalness={0.03}
          roughness={0.86}
          vertexColors={boxes.some((box) => Boolean(box.color))}
        />
      )}
    </instancedMesh>
  );
}

function StaticCylinderInstances({
  cylinders,
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
      if (cylinder.color) {
        workingColor.set(cylinder.color);
        mesh.setColorAt(index, workingColor);
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cylinders, dummy, workingColor]);

  if (cylinders.length === 0) return null;
  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, cylinders.length]}
      castShadow={castShadow}
      frustumCulled={false}
      receiveShadow={receiveShadow}
    >
      <cylinderGeometry args={[1, 1, 1, radialSegments]} />
      <meshStandardMaterial
        color={color}
        metalness={0.02}
        roughness={0.86}
        vertexColors={cylinders.some((item) => Boolean(item.color))}
      />
    </instancedMesh>
  );
}

function makeRoadGeometry(plan: LivingCityPlan) {
  const groundDecks: BoxInstance[] = [];
  const elevatedDecks: BoxInstance[] = [];
  const bridgeDecks: BoxInstance[] = [];
  const guardRails: BoxInstance[] = [];
  const laneMarkings: BoxInstance[] = [];
  const crosswalks: BoxInstance[] = [];
  const pillars: CylinderInstance[] = [];

  for (const road of plan.roads) {
    const length =
      road.axis === "x"
        ? Math.abs(road.end.x - road.start.x)
        : Math.abs(road.end.z - road.start.z);
    const x = (road.start.x + road.end.x) / 2;
    const z = (road.start.z + road.end.z) / 2;
    if (road.surface === "bridge") continue;

    const deck: BoxInstance = {
      x,
      y: road.level === "elevated" ? ELEVATED_ROAD_Y : 0.085,
      z,
      width: road.axis === "x" ? length : road.width,
      height: road.level === "elevated" ? 0.26 : 0.16,
      depth: road.axis === "x" ? road.width : length,
    };
    (road.level === "elevated" ? elevatedDecks : groundDecks).push(deck);

    const dashSpacing = road.roadClass === "arterial" ? 4.2 : 5.5;
    const dashCount = Math.max(1, Math.floor(length / dashSpacing));
    for (let index = 0; index < dashCount; index += 1) {
      const progress = (index + 0.5) / dashCount;
      laneMarkings.push({
        x:
          road.axis === "x"
            ? THREE.MathUtils.lerp(road.start.x, road.end.x, progress)
            : x,
        y:
          road.level === "elevated"
            ? ELEVATED_ROAD_Y + 0.142
            : ROAD_TOP_Y + 0.006,
        z:
          road.axis === "z"
            ? THREE.MathUtils.lerp(road.start.z, road.end.z, progress)
            : z,
        width: road.axis === "x" ? 1.65 : 0.055,
        height: 0.018,
        depth: road.axis === "z" ? 1.65 : 0.055,
      });
    }

    if (road.level === "elevated") {
      const pillarCount = Math.max(2, Math.floor(length / 7));
      for (let index = 0; index <= pillarCount; index += 1) {
        const progress = index / pillarCount;
        pillars.push({
          x:
            road.axis === "x"
              ? THREE.MathUtils.lerp(road.start.x, road.end.x, progress)
              : x,
          y: ELEVATED_ROAD_Y / 2,
          z:
            road.axis === "z"
              ? THREE.MathUtils.lerp(road.start.z, road.end.z, progress)
              : z,
          radius: 0.25,
          height: ELEVATED_ROAD_Y,
        });
      }
      for (const side of [-1, 1]) {
        guardRails.push({
          x:
            road.axis === "x"
              ? x
              : x + side * (road.width / 2 - 0.08),
          y: ELEVATED_ROAD_Y + 0.28,
          z:
            road.axis === "x"
              ? z + side * (road.width / 2 - 0.08)
              : z,
          width: road.axis === "x" ? length : 0.1,
          height: 0.32,
          depth: road.axis === "x" ? 0.1 : length,
        });
      }
    }
  }

  for (const bridge of plan.bridges) {
    const segments = 12;
    const step = bridge.width / segments;
    for (let index = 0; index < segments; index += 1) {
      const t0 = index / segments;
      const t1 = (index + 1) / segments;
      const y0 = ROAD_TOP_Y + Math.sin(t0 * Math.PI) * 0.7;
      const y1 = ROAD_TOP_Y + Math.sin(t1 * Math.PI) * 0.7;
      const y = (y0 + y1) / 2;
      const x = bridge.x - bridge.width / 2 + (index + 0.5) * step;
      const slope = Math.atan2(y1 - y0, step);
      const segmentLength = Math.hypot(step, y1 - y0) + 0.035;
      bridgeDecks.push({
        x,
        y,
        z: bridge.z,
        width: segmentLength,
        height: 0.22,
        depth: bridge.depth,
        rotationZ: slope,
      });
      laneMarkings.push({
        x,
        y: y + 0.12,
        z: bridge.z,
        width: segmentLength * 0.6,
        height: 0.018,
        depth: 0.055,
        rotationZ: slope,
      });
      for (const side of [-1, 1]) {
        guardRails.push({
          x,
          y: y + 0.32,
          z: bridge.z + side * (bridge.depth / 2 - 0.08),
          width: segmentLength,
          height: 0.36,
          depth: 0.09,
          rotationZ: slope,
        });
      }
    }
    for (const offset of [-0.34, 0.34]) {
      pillars.push({
        x: bridge.x + bridge.width * offset,
        y: 0.42,
        z: bridge.z,
        radius: 0.28,
        height: 0.84,
      });
    }
  }

  const horizontal = plan.roads.filter(
    (road) =>
      road.axis === "x" &&
      road.level === "ground" &&
      road.surface === "ground",
  );
  const vertical = plan.roads.filter(
    (road) =>
      road.axis === "z" &&
      road.level === "ground" &&
      road.surface === "ground",
  );
  let intersectionCount = 0;
  for (const xRoad of horizontal) {
    for (const zRoad of vertical) {
      const x = zRoad.start.x;
      const z = xRoad.start.z;
      if (
        x < Math.min(xRoad.start.x, xRoad.end.x) - 0.01 ||
        x > Math.max(xRoad.start.x, xRoad.end.x) + 0.01 ||
        z < Math.min(zRoad.start.z, zRoad.end.z) - 0.01 ||
        z > Math.max(zRoad.start.z, zRoad.end.z) + 0.01
      ) {
        continue;
      }
      intersectionCount += 1;
      if (intersectionCount > 120) break;
      for (const side of [-1, 1]) {
        for (let stripe = -1; stripe <= 1; stripe += 1) {
          crosswalks.push(
            {
              x: x + stripe * 0.34,
              y: ROAD_TOP_Y + 0.009,
              z: z + side * 0.72,
              width: 0.18,
              height: 0.018,
              depth: 0.58,
            },
            {
              x: x + side * 0.72,
              y: ROAD_TOP_Y + 0.01,
              z: z + stripe * 0.34,
              width: 0.58,
              height: 0.018,
              depth: 0.18,
            },
          );
        }
      }
    }
    if (intersectionCount > 120) break;
  }

  return {
    groundDecks,
    elevatedDecks,
    bridgeDecks,
    guardRails,
    laneMarkings,
    crosswalks,
    pillars,
  };
}

function makeBlockGeometry(plan: LivingCityPlan) {
  const sidewalks: BoxInstance[] = [];
  const curbs: BoxInstance[] = [];
  const districtColor = new Map(
    plan.districts.map((district) => [district.id, district.color]),
  );
  for (const block of plan.blocks) {
    if (block.kind === "park") continue;
    sidewalks.push({
      x: block.x,
      y: BLOCK_TOP_Y / 2,
      z: block.z,
      width: block.width - 0.34,
      height: BLOCK_TOP_Y,
      depth: block.depth - 0.34,
      color: new THREE.Color(
        districtColor.get(block.districtId) ?? "#6f7b74",
      )
        .lerp(new THREE.Color("#737b76"), 0.7)
        .getStyle(),
    });
    for (const side of [-1, 1]) {
      curbs.push(
        {
          x: block.x,
          y: 0.14,
          z: block.z + side * (block.depth / 2 - 0.17),
          width: block.width,
          height: 0.13,
          depth: 0.16,
        },
        {
          x: block.x + side * (block.width / 2 - 0.17),
          y: 0.14,
          z: block.z,
          width: 0.16,
          height: 0.13,
          depth: block.depth,
        },
      );
    }
  }
  return { sidewalks, curbs };
}

function makeParkGeometry(plan: LivingCityPlan) {
  const lawns: BoxInstance[] = [];
  const paths: BoxInstance[] = [];
  const fountains: CylinderInstance[] = [];
  for (const park of plan.parks) {
    lawns.push({
      x: park.x,
      y: 0.12,
      z: park.z,
      width: park.width - 0.34,
      height: 0.23,
      depth: park.depth - 0.34,
    });
    paths.push(
      {
        x: park.x,
        y: 0.247,
        z: park.z,
        width: park.width - 1,
        height: 0.025,
        depth: 0.62,
      },
      {
        x: park.x,
        y: 0.248,
        z: park.z,
        width: 0.62,
        height: 0.025,
        depth: park.depth - 1,
      },
    );
    fountains.push({
      x: park.x,
      y: 0.34,
      z: park.z,
      radius: 0.62,
      height: 0.2,
    });
  }
  return { lawns, paths, fountains };
}

function makePropGeometry(plan: LivingCityPlan) {
  const trunks: CylinderInstance[] = [];
  const treeCrowns: CylinderInstance[] = [];
  const lightPoles: CylinderInstance[] = [];
  const lightBulbs: CylinderInstance[] = [];
  for (const prop of plan.props) {
    if (prop.kind === "tree") {
      trunks.push({
        x: prop.x,
        y: BLOCK_TOP_Y + 0.34 * prop.scale,
        z: prop.z,
        radius: 0.08 * prop.scale,
        height: 0.68 * prop.scale,
        rotationY: prop.rotationY,
      });
      treeCrowns.push({
        x: prop.x,
        y: BLOCK_TOP_Y + 0.98 * prop.scale,
        z: prop.z,
        radius: 0.42 * prop.scale,
        height: 0.9 * prop.scale,
        rotationY: prop.rotationY,
        color:
          prop.id.charCodeAt(prop.id.length - 1) % 2 === 0
            ? "#477e4b"
            : "#396b45",
      });
    } else {
      lightPoles.push({
        x: prop.x,
        y: BLOCK_TOP_Y + 0.62,
        z: prop.z,
        radius: 0.035,
        height: 1.24,
        rotationY: prop.rotationY,
      });
      lightBulbs.push({
        x: prop.x,
        y: BLOCK_TOP_Y + 1.27,
        z: prop.z,
        radius: 0.08,
        height: 0.08,
      });
    }
  }
  return { trunks, treeCrowns, lightPoles, lightBulbs };
}
