"use client";

import { Edges, Line } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { SemanticComponent } from "@/app/lib/semantic-city";
import type {
  SemanticLabel,
  SemanticRelationOverlay,
} from "@/app/lib/semantic-lens";
import type { UrbanFabricPlan } from "@/app/lib/urban-fabric";

const BLOCK_Y = 0.31;

export interface SemanticLensLayerProps {
  urbanFabric: UrbanFabricPlan;
  components: readonly SemanticComponent[];
  labels: readonly SemanticLabel[];
  relations: readonly SemanticRelationOverlay[];
  selectedComponentId?: string | null;
  selectedEntityId?: string | null;
  overlayOpacity: number;
  relationOpacity: number;
  onSelectComponent?: (componentId: string) => void;
  onSelectEntity?: (entityId: string) => void;
  onSelectRelation?: (relationId: string) => void;
}

/**
 * A deliberately small semantic projection over the existing city. It owns no
 * repository facts and creates no new selectable entities: every hit target,
 * label and line resolves to a compiler-provided component, entity or relation.
 */
export function SemanticLensLayer({
  urbanFabric,
  components,
  labels,
  relations,
  selectedComponentId,
  selectedEntityId,
  overlayOpacity,
  relationOpacity,
  onSelectComponent,
  onSelectEntity,
  onSelectRelation,
}: SemanticLensLayerProps) {
  const componentById = new Map(components.map((item) => [item.id, item]));
  const componentColor = new Map(
    urbanFabric.componentAssignments.map((item) => [item.componentId, item.accentColor]),
  );
  const selectedBlockIds = new Set(
    selectedComponentId
      ? urbanFabric.componentBlockIds[selectedComponentId] ?? []
      : [],
  );
  const selectedAddress = selectedEntityId
    ? urbanFabric.entityAddresses[selectedEntityId]
    : undefined;

  const stop = (event: ThreeEvent<MouseEvent>) => event.stopPropagation();

  return (
    <group name="semantic-lens-layer">
      {urbanFabric.blocks.map((block) => {
        if (!selectedBlockIds.has(block.id)) return null;
        const component = selectedComponentId
          ? componentById.get(selectedComponentId)
          : undefined;
        const color = componentColor.get(component?.id ?? "") ?? "#71e0c1";
        return (
          <mesh
            key={block.id}
            name={`semantic-component-block:${block.id}`}
            position={[block.x, BLOCK_Y, block.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(event) => {
              stop(event);
              if (selectedComponentId) onSelectComponent?.(selectedComponentId);
            }}
          >
            <planeGeometry args={[block.width * 0.94, block.depth * 0.94]} />
            <meshBasicMaterial
              color={color}
              depthWrite={false}
              opacity={0.12 * overlayOpacity}
              transparent
            />
          </mesh>
        );
      })}

      {urbanFabric.buildings.map((building) => {
        const inSelectedComponent = building.componentId === selectedComponentId;
        const selected = building.id === selectedAddress?.buildingId;
        if (!inSelectedComponent && !selected) return null;
        const component = componentById.get(building.componentId);
        const color = selected
          ? "#effff9"
          : componentColor.get(component?.id ?? "") ?? "#71e0c1";
        return (
          <group
            key={building.id}
            name={`semantic-building:${building.id}`}
            position={[building.x, building.height / 2 + 0.25, building.z]}
            rotation={[0, building.rotation, 0]}
          >
            <mesh
              onClick={(event) => {
                stop(event);
                onSelectEntity?.(building.primaryEntityId);
              }}
            >
              <boxGeometry args={[building.width + 0.25, building.height + 0.3, building.depth + 0.25]} />
              <meshBasicMaterial
                color={color}
                depthWrite={false}
                opacity={(selected ? 0.09 : 0.035) * overlayOpacity}
                transparent
              />
              <Edges
                color={color}
                opacity={(selected ? 0.96 : 0.38) * overlayOpacity}
                transparent
              />
            </mesh>
          </group>
        );
      })}

      {selectedAddress
        ? urbanFabric.architecturalEnvelopes
            .filter(
              (envelope) =>
                envelope.semanticBuildingId === selectedAddress.buildingId,
            )
            .map((envelope) => (
              <mesh
                key={envelope.id}
                name={`semantic-facade-mass:${envelope.id}`}
                position={[envelope.x, envelope.height / 2 + 0.25, envelope.z]}
                rotation={[0, envelope.rotation, 0]}
                onClick={(event) => {
                  stop(event);
                  if (selectedEntityId) onSelectEntity?.(selectedEntityId);
                }}
              >
                <boxGeometry
                  args={[
                    envelope.width + 0.12,
                    envelope.height + 0.16,
                    envelope.depth + 0.12,
                  ]}
                />
                <meshBasicMaterial
                  color="#effff9"
                  depthWrite={false}
                  opacity={0.018 * overlayOpacity}
                  transparent
                />
                <Edges
                  color="#b8fff0"
                  opacity={0.68 * overlayOpacity}
                  transparent
                />
              </mesh>
            ))
        : null}

      {selectedAddress ? (
        <group
          name="semantic-entrance-marker"
          position={[selectedAddress.entrance.x, 0.63, selectedAddress.entrance.z]}
          onClick={(event) => {
            stop(event);
            if (selectedEntityId) onSelectEntity?.(selectedEntityId);
          }}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.22, 0.34, 24]} />
            <meshBasicMaterial color="#ffffff" depthTest={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.82, 8]} />
            <meshBasicMaterial color="#72e0c1" toneMapped={false} />
          </mesh>
        </group>
      ) : null}

      {relations.map((overlay) => (
        <group key={overlay.id} name={`semantic-relation:${overlay.id}`}>
          <Line
            points={[
              [overlay.sourcePoint.x, overlay.sourcePoint.y, overlay.sourcePoint.z],
              [overlay.targetPoint.x, overlay.targetPoint.y, overlay.targetPoint.z],
            ]}
            color="#8dcbd3"
            lineWidth={overlay.width}
            opacity={0.72 * relationOpacity}
            transparent
            dashed
            dashSize={0.38}
            gapSize={0.24}
            onClick={(event) => {
              stop(event);
              onSelectRelation?.(overlay.id);
            }}
          />
          <mesh position={[overlay.targetPoint.x, overlay.targetPoint.y, overlay.targetPoint.z]}>
            <sphereGeometry args={[0.13, 10, 8]} />
            <meshBasicMaterial color="#8dcbd3" opacity={relationOpacity} transparent />
          </mesh>
        </group>
      ))}

      {labels.map((label) => (
        <SemanticWorldLabel
          key={label.id}
          label={label}
          onSelectComponent={onSelectComponent}
          onSelectEntity={onSelectEntity}
        />
      ))}
    </group>
  );
}

