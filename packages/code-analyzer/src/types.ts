export const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"] as const;

export type SourceExtension = (typeof SOURCE_EXTENSIONS)[number];
export type SourceLanguage = "typescript" | "javascript";
export type FileRole = "source" | "test" | "docs" | "config" | "script" | "other";
export type ImportKind = "import" | "export" | "require" | "dynamic-import";

export interface ImportReference {
  specifier: string;
  kind: ImportKind;
}

export interface SourceAnalysis {
  path: string;
  extension: SourceExtension;
  language: SourceLanguage;
  role: FileRole;
  loc: number;
  imports: ImportReference[];
  exportNames: string[];
  exports: number;
  isEntryPoint: boolean;
}

export interface WorkspacePackage {
  name: string;
  directory: string;
  entries: string[];
}

export interface PathAlias {
  pattern: string;
  targets: string[];
}

export interface ResolverConfig {
  baseUrl: string;
  aliases: PathAlias[];
  workspacePackages: WorkspacePackage[];
}

export interface ResolvableFile {
  id: string;
  path: string;
  imports: ImportReference[];
}

export interface ResolvedImport {
  sourceId: string;
  targetId: string;
  specifier: string;
}

export interface IgnoreRule {
  pattern: string;
  negated: boolean;
  regex: RegExp;
}
