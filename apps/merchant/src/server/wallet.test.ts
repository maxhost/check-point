import { createHash, createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import forge from "node-forge";
import { unzipSync } from "fflate";
import { buildApplePkpass, selfSignedSigner } from "./wallet/apple";
import {
  GOOGLE_CLASS_SUFFIX,
  buildGoogleSaveJwt,
  loyaltyClassId,
  loyaltyObjectId,
} from "./wallet/google";
import { walletPassResponse } from "./wallet/core";
import { type PassBuildInput, walletProviderFromEnv } from "./wallet/provider";
import { generateOpaqueToken } from "./consumer/core";

const QR = "QR-TOKEN-abc123_-";
const input: PassBuildInput = {
  serialNumber: "serial-abc_123-XYZ",
  qrToken: QR,
  firstName: "Marcos",
  lastName: "Pérez",
  origin: "https://app.mipasaporte.test",
  webViewToken: "WEB-VIEW-TOKEN-xyz_-",
};

describe("apple .pkpass builder", () => {
  it("produces a structurally valid, signed, unzippable pass with barcode = qrToken", async () => {
    const bytes = await buildApplePkpass(
      {
        ...input,
        passTypeIdentifier: "pass.com.mipasaporte.test",
        teamIdentifier: "TEAM123456",
        authenticationToken: "auth-token-raw",
      },
      selfSignedSigner(),
    );
    const files = unzipSync(new Uint8Array(bytes));

    // Archive carries the mandatory members.
    for (const name of [
      "pass.json",
      "manifest.json",
      "signature",
      "icon.png",
    ]) {
      expect(files[name], `missing ${name}`).toBeTruthy();
    }

    // pass.json is well-formed; barcode carries the qrToken, no PII in altText.
    const pass = JSON.parse(Buffer.from(files["pass.json"]).toString());
    expect(pass.formatVersion).toBe(1);
    expect(pass.serialNumber).toBe(input.serialNumber);
    expect(pass.barcode.format).toBe("PKBarcodeFormatQR");
    expect(pass.barcode.message).toBe(QR);
    expect(pass.barcodes[0].message).toBe(QR);
    expect(pass.barcode.altText).toBe("");
    // Provisioned push hooks for spec 0033.
    expect(pass.webServiceURL).toContain(input.origin);
    expect(pass.authenticationToken).toBe("auth-token-raw");
    // The "Ver mis programas" link is on a back field.
    expect(JSON.stringify(pass.storeCard.backFields)).toContain(
      `${input.origin}/c/${input.webViewToken}`,
    );

    // manifest.json holds the correct sha1 of every non-manifest/signature file.
    const manifest = JSON.parse(Buffer.from(files["manifest.json"]).toString());
    for (const [name, digest] of Object.entries(manifest)) {
      expect(files[name], `manifest lists absent ${name}`).toBeTruthy();
      const actual = createHash("sha1").update(files[name]).digest("hex");
      expect(actual).toBe(digest);
    }
    expect(manifest["manifest.json"]).toBeUndefined();
    expect(manifest["signature"]).toBeUndefined();

    // signature is a parseable PKCS#7 detached signature (self-signed here).
    expect(files["signature"].length).toBeGreaterThan(0);
    const p7Asn1 = forge.asn1.fromDer(
      forge.util.createBuffer(
        Buffer.from(files["signature"]).toString("binary"),
      ),
    );
    const p7 = forge.pkcs7.messageFromAsn1(p7Asn1) as unknown as {
      type: string;
      certificates: unknown[];
    };
    expect(p7.type).toBe(forge.pki.oids.signedData);
    expect(p7.certificates.length).toBeGreaterThan(0);
  }, 20_000);
});

describe("google save JWT", () => {
  it("is RS256-signed by the SA and references the right class/object with barcode = qrToken", () => {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const issuerId = "3388000000012345678";
    const jwt = buildGoogleSaveJwt(
      input,
      {
        clientEmail: "sa@mipasaporte.iam.gserviceaccount.com",
        privateKeyPem: privateKey,
        issuerId,
      },
      new Date(1_700_000_000_000),
    );
    const [header, payload, signature] = jwt.split(".");
    expect(header && payload && signature).toBeTruthy();

    // Signature verifies against the SA public key.
    const ok = createVerify("RSA-SHA256")
      .update(`${header}.${payload}`)
      .verify(publicKey, Buffer.from(signature, "base64url"));
    expect(ok).toBe(true);

    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims.typ).toBe("savetowallet");
    expect(claims.aud).toBe("google");
    expect(claims.iss).toBe("sa@mipasaporte.iam.gserviceaccount.com");
    const obj = claims.payload.loyaltyObjects[0];
    expect(obj.id).toBe(loyaltyObjectId(issuerId, input.serialNumber));
    expect(obj.classId).toBe(loyaltyClassId(issuerId));
    expect(loyaltyClassId(issuerId)).toBe(`${issuerId}.${GOOGLE_CLASS_SUFFIX}`);
    expect(obj.barcode.type).toBe("QR_CODE");
    expect(obj.barcode.value).toBe(QR);
    expect(JSON.stringify(obj.linksModuleData)).toContain(
      `${input.origin}/c/${input.webViewToken}`,
    );
  });
});

describe("wallet tokens & DTOs never leak secrets", () => {
  it("web_view_token is random ≥128 bits and distinct from a fresh qr_token", () => {
    const qr = generateOpaqueToken();
    const web = generateOpaqueToken();
    expect(web).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(web, "base64url").length).toBeGreaterThanOrEqual(16);
    expect(web).not.toEqual(qr);
  });

  it("walletPassResponse omits authToken, authTokenHash and consumerId", () => {
    const dto = walletPassResponse({
      id: "pass-1",
      consumerId: "consumer-1",
      provider: "apple",
      serialNumber: "serial-1",
      authToken: "SECRET-STABLE-AUTH-TOKEN",
      authTokenHash: "SECRET-AUTH-TOKEN-HASH",
      createdAt: new Date("2026-08-14T00:00:00Z"),
      updatedAt: new Date("2026-08-14T00:00:00Z"),
    });
    expect(dto).not.toHaveProperty("authToken");
    expect(dto).not.toHaveProperty("authTokenHash");
    expect(dto).not.toHaveProperty("consumerId");
    expect(JSON.stringify(dto)).not.toContain("SECRET-STABLE-AUTH-TOKEN");
    expect(JSON.stringify(dto)).not.toContain("SECRET-AUTH-TOKEN-HASH");
    expect(dto).toMatchObject({
      id: "pass-1",
      provider: "apple",
      serialNumber: "serial-1",
    });
  });
});

describe("wallet provider selection (503 gate)", () => {
  it("without secrets: fake fills in outside production (both configured)", () => {
    const p = walletProviderFromEnv({ NODE_ENV: "test" });
    expect(p.appleConfigured).toBe(true);
    expect(p.googleConfigured).toBe(true);
  });

  it("in production without secrets: unconfigured → routes answer 503", () => {
    const p = walletProviderFromEnv({ NODE_ENV: "production" });
    expect(p.appleConfigured).toBe(false);
    expect(p.googleConfigured).toBe(false);
  });

  it("google secrets present → google configured even in production", () => {
    const p = walletProviderFromEnv({
      NODE_ENV: "production",
      GOOGLE_WALLET_SA_JSON: "{}",
      GOOGLE_WALLET_ISSUER_ID: "123",
    });
    expect(p.googleConfigured).toBe(true);
    expect(p.appleConfigured).toBe(false);
  });
});
