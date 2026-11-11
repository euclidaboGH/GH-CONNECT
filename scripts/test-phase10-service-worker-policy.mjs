import fs from "node:fs"
import vm from "node:vm"
import assert from "node:assert/strict"

const source = fs.readFileSync(new URL("../public/sw.js", import.meta.url), "utf8")
const listeners = new Map()
const shownNotifications = []
const openedWindows = []
const self = {
  location: { origin: "https://greenhaven.example", protocol: "https:" },
  addEventListener: (name, handler) => listeners.set(name, handler),
  skipWaiting: () => Promise.resolve(),
  clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]), openWindow: (url) => { openedWindows.push(url); return Promise.resolve() } },
  registration: { showNotification: (title, options) => { shownNotifications.push({ title, options }); return Promise.resolve() } },
}
const context = { self, clients: self.clients, caches: {}, fetch: async () => new Response("ok"), URL, Response, Promise, Map, Set, JSON }
vm.runInNewContext(`${source}\nglobalThis.__policy = { isApiRequest, isPublicStaticRequest, isSafePublicStaticResponse }`, context)
const policy = context.__policy
const request = (url, options = {}) => ({
  url,
  method: options.method || "GET",
  mode: options.mode || "cors",
  destination: options.destination || "script",
  cache: options.cache || "default",
  headers: new Headers(options.headers || {}),
})

assert.equal(policy.isApiRequest("/api/social/feed"), true)
assert.equal(policy.isApiRequest("/api/media/x/content"), true)
assert.equal(policy.isApiRequest("/settings"), false)
assert.equal(policy.isPublicStaticRequest(request("https://greenhaven.example/_next/static/chunks/app.js"), new URL("https://greenhaven.example/_next/static/chunks/app.js")), true)
assert.equal(policy.isPublicStaticRequest(request("https://greenhaven.example/settings"), new URL("https://greenhaven.example/settings")), false)
assert.equal(policy.isPublicStaticRequest(request("https://greenhaven.example/api/media/x/content"), new URL("https://greenhaven.example/api/media/x/content")), false)
assert.equal(policy.isPublicStaticRequest(request("https://cdn.example/app.js"), new URL("https://cdn.example/app.js")), false)
assert.equal(policy.isPublicStaticRequest(request("https://greenhaven.example/_next/static/a.js", { method: "POST" }), new URL("https://greenhaven.example/_next/static/a.js")), false)
assert.equal(policy.isPublicStaticRequest(request("https://greenhaven.example/_next/static/a.js", { headers: { Authorization: "Bearer secret" } }), new URL("https://greenhaven.example/_next/static/a.js")), false)
assert.equal(policy.isSafePublicStaticResponse(({ status: 200, type: "basic", headers: new Headers({ "Cache-Control": "public, max-age=31536000" }) })), true)
assert.equal(policy.isSafePublicStaticResponse(({ status: 200, type: "basic", headers: new Headers({ "Cache-Control": "private, no-store" }) })), false)
assert.equal(policy.isSafePublicStaticResponse(({ status: 200, type: "basic", headers: new Headers({ Vary: "*" }) })), false)
// Receiver behaviour: generic privacy-safe display and same-origin click navigation.
let waited
listeners.get("push")({ data: { json: () => ({ title: "T".repeat(200), body: "B".repeat(700), url: "/wallet" }) }, waitUntil: (promise) => { waited = promise } })
await waited
assert.equal(shownNotifications.length, 1)
assert.equal(shownNotifications[0].title, "GreenHaven")
assert.equal(shownNotifications[0].options.body, "You have a new notification")
assert.equal(shownNotifications[0].options.data.url, "/")
assert.equal(shownNotifications[0].options.tag, "greenhaven-notification")
let clickWaited
listeners.get("notificationclick")({ notification: { data: { url: "https://attacker.example/steal" }, close: () => {} }, waitUntil: (promise) => { clickWaited = promise } })
await clickWaited
assert.deepEqual(openedWindows, ["/"])
listeners.get("notificationclick")({ notification: { data: { deepLink: "/wallet?tab=history" }, close: () => {} }, waitUntil: (promise) => { clickWaited = promise } })
await clickWaited
assert.deepEqual(openedWindows, ["/", "/wallet?tab=history"])
console.log("Phase 10 service-worker policy tests: 16/16")
