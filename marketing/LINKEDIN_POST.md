# MCP Server Console just landed in Australia — but who’s managing the keys?

MCP Server Console is powerful, yet it ships with **zero** out-of-the-box access
management. No expiry, no audit trail, no alerting. That’s a governance gap most
security teams can’t afford.

I built **MCPE** — the MCP Server Console Provisioner — to close it.

What it does in 60 seconds:
- Programmatically provisions (and revokes) MCP access grants
- Maintains a full audit trail with **PII masking** built in
- Alerts on token expiry and unauthorised requests before they become incidents

All inside a scoped ServiceNow app (x_mcpe). No external agents. No custom
infrastructure.

If your team is rolling out MCP in Australia — or anywhere without native access
controls — this is the missing layer.

Code, tests, and whitepaper are open-source under MIT.

Repo: github.com/vladarchitectservicenow-oss/MCPE

Would love feedback from ServiceNow architects and security engineers. What
governance gaps are you seeing with emerging protocols?

#ServiceNow #MCP #CyberSecurity #Governance #ServiceNowDeveloper #OpenSource
