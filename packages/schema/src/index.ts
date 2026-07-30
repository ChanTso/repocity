import { z } from "zod";

export const SCHEMA_VERSION = "0.1" as const;

const finiteNumber = z.number().finite();
const nonNegativeInteger = z.number().int().nonnegative();
const positiveInteger = z.number().int().positive();

export const EntityIdSchema = z.string().min(1);
export const CommitIndexSchema = nonNegativeInteger;

export const LanguageSchema = z.enum(["typescript", "javascript"]);
export const EntityRoleSchema = z.enum([
  "source",
  "test",
  "docs",
  "config",
  "script",
  "other",
]);

export const RuntimeMetricsSchema = z
  .object({
    loc: nonNegativeInteger,
    exports: nonNegativeInteger,
    fanIn: nonNegativeInteger,
    fanOut: nonNegativeInteger,
  })
  .strict();

export const MaxMetricsSchema = RuntimeMetricsSchema.extend({
  churn: nonNegativeInteger,
}).strict();

export const EntityLayoutSchema = z
  .object({
    x: finiteNumber,
    z: finiteNumber,
    width: finiteNumber.positive(),
    depth: finiteNumber.positive(),
    maxHeight: finiteNumber.positive(),
    rotationY: finiteNumber,
    styleVariant: nonNegativeInteger,
  })
  .strict();

export const CityEntitySchema = z
  .object({
    id: EntityIdSchema,
    kind: z.literal("building"),
    path: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    name: z.string().min(1),
    extension: z.string().regex(/^\.[a-z0-9]+$/i),
    language: LanguageSchema,
    role: EntityRoleSchema,
    districtId: z.string().min(1),
    bornAt: CommitIndexSchema,
    diedAt: CommitIndexSchema.optional(),
    maxMetrics: MaxMetricsSchema,
    layout: EntityLayoutSchema,
  })
  .strict()
  .superRefine((entity, context) => {
    if (entity.diedAt !== undefined && entity.diedAt < entity.bornAt) {
      context.addIssue({
        code: "custom",
        message: "diedAt must not precede bornAt",
        path: ["diedAt"],
      });
    }

    if (new Set(entity.aliases).size !== entity.aliases.length) {
      context.addIssue({
        code: "custom",
        message: "aliases must be unique",
        path: ["aliases"],
      });
    }
  });

export const RelationSchema = z
  .object({
    id: z.string().min(1),
    sourceId: EntityIdSchema,
    targetId: EntityIdSchema,
    kind: z.literal("import"),
    bornAt: CommitIndexSchema,
    diedAt: CommitIndexSchema.optional(),
    weight: positiveInteger,
  })
  .strict()
  .superRefine((relation, context) => {
    if (
      relation.diedAt !== undefined &&
      relation.diedAt < relation.bornAt
    ) {
      context.addIssue({
        code: "custom",
        message: "diedAt must not precede bornAt",
        path: ["diedAt"],
      });
    }

    if (relation.sourceId === relation.targetId) {
      context.addIssue({
        code: "custom",
        message: "self relations are not supported",
        path: ["targetId"],
      });
    }
  });

export const CommitMetaSchema = z
  .object({
    index: CommitIndexSchema,
    sha: z.string().regex(/^[0-9a-f]{7,64}$/i),
    parents: z.array(z.string().regex(/^[0-9a-f]{7,64}$/i)),
    authorName: z.string().min(1),
    authoredAt: z.string().datetime({ offset: true }),
    message: z.string(),
    tags: z.array(z.string().min(1)),
    changedEntityIds: z.array(EntityIdSchema),
    chapterId: z.string().min(1).optional(),
  })
  .strict();

export const SpawnEntityChangeSchema = z
  .object({
    op: z.literal("spawn"),
    entityId: EntityIdSchema,
    metrics: RuntimeMetricsSchema,
  })
  .strict();

export const UpdateEntityChangeSchema = z
  .object({
    op: z.literal("update"),
    entityId: EntityIdSchema,
    before: RuntimeMetricsSchema,
    after: RuntimeMetricsSchema,
  })
  .strict();

export const RemoveEntityChangeSchema = z
  .object({
    op: z.literal("remove"),
    entityId: EntityIdSchema,
  })
  .strict();

