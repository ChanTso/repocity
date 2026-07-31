"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { stableCityHash } from "@/app/lib/city-visuals";
import type { LivingCityPlan } from "@/app/lib/living-city";
import {
  BLOCK_TOP_Y,
  getRoadSurfaceHeight,
  prepareRoute,
  sampleRoute,
  type PreparedRoute,
  type RouteSample,
  type TimeOfDayPalette,
} from "./living-city-render-utils";

interface MovingAgent {
  id: string;
  route: PreparedRoute;
  phase: number;
  speed: number;
  lane: number;
  color: string;
}

export interface LivingCityMobilityProps {
  plan: LivingCityPlan;
  palette: TimeOfDayPalette;
  showTraffic: boolean;
  showPedestrians: boolean;
  showWaterTraffic: boolean;
}

export function LivingCityMobility({
  plan,
  palette,
  showTraffic,
  showPedestrians,
  showWaterTraffic,
}: LivingCityMobilityProps) {
  const cars = useMemo(
    () =>
      makeAgents(
        plan.mobility.carRoutes.map(prepareRoute),
        "car",
        56,
      ),
    [plan],
  );
  const pedestrians = useMemo(
    () =>
      makeAgents(
        plan.mobility.pedestrianRoutes.map(prepareRoute),
        "pedestrian",
        72,
      ),
    [plan],
  );
  const boats = useMemo(
    () =>
      makeAgents(
        plan.mobility.boatRoutes.map(prepareRoute),
        "boat",
        8,
      ),
    [plan],
  );

  return (
    <group>
      <Cars
        agents={cars}
        palette={palette}
        plan={plan}
        visible={showTraffic}
      />
      <Pedestrians
        agents={pedestrians}
        visible={showPedestrians}
      />
      <Boats agents={boats} visible={showWaterTraffic} />
    </group>
  );
}

function Cars({
  agents,
  plan,
  palette,
  visible,
}: {
  agents: readonly MovingAgent[];
  plan: LivingCityPlan;
  palette: TimeOfDayPalette;
  visible: boolean;
}) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const headlightRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    const body = bodyRef.current;
    const cabin = cabinRef.current;
    const headlights = headlightRef.current;
    if (!visible || !body || !cabin || !headlights) return;
    agents.forEach((agent, index) => {
      const sampled = movingSample(
        agent,
        clock.elapsedTime,
        agent.route.route.closed,
      );
      const sideX = -sampled.dz * agent.lane;
      const sideZ = sampled.dx * agent.lane;
      const x = sampled.x + sideX;
      const z = sampled.z + sideZ;
      const roadY = getRoadSurfaceHeight(plan, sampled.x, sampled.z);
      const rotationY = Math.atan2(sampled.dx, sampled.dz);

      dummy.position.set(x, roadY + 0.13, z);
      dummy.rotation.set(0, rotationY, 0);
      dummy.scale.set(0.38, 0.18, 0.72);
      dummy.updateMatrix();
      body.setMatrixAt(index, dummy.matrix);
      color.set(agent.color);
      body.setColorAt(index, color);

      dummy.position.set(x, roadY + 0.27, z - 0.04);
      dummy.scale.set(0.29, 0.16, 0.38);
      dummy.updateMatrix();
      cabin.setMatrixAt(index, dummy.matrix);

      for (let light = 0; light < 2; light += 1) {
        const right = light === 0 ? -0.13 : 0.13;
        const forward = 0.37;
        dummy.position.set(
          x + sampled.dx * forward - sampled.dz * right,
          roadY + 0.16,
          z + sampled.dz * forward + sampled.dx * right,
        );
        dummy.rotation.set(0, rotationY, 0);
        dummy.scale.set(0.06, 0.055, 0.025);
        dummy.updateMatrix();
        headlights.setMatrixAt(index * 2 + light, dummy.matrix);
      }
    });
    for (const mesh of [body, cabin, headlights]) {
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
          metalness={0.36}
          roughness={0.44}
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
          color="#263a42"
          metalness={0.42}
          roughness={0.28}
        />
      </instancedMesh>
      <instancedMesh
        ref={headlightRef}
        args={[undefined, undefined, agents.length * 2]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color="#fff2bd"
          opacity={0.48 + palette.night * 0.52}
          toneMapped={false}
          transparent
        />
      </instancedMesh>
    </group>
  );
}