function SemanticWorldLabel({
  label,
  onSelectComponent,
  onSelectEntity,
}: {
  label: SemanticLabel;
  onSelectComponent?: (componentId: string) => void;
  onSelectEntity?: (entityId: string) => void;
}) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const maxDistance =
    label.kind === "file"
      ? 220
      : label.kind === "building"
        ? 360
        : label.kind === "component"
          ? 1_200
          : 720;
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "rgba(5, 21, 23, 0.92)";
    context.strokeStyle = label.kind === "flow-station"
      ? "rgba(255, 179, 93, 0.92)"
      : label.selected
        ? "rgba(114, 224, 193, 0.95)"
        : "rgba(126, 220, 199, 0.62)";
    context.lineWidth = label.selected ? 5 : 3;
    context.beginPath();
    context.roundRect(3, 3, 506, 122, 18);
    context.fill();
    context.stroke();
    context.fillStyle = label.kind === "flow-station" ? "#ffd39d" : "#e4f5f0";
    context.font = "700 28px ui-monospace, SFMono-Regular, monospace";
    context.textBaseline = "middle";
    context.fillText(label.label.slice(0, 24), 24, label.detail ? 47 : 64, 464);
    if (label.detail) {
      context.fillStyle = "#88a39c";
      context.font = "18px ui-monospace, SFMono-Regular, monospace";
      context.fillText(label.detail.slice(0, 42), 24, 88, 464);
    }
    const next = new THREE.CanvasTexture(canvas);
    next.colorSpace = THREE.SRGBColorSpace;
    next.needsUpdate = true;
    return next;
  }, [label.detail, label.kind, label.label, label.selected]);
  useEffect(() => () => texture?.dispose(), [texture]);
  useFrame(({ camera }) => {
    const sprite = spriteRef.current;
    if (!sprite) return;
    const dx = camera.position.x - label.x;
    const dy = camera.position.y - label.y;
    const dz = camera.position.z - label.z;
    sprite.visible = dx * dx + dy * dy + dz * dz <= maxDistance * maxDistance;
  });
  if (!texture) return null;
  const scale = label.kind === "component" ? 9.4 : label.selected ? 8.8 : 7.6;
  return (
    <sprite
      ref={spriteRef}
      name={`semantic-label:${label.id}`}
      position={[label.x, label.y, label.z]}
      scale={[scale, scale / 4, 1]}
      onClick={(event) => {
        event.stopPropagation();
        if (label.entityId) onSelectEntity?.(label.entityId);
        else if (label.componentId) onSelectComponent?.(label.componentId);
      }}
    >
      <spriteMaterial
        map={texture}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        transparent
      />
    </sprite>
  );
}

export default SemanticLensLayer;