export const RenameEntityChangeSchema = z
  .object({
    op: z.literal("rename"),
    entityId: EntityIdSchema,
    beforePath: z.string().min(1),
    afterPath: z.string().min(1),
  })
  .strict()
  .refine((change) => change.beforePath !== change.afterPath, {
    message: "rename paths must differ",
    path: ["afterPath"],
  });

export const EntityChangeSchema = z.discriminatedUnion("op", [
  SpawnEntityChangeSchema,
  UpdateEntityChangeSchema,
  RemoveEntityChangeSchema,
  RenameEntityChangeSchema,
]);

export const RelationChangeSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("add"),
      relationId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      op: z.literal("remove"),
      relationId: z.string().min(1),
    })
    .strict(),
]);

export const ReplayDeltaSchema = z
  .object({
    commitIndex: CommitIndexSchema,
    entityChanges: z.array(EntityChangeSchema),
    relationChanges: z.array(RelationChangeSchema),
  })
  .strict();

export const RuntimeEntityStateSchema = z
  .object({
    entityId: EntityIdSchema,
    path: z.string().min(1),
    metrics: RuntimeMetricsSchema,
  })
  .strict();

export const ReplayStateSchema = z
  .object({
    commitIndex: z.number().int().min(-1),
    entities: z.record(EntityIdSchema, RuntimeEntityStateSchema),
    relationIds: z.array(z.string().min(1)),
  })
  .strict();

/**
 * Keyframe files contain exactly the serializable replay state. Keeping the
 * shapes identical avoids an extra wrapper in every seek.
 */
export const ReplayKeyframeSchema = ReplayStateSchema;

export const DistrictLayoutSchema = z
  .object({
    x: finiteNumber,
    z: finiteNumber,
    width: finiteNumber.positive(),
    depth: finiteNumber.positive(),
  })
  .strict();

export const DistrictSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    entityIds: z.array(EntityIdSchema),
    weight: finiteNumber.positive(),
    color: z.string().regex(/^#[0-9a-f]{6}$/i),
    layout: DistrictLayoutSchema,
  })
  .strict();

export const ChapterSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1).optional(),
    startCommitIndex: CommitIndexSchema,
    endCommitIndex: CommitIndexSchema,
    commitIndices: z.array(CommitIndexSchema).min(1),
    mode: z.enum(["rules", "manual", "ai"]),
    disclaimer: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((chapter, context) => {
    if (chapter.endCommitIndex < chapter.startCommitIndex) {
      context.addIssue({
        code: "custom",
        message: "chapter end must not precede start",
        path: ["endCommitIndex"],
      });
    }
    if (
      chapter.commitIndices[0] !== chapter.startCommitIndex ||
      chapter.commitIndices.at(-1) !== chapter.endCommitIndex
    ) {
      context.addIssue({
        code: "custom",
        message: "chapter boundaries must match commitIndices",
        path: ["commitIndices"],
      });
    }
  });

export const RepoManifestSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    projectId: z.string().min(1),
    repo: z
      .object({
        name: z.string().min(1),
        remoteUrl: z.string().url().optional(),
        defaultBranch: z.string().min(1),
        headSha: z.string().regex(/^[0-9a-f]{7,64}$/i),
      })
      .strict(),
    stats: z
      .object({
        entityCount: nonNegativeInteger,
        districtCount: nonNegativeInteger,
        commitCount: nonNegativeInteger,
        displayedCommitCount: nonNegativeInteger,
      })
      .strict(),
    files: z
      .object({
        districts: z.string().min(1).optional(),
        entities: z.string().min(1),
        relations: z.string().min(1),
        commits: z.string().min(1),
        chapters: z.string().min(1),
        deltas: z.string().min(1),
        keyframesDir: z.string().min(1),
      })
      .strict(),
  })
  .strict();

/** Schemas for each independently loaded file in a static project bundle. */
export const DistrictsFileSchema = z.array(DistrictSchema);
export const EntitiesFileSchema = z.array(CityEntitySchema);
export const RelationsFileSchema = z.array(RelationSchema);
export const CommitsFileSchema = z.array(CommitMetaSchema);
export const ChaptersFileSchema = z.array(ChapterSchema);
export const DeltasFileSchema = z.array(ReplayDeltaSchema);
export const KeyframesFileSchema = z.array(ReplayKeyframeSchema);

