import { createHash } from "node:crypto";
import forge from "node-forge";
import { zipSync } from "fflate";
import { WALLET_BRAND } from "./core";
import type { ApplePassBuildInput } from "./provider";

/**
 * A signing identity for the `.pkpass` manifest. `signManifest` returns the raw
 * PKCS#7 **detached** signature (DER bytes) over the manifest — real (Pass Type
 * ID cert + WWDR) in prod, self-signed in dev/test (verifies structure only).
 */
export type AppleSigner = {
  signManifest(manifest: Buffer): Buffer;
};

export type ApplePkpassInput = ApplePassBuildInput & {
  passTypeIdentifier: string;
  teamIdentifier: string;
};

// A minimal valid PNG (solid brand square) so the archive carries the required
// `icon.png`/`logo.png`. Structural fidelity only; the rich card art is spec 0031.
const BRAND_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKklEQVR42u3NMQEAAAgDoK1/" +
  "aM3g4QcVqDPSyiVpJDkAAAAAAAAAAADg2QAsMwGf5m1Y7QAAAABJRU5ErkJggg==";
const BRAND_PNG = new Uint8Array(Buffer.from(BRAND_PNG_BASE64, "base64"));

function sha1Hex(bytes: Uint8Array): string {
  return createHash("sha1").update(bytes).digest("hex");
}

/** Builds the `pass.json` object (storeCard style, barcode = qrToken, no PII beyond name). */
export function buildPassJson(
  input: ApplePkpassInput,
): Record<string, unknown> {
  const holder = `${input.firstName} ${input.lastName}`.trim();
  const programsUrl = `${input.origin}/c/${input.webViewToken}`;
  const barcode = {
    format: "PKBarcodeFormatQR",
    message: input.qrToken,
    messageEncoding: "iso-8859-1",
    // altText carries NO PII (ADR 0014) — it would render under the QR.
    altText: "",
  };
  return {
    formatVersion: 1,
    passTypeIdentifier: input.passTypeIdentifier,
    teamIdentifier: input.teamIdentifier,
    serialNumber: input.serialNumber,
    organizationName: WALLET_BRAND.organizationName,
    description: WALLET_BRAND.description,
    logoText: WALLET_BRAND.organizationName,
    backgroundColor: WALLET_BRAND.backgroundColor,
    foregroundColor: WALLET_BRAND.foregroundColor,
    labelColor: WALLET_BRAND.labelColor,
    // Provisioned hooks for the push/update channel (spec 0033) — not served yet.
    webServiceURL: `${input.origin}/api/public/wallet/passkit`,
    authenticationToken: input.authenticationToken,
    barcode,
    barcodes: [barcode],
    storeCard: {
      primaryFields: [
        { key: "holder", label: "Titular", value: holder || "CheckPass Club" },
      ],
      // The single "Última novedad" slot (ADR 0033). `changeMessage` makes iOS raise
      // a notification with the new value when the pulled pass differs from the cached
      // one (spec 0033) — that pull is what the empty APNs push wakes.
      secondaryFields: [
        {
          key: "latest",
          label: "Última novedad",
          value: input.latestMessage || "—",
          changeMessage: "%@",
        },
      ],
      auxiliaryFields: [],
      backFields: [
        {
          key: "programs",
          label: "Ver mis programas",
          value: programsUrl,
          attributedValue: `<a href="${programsUrl}">Ver mis programas</a>`,
        },
      ],
    },
  };
}

/**
 * Assembles and signs the `.pkpass`: pass.json + images, a `manifest.json` of
 * per-file sha1, a detached PKCS#7 `signature` over that manifest, zipped. Returns
 * the archive bytes.
 */
export async function buildApplePkpass(
  input: ApplePkpassInput,
  signer: AppleSigner,
): Promise<Buffer> {
  const passJson = new Uint8Array(
    Buffer.from(JSON.stringify(buildPassJson(input), null, 2)),
  );
  const files: Record<string, Uint8Array> = {
    "pass.json": passJson,
    "icon.png": BRAND_PNG,
    "logo.png": BRAND_PNG,
  };

  const manifest: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) {
    manifest[name] = sha1Hex(bytes);
  }
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const signature = signer.signManifest(manifestBytes);

  const archive = zipSync(
    {
      ...files,
      "manifest.json": new Uint8Array(manifestBytes),
      signature: new Uint8Array(signature),
    },
    { level: 0 },
  );
  return Buffer.from(archive);
}

function signManifest(
  manifest: Buffer,
  key: forge.pki.PrivateKey,
  cert: forge.pki.Certificate,
  extraCerts: forge.pki.Certificate[],
): Buffer {
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest.toString("binary"));
  p7.addCertificate(cert);
  for (const extra of extraCerts) p7.addCertificate(extra);
  p7.addSigner({
    key: key as forge.pki.rsa.PrivateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date().toString() },
    ],
  });
  p7.sign({ detached: true });
  const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
  return Buffer.from(der, "binary");
}

/**
 * Real signing identity from a Pass Type ID `.p12` (base64) + the WWDR cert
 * (base64 DER). Both are added to the PKCS#7 so Apple can build the chain.
 */
export function certSigner(opts: {
  p12Base64: string;
  password: string;
  wwdrBase64: string;
}): AppleSigner {
  const p12Der = forge.util.decode64(opts.p12Base64);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, opts.password);

  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
      forge.pki.oids.pkcs8ShroudedKeyBag
    ] ?? [];
  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ??
    [];
  const key = keyBags[0]?.key;
  const cert = certBags[0]?.cert;
  if (!key || !cert)
    throw new Error("APPLE_PASS_CERT_P12: no key/certificate in the bundle");

  const wwdrCert = forge.pki.certificateFromAsn1(
    forge.asn1.fromDer(forge.util.decode64(opts.wwdrBase64)),
  );
  return {
    signManifest: (manifest) => signManifest(manifest, key, cert, [wwdrCert]),
  };
}

/**
 * Self-signed identity for dev/test: generates an RSA keypair + certificate with
 * node-forge. Produces a structurally valid, signed `.pkpass` that does NOT chain
 * to Apple (won't install on a real iPhone) but verifies the builder end-to-end.
 */
export function selfSignedSigner(): AppleSigner {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [
    { name: "commonName", value: "CheckPass Club Dev Pass" },
    { name: "organizationName", value: WALLET_BRAND.organizationName },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return {
    signManifest: (manifest) =>
      signManifest(manifest, keys.privateKey, cert, []),
  };
}
