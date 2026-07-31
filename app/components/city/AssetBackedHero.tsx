"use client";

import { Edges, Html, useGLTF, useTexture } from "@react-three/drei";
import { Component, Suspense, useMemo, type ErrorInfo, type ReactNode } from "react";
import * as THREE from "three";
import {
  CITY_KIT_ROOT,
  type AssetBackedHeroPlan,
  type AssetHeroBuildingPlacement,
  type RiverEdgeAssetPlacement,
  type VisualContextAssetPlacement,
} from "@/app/lib/asset-city";

interface AssetBackedHeroProps {
  plan: AssetBackedHeroPlan;
  selectedEntityId?: string | null;
  onHoverEntity?: (entityId: string | null) => void;
  onSelectEntity?: (entityId: string) => void;
}

interface BoundaryState {
  error: Error | null;
}

class AssetBackedHeroBoundary extends Component<
  { children: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("RepoCity V4.2 city-kit load failed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Html center position={[0, 4, 0]}>
        <aside
          aria-label="City asset load failure"
          style={{
            background: "rgba(56, 20, 18, .94)",
            border: "1px solid #ef786b",
            borderRadius: 6,
            color: "#fff3ef",
            font: "600 11px/1.4 ui-monospace, monospace",
            maxWidth: 280,
            padding: "10px 12px",
          }}
        >
          CITY KIT LOAD FAILED — {this.state.error.message}
        </aside>
      </Html>
    );
  }
}

const TEXTURE_URLS = {
  brickBase: `${CITY_KIT_ROOT}/textures/brick-basecolor.png`,
  brickNormal: `${CITY_KIT_ROOT}/textures/brick-normal.png`,
  brickRoughness: `${CITY_KIT_ROOT}/textures/brick-roughness.png`,
  brickAo: `${CITY_KIT_ROOT}/textures/brick-ao.png`,
  limestoneBase: `${CITY_KIT_ROOT}/textures/limestone-basecolor.png`,
  limestoneNormal: `${CITY_KIT_ROOT}/textures/limestone-normal.png`,
  limestoneRoughness: `${CITY_KIT_ROOT}/textures/limestone-roughness.png`,
  limestoneAo: `${CITY_KIT_ROOT}/textures/limestone-ao.png`,
  concreteBase: `${CITY_KIT_ROOT}/textures/concrete-basecolor.png`,
  concreteNormal: `${CITY_KIT_ROOT}/textures/concrete-normal.png`,
  concreteRoughness: `${CITY_KIT_ROOT}/textures/concrete-roughness.png`,
  concreteAo: `${CITY_KIT_ROOT}/textures/concrete-ao.png`,
  metalBase: `${CITY_KIT_ROOT}/textures/metal-basecolor.png`,
  metalNormal: `${CITY_KIT_ROOT}/textures/metal-normal.png`,
  metalRoughness: `${CITY_KIT_ROOT}/textures/metal-roughness.png`,
  metalAo: `${CITY_KIT_ROOT}/textures/metal-ao.png`,
  riverBase: `${CITY_KIT_ROOT}/textures/river-basecolor.png`,
  riverNormal: `${CITY_KIT_ROOT}/textures/river-normal.png`,
  riverRoughness: `${CITY_KIT_ROOT}/textures/river-roughness.png`,
  riverAo: `${CITY_KIT_ROOT}/textures/river-ao.png`,
  roofBase: `${CITY_KIT_ROOT}/textures/roof-basecolor.png`,
  roofNormal: `${CITY_KIT_ROOT}/textures/roof-normal.png`,
  roofRoughness: `${CITY_KIT_ROOT}/textures/roof-roughness.png`,
  roofAo: `${CITY_KIT_ROOT}/textures/roof-ao.png`,
} as const;

type TextureSet = ReturnType<typeof useCityMaterialMaps>;

