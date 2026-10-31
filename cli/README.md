# archdraw-live

See your coding agents work on a live map of your codebase. Run one command in
your project folder:

```bash
npx archdraw-live
```

It connects Claude Code, opens the live map in your browser and asks to let your
own Claude read the code and draw the architecture diagram (nothing else draws it). No account is needed. Then start Claude Code
(`claude`) in the same folder: each session appears as a star that moves to the
component it is working on, and raises a flag when it needs you.

To keep the project and edit the diagram, sign in from the live map. Projects that
nobody signs in to are deleted after 30 days without activity.

## Commands

| Command | What it does |
|---|---|
| `npx archdraw-live` | Set up (or reopen) this repository's live map |
| `npx archdraw-live --map` | Let Claude Code read the code and (re)draw the map (overview, then the detailed map) |
| `npx archdraw-live --detail` | Redraw only the detailed map |
| `npx archdraw-live update` | Switch to the newest release (every run also checks, see below) |
| `npx archdraw-live status` | Show this repository's live map link |
| `npx archdraw-live stop` | Disconnect this repository |

Options: `--api <url>` (another ArchDraw server), `--no-open`, `--no-map` (set up without drawing the map), `--no-detail` (overview only).

## The map

Claude alone draws it; the live map is empty until it has. Right after setup the
command asks to let Claude draw it: it runs your own Claude
Code (`claude -p` with read-only tools: Read, Grep, Glob) in the repository, which
reads the code and answers with a diagram and the folders each component owns.
It takes about a minute and uses your Claude account. Run it any time with
`npx archdraw-live --map`, or ask Claude in a session to "re-map the ArchDraw diagram".

Claude draws two maps, switched with **Overview | Detailed** at the top of the live map:

- **Overview** (always first): the high-level design. 8–16 components, each with what it is
  built with or does ("Scene prep · rasterio · s2cloudless"), arrows labelled with what moves
  ("aligned scenes"), and each data store as its own box.
- **Detailed**: every component opened up into its modules, classes and key files, with the
  calls and data flow between them. Claude draws it right after the overview (a minute or
  two more); redraw it with `npx archdraw-live --detail`. Agents show up on the part they
  are working in.

## Which session needs you

Each Claude Code session gets a name (Otter, Fox, …) shown on its star, in the
session's terminal title and in the **Needs you** list on the map, longest
waiting first. The terminal title changes to `● Otter needs you` when that
session is waiting for your permission. Turn on the bell in the list for desktop
notifications.

## Staying up to date

`npx` reuses a copy it has already downloaded, so on every run the command asks the npm
registry for the newest version and, if yours is older, restarts itself on the newest one
("Updating archdraw-live 0.3.1 → 0.3.2…"). Re-running also refreshes the hook script in
`~/.archdraw/hooks/`. `npx archdraw-live update` does the same on demand. Set
`ARCHDRAW_NO_UPDATE_CHECK=1` to turn the check off (it is also skipped in CI). The only
request is a public GET to `registry.npmjs.org`; nothing about you or your repository is sent.
Copies older than 0.3.2 don't have this check; run `npx -y archdraw-live@latest` once.

## What it does on your machine

- Reads the file list (`git ls-files`, respecting `.gitignore`) to check Claude's map
  against your files. Code never leaves the machine.
- Saves the project link (an access token for this one project) in
  `~/.archdraw/projects.json` (mode 0600), outside your repository.
- Copies a small hook script to `~/.archdraw/hooks/` and adds hooks for it to
  `~/.claude/settings.json` (a backup is kept at `settings.json.archdraw-backup`).
  The hooks do nothing in repositories that are not connected. If the ArchDraw
  Claude Code plugin is enabled, its hooks are used instead.

## What is sent to ArchDraw

- At setup: the repository folder name.
- When Claude draws the map (`--map`, or if you answer yes): Claude's diagrams (overview and detailed) and their component → file map. Claude reads the code on your machine; the code is not sent to ArchDraw.
- While Claude Code runs: the session id, branch, and the repository-relative path of
  each file the session reads or edits; that it is running a shell command (not the
  command); the step it is on, from its own to-do list ("Adding retry to the
  uploader"); when it waits for permission or finishes.
  A task is matched to a component name locally; only the component id is sent.
  The session's token counts (input, output, cache) and its model name, read on your machine from the session's own transcript file; never the transcript's content. They feed the spend figures in your editor (not shown on watch links).
- Never: file contents, diffs, prompts, commands or their output, or your git remote.
