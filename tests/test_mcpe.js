// Copyright (c) 2026 Vladimir Kapustin
// SPDX-License-Identifier: MIT
// test_mcpe.js — comprehensive test suite with mocks for all MCPE engines
const assert = require('assert');

// ---- Mock ServiceNow globals ----
function MockGR(table, rows) {
  this._table = table;
  this._rows = rows || [];
  this._idx = -1;
  this._limit = null;
  this._filters = [];
  this._filtered = this._rows;
  this._cur = {};
  this._inserted = [];
  this._queryOrderByDesc = false;
  this._queryOrderByField = null;
}

MockGR.prototype.addQuery = function(field, op, value) {
  this._filters.push({ field: field, op: op, value: value });
};

MockGR.prototype.setLimit = function(n) { this._limit = n; };
MockGR.prototype.orderByDesc = function(f) { this._queryOrderByDesc = true; this._queryOrderByField = f; };
MockGR.prototype.query = function() {
  this._idx = -1;
  this._filtered = this._rows.slice();
  if (this._limit) this._filtered = this._filtered.slice(0, this._limit);
};
MockGR.prototype.next = function() {
  this._idx++;
  if (this._limit && this._idx >= this._limit) return false;
  return this._idx < this._filtered.length;
};
MockGR.prototype.getValue = function(f) {
  if (this._idx >= 0 && this._idx < this._filtered.length) {
    var v = this._filtered[this._idx][f];
    if (v === true) return "1";
    if (v === false) return "0";
    return String(v || "");
  }
  return "";
};
MockGR.prototype.getUniqueValue = function() {
  if (this._idx >= 0 && this._idx < this._filtered.length) return this._filtered[this._idx].sys_id || "m";
  return "m";
};
MockGR.prototype.initialize = function() { this._cur = { _table: this._table }; };
MockGR.prototype.setValue = function(f, v) { this._cur[f] = v; };
MockGR.prototype.insert = function() {
  var id = "ins-" + Math.random().toString(36).slice(2);
  this._cur.sys_id = id;
  this._rows.push(this._cur);
  this._inserted.push(id);
  return id;
};

var DB = {
  "x_mcpe_access_grant": [
    { principal: "user1", mcp_server: "srv1", active: "1", granted_date: "20260515", expiry_date: "20260520", sys_id: "g1" },
    { principal: "user2", mcp_server: "srv2", active: "0", granted_date: "20260510", expiry_date: "20260512", sys_id: "g2" }
  ],
  "x_mcpe_audit_log": [
    { grant: "g1", action: "provision", principal: "u***r1", details: "auto", timestamp: "20260515000000", sys_id: "a1" }
  ],
  "x_mcpe_alert": []
};

function makeGdt() {
  return {
    getDisplayValueInternal: function() { return "20260516000000"; },
    addDaysLocalTime: function(days) {
      // no-op for mock; tests inspect behaviour through side effects
    }
  };
}

var currentGdt = makeGdt();

// Override GlideRecord per table
var GlideRecord = function(table) {
  if (!DB[table]) DB[table] = [];
  return new MockGR(table, DB[table]);
};

var GlideDateTime = function() {
  return currentGdt;
};

// Minimal Class.create
var Class = {
  create: function(proto) {
    var cls = function() {
      if (this.initialize) this.initialize.apply(this, arguments);
    };
    // Attach prototype after eval, but here we just prepare a skeleton.
    // The eval will overwrite cls prototype anyway.
    return cls;
  }
};

// ---- Load engines ----
const fs = require('fs');
function stripHeader(code) { return code.replace(/^\/\*.*?\*\//s, ''); }

var codeProv = stripHeader(fs.readFileSync('/home/crixus/agentic-loop/output/MCPE/src/MCPEProvisioner.js', 'utf8'));
var codeAudit = stripHeader(fs.readFileSync('/home/crixus/agentic-loop/output/MCPE/src/MCPEAuditEngine.js', 'utf8'));
var codeAlert = stripHeader(fs.readFileSync('/home/crixus/agentic-loop/output/MCPE/src/MCPEAlertEngine.js', 'utf8'));

// In the eval we need Class and GlideRecord/GlideDateTime to exist in scope.
// They do, since we're in the same file.
eval(codeProv);
eval(codeAudit);
eval(codeAlert);

// ---- Tests ----
function testProvision() {
  var p = new MCPEProvisioner();
  var r = p.provisionAccess("user3", "srv3", "user");
  assert.strictEqual(r.granted, true);
  assert.ok(r.recordSysId);
  console.log("  testProvision PASSED");
}

function testAuditSummary() {
  var p = new MCPEProvisioner();
  var r = p.auditActiveGrants();
  assert.ok(r.total >= 3, "Total should be >=3 after provision");
  assert.strictEqual(r.active, 2, "Expected 2 active after provision");
  assert.strictEqual(r.expired, 1);
  console.log("  testAuditSummary PASSED (total=" + r.total + ", active=" + r.active + ")");
}

function testAuditEngineMaskPII() {
  var a = new MCPEAuditEngine();
  assert.strictEqual(a.maskPII("vladimir.kapustin@example.com"), "v****n@example.com");
  assert.strictEqual(a.maskPII("longidentifier123"), "lo****23");
  assert.strictEqual(a.maskPII("short"), "short");
  assert.strictEqual(a.maskPII(null), "");
  console.log("  testAuditEngineMaskPII PASSED");
}

function testAuditEngineLogAction() {
  var a = new MCPEAuditEngine();
  var id = a.logAction("g1", "revoke", "vladimir.kapustin@example.com", "user offboarded");
  assert.ok(id);
  var latest = DB["x_mcpe_audit_log"][DB["x_mcpe_audit_log"].length - 1];
  assert.strictEqual(latest.grant, "g1");
  assert.strictEqual(latest.action, "revoke");
  assert.ok(latest.principal.indexOf("*") > -1);
  assert.strictEqual(latest.details, "user offboarded");
  console.log("  testAuditEngineLogAction PASSED");
}

function testAuditEngineGetTrail() {
  var a = new MCPEAuditEngine();
  var trail = a.getAuditTrail(10);
  assert.ok(trail.length >= 1);
  assert.ok(trail.every(function(e) { return e.principal.indexOf("*") > -1 || e.principal === ""; }));
  console.log("  testAuditEngineGetTrail PASSED (rows=" + trail.length + ")");
}

function testAlertEngineUnauthorized() {
  var ae = new MCPEAlertEngine();
  var id = ae.alertUnauthorized("intruder", "srv-critical", "no grant found");
  assert.ok(id);
  var last = DB["x_mcpe_alert"][DB["x_mcpe_alert"].length - 1];
  assert.strictEqual(last.severity, "unauthorized");
  assert.ok(last.message.indexOf("intruder") > -1);
  console.log("  testAlertEngineUnauthorized PASSED");
}

function testAlertEngineCheckExpiring() {
  var ae = new MCPEAlertEngine();
  var alerts = ae.checkExpiringTokens(7);
  // g1 has expiry 20260520, mock "now" is 20260516: 4 days left → within threshold
  assert.ok(alerts.length >= 1, "Expected at least one expiry alert since g1 expires in 4 days");
  console.log("  testAlertEngineCheckExpiring PASSED (alerts=" + alerts.length + ")");
}

console.log("Running MCPE tests...\n");
testProvision();
testAuditSummary();
testAuditEngineMaskPII();
testAuditEngineLogAction();
testAuditEngineGetTrail();
testAlertEngineUnauthorized();
testAlertEngineCheckExpiring();
console.log("\nAll MCPE tests PASSED");
