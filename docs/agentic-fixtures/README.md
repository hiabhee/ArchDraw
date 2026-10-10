# Agentic architecture fixtures

These Mermaid fixtures are stable inputs for layout, focus, evidence, proposal, and sync-state work. Counts are leaf architecture components; Mermaid subgraph containers are excluded.

| Fixture | Leaf components | Coverage |
|---|---:|---|
| [small-application.mmd](small-application.mmd) | 10 | Upload path, async processing, feedback cycle, long label |
| [grouped-system.mmd](grouped-system.mmd) | 30 | Nested groups, several concerns, labeled flows, processing cycle |
| [large-platform.mmd](large-platform.mmd) | 80 | Eight concern groups, nested service groups, long labels, multiple cycles, `checkout` as the initial focus |

Use these as deterministic visual inputs. Record parser/layout warnings separately from visual defects. Do not update a fixture merely to make an overlap disappear without recording the change and reason.
