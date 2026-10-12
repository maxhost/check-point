import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

/** Real route components and CSS; session/program reads are synthetic, HTTP actions intercepted by tests. */
export async function startWalletEntryHarness() {
  const vitestRequire = createRequire(
    await realpath(path.resolve("node_modules/vitest/package.json")),
  );
  const viteRequire = createRequire(vitestRequire.resolve("vite/package.json"));
  const { build } = viteRequire("esbuild");
  const compiled = await build({
    entryPoints: ["tests/e2e/support/wallet-entry-harness.tsx"],
    bundle: true,
    write: false,
    outdir: "wallet-entry-build",
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    nodePaths: [path.resolve("apps/consumer/node_modules")],
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [
      {
        name: "wallet-entry-fixture",
        setup(builder: {
          onResolve: (
            options: { filter: RegExp },
            callback: (args: { path: string }) => {
              path: string;
              namespace?: string;
              external?: boolean;
            },
          ) => void;
          onLoad: (
            options: { filter: RegExp; namespace: string },
            callback: (args: { path: string }) => {
              contents: string;
              loader: string;
              resolveDir: string;
            },
          ) => void;
        }) {
          builder.onResolve({ filter: /^\/fonts\// }, (args) => ({
            path: args.path,
            external: true,
          }));
          builder.onResolve(
            {
              filter:
                /^(next\/(headers|navigation|image)|@mi-pasaporte\/domain\/server\/)/,
            },
            (args) => ({ path: args.path, namespace: "wallet-fixture" }),
          );
          builder.onLoad(
            { filter: /.*/, namespace: "wallet-fixture" },
            (args) => ({
              loader: "js",
              resolveDir: path.resolve("apps/consumer"),
              contents:
                args.path === "next/headers"
                  ? `export async function cookies(){return {get(){return {value:'fixture'}}}} export async function headers(){return new Headers({'user-agent':navigator.userAgent})}`
                  : args.path === "next/navigation"
                    ? `export function useRouter(){return {refresh(){},push(url){location.assign(url)}}} export function redirect(url){location.assign(url);throw new Error('redirect:'+url)}`
                    : args.path === "next/image"
                      ? `import React from 'react';export default function Image(props){return React.createElement('img',props)}`
                      : `const f=globalThis.__walletEntryFixture;
        export const SESSION_COOKIE='fixture'; export const WALLET_MANIFEST_PATH='/wallet/manifest.webmanifest';
        export function walletManifestPathFor(token){return '/wallet/manifest.webmanifest?c='+encodeURIComponent(token)}
        export async function resolveSession(){return ['signed','member','ready'].includes(f.surface)?{id:'account-demo',firstName:f.name,lastName:'',phoneE164:null,webViewToken:'demo',qrToken:'demo'}:null}
        export async function getEnrollLanding(){return f.surface==='unavailable'?null:{programId:'demo-program',businessId:'business-demo',businessName:f.business,hasLogo:f.logo,logoVersion:4,welcomeOffer:f.welcome?{message:'Bienvenida',label:'Bienvenida',kind:'free_product',rule:null,validDays:7,redeemFrom:'now'}:null}}
        export async function isProgramMember(){return f.surface==='member'}
        export async function renderQrSvg(){return '<svg/>'} export function vapidFromEnv(){return null}
        export async function listConsumerPrograms(){return []} export async function listConsumerCoupons(){return {coupons:[]}} export async function listConsumerNotices(){return []}
        export async function markAccountOpened(){}`,
            }),
          );
        },
      },
    ],
  });
  const script = compiled.outputFiles.find((file: { path: string }) =>
    file.path.endsWith(".js"),
  )!.text;
  const css =
    (await readFile("apps/consumer/src/app/globals.css", "utf8")) +
    "\n" +
    (await readFile("apps/consumer/src/app/wallet.css", "utf8")) +
    "\n" +
    compiled.outputFiles.find((file: { path: string }) =>
      file.path.endsWith(".css"),
    )!.text;
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/bundle.js") {
      response.setHeader("content-type", "text/javascript");
      response.end(script);
    } else if (url.pathname === "/style.css") {
      response.setHeader("content-type", "text/css");
      response.end(css);
    } else if (url.pathname === "/fonts/nunito-sans.ttf") {
      response.setHeader("content-type", "font/ttf");
      response.end(
        await readFile("apps/consumer/public/fonts/nunito-sans.ttf"),
      );
    } else if (url.pathname.startsWith("/api/public/brands/")) {
      response.setHeader("content-type", "image/svg+xml");
      response.end(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><rect width="80" height="40" fill="#17382f"/><text x="40" y="26" fill="white" font-size="20" text-anchor="middle">CB</text></svg>',
      );
    } else {
      const fixture = {
        surface: url.pathname.endsWith("/ready")
          ? "ready"
          : url.pathname === "/wallet"
            ? "access"
            : (url.searchParams.get("surface") ?? "guest"),
        business: url.searchParams.get("business") ?? "Café del Barrio",
        name: url.searchParams.get("name") ?? "Ana",
        logo: url.searchParams.get("logo") === "1",
        welcome: url.searchParams.get("welcome") === "1",
      };
      response.setHeader("content-type", "text/html; charset=utf-8");
      response.end(
        `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script>globalThis.__walletEntryFixture=${JSON.stringify(fixture).replaceAll("<", "\\u003c")}</script><script type="module" src="/bundle.js"></script></body></html>`,
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("missing fixture address");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}
