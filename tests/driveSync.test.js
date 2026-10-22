import test from "node:test";
import assert from "node:assert/strict";
import { connectGoogleDrive, getDriveStatus, mergeDriveSnapshots } from "../src/lib/driveSync.js";

function storageArea(initial = {}) {
  const data = { ...initial };
  return {
    data,
    async get(keys) {
      if (keys === null) return { ...data };
      const list = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(list.filter((key) => Object.hasOwn(data, key)).map((key) => [key, data[key]]));
    },
    async set(values) { Object.assign(data, values); },
    async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key]; }
  };
}

function response(value, status = 200) {
  return { ok: status >= 200 && status < 300, status, async json() { return value; } };
}

test("initial connection merges existing local and Drive data, including preferences and deletions", async () => {
  const local = storageArea({
    session_local: { id: "local", title: "Local workspace", tabs: [{ url: "https://local.example" }], createdAt: "2025-01-01T00:00:00Z" },
    tabWorkspacesTheme: "dark",
    tabmorrowDriveUpdated_tabWorkspacesTheme: 20,
    tabmorrowDriveDeleted_removed: 30
  });
  const sync = storageArea({ session_small: { id: "small", title: "Synced workspace", tabs: [] } });
  const remote = {
    format: "tabmorrow-drive", version: 1,
    workspaces: {
      remote: { id: "remote", title: "Remote workspace", tabs: [], updatedAt: "2025-01-02T00:00:00Z" },
      removed: { id: "removed", title: "Deleted workspace", tabs: [], updatedAt: "1970-01-01T00:00:00.020Z" }
    },
    deleted: {},
    settings: { tabWorkspacesTheme: { value: "light", updatedAt: 10 } }
  };
  const previousChrome = globalThis.chrome;
  const previousFetch = globalThis.fetch;
  let uploaded;
  globalThis.chrome = {
    runtime: { getManifest: () => ({ oauth2: { client_id: "test.apps.googleusercontent.com" } }) },
    identity: { getAuthToken: async () => ({ token: "test-token" }), removeCachedAuthToken: async () => {} },
    storage: { local, sync }
  };
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address.includes("alt=media")) return response(remote);
    if (options.method === "PATCH") { uploaded = JSON.parse(options.body); return response({ id: "drive-file" }); }
    return response({ files: [{ id: "drive-file", name: "tabmorrow-data.json", modifiedTime: "2025-01-01T00:00:00Z" }] });
  };
  try {
    await connectGoogleDrive();
    assert.deepEqual(Object.keys(uploaded.workspaces).sort(), ["local", "remote", "small"]);
    assert.equal(uploaded.settings.tabWorkspacesTheme.value, "dark");
    assert.equal(uploaded.deleted.removed, 30);
    assert.equal(local.data.session_remote.title, "Remote workspace");
    assert.equal(local.data.tabWorkspacesTheme, "dark");
    assert.equal(sync.data.session_small, undefined);
    assert.equal((await getDriveStatus()).connected, true);
  } finally {
    globalThis.chrome = previousChrome;
    globalThis.fetch = previousFetch;
  }
});

test("an invalid Drive file stops migration without replacing local workspaces", async () => {
  const local = storageArea({ session_keep: { id: "keep", title: "Keep me", tabs: [] } });
  const sync = storageArea();
  const previousChrome = globalThis.chrome;
  const previousFetch = globalThis.fetch;
  let uploads = 0;
  globalThis.chrome = {
    runtime: { getManifest: () => ({ oauth2: { client_id: "test.apps.googleusercontent.com" } }) },
    identity: { getAuthToken: async () => ({ token: "test-token" }), removeCachedAuthToken: async () => {} },
    storage: { local, sync }
  };
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === "PATCH" || options.method === "POST") uploads++;
    if (String(url).includes("alt=media")) return response({ unexpected: true });
    return response({ files: [{ id: "drive-file" }] });
  };
  try {
    await assert.rejects(connectGoogleDrive(), /unsupported TabMorrow data file/);
    assert.equal(uploads, 0);
    assert.equal(local.data.session_keep.title, "Keep me");
    assert.equal((await getDriveStatus()).connected, false);
  } finally {
    globalThis.chrome = previousChrome;
    globalThis.fetch = previousFetch;
  }
});

