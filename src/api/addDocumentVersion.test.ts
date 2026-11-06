import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import axios from "axios";
import FormData from "form-data";
import { PaperlessAPI } from "./PaperlessAPI";

type Posted = { url: string; body: string; headers: Record<string, string> };

const realPost = axios.post;

function recordPost(reply: () => Promise<unknown>) {
  const posted: Posted[] = [];
  (axios as unknown as { post: unknown }).post = async (url: string, data: FormData, config: { headers: Record<string, string> }) => {
    posted.push({ url, body: data.getBuffer().toString("latin1"), headers: config.headers });
    return reply();
  };
  return posted;
}

describe("household fork: add_document_version posts to update_version", () => {
  afterEach(() => {
    (axios as unknown as { post: unknown }).post = realPost;
  });

  test("sends the file and label as multipart to the document's update_version and returns the task id", async () => {
    const posted = recordPost(async () => ({ status: 200, data: "task-123" }));
    const api = new PaperlessAPI("http://paperless.test", "token");
    const task = await api.addDocumentVersion(4026, Buffer.from("%PDF-1.4 revised"), "appeal-v2.pdf", "revised");

    assert.equal(task, "task-123");
    assert.equal(posted.length, 1);
    assert.equal(posted[0].url, "http://paperless.test/api/documents/4026/update_version/");
    assert.equal(posted[0].headers.Authorization, "Token token");
    assert.match(posted[0].body, /name="document"; filename="appeal-v2.pdf"/);
    assert.match(posted[0].body, /%PDF-1\.4 revised/);
    assert.match(posted[0].body, /name="version_label"\r\n\r\nrevised/);
  });

  test("leaves version_label out when none is given", async () => {
    const posted = recordPost(async () => ({ status: 200, data: "task-9" }));
    const api = new PaperlessAPI("http://paperless.test", "token");
    await api.addDocumentVersion(7, Buffer.from("x"), "a.pdf");
    assert.doesNotMatch(posted[0].body, /version_label/);
  });

  test("a refusal from Paperless names the status and the document", async () => {
    recordPost(async () => {
      const error = Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: { status: 403, data: "Insufficient permissions" },
      });
      throw error;
    });
    const api = new PaperlessAPI("http://paperless.test", "token");
    await assert.rejects(api.addDocumentVersion(55, Buffer.from("x"), "a.pdf"), /HTTP 403 adding a version to document 55: Insufficient permissions/);
  });
});
