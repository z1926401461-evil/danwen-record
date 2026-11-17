var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/worker.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};
var DEFAULT_PASSWORD_KEY = "egg-temp-app-2026";
var PBKDF2_ITERATIONS = 6e3;
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS
    }
  });
}
__name(json, "json");
function toHex(bytes) {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}
__name(toHex, "toHex");
function randomHex(length) {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return toHex(arr);
}
__name(randomHex, "randomHex");
function b64(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
__name(b64, "b64");
function unb64(text) {
  const bin = atob(text);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
__name(unb64, "unb64");
async function passwordKey(env) {
  const raw = env && env.PASSWORD_KEY || DEFAULT_PASSWORD_KEY;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return await crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
__name(passwordKey, "passwordKey");
async function encryptPassword(password, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await passwordKey(env);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(password)
  );
  return "enc:" + b64(iv) + "." + b64(new Uint8Array(cipher));
}
__name(encryptPassword, "encryptPassword");
async function decryptPassword(stored, env) {
  if (typeof stored !== "string" || stored.indexOf("enc:") !== 0) return null;
  try {
    const parts = stored.slice(4).split(".");
    if (parts.length !== 2) return null;
    const key = await passwordKey(env);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(parts[0]) },
      key,
      unb64(parts[1])
    );
    return new TextDecoder().decode(plain);
  } catch (e) {
    return null;
  }
}
__name(decryptPassword, "decryptPassword");
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return toHex(new Uint8Array(bits));
}
__name(hashPassword, "hashPassword");
function str(v, max = 200) {
  return String(v == null ? "" : v).slice(0, max);
}
__name(str, "str");
function validPassword(p) {
  return typeof p === "string" && p.length >= 6 && p.length <= 128;
}
__name(validPassword, "validPassword");
async function authUser(request, env) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("Authorization") || "");
  if (!match) return null;
  return await env.DB.prepare("SELECT id, username FROM users WHERE token = ?").bind(match[1].trim()).first();
}
__name(authUser, "authUser");
async function readState(userId, env) {
  const { results } = await env.DB.prepare(
    "SELECT obj_id, name, grp, model, create_time, records, updated_at FROM incubators WHERE user_id = ? AND deleted = 0"
  ).bind(userId).all();
  const objects = {};
  for (const row of results || []) {
    let records = {};
    try {
      const parsed = JSON.parse(row.records || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) records = parsed;
    } catch (e) {
    }
    objects[row.obj_id] = {
      id: row.obj_id,
      name: row.name,
      group: row.grp || "",
      model: row.model,
      createTime: row.create_time,
      records,
      updatedAt: row.updated_at
    };
  }
  return objects;
}
__name(readState, "readState");
async function register(body, env) {
  const username = str(body.username, 60).trim().toLowerCase();
  const password = String(body.password == null ? "" : body.password);
  if (!/^[\w\u4e00-\u9fa5.-]{2,30}$/u.test(username)) {
    return json({ error: "\u8D26\u53F7\u683C\u5F0F\u4E0D\u7B26\u5408\u8981\u6C42\uFF1A\u957F\u5EA6 2\u201330 \u4E2A\u5B57\u7B26\uFF0C\u4EC5\u652F\u6301\u5B57\u6BCD\u3001\u6570\u5B57\u3001\u4E2D\u6587\u53CA _ . -" }, 400);
  }
  if (!validPassword(password)) return json({ error: "\u5BC6\u7801\u957F\u5EA6\u4E0D\u5F97\u5C11\u4E8E 6 \u4F4D" }, 400);
  const exists = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
  if (exists) return json({ error: "\u8BE5\u8D26\u53F7\u5DF2\u88AB\u6CE8\u518C" }, 409);
  const encoded = await encryptPassword(password, env);
  const token = randomHex(32);
  await env.DB.prepare(
    "INSERT INTO users (username, password_hash, salt, token, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(username, encoded, "", token, Date.now()).run();
  return json({ token, username });
}
__name(register, "register");
async function login(body, env) {
  const username = str(body.username, 60).trim().toLowerCase();
  const password = String(body.password == null ? "" : body.password);
  const user = await env.DB.prepare(
    "SELECT id, username, password_hash, salt, token FROM users WHERE username = ?"
  ).bind(username).first();
  if (!user) return json({ error: "\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF" }, 401);
  const stored = user.password_hash || "";
  const isEncrypted = stored.indexOf("enc:") === 0;
  const matched = isEncrypted ? await decryptPassword(stored, env) === password : await hashPassword(password, user.salt || "") === stored;
  if (!matched) return json({ error: "\u8D26\u53F7\u6216\u5BC6\u7801\u9519\u8BEF" }, 401);
  if (!isEncrypted) {
    await env.DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").bind(await encryptPassword(password, env), "", user.id).run();
  }
  let token = user.token;
  if (!token) {
    token = randomHex(32);
    await env.DB.prepare("UPDATE users SET token = ? WHERE id = ?").bind(token, user.id).run();
  }
  return json({ token, username: user.username });
}
__name(login, "login");
async function account(user, env) {
  const row = await env.DB.prepare(
    "SELECT username, password_hash FROM users WHERE id = ?"
  ).bind(user.id).first();
  const password = await decryptPassword(row && row.password_hash, env);
  return json({
    username: row && row.username || user.username,
    password: password == null ? "" : password
  });
}
__name(account, "account");
async function changePassword(body, user, env) {
  const password = String(body.newPassword == null ? "" : body.newPassword);
  if (!validPassword(password)) return json({ error: "\u5BC6\u7801\u957F\u5EA6\u4E0D\u5F97\u5C11\u4E8E 6 \u4F4D" }, 400);
  await env.DB.prepare("UPDATE users SET password_hash = ?, salt = ? WHERE id = ?").bind(await encryptPassword(password, env), "", user.id).run();
  return json({ ok: true });
}
__name(changePassword, "changePassword");
async function sync(body, user, env) {
  const upserts = Array.isArray(body.upserts) ? body.upserts.slice(0, 300) : [];
  const deletes = Array.isArray(body.deletes) ? body.deletes.slice(0, 300) : [];
  const statements = [];
  for (const item of upserts) {
    if (!item || typeof item !== "object") continue;
    const objId = str(item.id, 120).trim();
    if (!objId) continue;
    const records = JSON.stringify(
      item.records && typeof item.records === "object" && !Array.isArray(item.records) ? item.records : {}
    );
    if (records.length > 9e5) continue;
    const updatedAt = Number(item.updatedAt) || Date.now();
    statements.push(env.DB.prepare(`
      INSERT INTO incubators (user_id, obj_id, name, grp, model, create_time, records, updated_at, deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(user_id, obj_id) DO UPDATE SET
        name = excluded.name,
        grp = excluded.grp,
        model = excluded.model,
        create_time = excluded.create_time,
        records = excluded.records,
        updated_at = excluded.updated_at,
        deleted = 0
      WHERE incubators.updated_at < excluded.updated_at
    `).bind(
      user.id,
      objId,
      str(item.name, 200),
      str(item.group, 200),
      str(item.model, 40) || "m120960",
      Number(item.createTime) || Date.now(),
      records,
      updatedAt
    ));
  }
  for (const item of deletes) {
    const objId = str(typeof item === "string" ? item : item && item.id, 120).trim();
    if (!objId) continue;
    const updatedAt = Number(item && item.updatedAt) || Date.now();
    statements.push(env.DB.prepare(
      "UPDATE incubators SET deleted = 1, updated_at = ? WHERE user_id = ? AND obj_id = ? AND updated_at < ?"
    ).bind(updatedAt, user.id, objId, updatedAt));
  }
  if (statements.length) await env.DB.batch(statements);
  return json({ objects: await readState(user.id, env), serverTime: Date.now() });
}
__name(sync, "sync");
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (!path.startsWith("/api/")) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("Not found", { status: 404, headers: CORS_HEADERS });
    }
    if (path === "/api/ping" && method === "GET") {
      return json({ ok: true, service: "temperature-app", runtime: "Cloudflare Workers" });
    }
    let body = {};
    if (method === "POST") {
      try {
        body = await request.json();
      } catch (e) {
        return json({ error: "\u8BF7\u6C42\u683C\u5F0F\u9519\u8BEF" }, 400);
      }
    }
    if (path === "/api/register" && method === "POST") return register(body, env);
    if (path === "/api/login" && method === "POST") return login(body, env);
    const user = await authUser(request, env);
    if (!user) return json({ error: "\u672A\u767B\u5F55\u6216\u767B\u5F55\u72B6\u6001\u5DF2\u5931\u6548" }, 401);
    if (path === "/api/state" && method === "GET") {
      return json({ objects: await readState(user.id, env), serverTime: Date.now() });
    }
    if (path === "/api/sync" && method === "POST") return sync(body, user, env);
    if (path === "/api/account" && method === "GET") return account(user, env);
    if (path === "/api/password" && method === "POST") return changePassword(body, user, env);
    if (path === "/api/logout" && method === "POST") return json({ ok: true });
    return json({ error: "\u63A5\u53E3\u4E0D\u5B58\u5728" }, 404);
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
