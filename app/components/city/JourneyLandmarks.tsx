"use client";

import type {} from "@react-three/fiber";
import type { PlannedBuilding } from "@/app/lib/living-city";
import { BUILDING_BASE_Y } from "./living-city-render-utils";

export type JourneyFacilityKind =
  | "gateway"
  | "factory"
  | "station"
  | "customs"
  | "rail-yard"
  | "port"
  | "civic"
  | "construction"
  | "module";

export interface JourneyLandmarkProps {
  building: PlannedBuilding;
  kind: JourneyFacilityKind;
  active: boolean;
  color: string;
}

export function getJourneyLandmarkHeight(
  building: PlannedBuilding,
): number {
  return Math.max(3.4, Math.min(8.5, building.height * 0.84 + 1.8));
}

interface SilhouetteProps {
  width: number;
  depth: number;
  height: number;
  active: boolean;
  color: string;
}

/**
 * A small set of deliberately different macro silhouettes for the Golden
 * Journey. These objects carry only facility identity; data and evidence stay
 * in the journey model instead of being invented by the renderer.
 */
export function JourneyLandmark({
  building,
  kind,
  active,
  color,
}: JourneyLandmarkProps) {
  const width = Math.max(3.4, building.width * 1.16);
  const depth = Math.max(3.2, building.depth * 1.16);
  const height = getJourneyLandmarkHeight(building);
  const rotationY = frontageRotation(building.frontage.side);
  const silhouette = { width, depth, height, active, color };

  return (
    <group
      name={`journey-landmark-${kind}`}
      position={[building.x, BUILDING_BASE_Y + 0.025, building.z]}
      rotation-y={rotationY}
      userData={{ entityId: building.entityId, journeyFacility: kind }}
    >
      <LandmarkBase {...silhouette} />
      {kind === "gateway" ? (
        <GatewayLandmark {...silhouette} />
      ) : kind === "factory" ? (
        <FactoryLandmark {...silhouette} />
      ) : kind === "station" ? (
        <StationLandmark {...silhouette} />
      ) : kind === "customs" ? (
        <CustomsLandmark {...silhouette} />
      ) : kind === "rail-yard" ? (
        <RailYardLandmark {...silhouette} />
      ) : kind === "port" ? (
        <PortLandmark {...silhouette} />
      ) : kind === "civic" ? (
        <CivicLandmark {...silhouette} />
      ) : kind === "construction" ? (
        <ConstructionLandmark {...silhouette} />
      ) : (
        <ModuleLandmark {...silhouette} />
      )}
    </group>
  );
}

function LandmarkBase({
  width,
  depth,
  active,
  color,
}: SilhouetteProps) {
  const radius = Math.max(width, depth) * 0.72;

  return (
    <>
      <mesh position={[0, 0.055, 0]} receiveShadow>
        <boxGeometry args={[width * 1.12, 0.11, depth * 1.12]} />
        <meshStandardMaterial
          color="#425650"
          emissive={color}
          emissiveIntensity={active ? 0.09 : 0.018}
          metalness={0.12}
          roughness={0.78}
        />
      </mesh>
      <mesh position={[0, 0.018, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[radius, radius + 0.09, 48]} />
        <meshBasicMaterial
          color={color}
          depthWrite={false}
          opacity={active ? 0.86 : 0.2}
          toneMapped={false}
          transparent
        />
      </mesh>
    </>
  );
}

function GatewayLandmark(props: SilhouetteProps) {
  const { width, depth, height, active, color } = props;
  const pylonHeight = height * 0.78;
  const pylonWidth = width * 0.2;

  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh
          castShadow
          key={side}
          position={[
            side * width * 0.31,
            0.12 + pylonHeight / 2,
            depth * 0.05,
          ]}
        >
          <boxGeometry args={[pylonWidth, pylonHeight, depth * 0.42]} />
          <ShellMaterial active={active} color={color} />
        </mesh>
      ))}
      <mesh
        castShadow
        position={[0, 0.12 + pylonHeight * 0.78, depth * 0.05]}
      >
        <boxGeometry args={[width * 0.82, height * 0.16, depth * 0.38]} />
        <ShellMaterial active={active} color={color} />
      </mesh>
      <mesh
        position={[0, 0.18 + pylonHeight * 0.45, depth * 0.04]}
      >
        <torusGeometry
          args={[width * 0.18, Math.max(0.045, width * 0.025), 8, 28, Math.PI]}
        />
        <AccentMaterial active={active} color={color} />
      </mesh>
      <mesh position={[0, 0.15, -depth * 0.34]} receiveShadow>
        <boxGeometry args={[width * 0.68, 0.12, depth * 0.28]} />
        <AccentMaterial active={active} color={color} />
      </mesh>
    </group>
  );
}

