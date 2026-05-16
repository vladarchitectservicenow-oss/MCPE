/**
 * Copyright (c) 2026 Vladimir Kapustin
 * SPDX-License-Identifier: MIT
 *
 * MCPEAlertEngine — Alerts for token expiry and unauthorized requests
 * Scope: x_mcpe
 */
var MCPEAlertEngine = Class.create();
MCPEAlertEngine.prototype = {
    initialize: function() {
        this.alertTable = "x_mcpe_alert";
    },

    /**
     * Check for grants nearing expiry and create alerts.
     * @param {Number} daysThreshold default 7
     * @return {Array} created alert sys_ids
     */
    checkExpiringTokens: function(daysThreshold) {
        daysThreshold = daysThreshold || 7;
        var alerts = [];
        var gdt = new GlideDateTime();
        var now = new GlideDateTime();
        now.addDaysLocalTime(daysThreshold);

        var gr = new GlideRecord("x_mcpe_access_grant");
        gr.addQuery("active", "true");
        gr.addQuery("expiry_date", "<=", now);
        gr.addQuery("expiry_date", ">", gdt);
        gr.query();
        while (gr.next()) {
            var alertId = this._createAlert(
                "expiry",
                "Token expiring for " + gr.getValue("principal"),
                gr.getUniqueValue()
            );
            alerts.push(alertId);
        }
        return alerts;
    },

    /**
     * Raise an alert for an unauthorized access attempt.
     * @param {String} principal
     * @param {String} mcpServer
     * @param {String} reason optional
     * @return {String} alert sys_id
     */
    alertUnauthorized: function(principal, mcpServer, reason) {
        var msg = "Unauthorized access attempt by " + principal + " to " + mcpServer;
        if (reason) msg += " (" + reason + ")";
        return this._createAlert("unauthorized", msg, null);
    },

    _createAlert: function(severity, message, grantSysId) {
        var gr = new GlideRecord(this.alertTable);
        gr.initialize();
        gr.setValue("severity", severity);
        gr.setValue("message", message);
        gr.setValue("grant", grantSysId);
        gr.setValue("created", new GlideDateTime().getDisplayValueInternal());
        return gr.insert();
    },

    type: "MCPEAlertEngine"
};
