import assert from "node:assert/strict";
import test from "node:test";
import {
  classBody,
  classPatch,
  classPresentation,
} from "./provision-class.mjs";

test("new class carries Trama viva visuals and the member layout", () => {
  const body = classBody(
    "issuer",
    "https://example.com/logo.png",
    "https://example.com/hero.png",
    "qa_trama",
  );
  assert.equal(body.id, "issuer.qa_trama");
  assert.equal(body.issuerName, "CheckPass Club");
  assert.equal(body.programName, "CheckPass Club");
  assert.equal(body.programLogo.sourceUri.uri, "https://example.com/logo.png");
  assert.equal(body.heroImage.sourceUri.uri, "https://example.com/hero.png");
  assert.equal(body.hexBackgroundColor, "#0f2a3a");
  assert.equal(body.accountNameLabel, "Miembro");
  assert.equal(
    body.classTemplateInfo.cardTemplateOverride.cardRowTemplateInfos[0].oneItem
      .item.firstValue.fields[0].fieldPath,
    "object.accountName",
  );
  assert.equal(
    body.classTemplateInfo.listTemplateOverride.firstRowOption.fieldOption
      .fields[0].fieldPath,
    "class.programName",
  );
  assert.equal(
    body.classTemplateInfo.listTemplateOverride.secondRowOption.fields[0]
      .fieldPath,
    "object.accountName",
  );
  assert.equal(
    body.classTemplateInfo.listTemplateOverride.thirdRowOption,
    undefined,
  );
});

test("patch preserves callback, messages, locations and unknown template fields", () => {
  const desired = classBody("issuer");
  const current = {
    id: desired.id,
    issuerName: "Mi CheckPass",
    programName: "Mi CheckPass",
    programLogo: {
      sourceUri: { uri: "https://example.com/old.png", description: "old" },
      contentDescription: { defaultValue: { value: "logo" } },
    },
    callbackOptions: { updateRequestUrl: "https://example.com/callback" },
    merchantLocations: [{ latitude: -2.9, longitude: -79.0 }],
    messages: [{ header: "Existing message" }],
    classTemplateInfo: {
      cardBarcodeSectionDetails: {
        firstTopDetail: {
          fieldSelector: { fields: [{ fieldPath: "class.programName" }] },
        },
      },
      cardTemplateOverride: { extra: "retain" },
      listTemplateOverride: { extra: "retain" },
    },
  };
  const patch = classPatch(current, desired);
  assert.equal(patch.reviewStatus, "UNDER_REVIEW");
  assert.equal(patch.issuerName, "CheckPass Club");
  assert.equal(patch.programName, "CheckPass Club");
  assert.equal(patch.programLogo.contentDescription.defaultValue.value, "logo");
  assert.equal(patch.programLogo.sourceUri.description, "old");
  assert.equal(
    patch.classTemplateInfo.cardBarcodeSectionDetails.firstTopDetail
      .fieldSelector.fields[0].fieldPath,
    "class.programName",
  );
  assert.equal(patch.classTemplateInfo.cardTemplateOverride.extra, "retain");
  assert.equal(patch.classTemplateInfo.listTemplateOverride.extra, "retain");
  assert.equal(patch.callbackOptions, undefined);
  assert.equal(patch.merchantLocations, undefined);
  assert.equal(patch.messages, undefined);
  assert.equal(patch.id, undefined);
  assert.equal(
    classPatch({ ...current, ...patch, reviewStatus: "APPROVED" }, desired),
    null,
  );
});

test("an unchanged approved class needs no write or review transition", () => {
  const desired = classBody("issuer");
  assert.equal(
    classPatch(
      {
        ...desired,
        reviewStatus: "APPROVED",
        callbackOptions: { updateRequestUrl: "https://example.com" },
      },
      desired,
    ),
    null,
  );
});

test("inspect contains presentation fields only", () => {
  const current = {
    ...classBody("issuer"),
    callbackOptions: { updateRequestUrl: "https://example.com" },
    secret: "private",
  };
  const snapshot = classPresentation(current);
  assert.equal(snapshot.secret, undefined);
  assert.equal(snapshot.callbackOptions, undefined);
  assert.equal(
    snapshot.heroImage.sourceUri.uri,
    current.heroImage.sourceUri.uri,
  );
});
