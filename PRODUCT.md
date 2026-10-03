# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The repository describes people who need to create, understand, teach, or review software architecture diagrams. The primary user role, usage situation, and highest-priority job have not been confirmed; software engineers and system architects are plausible audiences based on the documented workflows.

## Product Purpose

ArchDraw helps users turn a plain-language system description or a reachable public GitHub repository into a styled, editable system architecture diagram. Users can then inspect and refine the graph, apply layout or templates, and share or export their work.

## Positioning

Working hypothesis, not yet user-confirmed: ArchDraw combines prompt-based and repository-based diagram generation with a native editable React Flow canvas. Mermaid import/export and an MCP server also let users and AI assistants work with the same diagram workflow.

## Operating Context

- The product runs as a browser-based web app. The main editor is in `frontend/`; the standalone MCP server is in `mcp-server/`.
- Users can start from a natural-language prompt, a public GitHub repository URL, Mermaid, a template, or an existing canvas.
- The canvas supports editing nodes and connections, grouping, layout changes, and multiple diagram tabs.
- Tutorials teach architecture concepts through guided diagram work.
- Signed-in users can persist canvases and use sharing features. Guest work can use browser storage; persistence and authentication depend on configured infrastructure.

## Capabilities and Constraints

- Prompt generation can use fixed concept templates for short, general requests; more specific prompts or edits to an existing diagram use the planning pipeline.
- Repository generation analyzes reachable public GitHub repositories. Results are editable canvases, and can include detected components, relationships, and a summary.
- Mermaid is a supported input/output format. Frontend layout uses the Mermaid pipeline and Dagre; ELK is confined to the MCP server's legacy JSON layout path.
- Available workflows include templates, tutorials, public share links, embeds, and JSON, Mermaid, PNG, and SVG export. Some actions and formats are gated by account status.
- AI generation requires a configured Groq API key. Authentication and server-side persistence require database configuration; Google and GitHub sign-in depend on provider configuration. Email/password sign-in is disabled.
- Current documented quotas are 3 AI generations per hour for guests and 10 per day for authenticated users. Treat these as current policy, not a permanent guarantee.

## Brand Commitments

The product name is ArchDraw. No additional user-confirmed brand voice or identity constraints were provided during init.

## Evidence on Hand

- The repository contains the working web app, an interactive landing-page canvas demo, architecture templates, guided tutorials, and the MCP server implementation.
- The repository documents generation, editing, sharing, and export workflows. Do not turn feature descriptions into unsupported performance or customer-outcome claims.
- No verified testimonials, customer counts, case studies, or independent benchmark results were identified in the supplied product documentation. Do not fabricate them.

## Product Principles

- Keep generated diagrams editable so users can continue working with them as graphs.
- Support more than one starting point: system descriptions, repositories, Mermaid, templates, and existing canvases.
- Make the structure and relationships of a system available for inspection and refinement.
- Preserve diagram workflows across the web editor and MCP tools.

## Accessibility & Inclusion

No product-specific accessibility standard or user requirement was confirmed during init. Validate keyboard access, canvas interaction, text alternatives, and reduced-motion behavior when working on the relevant surfaces; do not claim conformance without evidence.
