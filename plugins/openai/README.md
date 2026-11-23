# OpenAI public directory package

Build from the repository root (Node.js 18+, `zip` and `unzip`):

```sh
node --test plugins/openai/package.test.mjs
node plugins/openai/package.mjs
```

The output is `plugins/archdraw-openai-<plugin version>.zip`. The archive has
`plugin.json` and `mcp.json` at its root. It uses the shared plugin identity,
icon and diagram skill, the hosted HTTPS MCP endpoint, and review scenarios
from `review.json`. The build removes the skill's local live-project section.
Only the five explicitly listed files are packaged. Local scripts, hooks,
compatibility manifests, npm commands and repository files are excluded.
The existing Claude and self-hosted Codex marketplaces are unchanged.

## Submission

1. Open https://platform.openai.com/plugins and sign in to the intended organization.
2. Use the existing ArchDraw draft if one exists; otherwise upload a new plugin.
3. Upload the generated ZIP and resolve metadata and skill scan findings.
4. Connect `https://archdraw.hiabhee.online/api/mcp` without authentication.
5. Complete the exact domain verification challenge supplied by the portal.
   Do not invent a token or overwrite another plugin's challenge.
6. Run the five positive and three negative review scenarios against the live
   plugin. Cases two and three follow case one in the same conversation.
   The cases in `review.json` are planned scenarios, not proof of execution.
7. Record the walkthrough and supply its accessible URL in review details
   (or add `demo_recording_url` to `review.json` and rebuild). No recording URL
   is included until a real recording exists.
8. Complete publisher identity verification and required review details.
   Submit for review after automated checks pass and the publisher has
   completed any required policy attestations. Publish after approval.

Local packaging tests verify archive boundaries and configuration; the MCP
server unit tests mock network calls. Neither replaces live integration tests
or the portal's tool scan. A successful build does not mean the plugin has
been submitted, approved or published.

References: [package format](https://developers.openai.com/plugins/build/plugins),
[submission workflow](https://developers.openai.com/plugins/deploy/submission).
