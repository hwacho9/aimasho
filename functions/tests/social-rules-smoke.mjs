// Run against the isolated demo emulator only. Never points at a cloud project.
import assert from "node:assert/strict";
const project = "demo-social-planning";
const endpoint = `http://127.0.0.1:8187/v1/projects/${project}/databases/(default)/documents`;
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
function token(uid) {
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ sub: uid, user_id: uid, aud: project, iss: `https://securetoken.google.com/${project}`, iat: now, exp: now + 3600, firebase: { sign_in_provider: "password" } })}.`;
}
async function seed(path, values) {
  const response = await fetch(`${endpoint}/${path}`, { method: "PATCH", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" }, body: JSON.stringify({ fields: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { stringValue: value }])) }) });
  assert.equal(response.status, 200, await response.text());
}
async function check(path, uid, status, method = "GET") {
  const response = await fetch(`${endpoint}/${path}`, { method, headers: { Authorization: `Bearer ${token(uid)}`, "Content-Type": "application/json" }, ...(method === "PATCH" ? { body: JSON.stringify({ fields: { body: { stringValue: "attempt" } } }) } : {}) });
  assert.equal(response.status, status, `${uid} ${method} ${path}: ${await response.text()}`);
}
await seed("meetups/test", { status: "COMPLETED" });
await seed("meetups/test/participants/me", { uid: "me" });
await seed("meetups/test/participants/friend", { uid: "friend" });
await seed("meetups/test/privateOrigins/me", { secret: "private-place" });
await seed("meetups/test/memories/me", { body: "A shared memory" });
await check("meetups/test/privateOrigins/me", "me", 200);
await check("meetups/test/privateOrigins/me", "friend", 403);
await check("meetups/test/memories/me", "friend", 200);
await check("meetups/test/memories/me", "outsider", 403);
await check("meetups/test/memories/me", "me", 403, "PATCH");
await check("meetups/test/memories/me", "friend", 403, "PATCH");
console.log("6 Firestore privacy checks passed (demo emulator only).");
