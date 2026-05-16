// Copyright (c) 2026 Vladimir Kapustin
// SPDX-License-Identifier: AGPL-3.0-only
// test_mcpe.js
const assert = require('assert');
function MockGR(table, rows) { this._rows = rows||[]; this._idx = -1; this._filters = {}; this._limit = null; this._filtered = []; this._inserted = []; }
MockGR.prototype.addQuery = function() {};
MockGR.prototype.setLimit = function(n) { this._limit = n; };
MockGR.prototype.query = function() { this._idx = -1; this._filtered = this._rows; };
MockGR.prototype.next = function() { this._idx++; if(this._limit && this._idx >= this._limit) return false; return this._idx < this._filtered.length; };
MockGR.prototype.getValue = function(f) {
  if(this._idx >= 0 && this._idx < this._filtered.length) {
    var v = this._filtered[this._idx][f];
    if (v === true) return "1";
    if (v === false) return "0";
    return String(v || "");
  }
  return "";
};
MockGR.prototype.getUniqueValue = function() { if(this._idx >= 0 && this._idx < this._filtered.length) return this._filtered[this._idx]["sys_id"]||"m"; return "m"; };
MockGR.prototype.initialize = function() { this._cur = {}; };
MockGR.prototype.setValue = function(f, v) { this._cur[f] = v; };
MockGR.prototype.insert = function() { var id = "ins-" + Math.random().toString(36).slice(2); this._rows.push(this._cur); this._cur.sys_id = id; return id; };

const fs = require('fs');
function stripHeader(code){ return code.replace(/^\/\*.*?\*\//s, ''); }
global.Class = { create: function(){ var cls=function(){ if(this.initialize) this.initialize.apply(this, arguments); }; return cls; } };
global.GlideRecord = function(table){ return new MockGR(table, DB[table]); };
global.GlideDateTime = function(){ this.getDisplayValueInternal=function(){ return '20260516000000'; }; };
var DB = { "x_mcpe_access_grant": [{ principal: "user1", mcp_server: "srv1", active: "1", granted_date: "20260515", sys_id: "g1" }, { principal: "user2", mcp_server: "srv2", active: "0", granted_date: "20260510", sys_id: "g2" }] };
eval(stripHeader(fs.readFileSync('/home/crixus/agentic-loop/output/MCPE/src/MCPEProvisioner.js','utf8')));

function testProvision() {
  var p = new MCPEProvisioner();
  var r = p.provisionAccess("user3", "srv3", "user");
  assert.strictEqual(r.granted, true);
  assert.ok(r.recordSysId);
  console.log("  testProvision PASSED");
}
function testAudit() {
  // testProvision added one record, total is now 3
  var p = new MCPEProvisioner();
  var r = p.auditActiveGrants();
  assert.ok(r.total >= 3, "Total should be >=3 after provision");
  assert.strictEqual(r.active, 2, "Expected 2 active after provision");
  assert.strictEqual(r.expired, 1);
  console.log("  testAudit PASSED (total=" + r.total + ", active=" + r.active + ")");
}
console.log("Running MCPE tests...\n");
testProvision(); testAudit();
console.log("All MCPE tests PASSED");