function Pedestrians({
  agents,
  visible,
}: {
  agents: readonly MovingAgent[];
  visible: boolean;
}) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    const body = bodyRef.current;
    const heads = headRef.current;
    if (!visible || !body || !heads) return;
    agents.forEach((agent, index) => {
      const sampled = movingSample(agent, clock.elapsedTime, true);
      const stride = Math.sin(clock.elapsedTime * 8 + agent.phase * 20) * 0.015;
      const x = sampled.x - sampled.dz * agent.lane * 0.35;
      const z = sampled.z + sampled.dx * agent.lane * 0.35;
      const rotationY = Math.atan2(sampled.dx, sampled.dz);
      dummy.position.set(x, BLOCK_TOP_Y + 0.2 + stride, z);
      dummy.rotation.set(0, rotationY, 0);
      dummy.scale.set(0.075, 0.33, 0.075);
      dummy.updateMatrix();
      body.setMatrixAt(index, dummy.matrix);
      color.set(agent.color);
      body.setColorAt(index, color);

      dummy.position.set(x, BLOCK_TOP_Y + 0.42 + stride, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(0.105);
      dummy.updateMatrix();
      heads.setMatrixAt(index, dummy.matrix);
    });
    body.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
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
        <cylinderGeometry args={[1, 1, 1, 6]} />
        <meshStandardMaterial color="#ffffff" />
      </instancedMesh>
      <instancedMesh
        ref={headRef}
        args={[undefined, undefined, agents.length]}
        castShadow
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#d6ad8d" roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

function Boats({
  agents,
  visible,
}: {
  agents: readonly MovingAgent[];
  visible: boolean;
}) {
  const hullRef = useRef<THREE.InstancedMesh>(null);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(({ clock }) => {
    const hull = hullRef.current;
    const cabin = cabinRef.current;
    if (!visible || !hull || !cabin) return;
    agents.forEach((agent, index) => {
      const sampled = movingSample(agent, clock.elapsedTime, false);
      const rotationY = Math.atan2(sampled.dx, sampled.dz);
      const bob = Math.sin(clock.elapsedTime * 2.1 + agent.phase * 12) * 0.035;
      dummy.position.set(sampled.x, 0.13 + bob, sampled.z);
      dummy.rotation.set(0, rotationY, Math.sin(clock.elapsedTime + agent.phase) * 0.018);
      dummy.scale.set(0.62, 0.2, 1.3);
      dummy.updateMatrix();
      hull.setMatrixAt(index, dummy.matrix);

      dummy.position.set(sampled.x, 0.37 + bob, sampled.z - 0.12);
      dummy.rotation.set(0, rotationY, 0);
      dummy.scale.set(0.38, 0.28, 0.48);
      dummy.updateMatrix();
      cabin.setMatrixAt(index, dummy.matrix);
    });
    hull.instanceMatrix.needsUpdate = true;
    cabin.instanceMatrix.needsUpdate = true;
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
        <meshStandardMaterial
          color="#bd5d47"
          metalness={0.1}
          roughness={0.72}
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
          color="#d8e0d8"
          metalness={0.08}
          roughness={0.55}
        />
      </instancedMesh>
    </group>
  );
}

function makeAgents(
  routes: readonly PreparedRoute[],
  mode: "car" | "pedestrian" | "boat",
  maximum: number,
): MovingAgent[] {
  const palette =
    mode === "car"
      ? ["#d95f4e", "#e1b44f", "#5f8fc5", "#d7ddd4", "#668b73"]
      : mode === "pedestrian"
        ? ["#e78167", "#6d92c7", "#d8b65d", "#7db39b", "#a77bb3"]
        : ["#c35e4b"];
  const agents: MovingAgent[] = [];
  for (const route of routes) {
    // Legacy Explore/Replay traffic is atmosphere-bearing. Its density must
    // not imply runtime volume or inherit static import weights.
    const desired = mode === "pedestrian" ? 3 : 2;
    for (let index = 0; index < desired; index += 1) {
      if (agents.length >= maximum) return agents;
      const seed = stableCityHash(`${route.route.id}:${mode}:${index}`);
      agents.push({
        id: `${route.route.id}:${index}`,
        route,
        phase: ((seed >>> 4) % 1000) / 1000,
        speed:
          mode === "car"
            ? 0.025 + ((seed >>> 9) % 15) / 1000
            : mode === "pedestrian"
              ? 0.012 + ((seed >>> 10) % 8) / 1000
              : 0.018 + ((seed >>> 8) % 6) / 1000,
        lane:
          mode === "car"
            ? index % 2 === 0
              ? -0.36
              : 0.36
            : ((seed % 5) - 2) * 0.22,
        color: palette[seed % palette.length]!,
      });
    }
  }
  return agents;
}

function movingSample(
  agent: MovingAgent,
  elapsed: number,
  closed: boolean,
): RouteSample {
  const raw = elapsed * agent.speed + agent.phase;
  if (closed) return sampleRoute(agent.route, raw);
  const cycle = ((raw % 2) + 2) % 2;
  const returning = cycle > 1;
  const sample = sampleRoute(
    agent.route,
    returning ? 2 - cycle : cycle,
  );
  return returning
    ? { ...sample, dx: -sample.dx, dz: -sample.dz }
    : sample;
}
