import type {
  DemoDistrict,
  DemoEntity,
  DemoRelation,
} from "./demo-data";
import type {
  SemanticCityPlan,
  SemanticComponent,
} from "./semantic-city";
import type {
  UrbanBlock,
  UrbanBuildingEnvelope,
  UrbanFabricPlan,
} from "./urban-fabric";

export type CityMode = "explore" | "map" | "journey" | "replay";
export type RelationDirection = "off" | "incoming" | "outgoing" | "both";
export type SemanticLabelLevel = "auto" | "district" | "building";
export type SemanticProvenance =
  | "repository-fact"
  | "static-inference"
  | "deterministic-projection"
  | "deterministic-simulation"
  | "observed-evidence";

export type SemanticSelection =
  | { kind: "none" }
  | { kind: "component"; componentId: string }
  | { kind: "building"; buildingId: string }
  | { kind: "entity"; entityId: string; symbolName?: string }
  | { kind: "relation"; relationId: string };

export interface SemanticLensState {
  mode: CityMode;
  selection: SemanticSelection;
  relationDirection: RelationDirection;
  labelLevel: SemanticLabelLevel;
}

export function transitionSemanticLensMode(
  state: SemanticLensState,
  mode: CityMode,
): SemanticLensState {
  return { ...state, mode };
}

export interface SemanticSelectionTransition {
  state: SemanticLensState;
  selectedEntityId: string | null;
  selectedSymbol: string | null;
}

/**
 * Keeps the semantic selection and the legacy file-inspector state coherent.
 * A component click is a scope selection, so it deliberately clears any file
 * child instead of inventing a representative file for that component.
 */
export function transitionSemanticSelection(
  state: SemanticLensState,
  selection: SemanticSelection,
  currentSelectedEntityId?: string | null,
): SemanticSelectionTransition {
  return {
    state: { ...state, selection },
    selectedEntityId:
      selection.kind === "entity"
        ? selection.entityId
        : selection.kind === "relation"
          ? currentSelectedEntityId ?? null
          : null,
    selectedSymbol:
      selection.kind === "entity" ? selection.symbolName ?? null : null,
  };
}

export interface SemanticSelectionPresentation {
  componentId: string | null;
  entityId: string | null;
  inspectorScope: "empty" | "component" | "building" | "file" | "relation";
}

/**
 * Resolves the only component/file pairing that may be presented by the UI.
 * Component and building scopes never leak a stale file inspector.
 */
export function resolveSemanticSelectionPresentation({
  selection,
  presentedEntityId,
  urbanFabric,
}: {
  selection: SemanticSelection;
  presentedEntityId?: string | null;
  urbanFabric: UrbanFabricPlan;
}): SemanticSelectionPresentation {
  if (selection.kind === "component") {
    return {
      componentId: selection.componentId,
      entityId: null,
      inspectorScope: "component",
    };
  }
  if (selection.kind === "building") {
    const building = urbanFabric.buildings.find(
      (candidate) => candidate.id === selection.buildingId,
    );
    return {
      componentId: building?.componentId ?? null,
      entityId: null,
      inspectorScope: "building",
    };
  }
  if (selection.kind === "none") {
    return { componentId: null, entityId: null, inspectorScope: "empty" };
  }
  const entityId =
    selection.kind === "entity"
      ? presentedEntityId ?? selection.entityId
      : presentedEntityId ?? null;
  return {
    componentId: entityId
      ? urbanFabric.entityAddresses[entityId]?.componentId ?? null
      : null,
    entityId,
    inspectorScope: selection.kind === "relation" ? "relation" : "file",
  };
}

export interface CityVisualProfile {
  mode: CityMode;
  /** CSS filter over the complete WebGL canvas, not only city geometry. */
  canvasBrightness: number;
  /** CSS filter over the complete WebGL canvas, not only city geometry. */
  canvasSaturation: number;
  ambientOpacity: number;
  ambientSpeedScale: number;
  semanticOverlayOpacity: number;
  relationOpacity: number;
}

