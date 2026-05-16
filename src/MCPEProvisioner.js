/**
 * Copyright (c) 2026 Vladimir Kapustin
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * MCPE — MCP Server Console Provisioner
 * Scope: x_mcpe
 * Problem: No automated MCP server access grants and audit.
 */
var MCPEProvisioner = Class.create();
MCPEProvisioner.prototype = {
    initialize: function() {
        this.version = "1.0.0";
    },

    /**
     * Provision an MCP server connection for a user or role.
     * @param {String} userSysId or role name
     * @param {String} mcpServerSysId
     * @return {Object} result
     */
    provisionAccess: function(principal, mcpServer, principalType) {
        // principalType: "user" or "role"
        var result = { granted: false, recordSysId: null, errors: [] };
        try {
            var gr = new GlideRecord("x_mcpe_access_grant");
            gr.initialize();
            gr.setValue("principal", principal);
            gr.setValue("mcp_server", mcpServer);
            gr.setValue("principal_type", principalType);
            gr.setValue("granted_date", new GlideDateTime().getDisplayValueInternal());
            gr.setValue("active", true);
            var id = gr.insert();
            if (id) {
                result.granted = true;
                result.recordSysId = id;
            } else {
                result.errors.push("Insert failed");
            }
        } catch (e) {
            result.errors.push(e.message);
        }
        return result;
    },

    /**
     * Audit all active MCP access grants.
     */
    auditActiveGrants: function() {
        var out = { total: 0, active: 0, expired: 0, grants: [] };
        try {
            var gr = new GlideRecord("x_mcpe_access_grant");
            gr.query();
            while (gr.next()) {
                out.total++;
                var active = gr.getValue("active") === "1";
                if (active) out.active++; else out.expired++;
                out.grants.push({
                    sys_id: gr.getUniqueValue(),
                    principal: gr.getValue("principal") || "",
                    mcp_server: gr.getValue("mcp_server") || "",
                    active: active,
                    granted_date: gr.getValue("granted_date") || ""
                });
            }
        } catch (e) {}
        return out;
    },

    type: "MCPEProvisioner"
};