test("first connection creates a private app-data file with existing workspaces", async () => {
  const local = storageArea({ session_one: { id: "one", title: "Research", tabs: [{ url: "https://example.com" }] } });
  const previousChrome = globalThis.chrome;
  const previousFetch = globalThis.fetch;
  let uploadBody = "";
  globalThis.chrome = {
    runtime: { getManifest: () => ({ oauth2: { client_id: "test.apps.googleusercontent.com" } }) },
    identity: { getAuthToken: async () => ({ token: "test-token" }), removeCachedAuthToken: async () => {} },
    storage: { local, sync: storageArea() }
  };
  globalThis.fetch = async (_url, options = {}) => {
    if (options.method === "POST") {
      uploadBody = await options.body.text();
      assert.match(options.headers["Content-Type"], /^multipart\/related; boundary=/);
      return response({ id: "new-drive-file" });
    }
    return response({ files: [] });
  };
  try {
    await connectGoogleDrive();
    assert.match(uploadBody, /"parents":\["appDataFolder"\]/);
    assert.match(uploadBody, /"title":"Research"/);
    assert.equal((await getDriveStatus()).connected, true);
  } finally {
    globalThis.chrome = previousChrome;
    globalThis.fetch = previousFetch;
  }
});

test("large data uses Drive's resumable upload instead of a 5 MB multipart request", async () => {
  const local = storageArea({ session_large: { id: "large", title: "Large workspace", note: "x".repeat(5 * 1024 * 1024), tabs: [] } });
  const previousChrome = globalThis.chrome;
  const previousFetch = globalThis.fetch;
  const methods = [];
  globalThis.chrome = {
    runtime: { getManifest: () => ({ oauth2: { client_id: "test.apps.googleusercontent.com" } }) },
    identity: { getAuthToken: async () => ({ token: "test-token" }), removeCachedAuthToken: async () => {} },
    storage: { local, sync: storageArea() }
  };
  globalThis.fetch = async (url, options = {}) => {
    methods.push(options.method || "GET");
    if (options.method === "POST") {
      assert.match(String(url), /uploadType=resumable/);
      assert.equal(JSON.parse(options.body).parents[0], "appDataFolder");
      return { ...response({}), headers: { get: () => "https://www.googleapis.com/upload/drive/v3/files?upload_id=test" } };
    }
    if (options.method === "PUT") {
      assert.ok(options.body.size > 5 * 1024 * 1024);
      return response({ id: "large-file" });
    }
    return response({ files: [] });
  };
  try {
    await connectGoogleDrive();
    assert.deepEqual(methods, ["GET", "POST", "PUT"]);
  } finally {
    globalThis.chrome = previousChrome;
    globalThis.fetch = previousFetch;
  }
});

test("an edit made during upload is included before Drive sync updates the local cache", async () => {
  const local = storageArea({ session_first: { id: "first", title: "First", tabs: [], updatedAt: "2025-01-01T00:00:00Z" } });
  const previousChrome = globalThis.chrome;
  const previousFetch = globalThis.fetch;
  const uploads = [];
  globalThis.chrome = {
    runtime: { getManifest: () => ({ oauth2: { client_id: "test.apps.googleusercontent.com" } }) },
    identity: { getAuthToken: async () => ({ token: "test-token" }), removeCachedAuthToken: async () => {} },
    storage: { local, sync: storageArea() }
  };
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).includes("alt=media")) return response({ format: "tabmorrow-drive", version: 1, workspaces: {}, deleted: {}, settings: {} });
    if (options.method === "PATCH") {
      uploads.push(JSON.parse(options.body));
      if (uploads.length === 1) local.data.session_second = { id: "second", title: "Added during upload", tabs: [], updatedAt: "2025-01-02T00:00:00Z" };
      return response({ id: "drive-file" });
    }
    return response({ files: [{ id: "drive-file" }] });
  };
  try {
    await connectGoogleDrive();
    assert.equal(uploads.length, 2);
    assert.equal(uploads[1].workspaces.second.title, "Added during upload");
    assert.equal(local.data.session_second.title, "Added during upload");
  } finally {
    globalThis.chrome = previousChrome;
    globalThis.fetch = previousFetch;
  }
});

test("newer workspace edits win while deletion tombstones prevent resurrection", () => {
  const older = { id: "shared", title: "Old", updatedAt: "2025-01-01T00:00:00Z" };
  const newer = { id: "shared", title: "New", updatedAt: "2025-01-02T00:00:00Z" };
  const local = { workspaces: { shared: newer }, deleted: { gone: 200 }, settings: {} };
  const remote = { workspaces: { shared: older, gone: { id: "gone", updatedAt: "1970-01-01T00:00:00.100Z" } }, deleted: {}, settings: {} };
  const merged = mergeDriveSnapshots(local, remote);
  assert.equal(merged.workspaces.shared.title, "New");
  assert.equal(merged.workspaces.gone, undefined);
  assert.equal(merged.deleted.gone, 200);
});
