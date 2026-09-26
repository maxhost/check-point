import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Component browser fixture: real UI/Driver/CSS, mocked Next navigation, no server guard. */
export async function startCatalogHarness() {
  const vitestRequire = createRequire(
    path.resolve("node_modules/vitest/package.json"),
  );
  const viteRequire = createRequire(vitestRequire.resolve("vite/package.json"));
  const { build } = viteRequire("esbuild");
  const merchantRequire = createRequire(
    path.resolve("apps/merchant/package.json"),
  );
  const postcss = merchantRequire("postcss");
  const tailwind = merchantRequire("@tailwindcss/postcss");
  const compiled = await build({
    entryPoints: ["tests/e2e/support/catalog-harness.tsx"],
    bundle: true,
    write: false,
    platform: "browser",
    jsx: "automatic",
    nodePaths: [path.resolve("apps/merchant/node_modules")],
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "next-navigation-fixture",
        setup(builder: {
          onResolve: (
            options: { filter: RegExp },
            callback: () => { path: string; namespace: string },
          ) => void;
          onLoad: (
            options: { filter: RegExp; namespace: string },
            callback: () => {
              contents: string;
              loader: string;
              resolveDir: string;
            },
          ) => void;
        }) {
          builder.onResolve({ filter: /^next\/(link|navigation)$/ }, () => ({
            path: "navigation",
            namespace: "fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            contents: `import React from 'react'; export default function Link({href,children,...props}) { return React.createElement('a',{href,...props},children); } export function useRouter(){return {push(href){window.location.href=href}}}`,
            loader: "js",
            resolveDir: path.resolve("apps/merchant"),
          }));
        },
      },
    ],
  });
  const from = path.resolve("apps/merchant/src/app/globals.css");
  const css = await postcss([
    tailwind({ base: path.resolve("apps/merchant") }),
  ]).process(await readFile(from, "utf8"), { from });
  const driverCss = await readFile(
    merchantRequire.resolve("driver.js/dist/driver.css"),
    "utf8",
  );
  const server = createServer((request, response) => {
    if (request.url === "/bundle.js") {
      response.setHeader("content-type", "application/javascript");
      response.end(compiled.outputFiles[0].text);
    } else if (request.url === "/style.css") {
      response.setHeader("content-type", "text/css");
      response.end(driverCss + css.css);
    } else {
      response.setHeader("content-type", "text/html");
      response.end(
        '<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script></html>',
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("fixture address missing");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
