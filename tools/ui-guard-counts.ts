/**
 * Categorias, tokens de clase y CSS de `tools/ui-guard.ts` (spec 0164, Fase 0c del ADR 0123).
 */

import postcss, { type AtRule, type Container, type Node } from "postcss";

export const CATEGORIES = [
  "native-element",
  "native-handler",
  "native-style",
  "dangerous-html",
  "native-spread",
  "create-element",
  "tag-variable",
  "restricted-import",
  "css-import",
  "raw-palette",
  "arbitrary-value",
  "type-scale",
  "css-file",
  "css-selector",
  "css-at-rule",
  "css-color",
  "css-kit-selector",
] as const;

export type Category = (typeof CATEGORIES)[number];
/** Por categoria, las lineas donde aparece (el conteo es el largo). */
export type Counts = Partial<Record<Category, number[]>>;

export const MERCHANT = "apps/merchant/src/";

export function add(counts: Counts, category: Category, line: number): void {
  (counts[category] ??= []).push(line);
}

const PALETTE =
  /^(bg|text|border(-[xytrblse])?|ring(-offset)?|fill|stroke|from|via|to|outline|divide|decoration|placeholder|caret|accent|shadow)-((slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|white|black)(\/.*)?$/;
const TYPE_SCALE =
  /^(text-(xs|sm|base|lg|[2-9]?xl)|font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|leading-.+)(\/.*)?$/;

/** La utilidad de un token de clase: sin variantes (`md:`, `data-[x]:`) ni `!`/`-` inicial. */
export function utilityOf(token: string): string {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (c === ":" && depth === 0) cut = i;
  }
  return token
    .slice(cut + 1)
    .replace(/^!/, "")
    .replace(/!$/, "")
    .replace(/^-/, "");
}

/**
 * Valor arbitrario, salvo una custom property: `w-[var(--x)]` o `w-(--x)`. Una propiedad arbitraria
 * es `[prop:valor]`; un selector de tour (`[data-tour="x"]`) no lo es.
 */
function isArbitrary(utility: string): boolean {
  if (utility.startsWith("[")) return /^\[[a-z-]+:[^\]]+\]$/.test(utility);
  const bracket = /-\[(.*)\]$/.exec(utility);
  if (bracket) return !/^var\(--[\w-]+\)$/.test(bracket[1]);
  const paren = /-\((.*)\)$/.exec(utility);
  if (paren) return !/^--[\w-]+$/.test(paren[1]);
  return false;
}

/** Categorias de clase de un string (`raw-palette`, `arbitrary-value`, `type-scale`). */
export function classCategories(text: string): Category[] {
  const found: Category[] = [];
  for (const token of text.split(/\s+/)) {
    if (token.length === 0) continue;
    const utility = utilityOf(token);
    if (PALETTE.test(utility)) found.push("raw-palette");
    if (isArbitrary(utility)) found.push("arbitrary-value");
    if (TYPE_SCALE.test(utility)) found.push("type-scale");
  }
  return found;
}

const CSS_ALLOWED = new Set([
  "apps/merchant/src/app/globals.css",
  "apps/merchant/src/app/[locale]/(merchant)/business/onboarding/onboarding.css",
]);
const NAMED_COLORS =
  "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen";
const CSS_COLOR = new RegExp(
  `#[0-9a-fA-F]{3,8}\\b|\\b(rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\\(|(?<![\\w-])(${NAMED_COLORS.split(" ").join("|")})(?![\\w-])`,
  "gi",
);
const KIT_SELECTOR = /\.cp-|\[data-variant|\[data-rac|\.react-aria-/;

function insidePrint(node: Node): boolean {
  for (let p: Container | undefined = node.parent; p; p = p.parent) {
    if (
      p.type === "atrule" &&
      (p as AtRule).name === "media" &&
      /\bprint\b/.test((p as AtRule).params)
    )
      return true;
  }
  return false;
}

/** Conteos de un `.css`. */
export function countCss(path: string, text: string): Counts {
  const counts: Counts = {};
  if (!CSS_ALLOWED.has(path)) add(counts, "css-file", 1);
  const root = postcss.parse(text, { from: path });
  root.walkRules((rule) => {
    const line = rule.source?.start?.line ?? 0;
    for (const selector of rule.selectors) {
      add(counts, "css-selector", line);
      if (KIT_SELECTOR.test(selector)) add(counts, "css-kit-selector", line);
    }
  });
  root.walkAtRules((atRule) => {
    if (/^(apply|layer|theme)$/.test(atRule.name)) {
      add(counts, "css-at-rule", atRule.source?.start?.line ?? 0);
    }
  });
  root.walkDecls((decl) => {
    if (insidePrint(decl)) return;
    const line = decl.source?.start?.line ?? 0;
    const matches = decl.value.match(CSS_COLOR) ?? [];
    for (let i = 0; i < matches.length; i++) add(counts, "css-color", line);
  });
  return counts;
}