const MODE_PROFILES: Readonly<Record<CityMode, CityVisualProfile>> = {
  explore: {
    mode: "explore",
    canvasBrightness: 1,
    canvasSaturation: 1,
    ambientOpacity: 1,
    ambientSpeedScale: 1,
    semanticOverlayOpacity: 0.25,
    relationOpacity: 0,
  },
  map: {
    mode: "map",
    canvasBrightness: 0.924,
    canvasSaturation: 0.38,
    ambientOpacity: 0.25,
    ambientSpeedScale: 0.72,
    semanticOverlayOpacity: 1,
    relationOpacity: 0.8,
  },
  journey: {
    mode: "journey",
    canvasBrightness: 0.95,
    canvasSaturation: 0.62,
    ambientOpacity: 0.25,
    ambientSpeedScale: 0.78,
    semanticOverlayOpacity: 0.65,
    relationOpacity: 0.2,
  },
  replay: {
    mode: "replay",
    canvasBrightness: 0.942,
    canvasSaturation: 0.5,
    ambientOpacity: 0.2,
    ambientSpeedScale: 0.58,
    semanticOverlayOpacity: 0.6,
    relationOpacity: 0.15,
  },
};

export function resolveModeVisualProfile(mode: CityMode): CityVisualProfile {
  return MODE_PROFILES[mode];
}

export interface AmbientLayerToggles {
  traffic: boolean;
  pedestrians: boolean;
  waterTraffic: boolean;
}

export interface AmbientPresentation extends AmbientLayerToggles {
  emphasis: number;
  speedScale: number;
}

export function resolveAmbientPresentation(
  profile: CityVisualProfile,
  toggles: AmbientLayerToggles,
): AmbientPresentation {
  return {
    ...toggles,
    emphasis: profile.ambientOpacity,
    speedScale: profile.ambientSpeedScale,
  };
}

export function resolveLayerPlayback({
  journeyPlaying,
  reducedMotion,
}: {
  journeyPlaying: boolean;
  reducedMotion: boolean;
}): { ambientPlaying: boolean; evidenceJourneyPlaying: boolean } {
  if (reducedMotion) {
    return { ambientPlaying: false, evidenceJourneyPlaying: false };
  }
  return {
    ambientPlaying: true,
    evidenceJourneyPlaying: journeyPlaying,
  };
}

export interface ResolvedComponentSelection {
  component: SemanticComponent;
  blockIds: string[];
  blocks: UrbanBlock[];
  buildingIds: string[];
  buildings: UrbanBuildingEnvelope[];
  entityIds: string[];
}

export function resolveComponentSelection(
  componentId: string,
  semanticPlan: SemanticCityPlan,
  urbanFabric: UrbanFabricPlan,
): ResolvedComponentSelection | null {
  const component = semanticPlan.components.find(
    (candidate) => candidate.id === componentId,
  );
  if (!component) return null;
  const blockIds = [...(urbanFabric.componentBlockIds[componentId] ?? [])].sort();
  const blockIdSet = new Set(blockIds);
  const blocks = urbanFabric.blocks
    .filter((block) => blockIdSet.has(block.id))
    .sort((left, right) => left.id.localeCompare(right.id, "en"));
  const buildings = urbanFabric.buildings
    .filter((building) => building.componentId === componentId)
    .sort((left, right) => left.id.localeCompare(right.id, "en"));
  return {
    component,
    blockIds,
    blocks,
    buildingIds: buildings.map((building) => building.id),
    buildings,
    entityIds: [...component.entityIds].sort(),
  };
}

export interface SemanticAddress {
  entityId: string;
  componentId: string;
  componentLabel: string;
  districtId: string;
  districtLabel: string;
  blockId: string;
  parcelId: string;
  buildingId: string;
  buildingLabel: string;
  entrance: { x: number; y?: number; z: number };
  label: string;
}