// Short aliases are convenient for consumers that do not expose file names.
export const DistrictsSchema = DistrictsFileSchema;
export const EntitiesSchema = EntitiesFileSchema;
export const RelationsSchema = RelationsFileSchema;
export const CommitsSchema = CommitsFileSchema;
export const ChaptersSchema = ChaptersFileSchema;
export const DeltasSchema = DeltasFileSchema;
export const KeyframesSchema = KeyframesFileSchema;

export const RepoCityBundleSchema = z
  .object({
    manifest: RepoManifestSchema,
    districts: z.array(DistrictSchema),
    entities: z.array(CityEntitySchema),
    relations: z.array(RelationSchema),
    commits: z.array(CommitMetaSchema),
    chapters: z.array(ChapterSchema),
    deltas: z.array(ReplayDeltaSchema),
    keyframes: z.array(ReplayKeyframeSchema),
  })
  .strict()
  .superRefine((bundle, context) => {
    const uniqueMap = <T>(
      values: readonly T[],
      getId: (value: T) => string | number,
      path: string,
    ) => {
      const map = new Map<string | number, T>();
      values.forEach((value, index) => {
        const id = getId(value);
        if (map.has(id)) {
          context.addIssue({
            code: "custom",
            message: `duplicate ${path} id: ${String(id)}`,
            path: [path, index],
          });
        }
        map.set(id, value);
      });
      return map;
    };

    const districts = uniqueMap(bundle.districts, (item) => item.id, "districts");
    const entities = uniqueMap(bundle.entities, (item) => item.id, "entities");
    const relations = uniqueMap(bundle.relations, (item) => item.id, "relations");
    const commits = uniqueMap(bundle.commits, (item) => item.index, "commits");
    const chapters = uniqueMap(bundle.chapters, (item) => item.id, "chapters");
    uniqueMap(bundle.deltas, (item) => item.commitIndex, "deltas");
    uniqueMap(bundle.keyframes, (item) => item.commitIndex, "keyframes");

    const stats = bundle.manifest.stats;
    const countChecks: Array<[number, number, string]> = [
      [stats.entityCount, bundle.entities.length, "entityCount"],
      [stats.districtCount, bundle.districts.length, "districtCount"],
      [stats.commitCount, bundle.commits.length, "commitCount"],
      [
        stats.displayedCommitCount,
        bundle.deltas.length,
        "displayedCommitCount",
      ],
    ];
    for (const [declared, actual, field] of countChecks) {
      if (declared !== actual) {
        context.addIssue({
          code: "custom",
          message: `${field} is ${declared}, expected ${actual}`,
          path: ["manifest", "stats", field],
        });
      }
    }

    bundle.entities.forEach((entity, index) => {
      const district = districts.get(entity.districtId);
      if (!district) {
        context.addIssue({
          code: "custom",
          message: `unknown district: ${entity.districtId}`,
          path: ["entities", index, "districtId"],
        });
      } else if (!district.entityIds.includes(entity.id)) {
        context.addIssue({
          code: "custom",
          message: `entity is missing from district entityIds: ${entity.id}`,
          path: ["entities", index, "districtId"],
        });
      }
    });

    bundle.districts.forEach((district, districtIndex) => {
      district.entityIds.forEach((entityId, entityIndex) => {
        const entity = entities.get(entityId);
        if (!entity || entity.districtId !== district.id) {
          context.addIssue({
            code: "custom",
            message: `district contains an unknown or mismatched entity: ${entityId}`,
            path: ["districts", districtIndex, "entityIds", entityIndex],
          });
        }
      });
    });

    bundle.relations.forEach((relation, index) => {
      const source = entities.get(relation.sourceId);
      const target = entities.get(relation.targetId);
      if (!source) {
        context.addIssue({
          code: "custom",
          message: `unknown relation source: ${relation.sourceId}`,
          path: ["relations", index, "sourceId"],
        });
      }
      if (!target) {
        context.addIssue({
          code: "custom",
          message: `unknown relation target: ${relation.targetId}`,
          path: ["relations", index, "targetId"],
        });
      }
      if (
        source &&
        target &&
        relation.bornAt < Math.max(source.bornAt, target.bornAt)
      ) {
        context.addIssue({
          code: "custom",
          message: "relation cannot be born before either endpoint",
          path: ["relations", index, "bornAt"],
        });
      }
    });

    bundle.commits.forEach((commit, index) => {
      commit.changedEntityIds.forEach((entityId, entityIndex) => {
        if (!entities.has(entityId)) {
          context.addIssue({
            code: "custom",
            message: `commit references unknown entity: ${entityId}`,
            path: ["commits", index, "changedEntityIds", entityIndex],
          });
        }
      });
      if (commit.chapterId && !chapters.has(commit.chapterId)) {
        context.addIssue({
          code: "custom",
          message: `commit references unknown chapter: ${commit.chapterId}`,
          path: ["commits", index, "chapterId"],
        });
      }
    });

    bundle.deltas.forEach((delta, deltaIndex) => {
      if (!commits.has(delta.commitIndex)) {
        context.addIssue({
          code: "custom",
          message: `delta has no matching commit: ${delta.commitIndex}`,
          path: ["deltas", deltaIndex, "commitIndex"],
        });
      }
      delta.entityChanges.forEach((change, changeIndex) => {
        if (!entities.has(change.entityId)) {
          context.addIssue({
            code: "custom",
            message: `delta references unknown entity: ${change.entityId}`,
            path: ["deltas", deltaIndex, "entityChanges", changeIndex],
          });
        }
      });
      delta.relationChanges.forEach((change, changeIndex) => {
        if (!relations.has(change.relationId)) {
          context.addIssue({
            code: "custom",
            message: `delta references unknown relation: ${change.relationId}`,
            path: ["deltas", deltaIndex, "relationChanges", changeIndex],
          });
        }
      });
    });

    bundle.keyframes.forEach((keyframe, keyframeIndex) => {
      if (!commits.has(keyframe.commitIndex)) {
        context.addIssue({
          code: "custom",
          message: `keyframe has no matching commit: ${keyframe.commitIndex}`,
          path: ["keyframes", keyframeIndex, "commitIndex"],
        });
      }
      Object.entries(keyframe.entities).forEach(
        ([entityId, entityState], entityIndex) => {
          if (!entities.has(entityId) || entityState.entityId !== entityId) {
            context.addIssue({
              code: "custom",
              message: `keyframe contains an unknown or mismatched entity: ${entityId}`,
              path: ["keyframes", keyframeIndex, "entities", entityIndex],
            });
          }
        },
      );
      keyframe.relationIds.forEach((relationId, relationIndex) => {
        if (!relations.has(relationId)) {
          context.addIssue({
            code: "custom",
            message: `keyframe contains unknown relation: ${relationId}`,
            path: [
              "keyframes",
              keyframeIndex,
              "relationIds",
              relationIndex,
            ],
          });
        }
      });
    });
  });

