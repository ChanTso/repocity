import { describe, expect, it } from "vitest";

import {
  demoProject,
  type DemoEntity,
  type DemoRelation,
} from "./demo-data";
import {
  planFlowSimulation,
  sampleFlowTokenProgress,
  type FlowJourney,
  type FlowTransportMode,
  type PlanFlowSimulationInput,
} from "./flow-simulation";
import { planLivingCity, type LivingCityPlan } from "./living-city";

function entity(
  id: string,
  path: string,
  districtId: string,
  metrics: Partial<DemoEntity["maxMetrics"]> = {},
): DemoEntity {
  const name = path.split("/").at(-1) ?? id;
  return {
    id,
    kind: "building",
    path,
    aliases: [],
    name,
    extension: path.endsWith(".tsx") ? ".tsx" : ".ts",
    language: "typescript",
    role: path.includes("test") ? "test" : "source",
    districtId,
    bornAt: 0,
    maxMetrics: {
      loc: 120,
      exports: 3,
      fanIn: 2,
      fanOut: 2,
      churn: 5,
      ...metrics,
    },
    layout: {
      x: 0,
      z: 0,
      width: 4,
      depth: 4,
      maxHeight: 10,
      rotationY: 0,
      styleVariant: 0,
    },
    summary: path,
    exportNames: [],
  };
}

const repoEntities = [
  entity("prepare", "apps/cli/src/cli.ts", "entry", { fanOut: 9 }),
  entity(
    "git",
    "packages/git-analyzer/src/analyze.ts",
    "analysis",
  ),
  entity(
    "code",
    "packages/code-analyzer/src/analyze.ts",
    "analysis",
  ),
  entity(
    "compiler",
    "packages/city-compiler/src/layout.ts",
    "facts",
  ),
  entity(
    "replay",
    "packages/replay-engine/src/index.ts",
    "facts",
  ),
  entity("schema", "packages/schema/src/index.ts", "facts"),
  entity("writer", "apps/cli/src/bundle.ts", "entry"),
  entity("loader", "app/lib/project-bundle.ts", "viewer"),
  entity("living", "app/lib/living-city.ts", "viewer"),
  entity("scene", "app/components/CityScene.tsx", "viewer"),
] satisfies DemoEntity[];

const repoRelations = [
  relation("r-prepare-git", "prepare", "git", 4),
  relation("r-git-code", "git", "code", 3),
  relation("r-code-compiler", "code", "compiler", 2),
  relation("r-compiler-replay", "compiler", "replay", 2),
  relation("r-replay-schema", "replay", "schema", 2),
  relation("r-schema-writer", "schema", "writer", 2),
  relation("r-writer-loader", "writer", "loader", 2),
  relation("r-loader-living", "loader", "living", 1),
  relation("r-living-scene", "living", "scene", 1),
] satisfies DemoRelation[];

function relation(
  id: string,
  sourceId: string,
  targetId: string,
  weight = 1,
): DemoRelation {
  return {
    id,
    sourceId,
    targetId,
    kind: "import",
    bornAt: 0,
    weight,
  };
}

function cityFor(
  entities: readonly DemoEntity[],
  relations: readonly DemoRelation[],
) {
  const districtIds = [...new Set(entities.map((item) => item.districtId))];
  return planLivingCity({
    entities,
    relations,
    districts: districtIds.map((id) => ({ id, name: id })),
  });
}