function commonDirectory(paths: readonly string[]): string {
  if (paths.length === 0) return "unmapped module";
  const directories = paths.map((path) => path.split("/").slice(0, -1));
  const common: string[] = [];
  const shortest = Math.min(...directories.map((parts) => parts.length));
  for (let index = 0; index < shortest; index += 1) {
    const value = directories[0]![index];
    if (!value || directories.some((parts) => parts[index] !== value)) break;
    common.push(value);
  }
  return common.join("/") || directories[0]!.join("/") || "repository root";
}

export function resolveSemanticAddress(
  entityId: string,
  entities: readonly DemoEntity[],
  districts: readonly DemoDistrict[],
  semanticPlan: SemanticCityPlan,
  urbanFabric: UrbanFabricPlan,
): SemanticAddress | null {
  const address = urbanFabric.entityAddresses[entityId];
  if (!address) return null;
  const component = semanticPlan.components.find(
    (candidate) => candidate.id === address.componentId,
  );
  const building = urbanFabric.buildings.find(
    (candidate) => candidate.id === address.buildingId,
  );
  if (!component || !building) return null;
  const district = districts.find((candidate) => candidate.id === component.districtId);
  const represented = building.entityIds
    .map((id) => entities.find((entity) => entity.id === id)?.path)
    .filter((path): path is string => Boolean(path));
  const buildingLabel = commonDirectory(represented);
  const districtLabel = district?.name ?? component.label;
  return {
    entityId,
    componentId: component.id,
    componentLabel: component.label,
    districtId: component.districtId,
    districtLabel,
    blockId: address.blockId,
    parcelId: address.parcelId,
    buildingId: address.buildingId,
    buildingLabel,
    entrance: address.entrance,
    label: `${districtLabel} · ${address.blockId} · ${address.buildingId}`,
  };
}

export interface ResolvedBuildingSelection {
  building: UrbanBuildingEnvelope;
  component: SemanticComponent;
  address: SemanticAddress;
  entities: DemoEntity[];
  moduleLabel: string;
  fileCount: number;
  exportCount: number;
}

export function resolveBuildingSelection(
  entityId: string,
  entities: readonly DemoEntity[],
  districts: readonly DemoDistrict[],
  semanticPlan: SemanticCityPlan,
  urbanFabric: UrbanFabricPlan,
): ResolvedBuildingSelection | null {
  const address = resolveSemanticAddress(
    entityId,
    entities,
    districts,
    semanticPlan,
    urbanFabric,
  );
  if (!address) return null;
  const building = urbanFabric.buildings.find(
    (candidate) => candidate.id === address.buildingId,
  );
  const component = semanticPlan.components.find(
    (candidate) => candidate.id === address.componentId,
  );
  if (!building || !component) return null;
  const represented = building.entityIds
    .map((id) => entities.find((entity) => entity.id === id))
    .filter((entity): entity is DemoEntity => Boolean(entity))
    .sort((left, right) => left.path.localeCompare(right.path, "en"));
  return {
    building,
    component,
    address,
    entities: represented,
    moduleLabel: commonDirectory(represented.map((entity) => entity.path)),
    fileCount: represented.length,
    exportCount: represented.reduce(
      (total, entity) => total + entity.maxMetrics.exports,
      0,
    ),
  };
}

export interface SemanticBreadcrumbItem {
  id: string;
  kind: "repository" | "component" | "building" | "file" | "symbol";
  label: string;
  provenance: "repository-fact" | "deterministic-projection";
  componentId?: string;
  buildingId?: string;
  entityId?: string;
  symbolName?: string;
}

