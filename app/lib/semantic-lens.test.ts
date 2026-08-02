import { describe, expect, it } from "vitest";
import { demoProject } from "./demo-data";
import { planLivingCity } from "./living-city";
import { planSemanticCity } from "./semantic-city";
import {
  isSemanticSelectableKind,
  resolveAmbientPresentation,
  resolveBuildingSelection,
  resolveComponentSelection,
  resolveLayerPlayback,
  resolveModeVisualProfile,
  resolveOneHopRelationshipOverlays,
  resolvePlacementExplanation,
  resolveSemanticBreadcrumb,
  resolveSemanticSelectionPresentation,
  resolveSemanticSearchResults,
  resolveVisibleSemanticLabels,
  transitionSemanticLensMode,
  transitionSemanticSelection,
  type CityMode,
} from "./semantic-lens";
import { planUrbanFabric } from "./urban-fabric";

const city = planLivingCity(demoProject);
const semantic = planSemanticCity({
  cityPlan: city,
  entities: demoProject.entities,
  relations: demoProject.relations,
  boundaryFacts: demoProject.boundaryFacts,
});
const fabric = planUrbanFabric({ semanticPlan: semantic });
const entity = demoProject.entities.find((candidate) => candidate.exportNames.length > 0)!;

describe("semantic lens", () => {
  it("defines deterministic profiles for all four modes", () => {
    const modes: CityMode[] = ["explore", "map", "journey", "replay"];
    expect(modes.map((mode) => resolveModeVisualProfile(mode).mode)).toEqual(modes);
    expect(resolveModeVisualProfile("map")).toEqual(resolveModeVisualProfile("map"));
  });

  it("enters Map from Explore, Flow and Replay without destroying semantic state", () => {
    for (const mode of ["explore", "journey", "replay"] as const) {
      const current = {
        mode,
        selection: { kind: "entity" as const, entityId: entity.id },
        relationDirection: "outgoing" as const,
        labelLevel: "auto" as const,
      };
      expect(transitionSemanticLensMode(current, "map")).toEqual({
        ...current,
        mode: "map",
      });
    }
  });

  it("keeps user-enabled ambient layers visible with reduced non-Explore emphasis", () => {
    const toggles = { traffic: true, pedestrians: true, waterTraffic: true };
    const explore = resolveAmbientPresentation(resolveModeVisualProfile("explore"), toggles);
    for (const mode of ["map", "journey", "replay"] as const) {
      const presentation = resolveAmbientPresentation(resolveModeVisualProfile(mode), toggles);
      expect(presentation.traffic).toBe(true);
      expect(presentation.pedestrians).toBe(true);
      expect(presentation.waterTraffic).toBe(true);
      expect(presentation.emphasis).toBeLessThan(explore.emphasis);
    }
    expect(resolveModeVisualProfile("journey").ambientSpeedScale).toBe(0.78);
  });

  it("keeps ambient playback independent from evidence playback", () => {
    expect(
      resolveLayerPlayback({ journeyPlaying: false, reducedMotion: false }),
    ).toEqual({ ambientPlaying: true, evidenceJourneyPlaying: false });
    expect(
      resolveLayerPlayback({ journeyPlaying: true, reducedMotion: true }),
    ).toEqual({ ambientPlaying: false, evidenceJourneyPlaying: false });
    expect(resolveModeVisualProfile("journey").ambientSpeedScale).toBe(0.78);
  });

  it("still respects disabled ambient toggles in every mode", () => {
    for (const mode of ["explore", "map", "journey", "replay"] as const) {
      expect(
        resolveAmbientPresentation(resolveModeVisualProfile(mode), {
          traffic: false,
          pedestrians: false,
          waterTraffic: false,
        }),
      ).toMatchObject({ traffic: false, pedestrians: false, waterTraffic: false });
    }
  });

  it("never classifies decorative or ambient context as semantic selection", () => {
    for (const kind of ["car", "pedestrian", "boat", "storefront", "tree", "bench", "streetlight"]) {
      expect(isSemanticSelectableKind(kind)).toBe(false);
    }
    expect(isSemanticSelectableKind("entity")).toBe(true);
  });

  it("resolves every assigned block and semantic building for a component", () => {
    const component = semantic.components[0]!;
    const selection = resolveComponentSelection(component.id, semantic, fabric)!;
    expect(selection.blockIds).toEqual(fabric.componentBlockIds[component.id]);
    expect(selection.buildings.every((building) => building.componentId === component.id)).toBe(true);
    expect(selection.entityIds).toEqual([...component.entityIds].sort());
  });

  it("resolves a file through component, module group, building and address", () => {
    const selection = resolveBuildingSelection(
      entity.id,
      demoProject.entities,
      demoProject.districts,
      semantic,
      fabric,
    )!;
    expect(selection.entities.some((candidate) => candidate.id === entity.id)).toBe(true);
    expect(selection.address.componentId).toBe(selection.component.id);
    expect(selection.address.buildingId).toBe(selection.building.id);
    expect(selection.address.blockId).toBeTruthy();
  });

  it("adds only supported file and export breadcrumb levels", () => {
    const base = {
      repositoryName: demoProject.manifest.repo.name,
      selectedEntityId: entity.id,
      entities: demoProject.entities,
      districts: demoProject.districts,
      semanticPlan: semantic,
      urbanFabric: fabric,
    };
    expect(resolveSemanticBreadcrumb(base).map((item) => item.kind)).toEqual([
      "repository",
      "component",
      "building",
      "file",
    ]);
    expect(
      resolveSemanticBreadcrumb({ ...base, selectedSymbol: entity.exportNames[0] }).at(-1),
    ).toMatchObject({ kind: "symbol", label: entity.exportNames[0] });
  });

  it("supports a repository to component-only breadcrumb", () => {
    const component = semantic.components[0]!;
    expect(
      resolveSemanticBreadcrumb({
        repositoryName: demoProject.manifest.repo.name,
        selectedComponentId: component.id,
        entities: demoProject.entities,
        districts: demoProject.districts,
        semanticPlan: semantic,
        urbanFabric: fabric,
      }).map((item) => item.kind),
    ).toEqual(["repository", "component"]);
  });

  it("clears file A and returns one coherent component-B presentation", () => {
    const fileA = demoProject.entities.find(
      (candidate) => fabric.entityAddresses[candidate.id],
    )!;
    const componentA = fabric.entityAddresses[fileA.id]!.componentId;
    const componentB = semantic.components.find(
      (candidate) => candidate.id !== componentA,
    )!;
    const current = {
      mode: "map" as const,
      selection: { kind: "entity" as const, entityId: fileA.id },
      relationDirection: "off" as const,
      labelLevel: "auto" as const,
    };
    const transition = transitionSemanticSelection(
      current,
      { kind: "component", componentId: componentB.id },
      fileA.id,
    );
    const presentation = resolveSemanticSelectionPresentation({
      selection: transition.state.selection,
      presentedEntityId: fileA.id,
      urbanFabric: fabric,
    });
    const breadcrumb = resolveSemanticBreadcrumb({
      repositoryName: demoProject.manifest.repo.name,
      selectedComponentId: presentation.componentId,
      selectedEntityId: presentation.entityId,
      entities: demoProject.entities,
      districts: demoProject.districts,
      semanticPlan: semantic,
      urbanFabric: fabric,
    });

    expect(transition.selectedEntityId).toBeNull();
    expect(transition.selectedSymbol).toBeNull();
    expect(presentation).toEqual({
      componentId: componentB.id,
      entityId: null,
      inspectorScope: "component",
    });
    expect(breadcrumb.map((item) => item.kind)).toEqual([
      "repository",
      "component",
    ]);
    expect(breadcrumb.at(-1)?.componentId).toBe(componentB.id);
  });

  it("explains placement with supported facts and deterministic projection rules", () => {
    const explanation = resolvePlacementExplanation(
      entity.id,
      demoProject.entities,
      demoProject.districts,
      semantic,
      fabric,
    )!;
    expect(explanation.mappingKind).toBe(
      "repository fact + deterministic spatial projection",
    );
    expect(explanation.dependencyProximityUsed).toBe(false);
    expect(explanation.placementRule).toContain("deterministic");
    expect(explanation.representativeFiles.length).toBeGreaterThan(0);
  });

  it("prioritizes labels deterministically and obeys the cap", () => {
    const input = {
      mode: "map" as const,
      selectedEntityId: entity.id,
      entities: demoProject.entities,
      districts: demoProject.districts,
      semanticPlan: semantic,
      urbanFabric: fabric,
      cap: 4,
    };
    const first = resolveVisibleSemanticLabels(input);
    expect(first).toEqual(resolveVisibleSemanticLabels(input));
    expect(first).toHaveLength(4);
    expect(first[0]!.kind).toBe("file");
    expect(first.every((label) => !label.label.toLowerCase().includes("cafe"))).toBe(true);
  });

  it("never suppresses the selected file label behind a component label", () => {
    const labels = resolveVisibleSemanticLabels({
      mode: "map",
      selectedEntityId: entity.id,
      entities: demoProject.entities,
      districts: demoProject.districts,
      semanticPlan: semantic,
      urbanFabric: fabric,
      cap: 1,
    });
    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatchObject({ kind: "file", entityId: entity.id, selected: true });
  });

  it("returns only supported one-hop relationship endpoints with a distinct visual kind", () => {
    const outgoing = demoProject.relations.find((relation) => relation.sourceId === entity.id);
    const relationEntity = outgoing
      ? entity
      : demoProject.entities.find((candidate) =>
          demoProject.relations.some((relation) => relation.sourceId === candidate.id),
        )!;
    const overlays = resolveOneHopRelationshipOverlays({
      entityId: relationEntity.id,
      direction: "outgoing",
      entities: demoProject.entities,
      relations: demoProject.relations,
      urbanFabric: fabric,
    });
    expect(overlays.length).toBeGreaterThan(0);
    expect(overlays.every((overlay) => overlay.visualKind === "static-relation")).toBe(true);
    expect(overlays.every((overlay) => overlay.relation.sourceId === relationEntity.id)).toBe(true);
  });

  it("search resolves component, module group, address and matching exports", () => {
    const symbol = entity.exportNames[0]!;
    const results = resolveSemanticSearchResults({
      query: symbol,
      entities: demoProject.entities,
      visibleEntityIds: new Set(demoProject.entities.map((candidate) => candidate.id)),
      districts: demoProject.districts,
      semanticPlan: semantic,
      urbanFabric: fabric,
    });
    expect(results[0]).toMatchObject({
      entity: { id: entity.id },
      matchedSymbol: symbol,
      entityType: "export",
    });
    expect(results[0]!.addressLabel).toContain("building");
  });
});
