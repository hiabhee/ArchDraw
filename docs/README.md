# ArchDraw docs

Start with [../CONTRIBUTING.md](../CONTRIBUTING.md) for setup and where code lives. [../AGENTS.md](../AGENTS.md) holds the detailed contracts (layout owner, sizing grid, handle rules, metering, persistence) that every change has to respect.

| Folder | What's in it | Trust it as current? |
| --- | --- | --- |
| [overview.md](overview.md) | What ArchDraw is and how the product works | Yes |
| [architecture/](architecture/) | How specific subsystems work: layout toggler, icon system, agentic workflow contract (+ fixtures) | Yes — update these when you change the subsystem |
| [guides/](guides/) | How-to guides, e.g. [deployment](guides/deployment.md) | Yes |
| [incidents/](incidents/) | Post-mortems of production issues | Historical record |
| [plans/](plans/) | Design and implementation plans, audits | Historical — they describe the code *when they were written*; file paths may have moved since |
| [archive/](archive/) | Older fix notes and summaries | Historical |
| [superpowers/](superpowers/) | Plans written by the Superpowers AI tool | Historical; the tool writes here, so leave the folder in place |

When code and a plan disagree, the code (and AGENTS.md) wins.
