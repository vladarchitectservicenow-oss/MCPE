# MCP Server Console Provisioner (MCPE)

## Overview

The **MCP Server Console Provisioner (MCPE)** is a scoped ServiceNow application
designed to bring enterprise-grade access management to the MCP Server Console.
While MCP Server Console is new in Australia and offers powerful server-side
interaction capabilities, it ships without out-of-the-box access management.
MCPE closes this governance gap by delivering automated access grants, a complete
and PII-masked audit trail, and proactive alerting for token expiry and
unauthorised access attempts.

Author: Vladimir Kapustin  
License: MIT

---

## Table of Contents

1. What is MCPE?
2. Why MCPE?
3. Architecture
4. Components
5. Installation
6. Configuration
7. Usage
8. Audit and Compliance
9. Alerting
10. API Reference
11. Testing
12. Security Considerations
13. Roadmap
14. Contributing
15. License

---

## 1. What is MCPE?

MCPE is a ServiceNow scoped application (scope: `x_mcpe`) that provides:

- **Programmatic access provisioning** for MCP Server Console connections.
- **Audit trail** of all active and expired grants.
- **PII masking** in operational logs to protect sensitive identifiers.
- **Alerts** for tokens nearing expiration and unauthorised request attempts.

It replaces manual spreadsheets and ad-hoc approvals with a structured, auditable
system of record inside the ServiceNow platform.

---

## 2. Why MCPE?

When a new protocol like MCP Server Console is introduced into an enterprise,
the default pattern is often to grant access liberally and worry about governance
later. This creates several risks:

- **Orphaned tokens** that remain active long after their business need expires.
- **Privilege escalation** without an approval or review trail.
- **Audit failure** because no structured log exists to prove who had access to
  what and when.
- **PII leakage** because logs capture raw email addresses and identifiers
  without redaction.
- **Delayed incident response** because teams only discover expired or abused
  tokens during manual reviews.

MCPE was designed specifically to eliminate these risks. By treating MCP access as
a first-class resource within ServiceNow, it brings the same governance rigour to
MCP grants that organisations already enforce for user accounts, roles, and
entitlements.

---

## 3. Architecture

MCPE follows a modular engine architecture. Each engine is implemented as a
ServiceNow Script Include and operates against scoped tables within the `x_mcpe`
namespace. All engines share a common convention for return objects, error
handling, and logging.

The application does not require any external infrastructure, MID servers, or
third-party APIs. It is self-contained inside the ServiceNow instance where it is
installed.

---

## 4. Components

### 4.1 MCPEProvisioner

Script Include responsible for creating, querying, and managing access grants.

Key methods:
- `provisionAccess(principal, mcpServer, principalType)` — Creates a new grant.
- `auditActiveGrants()` — Returns a summary of active and expired grants.

### 4.2 MCPEAuditEngine

Script Include responsible for maintaining an immutable audit trail.

Key methods:
- `logAction(grantSysId, action, principal, details)` — Persists an audit event.
- `getAuditTrail(limit)` — Retrieves masked audit records.
- `maskPII(value)` — Applies PII redaction rules to identifiers.

### 4.3 MCPEAlertEngine

Script Include responsible for proactive alerting.

Key methods:
- `checkExpiringTokens(daysThreshold)` — Scans for tokens nearing expiry and
  creates alerts.
- `alertUnauthorized(principal, mcpServer, reason)` — Records unauthorised
  access attempts.

### 4.4 Tables

| Table | Purpose |
|-------|---------|
| `x_mcpe_access_grant` | Stores active and historical grants |
| `x_mcpe_audit_log` | Immutable audit events |
| `x_mcpe_alert` | Alert records for expiry and unauthorised events |

---

## 5. Installation

1. Import the Update Set or XML files from the `src/` directory into your
   ServiceNow instance.
2. Verify that the scoped application `MCP Server Console Provisioner` appears in
   System Applications.
3. Grant the `x_mcpe.admin` role to administrators and `x_mcpe.user` to
   operators who need read-only audit access.
4. Run the test suite (see Testing section) to confirm correct installation.

---

## 6. Configuration

After installation, the following system properties can be configured under the
`x_mcpe` prefix:

- `x_mcpe.token_expiry_days` — Default number of days before a grant expires.
- `x_mcpe.alert_threshold_days` — Number of days before expiry to raise alerts.
- `x_mcpe.masking_enabled` — Boolean flag to enable or disable PII masking.
- `x_mcpe.siem_integration` — Optional endpoint for forwarding high-severity
  alerts to a SIEM.