export function resolveSemanticBreadcrumb({
  repositoryName,
  selectedComponentId,
  selectedEntityId,
  selectedSymbol,
  entities,
  districts,
  semanticPlan,
  urbanFabric,
}: {
  repositoryName: string;
  selectedComponentId?: string | null;
  selectedEntityId?: string | null;
  selectedSymbol?: string | null;
  entities: readonly DemoEntity[];
  districts: readonly DemoDistrict[];
  semanticPlan: SemanticCityPlan;
  urbanFabric: UrbanFabricPlan;
}): SemanticBreadcrumbItem[] {
  const items: SemanticBreadcrumbItem[] = [
    {
      id: `repository:${repositoryName}`,
      kind: "repository",
      label: repositoryName,
      provenance: "repository-fact",
    },
  ];
  if (selectedComponentId) {
    const component = semanticPlan.components.find(
      (candidate) => candidate.id === selectedComponentId,
    );
    if (component) {
      items.push({
        id: `component:${component.id}`,
        kind: "component",
        label: component.label,
        provenance: "repository-fact",
        componentId: component.id,
      });
    }
    if (!selectedEntityId) return items;
  }
  if (!selectedEntityId) return items;
  const entity = entities.find((candidate) => candidate.id === selectedEntityId);
  const selection = resolveBuildingSelection(
    selectedEntityId,
    entities,
    districts,
    semanticPlan,
    urbanFabric,
  );
  if (!entity || !selection) return items;
  if (!items.some((item) => item.kind === "component")) {
    items.push({
      id: `component:${selection.component.id}`,
      kind: "component",
      label: selection.component.label,
      provenance: "repository-fact",
      componentId: selection.component.id,
    });
  }
  items.push(
    {
      id: `building:${selection.building.id}`,
      kind: "building",
      label: selection.moduleLabel,
      provenance: "deterministic-projection",
      componentId: selection.component.id,
      buildingId: selection.building.id,
      entityId: selection.building.primaryEntityId,
    },
    {
      id: `entity:${entity.id}`,
      kind: "file",
      label: entity.name,
      provenance: "repository-fact",
      componentId: selection.component.id,
      buildingId: selection.building.id,
      entityId: entity.id,
    },
  );
  if (selectedSymbol && entity.exportNames.includes(selectedSymbol)) {
    items.push({
      id: `symbol:${entity.id}:${selectedSymbol}`,
      kind: "symbol",
      label: selectedSymbol,
      provenance: "repository-fact",
      componentId: selection.component.id,
      buildingId: selection.building.id,
      entityId: entity.id,
      symbolName: selectedSymbol,
    });
  }
  return items;
}

export interface PlacementExplanation {
  componentLabel: string;
  moduleLabel: string;
  deterministicBuildingId: string;
  districtLabel: string;
  blockId: string;
  addressLabel: string;
  fileCount: number;
  exportCount: number;
  representativeFiles: string[];
  groupingRule: string;
  placementRule: string;
  dependencyProximityUsed: false;
  mappingKind: "repository fact + deterministic spatial projection";
  relatedEntityIds: string[];
}

export function resolvePlacementExplanation(
  entityId: string,
  entities: readonly DemoEntity[],
  districts: readonly DemoDistrict[],
  semanticPlan: SemanticCityPlan,
  urbanFabric: UrbanFabricPlan,
): PlacementExplanation | null {
  const selection = resolveBuildingSelection(
    entityId,
    entities,
    districts,
    semanticPlan,
    urbanFabric,
  );
  if (!selection) return null;
  const strategy = selection.component.cluster.strategy;
  const groupingRule =
    strategy === "district"
      ? "package/workspace district ownership, then shared path prefix"
      : strategy === "path-fallback"
        ? "deterministic shared path-prefix fallback"
        : "district ownership with deterministic overflow grouping";
  return {
    componentLabel: selection.component.label,
    moduleLabel: selection.moduleLabel,
    deterministicBuildingId: selection.building.id,
    districtLabel: selection.address.districtLabel,
    blockId: selection.address.blockId,
    addressLabel: selection.address.label,
    fileCount: selection.fileCount,
    exportCount: selection.exportCount,
    representativeFiles: selection.entities.slice(0, 3).map((entity) => entity.path),
    groupingRule,
    placementRule:
      "connected component region + deterministic seeded block, parcel and entrance assignment",
    dependencyProximityUsed: false,
    mappingKind: "repository fact + deterministic spatial projection",
    relatedEntityIds: selection.entities.map((entity) => entity.id),
  };
}

export interface SemanticLabel {
  id: string;
  kind: "component" | "building" | "file" | "flow-station" | "relation-endpoint";
  label: string;
  detail?: string;
  componentId?: string;
  buildingId?: string;
  entityId?: string;
  priority: number;
  x: number;
  y: number;
  z: number;
  selected: boolean;
  provenance: SemanticProvenance;
}