function useCityMaterialMaps() {
  const textures = useTexture(TEXTURE_URLS);
  return useMemo(() => {
    for (const [name, texture] of Object.entries(textures)) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      const repeat = name.startsWith("brick")
        ? 7
        : name.startsWith("limestone") || name.startsWith("concrete")
          ? 4
          : 3;
      texture.repeat.set(repeat, repeat);
      texture.anisotropy = 8;
      texture.colorSpace = name.endsWith("Base")
        ? THREE.SRGBColorSpace
        : THREE.NoColorSpace;
    }
    return {
      brick: {
        map: textures.brickBase,
        normalMap: textures.brickNormal,
        roughnessMap: textures.brickRoughness,
        aoMap: textures.brickAo,
      },
      limestone: {
        map: textures.limestoneBase,
        normalMap: textures.limestoneNormal,
        roughnessMap: textures.limestoneRoughness,
        aoMap: textures.limestoneAo,
      },
      concrete: {
        map: textures.concreteBase,
        normalMap: textures.concreteNormal,
        roughnessMap: textures.concreteRoughness,
        aoMap: textures.concreteAo,
      },
      metal: {
        map: textures.metalBase,
        normalMap: textures.metalNormal,
        roughnessMap: textures.metalRoughness,
        aoMap: textures.metalAo,
      },
      river: {
        map: textures.riverBase,
        normalMap: textures.riverNormal,
        roughnessMap: textures.riverRoughness,
        aoMap: textures.riverAo,
      },
      roof: {
        map: textures.roofBase,
        normalMap: textures.roofNormal,
        roughnessMap: textures.roofRoughness,
        aoMap: textures.roofAo,
      },
    };
  }, [textures]);
}

function materialFamily(name: string): keyof TextureSet | null {
  const value = name.toLowerCase();
  if (value.includes("brick")) return "brick";
  if (value.includes("limestone")) return "limestone";
  if (value.includes("concrete") || value.includes("sidewalk")) return "concrete";
  if (value.includes("river-wall")) return "river";
  if (value.includes("roof")) return "roof";
  if (
    value.includes("metal") ||
    value.includes("steel") ||
    value.includes("bronze") ||
    value.includes("signal-case")
  ) return "metal";
  return null;
}

function cloneAssetNode(
  scene: THREE.Group,
  nodeName: string,
  textures: TextureSet,
): THREE.Object3D {
  const source = scene.getObjectByName(nodeName);
  if (!source) throw new Error(`Missing required GLB node: ${nodeName}`);
  const clone = source.clone(true);
  clone.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const sourceMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const materials = sourceMaterials.map((sourceMaterial) => {
      const next = sourceMaterial.clone();
      const family = materialFamily(next.name);
      if (family && next instanceof THREE.MeshStandardMaterial) {
        const maps = textures[family];
        if (family === "metal") {
          next.normalMap = maps.normalMap;
          next.roughnessMap = maps.roughnessMap;
          next.aoMap = maps.aoMap;
        } else {
          Object.assign(next, maps);
          next.color.set("#ffffff");
        }
        next.normalScale.set(0.28, 0.28);
        next.needsUpdate = true;
      }
      if (next.name.includes("glass") && next instanceof THREE.MeshStandardMaterial) {
        next.transparent = true;
        next.opacity = 0.72;
        next.roughness = 0.16;
        next.metalness = 0.06;
        next.envMapIntensity = 1.4;
      }
      if (next.name.includes("interior") && next instanceof THREE.MeshStandardMaterial) {
        next.emissive.set("#b86f31");
        next.emissiveIntensity = 0.18;
      }
      return next;
    });
    object.material = Array.isArray(object.material) ? materials : materials[0]!;
  });
  return clone;
}

