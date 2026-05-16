/**
 * Copyright (c) 2026 Vladimir Kapustin
 * SPDX-License-Identifier: MIT
 *
 * MCPEAuditEngine — Full audit trail of all grants with PII mask
 * Scope: x_mcpe
 */
var MCPEAuditEngine = Class.create();
MCPEAuditEngine.prototype = {
    initialize: function() {
        this.auditTable = "x_mcpe_audit_log";
        this.maskToken = "****";
    },

    /**
     * Log an action to the audit trail.
     * @param {String} grantSysId
     * @param {String} action
     * @param {String} principal
     * @param {String} details
     * @return {String} inserted sys_id
     */
    logAction: function(grantSysId, action, principal, details) {
        var gr = new GlideRecord(this.auditTable);
        gr.initialize();
        gr.setValue("grant", grantSysId);
        gr.setValue("action", action);
        gr.setValue("principal", this.maskPII(principal));
        gr.setValue("details", details || "");
        gr.setValue("timestamp", new GlideDateTime().getDisplayValueInternal());
        return gr.insert();
    },

    /**
     * Retrieve audit trail with PII redacted.
     * @param {Number} limit optional row limit
     * @return {Array} audit entries
     */
    getAuditTrail: function(limit) {
        var out = [];
        var gr = new GlideRecord(this.auditTable);
        if (limit) gr.setLimit(limit);
        gr.orderByDesc("timestamp");
        gr.query();
        while (gr.next()) {
            out.push({
                grant: gr.getValue("grant"),
                action: gr.getValue("action"),
                principal: this.maskPII(gr.getValue("principal")),
                details: gr.getValue("details"),
                timestamp: gr.getValue("timestamp")
            });
        }
        return out;
    },

    /**
     * Mask PII in a text string.
     * Emails: show first and last char of local part.
     * Long identifiers: show first and last 2 chars.
     * @param {String} value
     * @return {String}
     */
    maskPII: function(value) {
        if (!value) return "";
        if (value.indexOf("@") > -1) {
            var parts = value.split("@");
            var local = parts[0];
            var domain = parts[1];
            var maskedLocal = local.length > 2
                ? local.charAt(0) + this.maskToken + local.charAt(local.length - 1)
                : this.maskToken;
            return maskedLocal + "@" + domain;
        }
        if (value.length > 6) {
            return value.substring(0, 2) + this.maskToken + value.substring(value.length - 2);
        }
        return value;
    },

    type: "MCPEAuditEngine"
};