---

## 7. Usage

### Provisioning Access

From a Business Rule, Flow Action, or Script Include:

```javascript
var prov = new MCPEProvisioner();
var result = prov.provisionAccess("user1", "mcp-prod-01", "user");
if (result.granted) {
    gs.info("Granted sys_id = " + result.recordSysId);
} else {
    gs.error("Grant failed: " + result.errors.join(", "));
}
```

### Auditing Grants

```javascript
var audit = new MCPEAuditEngine();
var trail = audit.getAuditTrail(50);
```

### Checking for Expiring Tokens

```javascript
var alert = new MCPEAlertEngine();
var alerts = alert.checkExpiringTokens(7);
gs.info("Created " + alerts.length + " expiry alerts");
```

---

## 8. Audit and Compliance

MCPE was designed with compliance as a first-class requirement, not an
afterthought. Every grant action is logged with an immutable timestamp and masked
PII. The architecture supports the following frameworks and standards:

- Australian Privacy Principles (APPs)
- ISO 27001 Access Control requirements
- SOC 2 Type II change management controls
- NIST Cybersecurity Framework PR.AC (Identity Management and Access Control)

Redaction is performed at two points: at persistence (when writing to the audit
table) and at retrieval (when serving read requests). This ensures that
operational staff never handle raw identifiers, and that exported logs are safe
for auditor review without additional processing.

---

## 9. Alerting

MCPE’s alerting capabilities are split into two categories: proactive and
reactive.

### Proactive Alerts

A scheduled job runs daily to identify tokens that will expire within the
configured threshold. For each expiring token, an alert is created in
`x_mcpe_alert` and optionally dispatched via notification or SIEM integration.

### Reactive Alerts

When the perimeter detects an unauthorised access attempt — for example, a user
invoking an MCP server they are not granted to — the calling integration can
invoke `alertUnauthorized()`. This immediately records the incident and can
trigger a Security Incident workflow.

---

## 10. API Reference

### MCPEProvisioner.provisionAccess(principal, mcpServer, principalType)

| Parameter | Type | Description |
|-----------|------|-------------|
| principal | String | User sys_id or role name |
| mcpServer | String | MCP server identifier |
| principalType | String | "user" or "role" |

Returns an object with `granted`, `recordSysId`, and `errors`.

### MCPEAuditEngine.logAction(grantSysId, action, principal, details)

| Parameter | Type | Description |
|-----------|------|-------------|
| grantSysId | String | sys_id of the related grant |
| action | String | e.g. "provision", "revoke", "renew" |
| principal | String | Masked principal identifier |
| details | String | Free-text details |

Returns the sys_id of the inserted audit record.

### MCPEAlertEngine.checkExpiringTokens(daysThreshold)

| Parameter | Type | Description |
|-----------|------|-------------|
| daysThreshold | Number | Default 7 |

Returns an array of created alert sys_ids.

---

## 11. Testing

MCPE ships with a Node.js-based test suite that mocks ServiceNow globals and
validates the core JavaScript logic.

Run tests from the repository root:

```bash
node tests/test_mcpe.js
```

Expected output:

```
Running MCPE tests...

  testProvision PASSED
  testAudit PASSED
All MCPE tests PASSED
```

Additionally, ServiceNow instance-level tests can be performed via Background
Scripts to validate GlideRecord interactions against the actual tables.

---

## 12. Security Considerations

- Script Includes use `new GlideRecord()` within the scoped app, respecting
  ServiceNow ACLs.
- PII masking is applied before audit persistence and again on retrieval.
- No secrets or credentials are stored in client-visible code.
- Update sets should be reviewed before promotion to production.
- Alerts should be wired into existing incident response workflows.

---

## 13. Roadmap

- [ ] Multi-instance federation for distributed MCP clusters
- [ ] Just-In-Time (JIT) access with time-bounded approval flows
- [ ] Automated recertification campaigns
- [ ] Integration with external SIEMs via REST Message
- [ ] ServiceNow Store publication

---

## 14. Contributing

Contributions are welcome. Please follow the existing code style, add tests for
new features, and ensure that PII masking rules remain applied to any new data
paths. Open issues and pull requests at the GitHub repository.

---

## 15. License

MIT License. See LICENSE file for full terms.

---

*Vladimir Kapustin · MCPE v1.0.0*
