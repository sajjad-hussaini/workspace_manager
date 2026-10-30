import test from "node:test";
import assert from "node:assert/strict";
import { normalizeLinkUrl } from "./utils.js";

test("link entry adds HTTPS to bare domains and preserves paths, queries, and fragments", () => {
  assert.equal(normalizeLinkUrl("google.com"), "https://google.com/");
  assert.equal(normalizeLinkUrl("  www.google.com/search?q=tabs#results  "), "https://www.google.com/search?q=tabs#results");
  assert.equal(normalizeLinkUrl("//example.com/docs"), "https://example.com/docs");
});

test("link entry preserves explicit schemes and supports local addresses with ports", () => {
  assert.equal(normalizeLinkUrl("http://example.com/docs"), "http://example.com/docs");
  assert.equal(normalizeLinkUrl("https://example.com:8443/docs"), "https://example.com:8443/docs");
  assert.equal(normalizeLinkUrl("file:///C:/notes.txt"), "file:///C:/notes.txt");
  assert.equal(normalizeLinkUrl("localhost:3000/app"), "https://localhost:3000/app");
  assert.equal(normalizeLinkUrl("127.0.0.1:8080"), "https://127.0.0.1:8080/");
  assert.equal(normalizeLinkUrl("[::1]:3000"), "https://[::1]:3000/");
});

test("link entry rejects empty and malformed addresses", () => {
  for (const value of ["", "   ", "not-a-url", "not a url", "https://", "https://exa mple.com", "/docs", "?q=search", "example.com:99999"]) {
    assert.throws(() => normalizeLinkUrl(value), undefined, value);
  }
});