function artifactBoundary(
  relationIds: readonly string[] = ["r-writer-loader"],
  options: {
    id?: string;
    factId?: string;
    centerX?: number;
    entityIds?: readonly string[];
  } = {},
): NonNullable<PlanFlowSimulationInput["artifactWaterBoundary"]> {
  const centerX = options.centerX ?? 0;
  return {
    // Renderer geometry and the underlying semantic fact intentionally have
    // different identities; Journey legs must retain the fact identity.
    id: options.id ?? "semantic-water-static-bundle",
    boundaryFactIds: [
      options.factId ?? "artifact-boundary-static-bundle",
    ],
    outline: [
      { x: centerX - 3, z: -30 },
      { x: centerX + 3, z: -30 },
      { x: centerX + 3, z: 30 },
      { x: centerX - 3, z: 30 },
      { x: centerX - 3, z: -30 },
    ],
    relationIds: [...relationIds],
    evidence: {
      entityIds: [...(options.entityIds ?? ["writer", "loader"])],
      relationIds: [...relationIds],
      reason: "Typed static artifact producer/consumer boundary.",
    },
  };
}

function expectJourneyConnected(journey: FlowJourney) {
  const stepIds = new Set(journey.steps.map((step) => step.id));
  const adjacency = new Map<string, Set<string>>();
  for (const step of journey.steps) adjacency.set(step.id, new Set());
  for (const leg of journey.legs) {
    expect(stepIds.has(leg.sourceStepId)).toBe(true);
    expect(stepIds.has(leg.targetStepId)).toBe(true);
    expect(leg.sourceEntityId).toBe(
      journey.steps.find((step) => step.id === leg.sourceStepId)?.entityId,
    );
    expect(leg.targetEntityId).toBe(
      journey.steps.find((step) => step.id === leg.targetStepId)?.entityId,
    );
    expect(leg.points[0]).toEqual(leg.source.point);
    expect(leg.points.at(-1)).toEqual(leg.target.point);
    adjacency.get(leg.sourceStepId)!.add(leg.targetStepId);
    adjacency.get(leg.targetStepId)!.add(leg.sourceStepId);
  }

  const reached = new Set<string>();
  const pending = journey.steps[0] ? [journey.steps[0].id] : [];
  while (pending.length > 0) {
    const current = pending.shift()!;
    if (reached.has(current)) continue;
    reached.add(current);
    for (const target of adjacency.get(current) ?? []) pending.push(target);
  }
  expect(reached).toEqual(stepIds);
}

