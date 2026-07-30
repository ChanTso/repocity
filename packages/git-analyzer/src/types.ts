import type {
  FileRole,
  ImportReference,
  ResolverConfig,
  SourceLanguage,
} from "@repocity/code-analyzer";

export interface RuntimeMetrics {
  loc: number;
  exports: number;
  fanIn: number;
  fanOut: number;
}

export interface EntityMaxMetrics extends RuntimeMetrics {
  churn: number;
}

export interface AnalyzedEntity {
  id: string;
  kind: "building";
  path: string;
  aliases: string[];
  name: string;
  extension: string;
  language: SourceLanguage;
  role: FileRole;
  bornAt: number;
  diedAt?: number;
  maxMetrics: EntityMaxMetrics;
  currentMetrics: RuntimeMetrics;
  exportNames: string[];
  isEntryPoint: boolean;
}

export type GitChangeStatus = "add" | "modify" | "delete" | "rename" | "copy";

export interface GitFileChange {
  status: GitChangeStatus;
  path: string;
  oldPath?: string;
  similarity?: number;
  additions: number;
  deletions: number;
  entityId?: string;
}

export interface AnalyzedCommit {
  index: number;
  sha: string;
  parents: string[];
  authorName: string;
  authoredAt: string;
  message: string;
  tags: string[];
  changedEntityIds: string[];
  changes: GitFileChange[];
  chapterId?: string;
}

export interface AnalyzedRelation {
  id: string;
  sourceId: string;
  targetId: string;
  kind: "import";
  bornAt: number;
  diedAt?: number;
  weight: number;
}

export type EntityReplayChange =
  | { op: "spawn"; entityId: string; metrics: RuntimeMetrics }
  | {
      op: "update";
      entityId: string;
      before: RuntimeMetrics;
      after: RuntimeMetrics;
    }
  | { op: "remove"; entityId: string }
  | {
      op: "rename";
      entityId: string;
      beforePath: string;
      afterPath: string;
    };

export type RelationReplayChange =
  | { op: "add"; relationId: string }
  | { op: "remove"; relationId: string };

export interface AnalyzedReplayDelta {
  commitIndex: number;
  entityChanges: EntityReplayChange[];
  relationChanges: RelationReplayChange[];
}

export interface RepositoryMetadata {
  name: string;
  path: string;
  remoteUrl?: string;
  defaultBranch: string;
  headSha: string;
}

export interface GitAnalysisResult {
  repo: RepositoryMetadata;
  entities: AnalyzedEntity[];
  relations: AnalyzedRelation[];
  commits: AnalyzedCommit[];
  deltas: AnalyzedReplayDelta[];
  resolverConfig: ResolverConfig;
  warnings: string[];
}

export interface AnalyzeGitOptions {
  ignorePatterns?: string[];
  maxFileBytes?: number;
  onProgress?: (progress: GitAnalysisProgress) => void;
}

export interface GitAnalysisProgress {
  phase: "metadata" | "history" | "commit" | "complete";
  current?: number;
  total?: number;
  message: string;
}

export interface PreparedRepository {
  path: string;
  input: string;
  cloned: boolean;
  cleanup(): Promise<void>;
}

export interface ActiveAnalyzedFile {
  id: string;
  path: string;
  loc: number;
  exports: number;
  exportNames: string[];
  imports: ImportReference[];
  language: SourceLanguage;
  role: FileRole;
  isEntryPoint: boolean;
}