function BuildingAsset({
  placement,
  textures,
  onHoverEntity,
  onSelectEntity,
  selected,
}: {
  placement: AssetHeroBuildingPlacement;
  textures: TextureSet;
  onHoverEntity?: (entityId: string | null) => void;
  onSelectEntity?: (entityId: string) => void;
  selected: boolean;
}) {
  const gltf = useGLTF(`${CITY_KIT_ROOT}/${placement.source}`);
  const object = useMemo(
    () => cloneAssetNode(gltf.scene, placement.node, textures),
    [gltf.scene, placement.node, textures],
  );
  return (
    <group
      name={placement.id}
      position={[placement.x, placement.y, placement.z]}
      rotation={[0, placement.rotation, 0]}
      scale={[placement.width, placement.height, placement.depth]}
      userData={{
        assetBacked: true,
        envelopeId: placement.envelopeId,
        semanticBuildingId: placement.semanticBuildingId,
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelectEntity?.(placement.primaryEntityId);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onHoverEntity?.(null);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHoverEntity?.(placement.primaryEntityId);
      }}
    >
      <primitive object={object} />
      {selected ? (
        <mesh position={[0, 0.53, 0]} raycast={() => null}>
          <boxGeometry args={[1.08, 1.12, 1.04]} />
          <meshBasicMaterial
            transparent
            opacity={0}
          />
          <Edges color="#75f1d4" threshold={15} />
        </mesh>
      ) : null}
    </group>
  );
}

function StreetAsset({
  placement,
  scene,
  textures,
}: {
  placement: VisualContextAssetPlacement;
  scene: THREE.Group;
  textures: TextureSet;
}) {
  const object = useMemo(
    () => cloneAssetNode(scene, placement.node, textures),
    [placement.node, scene, textures],
  );
  return (
    <primitive
      object={object}
      position={[placement.x, placement.y, placement.z]}
      rotation={[0, placement.rotation, 0]}
      scale={placement.scale}
      raycast={() => null}
      userData={{ visualContext: true, semantic: false }}
    />
  );
}

function RiverAsset({
  placement,
  scene,
  textures,
}: {
  placement: RiverEdgeAssetPlacement;
  scene: THREE.Group;
  textures: TextureSet;
}) {
  const object = useMemo(
    () => cloneAssetNode(scene, placement.node, textures),
    [placement.node, scene, textures],
  );
  return (
    <primitive
      object={object}
      position={[placement.x, placement.y, placement.z]}
      rotation={[0, placement.rotation, 0]}
      scale={placement.scale}
      raycast={() => null}
      userData={{ visualContext: true, semantic: false }}
    />
  );
}

function AssetBackedHeroContent({
  plan,
  onHoverEntity,
  onSelectEntity,
  selectedEntityId,
}: AssetBackedHeroProps) {
  const textures = useCityMaterialMaps();
  const streetKit = useGLTF(`${CITY_KIT_ROOT}/street-river-modules.glb`);
  useGLTF(`${CITY_KIT_ROOT}/storefront-modules.glb`);
  return (
    <group name="asset-backed-hero-v4-2">
      {plan.buildings.map((placement) => (
        <BuildingAsset
          key={placement.id}
          onHoverEntity={onHoverEntity}
          onSelectEntity={onSelectEntity}
          placement={placement}
          selected={placement.primaryEntityId === selectedEntityId}
          textures={textures}
        />
      ))}
      {plan.visualContext.map((placement) => (
        <StreetAsset
          key={placement.id}
          placement={placement}
          scene={streetKit.scene}
          textures={textures}
        />
      ))}
      {plan.riverEdge.map((placement) => (
        <RiverAsset
          key={placement.id}
          placement={placement}
          scene={streetKit.scene}
          textures={textures}
        />
      ))}
    </group>
  );
}

function CityKitLoadingMarker() {
  return (
    <group name="city-kit-loading-marker" position={[0, 2.4, 0]}>
      <mesh rotation={[Math.PI / 4, Math.PI / 4, 0]}>
        <octahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial color="#67dcc2" emissive="#2c7e70" wireframe />
      </mesh>
      <Html center position={[0, 0.65, 0]}>
        <output style={{ color: "#d8fff5", font: "700 10px ui-monospace, monospace" }}>
          LOADING CITY KIT…
        </output>
      </Html>
    </group>
  );
}

export function AssetBackedHero(props: AssetBackedHeroProps) {
  return (
    <AssetBackedHeroBoundary>
      <Suspense fallback={<CityKitLoadingMarker />}>
        <AssetBackedHeroContent {...props} />
      </Suspense>
    </AssetBackedHeroBoundary>
  );
}

export default AssetBackedHero;