describe("planFlowSimulation", () => {
  it("samples forward and return tokens from a pausable deterministic clock", () => {
    const forward = {
      delay: 0.5,
      direction: "forward" as const,
      progress: 0,
      speed: 1,
    };
    const response = {
      ...forward,
      direction: "return" as const,
    };

    expect(sampleFlowTokenProgress(forward, 0.25)).toBe(0);
    expect(sampleFlowTokenProgress(response, 0.25)).toBe(1);
    expect(sampleFlowTokenProgress(forward, 1.5)).toBe(0.5);
    expect(sampleFlowTokenProgress(response, 1.5)).toBe(0.5);
    expect(sampleFlowTokenProgress(forward, 10)).toBe(1);
    expect(sampleFlowTokenProgress(response, 10)).toBe(0);
    expect(
      sampleFlowTokenProgress({ ...forward, progress: 0.6 }, 0.25),
    ).toBe(0.6);
    expect(
      sampleFlowTokenProgress({ ...response, progress: 0.6 }, 0.25),
    ).toBe(0.4);
    expect(sampleFlowTokenProgress(forward, 1.5)).toBe(
      sampleFlowTokenProgress(forward, 1.5),
    );
  });

  it("finds the curated ten-stop serial journey in the shipped demo project", () => {
    const cityPlan = planLivingCity(demoProject);
    const plan = planFlowSimulation({
      entities: demoProject.entities,
      relations: demoProject.relations,
      cityPlan,
      maxJourneys: 4,
    });

    const journey = plan.journeys.find(
      (candidate) =>
        candidate.id === "journey-repocity-repository-to-city",
    );

    expect(journey?.steps.map((step) => step.semanticKey)).toEqual([
      "prepare",
      "git",
      "code",
      "compiler",
      "replay",
      "producer-schema",
      "writer",
      "loader",
      "living",
      "scene",
    ]);
    expect(
      demoProject.entities.find(
        (entity) => entity.id === journey?.steps[0]?.entityId,
      )?.path,
    ).toBe("apps/cli/src/cli.ts");
    expect(journey?.legs).toHaveLength(9);
    expect(journey?.provenance).toBe("simulated");
    expect(cityPlan.geography.river).not.toBeNull();
    expect(
      journey?.legs.find(
        (leg) =>
          leg.sourceStepId === journey.steps[6]?.id &&
          leg.targetStepId === journey.steps[7]?.id,
      ),
    ).toMatchObject({
      mode: "freight",
      label: "静态 Bundle 陆路交付",
      artifactBoundaryId: null,
    });
  });

  it("constructs the real serial producer-consumer journey with traceable traffic", () => {
    const plan = planFlowSimulation({
      entities: repoEntities,
      relations: repoRelations,
      cityPlan: cityFor(repoEntities, repoRelations),
      maxJourneys: 1,
      tokensPerLeg: 2,
    });

    expect(plan.defaultJourneyId).toBe(
      "journey-repocity-repository-to-city",
    );
    const journey = plan.journeys[0]!;
    expect(journey.kind).toBe("repository-pipeline");
    expect(journey.provenance).toBe("simulated");
    expect(journey.steps.map((step) => step.semanticKey)).toEqual([
      "prepare",
      "git",
      "code",
      "compiler",
      "replay",
      "producer-schema",
      "writer",
      "loader",
      "living",
      "scene",
    ]);
    expect(
      journey.legs.map((leg) => [
        journey.steps.find((step) => step.id === leg.sourceStepId)
          ?.semanticKey,
        journey.steps.find((step) => step.id === leg.targetStepId)
          ?.semanticKey,
      ]),
    ).toEqual([
      ["prepare", "git"],
      ["git", "code"],
      ["code", "compiler"],
      ["compiler", "replay"],
      ["replay", "producer-schema"],
      ["producer-schema", "writer"],
      ["writer", "loader"],
      ["loader", "living"],
      ["living", "scene"],
    ]);
    expect(
      journey.legs.filter(
        (leg) =>
          journey.steps.find((step) => step.id === leg.sourceStepId)
            ?.semanticKey === "prepare",
      ),
    ).toHaveLength(1);
    expect(
      journey.legs.some(
        (leg) =>
          journey.steps.find((step) => step.id === leg.sourceStepId)
            ?.semanticKey === "prepare" &&
          journey.steps.find((step) => step.id === leg.targetStepId)
            ?.semanticKey === "code",
      ),
    ).toBe(false);
    expect(journey.steps[1]?.semanticKey).toBe("git");
    expect(journey.steps[2]?.semanticKey).toBe("code");
    expect(journey.steps[2]?.description).toContain("不是与 Git 并行");
    const bundleCrossing = journey.legs.find(
      (leg) =>
        leg.sourceEntityId === "writer" &&
        leg.targetEntityId === "loader",
    );
    expect(bundleCrossing).toMatchObject({
      mode: "freight",
      label: "静态 Bundle 陆路交付",
      artifactBoundaryId: null,
    });
    expect(bundleCrossing?.reason).toContain("静态 Bundle");
    expect(bundleCrossing?.reason).toContain(
      "没有 typed artifact water boundary",
    );
    expect(journey.legs.every((leg) => leg.reason.length > 0)).toBe(true);
    expect(
      journey.legs.every((leg) => leg.evidenceIds.length > 0),
    ).toBe(true);
    expect(journey.tokens).toHaveLength(journey.legs.length * 2);
    expect(
      journey.tokens.every((token) => token.progressPhase.length > 0),
    ).toBe(true);
    expectJourneyConnected(journey);
  });

  it("keeps the artifact boat leg on the typed boundary centerline", () => {
    const base = cityFor(repoEntities, repoRelations);
    const cityPlan = {
      ...base,
      geography: {
        river: {
          id: "river-test",
          axis: "z" as const,
          x: 0,
          z: 0,
          width: 6,
          depth: 60,
        },
      },
    };
    const journey = planFlowSimulation({
      entities: repoEntities,
      relations: repoRelations,
      cityPlan,
      maxJourneys: 1,
      artifactWaterBoundary: artifactBoundary(),
    }).journeys[0]!;
    const boat = journey.legs.find(
      (leg) =>
        leg.sourceEntityId === "writer" &&
        leg.targetEntityId === "loader",
    )!;

    expect(boat.mode).toBe("boat");
    expect(boat.artifactBoundaryId).toBe(
      "artifact-boundary-static-bundle",
    );
    expect(boat.points.some((candidate) => candidate.x === 0)).toBe(true);
  });

  it("never grants boat transport from legacy river geometry alone", () => {
    const base = cityFor(repoEntities, repoRelations);
    const cityPlan: LivingCityPlan = {
      ...base,
      geography: {
        river: {
          id: "legacy-river-without-semantic-authority",
          axis: "z",
          x: 0,
          z: 0,
          width: 8,
          depth: 60,
        },
      },
    };

    const journey = planFlowSimulation({
      entities: repoEntities,
      relations: repoRelations,
      cityPlan,
      maxJourneys: 1,
      modeOverrides: {
        "r-writer-loader": "boat",
      },
    }).journeys[0]!;
    const delivery = journey.legs.find(
      (leg) =>
        leg.sourceEntityId === "writer" &&
        leg.targetEntityId === "loader",
    )!;

    expect(delivery.mode).toBe("freight");
    expect(delivery.artifactBoundaryId).toBeNull();
    expect(journey.tokens.some((token) => token.mode === "boat")).toBe(false);
  });

  it("allows boat transport when the typed boundary authorizes the relation", () => {
    const journey = planFlowSimulation({
      entities: repoEntities,
      relations: repoRelations,
      cityPlan: cityFor(repoEntities, repoRelations),
      maxJourneys: 1,
      artifactWaterBoundary: artifactBoundary(),
    }).journeys[0]!;
    const delivery = journey.legs.find(
      (leg) =>
        leg.sourceEntityId === "writer" &&
        leg.targetEntityId === "loader",
    )!;

    expect(delivery).toMatchObject({
      mode: "boat",
      artifactBoundaryId: "artifact-boundary-static-bundle",
    });
    expect(delivery.reason).toContain(
      "artifact-boundary-static-bundle",
    );
    expect(
      journey.evidence.find((item) =>
        item.boundaryIds.includes("artifact-boundary-static-bundle"),
      ),
    ).toMatchObject({
      boundaryIds: ["artifact-boundary-static-bundle"],
    });
  });

  it("matches the Golden Journey boundary by exact fact endpoints independent of boundary order", () => {
    const matching = artifactBoundary(["r-writer-loader"], {
      id: "water-z-matching",
      factId: "fact-writer-loader",
      centerX: 0,
      entityIds: ["writer", "loader"],
    });
    const unrelated = artifactBoundary(["r-prepare-git"], {
      id: "water-a-unrelated",
      factId: "fact-prepare-git",
      centerX: 40,
      entityIds: ["prepare", "git"],
    });
    const matchingFact = {
      id: "fact-writer-loader",
      sourceEntityId: "writer",
      targetEntityId: "loader",
      relationId: "r-writer-loader",
    };
    const unrelatedFact = {
      id: "fact-prepare-git",
      sourceEntityId: "prepare",
      targetEntityId: "git",
      relationId: "r-prepare-git",
    };
    const cityPlan = cityFor(repoEntities, repoRelations);
    const first = planFlowSimulation({
      entities: repoEntities,
      relations: repoRelations,
      cityPlan,
      maxJourneys: 1,
      artifactWaterBoundaries: [unrelated, matching],
      artifactBoundaryFacts: [unrelatedFact, matchingFact],
    });
    const reversed = planFlowSimulation({
      entities: repoEntities,
      relations: repoRelations,
      cityPlan,
      maxJourneys: 1,
      artifactWaterBoundaries: [matching, unrelated],
      artifactBoundaryFacts: [matchingFact, unrelatedFact],
    });
    const delivery = first.journeys[0]!.legs.find(
      (leg) =>
        leg.sourceEntityId === "writer" &&
        leg.targetEntityId === "loader",
    )!;

    expect(JSON.stringify(first)).toBe(JSON.stringify(reversed));
    expect(delivery).toMatchObject({
      mode: "boat",
      artifactBoundaryId: "fact-writer-loader",
    });
    expect(delivery.points.some((point) => point.x === 0)).toBe(true);
    expect(delivery.points.some((point) => point.x === 40)).toBe(false);
  });

  it("falls back to relation evidence when exact boundary fact endpoints are unavailable", () => {
    const matching = artifactBoundary(["r-writer-loader"], {
      id: "water-z-relation-match",
      factId: "fact-relation-match",
      centerX: -12,
      entityIds: ["aggregate-a", "aggregate-b"],
    });
    const unrelated = artifactBoundary(["r-prepare-git"], {
      id: "water-a-unrelated",
      factId: "fact-unrelated",
      centerX: 28,
      entityIds: ["aggregate-c", "aggregate-d"],
    });
    const delivery = planFlowSimulation({
      entities: repoEntities,
      relations: repoRelations,
      cityPlan: cityFor(repoEntities, repoRelations),
      maxJourneys: 1,
      artifactWaterBoundaries: [unrelated, matching],
    }).journeys[0]!.legs.find(
      (leg) =>
        leg.sourceEntityId === "writer" &&
        leg.targetEntityId === "loader",
    )!;

    expect(delivery).toMatchObject({
      mode: "boat",
      artifactBoundaryId: "fact-relation-match",
    });
    expect(delivery.points.some((point) => point.x === -12)).toBe(true);
    expect(delivery.points.some((point) => point.x === 28)).toBe(false);
  });

  it("deterministically pairs car requests with a labelled return response", () => {
    const cityPlan = cityFor(repoEntities, repoRelations);
    const input = {
      entities: repoEntities,
      relations: repoRelations,
      cityPlan,
      maxJourneys: 1,
      tokensPerLeg: 1,
    } as const;
    const first = planFlowSimulation(input);
    const repeated = planFlowSimulation(input);
    const journey = first.journeys[0]!;
    const carLeg = journey.legs.find((leg) => leg.mode === "car")!;
    const carTokens = journey.tokens.filter(
      (token) => token.legId === carLeg.id,
    );
    const repeatedCarTokens = repeated.journeys[0]!.tokens.filter(
      (token) => token.legId === carLeg.id,
    );

    expect(carTokens).toEqual(repeatedCarTokens);
    expect(carTokens).toHaveLength(2);
    expect(
      carTokens.some(
        (token) =>
          token.direction === "forward" &&
          token.payload.label === "静态 Bundle",
      ),
    ).toBe(true);
    expect(
      carTokens.some(
        (token) =>
          token.direction === "return" &&
          token.payload.label === "城市计划 · 响应" &&
          token.progress === 0,
      ),
    ).toBe(true);
  });

  it("uses fixed scenario cohorts instead of turning import weight into traffic", () => {
    const journey = planFlowSimulation({
      entities: repoEntities,
      relations: repoRelations,
      cityPlan: cityFor(repoEntities, repoRelations),
      maxJourneys: 1,
    }).journeys[0]!;
    const tokensFor = (sourceEntityId: string, targetEntityId: string) => {
      const leg = journey.legs.find(
        (candidate) =>
          candidate.sourceEntityId === sourceEntityId &&
          candidate.targetEntityId === targetEntityId,
      )!;
      return journey.tokens.filter((token) => token.legId === leg.id);
    };

    expect(tokensFor("prepare", "git")).toHaveLength(3);
    expect(tokensFor("git", "code")).toHaveLength(6);
    expect(tokensFor("loader", "living")).toHaveLength(2);
  });

  it("is byte-stable and independent of entity and relation ordering", () => {
    const cityPlan = cityFor(repoEntities, repoRelations);
    const first = planFlowSimulation({
      entities: repoEntities,
      relations: repoRelations,
      cityPlan,
    });
    const repeated = planFlowSimulation({
      entities: repoEntities,
      relations: repoRelations,
      cityPlan,
    });
    const reversed = planFlowSimulation({
      entities: [...repoEntities].reverse(),
      relations: [...repoRelations].reverse(),
      cityPlan,
    });

    expect(JSON.stringify(first)).toBe(JSON.stringify(repeated));
    expect(JSON.stringify(first)).toBe(JSON.stringify(reversed));
  });

  it("drops missing entities and buildings without leaving isolated legs", () => {
    const unplanned = entity(
      "unplanned",
      "external/unplanned.ts",
      "external",
    );
    const dangling = relation("r-dangling", "scene", "missing", 2);
    const missingBuilding = relation(
      "r-unplanned",
      "scene",
      "unplanned",
      2,
    );
    const cityPlan = cityFor(repoEntities, repoRelations);
    const plan = planFlowSimulation({
      entities: [...repoEntities, unplanned],
      relations: [...repoRelations, dangling, missingBuilding],
      cityPlan,
    });

    expect(plan.diagnostics.ignoredRelationIds).toEqual([
      "r-dangling",
      "r-unplanned",
    ]);
    expect(plan.diagnostics.missingBuildingEntityIds).toEqual([
      "unplanned",
    ]);
    for (const journey of plan.journeys) {
      expect(
        journey.legs.some(
          (leg) =>
            leg.sourceEntityId === "missing" ||
            leg.targetEntityId === "missing" ||
            leg.sourceEntityId === "unplanned" ||
            leg.targetEntityId === "unplanned",
        ),
      ).toBe(false);
      expectJourneyConnected(journey);
    }
  });

  it("rejects a journey whose semantic vehicles have no connected road path", () => {
    const cityPlan = {
      ...cityFor(repoEntities, repoRelations),
      roads: [],
    };
    const plan = planFlowSimulation({
      entities: repoEntities,
      relations: repoRelations,
      cityPlan,
      maxJourneys: 1,
    });

    expect(plan.journeys).toEqual([]);
    expect(plan.defaultJourneyId).toBeNull();
    expect(plan.diagnostics.unroutableJourneyIds).toEqual([
      "journey-repocity-repository-to-city",
    ]);
  });

  it("supports every transport agent type through deterministic overrides", () => {
    const modes: FlowTransportMode[] = [
      "pedestrian",
      "car",
      "transit",
      "freight",
      "boat",
    ];
    const traversedRelationIds = [
      "r-prepare-git",
      "r-git-code",
      "r-code-compiler",
      "r-compiler-replay",
      "r-writer-loader",
    ];
    const modeOverrides = Object.fromEntries(
      traversedRelationIds.map((relationId, index) => [
        relationId,
        modes[index]!,
      ]),
    );
    const plan = planFlowSimulation({
      entities: repoEntities,
      relations: repoRelations,
      cityPlan: cityFor(repoEntities, repoRelations),
      maxJourneys: 2,
      modeOverrides,
      tokensPerLeg: 1,
      artifactWaterBoundary: artifactBoundary(),
    });
    const inferred = plan.journeys.find(
      (journey) => journey.kind === "dependency-journey",
    )!;
    const actualModes = new Set(
      inferred.legs.map((leg) => leg.mode),
    );

    for (const mode of modes) {
      expect(actualModes.has(mode)).toBe(true);
      expect(
        inferred.tokens.some(
          (token) =>
            token.mode === mode &&
            token.legId ===
              inferred.legs.find((leg) => leg.mode === mode)?.id,
        ),
      ).toBe(true);
    }
  });
});
