/**
 * Conteos de `.ts`/`.tsx` de `tools/ui-guard.ts` (spec 0164): `Linter` de ESLint con el parser de
 * typescript-eslint y `noInlineConfig` (un `eslint-disable` no apaga nada).
 */

import { Linter, type Rule } from "eslint";
import tseslint from "typescript-eslint";
import {
  add,
  classCategories,
  MERCHANT,
  type Category,
  type Counts,
} from "./ui-guard-counts.ts";

const SVG =
  "svg g path circle ellipse line polyline polygon rect text tspan defs linearGradient radialGradient stop clipPath mask pattern symbol use title desc";
const ALLOWED_NATIVE = new Set(
  (
    "div span p h1 h2 h3 h4 h5 h6 ul ol li dl dt dd section article header footer main nav aside strong em small b i u s mark sub sup br hr figure figcaption blockquote q cite abbr time code pre kbd table thead tbody tfoot tr th td caption colgroup col img picture source video canvas " +
    SVG
  ).split(" "),
);
/** Para `tag-variable`: un string que es nombre de tag (permitido o no). */
const TAG_NAMES = new Set([
  ...ALLOWED_NATIVE,
  ..."a button input select textarea label form fieldset legend dialog details summary option optgroup iframe output meter progress datalist menu area map object embed audio".split(
    " ",
  ),
]);
const RESTRICTED_IMPORT =
  /^(react-aria-components|react-aria|react-stately|@react-aria\/.+|@react-stately\/.+|next\/link)$/;

type AnyNode = Rule.Node & Record<string, unknown>;

/** Un string literal, o un `?:`/`&&`/`||`/`as` cuyas hojas lo son. */
function stringValues(node: AnyNode | null | undefined): string[] | null {
  if (!node) return null;
  if (node.type === "Literal")
    return typeof node.value === "string" ? [node.value] : null;
  if (node.type === "TemplateLiteral")
    return (node.expressions as unknown[]).length === 0
      ? (node.quasis as Array<{ value: { cooked: string } }>).map(
          (q) => q.value.cooked,
        )
      : null;
  if ((node.type as string) === "TSAsExpression")
    return stringValues(node.expression as AnyNode);
  if (node.type === "ConditionalExpression") {
    const a = stringValues(node.consequent as AnyNode);
    const b = stringValues(node.alternate as AnyNode);
    return a && b ? [...a, ...b] : null;
  }
  if (node.type === "LogicalExpression")
    return stringValues(node.right as AnyNode);
  return null;
}

function isCustomPropertyStyle(value: AnyNode | null): boolean {
  if (value?.type !== "JSXExpressionContainer") return false;
  const object = value.expression as AnyNode;
  if (object.type !== "ObjectExpression") return false;
  return (object.properties as AnyNode[]).every(
    (p) =>
      p.type === "Property" &&
      (p.key as AnyNode).type === "Literal" &&
      String((p.key as AnyNode).value).startsWith("--"),
  );
}

function checkNative(element: AnyNode, report: Report): void {
  const name = element.name as AnyNode;
  if (name.type !== "JSXIdentifier" || !/^[a-z]/.test(String(name.name)))
    return;
  if (!ALLOWED_NATIVE.has(String(name.name))) report(element, "native-element");
  for (const attribute of element.attributes as AnyNode[]) {
    if (attribute.type === "JSXSpreadAttribute") {
      report(attribute, "native-spread");
      continue;
    }
    const attr = String((attribute.name as AnyNode).name);
    if (/^on[A-Z]/.test(attr)) report(attribute, "native-handler");
    if (attr === "dangerouslySetInnerHTML") report(attribute, "dangerous-html");
    if (
      attr === "style" &&
      !isCustomPropertyStyle(attribute.value as AnyNode | null)
    )
      report(attribute, "native-style");
  }
}

function checkCall(call: AnyNode, report: Report): void {
  const callee = call.callee as AnyNode;
  const property = callee.property as AnyNode | undefined;
  if (
    (callee.type === "Identifier" &&
      /^(createElement|jsx|jsxs|jsxDEV)$/.test(String(callee.name))) ||
    (callee.type === "MemberExpression" &&
      property?.type === "Identifier" &&
      property.name === "createElement" &&
      // `document.createElement` es el DOM (un canvas para recortar), no React.
      (callee.object as AnyNode).name !== "document")
  )
    report(call, "create-element");
}

type Report = (node: AnyNode, category: Category) => void;

const guardRule: Rule.RuleModule = {
  create(context) {
    const inApp = context.filename.slice(MERCHANT.length).startsWith("app/");
    const report: Report = (node, category) =>
      context.report({ node, message: category });
    const importSource = (node: AnyNode) => {
      const source = node.source as AnyNode | null;
      if (source?.type !== "Literal") return;
      const value = String(source.value);
      if (RESTRICTED_IMPORT.test(value)) report(node, "restricted-import");
      if (node.type === "ImportDeclaration" && value.endsWith(".css") && inApp)
        report(node, "css-import");
    };
    const classes = (node: AnyNode, text: string) => {
      for (const category of classCategories(text)) report(node, category);
    };
    return {
      JSXOpeningElement: (node) => checkNative(node as AnyNode, report),
      CallExpression: (node) => checkCall(node as AnyNode, report),
      VariableDeclarator(node) {
        const id = (node as AnyNode).id as AnyNode;
        const values = stringValues((node as AnyNode).init as AnyNode | null);
        if (
          id.type === "Identifier" &&
          /^[A-Z]/.test(String(id.name)) &&
          values?.some((v) => TAG_NAMES.has(v))
        )
          report(node as AnyNode, "tag-variable");
      },
      ImportDeclaration: (node) => importSource(node as AnyNode),
      ExportNamedDeclaration: (node) => importSource(node as AnyNode),
      ExportAllDeclaration: (node) => importSource(node as AnyNode),
      ImportExpression: (node) => importSource(node as AnyNode),
      Literal(node) {
        const literal = node as AnyNode;
        const parent = literal.parent as AnyNode | undefined;
        if (typeof literal.value !== "string" || parent?.source === literal)
          return;
        classes(literal, literal.value);
      },
      TemplateElement(node) {
        const value = (node as AnyNode).value as { cooked: string | null };
        classes(node as AnyNode, value.cooked ?? "");
      },
    };
  },
};

const linter = new Linter({ configType: "flat" });
const config = (jsx: boolean, files: string[]): Linter.Config => ({
  files,
  languageOptions: {
    parser: tseslint.parser as Linter.Parser,
    parserOptions: { ecmaFeatures: { jsx }, sourceType: "module" },
  },
  linterOptions: {
    noInlineConfig: true,
    reportUnusedDisableDirectives: "off",
  },
  plugins: { ui: { rules: { guard: guardRule } } },
  rules: { "ui/guard": "error" },
});
const CONFIG = [config(true, ["**/*.tsx"]), config(false, ["**/*.ts"])];

/** Conteos de un `.ts`/`.tsx`. Un archivo que no parsea es un error, no se saltea. */
export function countSource(path: string, text: string): Counts {
  const counts: Counts = {};
  for (const message of linter.verify(text, CONFIG, path)) {
    if (message.fatal) {
      throw new Error(`${path}:${message.line}: ${message.message}`);
    }
    if (message.ruleId === "ui/guard") {
      add(counts, message.message as Category, message.line);
    }
  }
  return counts;
}
