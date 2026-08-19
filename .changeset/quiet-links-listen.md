---
"@buresmi7/agent-doc-rules-docs-validator": patch
"@buresmi7/agent-doc-rules-skill": patch
---

Replace local-server link crawling with a no-listener Remark pipeline. Preserve
local, fragment, and raw HTML checks, validate HTTP(S) links through direct
requests with a bounded timeout, add undefined reference validation, and
describe link skips independently of the underlying checker. Proxy environment
variables are not applied automatically.