export type EntityId = z.infer<typeof EntityIdSchema>;
export type CommitIndex = z.infer<typeof CommitIndexSchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type EntityRole = z.infer<typeof EntityRoleSchema>;
export type RuntimeMetrics = z.infer<typeof RuntimeMetricsSchema>;
export type MaxMetrics = z.infer<typeof MaxMetricsSchema>;
export type EntityLayout = z.infer<typeof EntityLayoutSchema>;
export type CityEntity = z.infer<typeof CityEntitySchema>;
export type Relation = z.infer<typeof RelationSchema>;
export type CommitMeta = z.infer<typeof CommitMetaSchema>;
export type EntityChange = z.infer<typeof EntityChangeSchema>;
export type RelationChange = z.infer<typeof RelationChangeSchema>;
export type ReplayDelta = z.infer<typeof ReplayDeltaSchema>;
export type RuntimeEntityState = z.infer<typeof RuntimeEntityStateSchema>;
export type ReplayState = z.infer<typeof ReplayStateSchema>;
export type ReplayKeyframe = z.infer<typeof ReplayKeyframeSchema>;
export type DistrictLayout = z.infer<typeof DistrictLayoutSchema>;
export type District = z.infer<typeof DistrictSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type RepoManifest = z.infer<typeof RepoManifestSchema>;
export type RepoCityBundle = z.infer<typeof RepoCityBundleSchema>;

export function validateRepoCityBundle(input: unknown): RepoCityBundle {
  return RepoCityBundleSchema.parse(input);
}

export function safeValidateRepoCityBundle(input: unknown) {
  return RepoCityBundleSchema.safeParse(input);
}
