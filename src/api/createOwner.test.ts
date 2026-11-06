import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { PaperlessAPI } from "./PaperlessAPI";

type Sent = { path: string; method?: string; body: Record<string, unknown> };

function recordingApi() {
  const sent: Sent[] = [];
  const api = new PaperlessAPI("http://paperless.test", "token");
  (api as unknown as { request: (path: string, init?: RequestInit) => Promise<unknown> }).request = async (
    path: string,
    init?: RequestInit
  ) => {
    sent.push({ path, method: init?.method, body: JSON.parse(String(init?.body ?? "{}")) });
    return { id: 1 };
  };
  return { api, sent };
}

describe("household fork: metadata is created with no owner", () => {
  test("create_tag, create_correspondent and create_document_type send owner null", async () => {
    const { api, sent } = recordingApi();
    await api.createTag({ name: "Receipts" });
    await api.createCorrespondent({ name: "Michaels" });
    await api.createDocumentType({ name: "Lunch Note" });
    assert.deepEqual(
      sent.map((s) => [s.path, s.method, s.body]),
      [
        ["/tags/", "POST", { owner: null, name: "Receipts" }],
        ["/correspondents/", "POST", { owner: null, name: "Michaels" }],
        ["/document_types/", "POST", { owner: null, name: "Lunch Note" }],
      ]
    );
  });

  test("an owner the caller names is kept", async () => {
    const { api, sent } = recordingApi();
    await api.createTag({ name: "Private", owner: 7 });
    assert.equal(sent[0].body.owner, 7);
  });
});
