# archdraw-live

See your coding agents work on a live map of your codebase. Run one command in
your project folder:

```bash
npx archdraw-live
```

It maps the repository into an architecture diagram, connects Claude Code and
opens the live map in your browser. No account is needed. Then start Claude Code
(`claude`) in the same folder: each session appears as a star that moves to the
component it is working on, and raises a flag when it needs you.

To keep the project and edit the diagram, sign in from the live map. Projects that
nobody signs in to are deleted after 30 days without activity.

## Commands

| Command | What it does |
|---|---|
| `npx archdraw-live` | Set up (or reopen) this repository's live map |
| `npx archdraw-live --dry-run` | Print exactly what would be sent, send nothing |
| `npx archdraw-live --rescan` | Rebuild the diagram from the folders; your layout is kept |
| `npx archdraw-live --map` | Let Claude Code read the code and draw an accurate map (overview, then the detailed map) |
| `npx archdraw-live --detail` | Redraw only the detailed map |
| `npx archdraw-live status` | Show this repository's live map link |
| `npx archdraw-live stop` | Disconnect this repository |

Options: `--api <url>` (another ArchDraw server), `--no-open`, `--no-detail` (overview only).

## An accurate map

The first map is a one-second guess from folder names and imports. Right after
setup the command offers to let Claude draw the real one: it runs your own Claude
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

## What it does on your machine

- Reads the file list (`git ls-files`, respecting `.gitignore`) and, to find imports
  between folders, the first 64 KB of source files. Code never leaves the machine.
- Saves the project link (an access token for this one project) in
  `~/.archdraw/projects.json` (mode 0600), outside your repository.
- Copies a small hook script to `~/.archdraw/hooks/` and adds hooks for it to
  `~/.claude/settings.json` (a backup is kept at `settings.json.archdraw-backup`).
  The hooks do nothing in repositories that are not connected. If the ArchDraw
  Claude Code plugin is enabled, its hooks are used instead.

## What is sent to ArchDraw

- At setup: the repository folder name, component names, the folder paths each
  component covers, and the connections between them.
- With `--map` (or if you answer yes): Claude's diagrams (overview and detailed) and their component → file map. Claude reads the code on your machine; the code is not sent to ArchDraw.
- While Claude Code runs: the session id, branch, and the repository-relative path of
  each file the session reads or edits; when it waits for permission or finishes.
  A task is matched to a component name locally; only the component id is sent.
- Never: file contents, diffs, prompts or your git remote.