export function resolveVisibleSemanticLabels({
  mode,
  selectedComponentId,
  selectedEntityId,
  flowDestinationEntityId,
  entities,
  districts,
  semanticPlan,
  urbanFabric,
  cap = 12,
}: {
  mode: CityMode;
  selectedComponentId?: string | null;
  selectedEntityId?: string | null;
  flowDestinationEntityId?: string | null;
  entities: readonly DemoEntity[];
  districts: readonly DemoDistrict[];
  semanticPlan: SemanticCityPlan;
  urbanFabric: UrbanFabricPlan;
  cap?: number;
}): SemanticLabel[] {
  const labels: SemanticLabel[] = [];
  if (mode === "map") {
    for (const component of semanticPlan.components) {
      const selection = resolveComponentSelection(component.id, semanticPlan, urbanFabric);
      if (!selection || selection.blocks.length === 0) continue;
      const x = selection.blocks.reduce((sum, block) => sum + block.x, 0) / selection.blocks.length;
      const z = selection.blocks.reduce((sum, block) => sum + block.z, 0) / selection.blocks.length;
      const selected = component.id === selectedComponentId;
      labels.push({
        id: `component:${component.id}`,
        kind: "component",
        label: component.label,
        detail: `${component.metrics.files} files · ${selection.blockIds.length} blocks`,
        componentId: component.id,
        priority: selected ? 300 : 90,
        x,
        y: selected ? 7.8 : 6.2,
        z,
        selected,
        provenance: "repository-fact",
      });
    }
  }
  if (selectedEntityId && mode !== "replay") {
    const selection = resolveBuildingSelection(
      selectedEntityId,
      entities,
      districts,
      semanticPlan,
      urbanFabric,
    );
    const entity = entities.find((candidate) => candidate.id === selectedEntityId);
    if (selection && entity) {
      labels.push({
        id: `building:${selection.building.id}`,
        kind: "building",
        label: selection.moduleLabel,
        detail: `${selection.fileCount} files · ${selection.address.blockId}`,
        componentId: selection.component.id,
        buildingId: selection.building.id,
        entityId: selectedEntityId,
        priority: 500,
        x: selection.building.x,
        y: selection.building.height + 1.25,
        z: selection.building.z,
        selected: true,
        provenance: "deterministic-projection",
      });
      if (mode === "map") {
        labels.push({
          id: `file:${entity.id}`,
          kind: "file",
          label: entity.name,
          detail: entity.path,
          componentId: selection.component.id,
          buildingId: selection.building.id,
          entityId: selectedEntityId,
          priority: 600,
          x: selection.address.entrance.x,
          y: 1.9,
          z: selection.address.entrance.z,
          selected: true,
          provenance: "repository-fact",
        });
      }
    }
  }
  if (flowDestinationEntityId) {
    const selection = resolveBuildingSelection(
      flowDestinationEntityId,
      entities,
      districts,
      semanticPlan,
      urbanFabric,
    );
    if (selection) {
      labels.push({
        id: `flow:${flowDestinationEntityId}`,
        kind: "flow-station",
        label: "CURRENT FLOW DESTINATION",
        detail: selection.moduleLabel,
        componentId: selection.component.id,
        buildingId: selection.building.id,
        entityId: flowDestinationEntityId,
        priority: 450,
        x: selection.building.x,
        y: selection.building.height + 2.1,
        z: selection.building.z,
        selected: true,
        provenance: "deterministic-simulation",
      });
    }
  }
  const byId = new Map<string, SemanticLabel>();
  for (const label of labels) {
    const existing = byId.get(label.id);
    if (!existing || existing.priority < label.priority) byId.set(label.id, label);
  }
  return [...byId.values()]
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id, "en"))
    .slice(0, Math.max(0, cap));
}

