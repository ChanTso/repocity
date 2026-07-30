import { extname, posix } from "node:path";

import ts from "typescript";

import { normalizeRepoPath } from "./ignore.js";
import type {
  FileRole,
  ImportKind,
  ImportReference,
  SourceAnalysis,
  SourceExtension,
  SourceLanguage,
} from "./types.js";

function scriptKindFor(extension: SourceExtension): ts.ScriptKind {
  switch (extension) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

function collectBindingNames(name: ts.BindingName, names: Set<string>): void {
  if (ts.isIdentifier(name)) {
    names.add(name.text);
    return;
  }

  for (const element of name.elements) {
    if (ts.isBindingElement(element)) {
      collectBindingNames(element.name, names);
    }
  }
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false)
  );
}

function propertyNameText(name: ts.PropertyName | undefined): string | undefined {
  if (!name) {
    return undefined;
  }
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function commonJsExportName(node: ts.BinaryExpression): string[] {
  if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
    return [];
  }

  const left = node.left;
  if (!ts.isPropertyAccessExpression(left)) {
    return [];
  }

  if (ts.isIdentifier(left.expression) && left.expression.text === "exports") {
    return [left.name.text];
  }

  if (
    ts.isPropertyAccessExpression(left.expression) &&
    ts.isIdentifier(left.expression.expression) &&
    left.expression.expression.text === "module" &&
    left.expression.name.text === "exports"
  ) {
    return [left.name.text];
  }

  if (
    ts.isIdentifier(left.expression) &&
    left.expression.text === "module" &&
    left.name.text === "exports"
  ) {
    if (ts.isObjectLiteralExpression(node.right)) {
      const names = node.right.properties
        .map((property) => propertyNameText(property.name))
        .filter((name): name is string => Boolean(name));
      return names.length > 0 ? names : ["default"];
    }
    return ["default"];
  }

  return [];
}

function moduleSpecifierText(expression: ts.Expression | undefined): string | undefined {
  return expression && ts.isStringLiteralLike(expression) ? expression.text : undefined;
}

function pushImport(
  imports: Map<string, ImportReference>,
  specifier: string | undefined,
  kind: ImportKind,
): void {
  if (!specifier) {
    return;
  }
  imports.set(`${kind}:${specifier}`, { specifier, kind });
}

export function classifyFileRole(filePath: string): FileRole {
  const normalizedPath = normalizeRepoPath(filePath).toLowerCase();
  const fileName = posix.basename(normalizedPath);

  if (
    /(^|\/)(__tests__|tests?|specs?|e2e|integration)(\/|$)/.test(normalizedPath) ||
    /\.(test|spec)\.[jt]sx?$/.test(fileName)
  ) {
    return "test";
  }
  if (/(^|\/)(docs?|examples?|stories)(\/|$)/.test(normalizedPath)) {
    return "docs";
  }
  if (
    /(^|\/)(scripts?|tools?|bin)(\/|$)/.test(normalizedPath) ||
    fileName.startsWith("script.")
  ) {
    return "script";
  }
  if (
    /(^|\/)(config|infra)(\/|$)/.test(normalizedPath) ||
    /(^|\.)(config|rc)\.[jt]sx?$/.test(fileName) ||
    /^(vite|vitest|webpack|rollup|eslint|prettier|tailwind|postcss|next|nuxt|jest)\.config\.[jt]s$/.test(
      fileName,
    )
  ) {
    return "config";
  }
  if (/(^|\/)(src|lib|server|client|app|packages?|apps?)(\/|$)/.test(normalizedPath)) {
    return "source";
  }
  return "other";
}

export function isLikelyEntryPoint(filePath: string): boolean {
  const normalizedPath = normalizeRepoPath(filePath).toLowerCase();
  const fileName = posix.basename(normalizedPath);

  return (
    /(^|\/)(index|main|server|client|cli|entry)\.[jt]sx?$/.test(normalizedPath) ||
    /(^|\/)(routes?|pages?|app)\/.+\.[jt]sx?$/.test(normalizedPath) ||
    /(^|\/)(bin)\/.+\.[jt]s$/.test(normalizedPath) ||
    /^(next|vite|vitest|webpack|rollup)\.config\.[jt]s$/.test(fileName)
  );
}

export function analyzeSource(filePath: string, contents: string): SourceAnalysis {
  const normalizedPath = normalizeRepoPath(filePath);
  const extension = extname(normalizedPath) as SourceExtension;
  if (![".ts", ".tsx", ".js", ".jsx"].includes(extension)) {
    throw new Error(`Unsupported source extension for ${filePath}`);
  }

  const sourceFile = ts.createSourceFile(
    normalizedPath,
    contents,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(extension),
  );
  const imports = new Map<string, ImportReference>();
  const exportNames = new Set<string>();

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      pushImport(imports, moduleSpecifierText(node.moduleSpecifier), "import");
    } else if (ts.isExportDeclaration(node)) {
      pushImport(imports, moduleSpecifierText(node.moduleSpecifier), "export");
      if (!node.exportClause) {
        if (node.moduleSpecifier) {
          exportNames.add("*");
        }
      } else if (ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) {
          exportNames.add(element.name.text);
        }
      } else {
        exportNames.add(node.exportClause.name.text);
      }
    } else if (ts.isExportAssignment(node)) {
      exportNames.add("default");
    } else if (ts.isImportEqualsDeclaration(node)) {
      if (ts.isExternalModuleReference(node.moduleReference)) {
        pushImport(
          imports,
          moduleSpecifierText(node.moduleReference.expression),
          "import",
        );
      }
    } else if (
      (ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node) ||
        ts.isModuleDeclaration(node)) &&
      hasModifier(node, ts.SyntaxKind.ExportKeyword)
    ) {
      if (hasModifier(node, ts.SyntaxKind.DefaultKeyword)) {
        exportNames.add("default");
      } else if (node.name) {
        exportNames.add(node.name.text);
      }
    } else if (
      ts.isVariableStatement(node) &&
      hasModifier(node, ts.SyntaxKind.ExportKeyword)
    ) {
      if (hasModifier(node, ts.SyntaxKind.DefaultKeyword)) {
        exportNames.add("default");
      }
      for (const declaration of node.declarationList.declarations) {
        collectBindingNames(declaration.name, exportNames);
      }
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        pushImport(imports, moduleSpecifierText(node.arguments[0]), "dynamic-import");
      } else if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require"
      ) {
        pushImport(imports, moduleSpecifierText(node.arguments[0]), "require");
      }
    } else if (ts.isBinaryExpression(node)) {
      for (const name of commonJsExportName(node)) {
        exportNames.add(name);
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  const language: SourceLanguage =
    extension === ".ts" || extension === ".tsx" ? "typescript" : "javascript";
  const names = [...exportNames].sort((left, right) => left.localeCompare(right));

  return {
    path: normalizedPath,
    extension,
    language,
    role: classifyFileRole(normalizedPath),
    loc: contents.split(/\r?\n/).filter((line) => line.trim().length > 0).length,
    imports: [...imports.values()].sort((left, right) =>
      `${left.specifier}:${left.kind}`.localeCompare(`${right.specifier}:${right.kind}`),
    ),
    exportNames: names,
    exports: names.length,
    isEntryPoint: isLikelyEntryPoint(normalizedPath),
  };
}