function FactoryLandmark(props: SilhouetteProps) {
  const { width, depth, height, active, color } = props;
  const shedHeight = height * 0.4;

  return (
    <group>
      <mesh
        castShadow
        position={[-width * 0.09, 0.12 + shedHeight / 2, depth * 0.05]}
      >
        <boxGeometry args={[width * 0.74, shedHeight, depth * 0.72]} />
        <ShellMaterial active={active} color={color} />
      </mesh>
      <mesh
        castShadow
        position={[width * 0.31, 0.12 + shedHeight * 0.34, -depth * 0.2]}
      >
        <boxGeometry args={[width * 0.28, shedHeight * 0.68, depth * 0.3]} />
        <ShellMaterial active={active} color={color} />
      </mesh>
      {[-0.24, 0, 0.24].map((offset) => (
        <mesh
          castShadow
          key={offset}
          position={[
            offset * width,
            0.12 + shedHeight + height * 0.08,
            depth * 0.04,
          ]}
          rotation-z={offset === 0 ? -0.08 : 0.08}
        >
          <boxGeometry args={[width * 0.22, height * 0.12, depth * 0.6]} />
          <AccentMaterial active={active} color={color} />
        </mesh>
      ))}
      {[-0.19, 0.2].map((offset, index) => {
        const chimneyHeight = height * (index === 0 ? 0.62 : 0.78);
        return (
          <mesh
            castShadow
            key={offset}
            position={[
              offset * width,
              0.12 + chimneyHeight / 2,
              depth * 0.3,
            ]}
          >
            <cylinderGeometry
              args={[width * 0.045, width * 0.065, chimneyHeight, 10]}
            />
            <ShellMaterial active={active} color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

function StationLandmark(props: SilhouetteProps) {
  const { width, depth, height, active, color } = props;
  const canopyHeight = height * 0.38;

  return (
    <group>
      <mesh position={[0, 0.16, depth * 0.02]} receiveShadow>
        <boxGeometry args={[width * 0.92, 0.16, depth * 0.76]} />
        <ShellMaterial active={active} color={color} />
      </mesh>
      {[-0.25, 0.25].map((x) => (
        <mesh
          castShadow
          key={x}
          position={[x * width, 0.22 + canopyHeight / 2, depth * 0.02]}
        >
          <boxGeometry args={[width * 0.06, canopyHeight, depth * 0.64]} />
          <ShellMaterial active={active} color={color} />
        </mesh>
      ))}
      <mesh
        castShadow
        position={[0, 0.22 + canopyHeight, depth * 0.02]}
        rotation-z={Math.PI / 24}
      >
        <boxGeometry args={[width * 0.84, height * 0.1, depth * 0.7]} />
        <AccentMaterial active={active} color={color} />
      </mesh>
      <mesh
        castShadow
        position={[0, 0.22 + height * 0.46, depth * 0.3]}
      >
        <boxGeometry args={[width * 0.22, height * 0.7, depth * 0.18]} />
        <ShellMaterial active={active} color={color} />
      </mesh>
      <mesh
        position={[0, 0.22 + height * 0.65, depth * 0.2]}
        rotation-x={Math.PI / 2}
      >
        <cylinderGeometry args={[width * 0.075, width * 0.075, 0.07, 20]} />
        <AccentMaterial active={active} color={color} />
      </mesh>
      {[-0.34, 0.34].map((x) => (
        <mesh key={x} position={[x * width, 0.23, 0]}>
          <boxGeometry args={[width * 0.025, 0.055, depth * 0.96]} />
          <RailMaterial active={active} color={color} />
        </mesh>
      ))}
    </group>
  );
}

function CustomsLandmark(props: SilhouetteProps) {
  const { width, depth, height, active, color } = props;
  const hallHeight = height * 0.48;

  return (
    <group>
      <mesh
        castShadow
        position={[0, 0.12 + hallHeight / 2, depth * 0.2]}
      >
        <boxGeometry args={[width * 0.72, hallHeight, depth * 0.38]} />
        <ShellMaterial active={active} color={color} />
      </mesh>
      <mesh
        castShadow
        position={[0, 0.16 + height * 0.49, -depth * 0.16]}
      >
        <boxGeometry args={[width * 0.94, height * 0.11, depth * 0.22]} />
        <AccentMaterial active={active} color={color} />
      </mesh>
      {[-0.35, 0.35].map((x) => (
        <mesh
          castShadow
          key={x}
          position={[x * width, 0.17 + height * 0.25, -depth * 0.16]}
        >
          <boxGeometry args={[width * 0.14, height * 0.5, depth * 0.24]} />
          <ShellMaterial active={active} color={color} />
        </mesh>
      ))}
      {[-0.2, 0, 0.2].map((x) => (
        <group key={x}>
          <mesh position={[x * width, height * 0.2, -depth * 0.34]}>
            <boxGeometry args={[width * 0.025, height * 0.35, depth * 0.025]} />
            <RailMaterial active={active} color={color} />
          </mesh>
          <mesh
            position={[
              x * width + width * 0.07,
              height * 0.25,
              -depth * 0.34,
            ]}
            rotation-z={-Math.PI / 10}
          >
            <boxGeometry args={[width * 0.18, 0.045, depth * 0.035]} />
            <AccentMaterial active={active} color={color} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function RailYardLandmark(props: SilhouetteProps) {
  const { width, depth, height, active, color } = props;
  const trackXs = [-0.3, 0, 0.3];

  return (
    <group>
      {trackXs.flatMap((trackX) =>
        [-0.045, 0.045].map((railOffset) => (
          <mesh
            key={`${trackX}:${railOffset}`}
            position={[(trackX + railOffset) * width, 0.15, 0]}
          >
            <boxGeometry args={[width * 0.018, 0.07, depth * 0.94]} />
            <RailMaterial active={active} color={color} />
          </mesh>
        )),
      )}
      {Array.from({ length: 7 }, (_, index) => (
        <mesh
          key={index}
          position={[0, 0.115, -depth * 0.42 + (index * depth * 0.84) / 6]}
        >
          <boxGeometry args={[width * 0.84, 0.055, depth * 0.025]} />
          <meshStandardMaterial color="#513a2e" roughness={0.9} />
        </mesh>
      ))}
      {[-0.31, 0.31].map((x) => (
        <mesh
          castShadow
          key={x}
          position={[x * width, 0.14 + height * 0.34, depth * 0.14]}
        >
          <boxGeometry args={[width * 0.05, height * 0.68, depth * 0.06]} />
          <ShellMaterial active={active} color={color} />
        </mesh>
      ))}
      <mesh
        castShadow
        position={[0, 0.14 + height * 0.66, depth * 0.14]}
      >
        <boxGeometry args={[width * 0.72, height * 0.08, depth * 0.08]} />
        <AccentMaterial active={active} color={color} />
      </mesh>
      <mesh position={[0, 0.17, depth * 0.32]}>
        <cylinderGeometry args={[width * 0.2, width * 0.2, 0.08, 28]} />
        <AccentMaterial active={active} color={color} />
      </mesh>
    </group>
  );
}

function PortLandmark(props: SilhouetteProps) {
  const { width, depth, height, active, color } = props;
  const mastHeight = height * 0.82;

  return (
    <group>
      <mesh position={[0, 0.16, depth * 0.1]} receiveShadow>
        <boxGeometry args={[width * 0.96, 0.18, depth * 0.72]} />
        <ShellMaterial active={active} color={color} />
      </mesh>
      {[
        [-0.26, 0.18, 0.28],
        [-0.02, 0.18, 0.24],
        [0.2, 0.18, 0.3],
        [-0.18, 0.32, 0.22],
      ].map(([x, y, z], index) => (
        <mesh
          castShadow
          key={index}
          position={[x! * width, 0.16 + y! * height, z! * depth]}
        >
          <boxGeometry args={[width * 0.2, height * 0.18, depth * 0.2]} />
          <meshStandardMaterial
            color={index % 2 === 0 ? color : "#d68a52"}
            emissive={color}
            emissiveIntensity={active ? 0.22 : 0.04}
            roughness={0.62}
          />
        </mesh>
      ))}
      <mesh
        castShadow
        position={[width * 0.32, 0.18 + mastHeight / 2, -depth * 0.02]}
      >
        <boxGeometry args={[width * 0.07, mastHeight, depth * 0.07]} />
        <ShellMaterial active={active} color={color} />
      </mesh>
      <mesh
        castShadow
        position={[
          width * 0.12,
          0.18 + mastHeight * 0.88,
          -depth * 0.16,
        ]}
        rotation-x={-Math.PI / 16}
      >
        <boxGeometry args={[width * 0.48, height * 0.075, depth * 0.08]} />
        <AccentMaterial active={active} color={color} />
      </mesh>
      <mesh
        position={[-width * 0.11, 0.2 + mastHeight * 0.52, -depth * 0.16]}
      >
        <cylinderGeometry args={[0.025, 0.025, mastHeight * 0.58, 7]} />
        <RailMaterial active={active} color={color} />
      </mesh>
      <mesh position={[0, 0.19, -depth * 0.46]}>
        <boxGeometry args={[width, 0.12, depth * 0.1]} />
        <AccentMaterial active={active} color={color} />
      </mesh>
    </group>
  );
}

function CivicLandmark(props: SilhouetteProps) {
  const { width, depth, height, active, color } = props;
  const rotundaRadius = Math.min(width, depth) * 0.25;

  return (
    <group>
      <mesh castShadow position={[0, 0.2, depth * 0.08]}>
        <boxGeometry args={[width * 0.86, 0.3, depth * 0.66]} />
        <ShellMaterial active={active} color={color} />
      </mesh>
      <mesh
        castShadow
        position={[0, 0.34 + height * 0.24, depth * 0.08]}
      >
        <cylinderGeometry
          args={[rotundaRadius, rotundaRadius * 1.08, height * 0.48, 24]}
        />
        <ShellMaterial active={active} color={color} />
      </mesh>
      <mesh
        castShadow
        position={[0, 0.34 + height * 0.51, depth * 0.08]}
        scale={[rotundaRadius, height * 0.18, rotundaRadius]}
      >
        <sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <AccentMaterial active={active} color={color} />
      </mesh>
      <mesh position={[0, 0.36 + height * 0.76, depth * 0.08]}>
        <cylinderGeometry args={[0.035, 0.055, height * 0.34, 9]} />
        <AccentMaterial active={active} color={color} />
      </mesh>
      {[-0.3, -0.1, 0.1, 0.3].map((x) => (
        <mesh
          castShadow
          key={x}
          position={[x * width, 0.34 + height * 0.13, -depth * 0.28]}
        >
          <cylinderGeometry
            args={[width * 0.025, width * 0.03, height * 0.26, 10]}
          />
          <RailMaterial active={active} color={color} />
        </mesh>
      ))}
    </group>
  );
}

function ConstructionLandmark(props: SilhouetteProps) {
  const { width, depth, height, active, color } = props;
  const frameWidth = width * 0.68;
  const frameDepth = depth * 0.62;

  return (
    <group>
      {[0.22, 0.42, 0.62, 0.82].map((level) => (
        <mesh key={level} position={[0, 0.08 + height * level, depth * 0.08]}>
          <boxGeometry args={[frameWidth, height * 0.045, frameDepth]} />
          <meshStandardMaterial
            color="#22383c"
            emissive={color}
            emissiveIntensity={active ? 0.18 : 0.025}
            metalness={0.42}
            roughness={0.52}
            transparent
            opacity={0.82}
          />
        </mesh>
      ))}
      {[
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ].map(([x, z]) => (
        <mesh
          castShadow
          key={`${x}:${z}`}
          position={[
            x! * frameWidth * 0.45,
            0.08 + height * 0.47,
            depth * 0.08 + z! * frameDepth * 0.45,
          ]}
        >
          <boxGeometry args={[width * 0.045, height * 0.9, depth * 0.045]} />
          <RailMaterial active={active} color={color} />
        </mesh>
      ))}
      <mesh
        castShadow
        position={[width * 0.38, 0.08 + height * 0.55, -depth * 0.2]}
      >
        <boxGeometry args={[width * 0.055, height * 1.1, depth * 0.055]} />
        <AccentMaterial active={active} color={color} />
      </mesh>
      <mesh
        castShadow
        position={[width * 0.06, 0.08 + height * 1.03, -depth * 0.2]}
      >
        <boxGeometry args={[width * 0.7, height * 0.055, depth * 0.06]} />
        <AccentMaterial active={active} color={color} />
      </mesh>
      <mesh
        position={[-width * 0.26, 0.08 + height * 0.74, -depth * 0.2]}
      >
        <cylinderGeometry args={[0.02, 0.02, height * 0.54, 6]} />
        <RailMaterial active={active} color={color} />
      </mesh>
    </group>
  );
}

function ModuleLandmark(props: SilhouetteProps) {
  const { width, depth, height, active, color } = props;
  const pods = [
    [-0.28, -0.22, 0.42],
    [0.28, -0.22, 0.5],
    [-0.28, 0.24, 0.54],
    [0.28, 0.24, 0.44],
  ];

  return (
    <group>
      {pods.map(([x, z, heightScale], index) => (
        <mesh
          castShadow
          key={index}
          position={[
            x! * width,
            0.12 + (height * heightScale!) / 2,
            z! * depth,
          ]}
        >
          <boxGeometry
            args={[width * 0.38, height * heightScale!, depth * 0.34]}
          />
          <ShellMaterial active={active} color={color} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.12 + height * 0.33, 0]}>
        <cylinderGeometry
          args={[width * 0.12, width * 0.16, height * 0.66, 8]}
        />
        <AccentMaterial active={active} color={color} />
      </mesh>
      {[
        [0, -0.22],
        [0, 0.22],
        [-0.28, 0],
        [0.28, 0],
      ].map(([x, z], index) => (
        <mesh
          key={index}
          position={[x! * width, height * 0.28, z! * depth]}
          rotation-y={index < 2 ? 0 : Math.PI / 2}
        >
          <boxGeometry args={[width * 0.08, height * 0.08, depth * 0.36]} />
          <AccentMaterial active={active} color={color} />
        </mesh>
      ))}
    </group>
  );
}

function ShellMaterial({
  active,
  color,
}: {
  active: boolean;
  color: string;
}) {
  return (
    <meshStandardMaterial
      color="#91aaa4"
      emissive={color}
      emissiveIntensity={active ? 0.1 : 0.018}
      metalness={0.16}
      roughness={0.66}
    />
  );
}

function AccentMaterial({
  active,
  color,
}: {
  active: boolean;
  color: string;
}) {
  return (
    <meshStandardMaterial
      color={color}
      emissive={color}
      emissiveIntensity={active ? 0.92 : 0.2}
      metalness={0.24}
      roughness={0.42}
      toneMapped={!active}
    />
  );
}

function RailMaterial({
  active,
  color,
}: {
  active: boolean;
  color: string;
}) {
  return (
    <meshStandardMaterial
      color="#819098"
      emissive={color}
      emissiveIntensity={active ? 0.3 : 0.025}
      metalness={0.72}
      roughness={0.36}
    />
  );
}

function frontageRotation(side: PlannedBuilding["frontage"]["side"]): number {
  switch (side) {
    case "north":
      return 0;
    case "south":
      return Math.PI;
    case "east":
      return -Math.PI / 2;
    case "west":
      return Math.PI / 2;
  }
}