export interface SemanticRelationOverlay {
  id: string;
  relation: DemoRelation;
  source: DemoEntity;
  target: DemoEntity;
  sourcePoint: { x: number; y: number; z: number };
  targetPoint: { x: number; y: number; z: number };
  width: number;
  provenance: "repository-fact";
  visualKind: "static-relation";
}

export function resolveOneHopRelationshipOverlays({
  entityId,
  direction,
  entities,
  relations,
  urbanFabric,
  visibleRelationIds,
}: {
  entityId?: string | null;
  direction: RelationDirection;
  entities: readonly DemoEntity[];
  relations: readonly DemoRelation[];
  urbanFabric: UrbanFabricPlan;
  visibleRelationIds?: ReadonlySet<string>;
}): SemanticRelationOverlay[] {
  if (!entityId || direction === "off") return [];
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  return relations
    .filter((relation) => !visibleRelationIds || visibleRelationIds.has(relation.id))
    .filter((relation) => {
      const incoming = relation.targetId === entityId;
      const outgoing = relation.sourceId === entityId;
      return direction === "both"
        ? incoming || outgoing
        : direction === "incoming"
          ? incoming
          : outgoing;
    })
    .map((relation) => {
      const source = entityById.get(relation.sourceId);
      const target = entityById.get(relation.targetId);
      const sourceAddress = urbanFabric.entityAddresses[relation.sourceId];
      const targetAddress = urbanFabric.entityAddresses[relation.targetId];
      if (!source || !target || !sourceAddress || !targetAddress) return null;
      return {
        id: relation.id,
        relation,
        source,
        target,
        sourcePoint: { ...sourceAddress.entrance, y: 2.25 },
        targetPoint: { ...targetAddress.entrance, y: 2.25 },
        width: Math.min(2.4, 0.7 + Math.sqrt(Math.max(1, relation.weight)) * 0.34),
        provenance: "repository-fact" as const,
        visualKind: "static-relation" as const,
      };
    })
    .filter((overlay): overlay is SemanticRelationOverlay => Boolean(overlay))
    .sort((left, right) => left.id.localeCompare(right.id, "en"));
}

export interface SemanticSearchResult {
  entity: DemoEntity;
  score: number;
  matchedSymbol?: string;
  componentLabel: string;
  moduleLabel: string;
  addressLabel: string;
  entityType: "file" | "export";
}

export function resolveSemanticSearchResults({
  query,
  entities,
  visibleEntityIds,
  districts,
  semanticPlan,
  urbanFabric,
  limit = 7,
}: {
  query: string;
  entities: readonly DemoEntity[];
  visibleEntityIds: ReadonlySet<string>;
  districts: readonly DemoDistrict[];
  semanticPlan: SemanticCityPlan;
  urbanFabric: UrbanFabricPlan;
  limit?: number;
}): SemanticSearchResult[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return entities
    .filter((entity) => visibleEntityIds.has(entity.id))
    .flatMap<SemanticSearchResult>((entity) => {
      const matchedSymbol = entity.exportNames.find((name) =>
        name.toLowerCase().includes(normalized),
      );
      const name = entity.name.toLowerCase();
      const path = entity.path.toLowerCase();
      const score = name.startsWith(normalized)
        ? 0
        : name.includes(normalized)
          ? 1
          : path.includes(normalized)
            ? 2
            : matchedSymbol
              ? 3
              : 9;
      const building = resolveBuildingSelection(
        entity.id,
        entities,
        districts,
        semanticPlan,
        urbanFabric,
      );
      if (score >= 9 || !building) return [];
      const result: SemanticSearchResult = {
        entity,
        score,
        componentLabel: building.component.label,
        moduleLabel: building.moduleLabel,
        addressLabel: building.address.label,
        entityType: matchedSymbol ? ("export" as const) : ("file" as const),
      };
      if (matchedSymbol) result.matchedSymbol = matchedSymbol;
      return [result];
    })
    .sort((left, right) => left.score - right.score || left.entity.path.localeCompare(right.entity.path, "en"))
    .slice(0, limit);
}

export function isSemanticSelectableKind(kind: string): boolean {
  return ["component", "building", "entity", "relation"].includes(kind);
}
