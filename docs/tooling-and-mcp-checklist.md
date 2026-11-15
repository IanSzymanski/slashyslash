# Windows tooling and MCP checklist

Based on the [game design audit](game-design-audit.md). Prepared November 14, 2026 for a solo creator using **Godot 2D, Codex, Claude Code, PC builds and two-player LAN**.

This is a setup specification. No Windows software, credentials or MCP connections were installed or changed. Current cloud tool availability does not establish what is installed on your Windows workstation.

## 1. Recommended stack

Start with **Godot + Git/Git LFS + Codex + Claude Code + one pixel editor + Audacity**, then add a music arrangement tool as the soundtrack develops. Use existing image generation first. Add ElevenLabs only if its sound/music samples justify the expense.

Use **Godot MCP as an optional automation aid**, **GitHub MCP as a useful repository-service connection**, and **ElevenLabs MCP as an optional asset-generation connection**. Shell commands, files and reproducible exports remain part of the workflow. MCP is not required for every application.

| Tool/capability | Priority | Connection for both assistants | Completion check |
|---|---|---|---|
| Godot stable standard build, GDScript, matching export templates | Required | Native CLI; optional community Godot MCP | Both run/import the project; a Windows export launches |
| Codex local Windows client and Claude Code | Required | Each uses its own login/configuration | Both read the repository and run the same verification command |
| Git for Windows and a GitHub remote | Required for the proposed workflow | Native Git; GitHub CLI or MCP for issues/PRs | Clone, branch and fetch work; remote authentication is verified |
| Git LFS | Required before committing large binary masters | Native CLI; no MCP | A fresh checkout obtains actual binary files, not only LFS pointers |
| Pixelorama **or** Aseprite | Required pixel-asset capability | Source files + CLI export; no MCP needed | Animation exports PNG + metadata with correct timing and alignment |
| Audacity | Required initial audio-editing capability, or an equivalent you already use | Files/macros; optional local scripting later | A trimmed/faded SFX sounds correct in Godot |
| Existing AI image generator | Use existing access first | Available native tool/app → exported files; optional external connector | A consistent reference sample survives cleanup and in-game inspection |
| Node.js LTS + npm | Required only for the selected Godot MCP implementation | Local runtime launched by each MCP client | Server starts and exposes expected tools in each client |
| Python | Recommended for asset validation/conversion scripts | CLI; no MCP | Shared asset validation command runs on both assistants' shells |
| FFmpeg/ffprobe | Recommended for media inspection/conversion | CLI; no MCP | Can inspect audio format/duration and prepare a test asset |
| GUT test framework | Recommended before combat/save systems expand | Godot addon + headless CLI | A meaningful behavior test passes and an intentional failure exits unsuccessfully |
| REAPER | Add for music/stem arrangement if needed | Project files; optional Lua ReaScript | Synchronized stems render, loop and transition correctly |
| OBS Studio + Godot debugger/profiler | Recommended for feel/performance evidence | Human capture and saved logs/clips; no initial MCP | A combat recording and performance capture are reproducible |
| Second PC and ordinary LAN | Required before claiming LAN readiness | Exported game using Godot ENet; no MCP | Two physical PCs connect and complete a test encounter |
| Krita | Optional concept art/paintovers | Files | Approved reference can be exported at agreed dimensions |
| ElevenLabs | Optional generated SFX/music | Official hosted MCP, separately authenticated in each client | One budgeted sample exports into local staging and imports successfully |

Choose one pixel editor initially. Pixelorama offers a free starting path; Aseprite is an alternative if its workflow is preferable. Both document CLI exports: [Pixelorama](https://pixelorama.org/user_manual/cli/), [Aseprite](https://aseprite.org/docs/cli/). [GUT](https://github.com/bitwes/Gut) is a community test framework; match its release to the chosen Godot version. [OBS](https://obsproject.com/kb/quick-start-guide/) supplies gameplay recording, not an automated judgment of combat quality.

## 2. Windows workstation setup

- [ ] Install the selected stable Godot **standard** build and its matching export templates. The .NET edition/SDK is unnecessary unless C# is intentionally selected.
- [ ] Record the exact Godot executable, console executable and version. Use the console executable where command output matters.
- [ ] Install and sign into current Windows Codex and Claude Code clients with the access your subscriptions provide.
- [ ] Install Git for Windows and Git LFS; optionally GitHub CLI for repository-service operations without MCP.
- [ ] Install a supported Node LTS if enabling the selected Godot MCP. Its README's Node minimum is not a recommendation to install an obsolete runtime.
- [ ] Install one pixel editor and the initial audio editor. Add Python/FFmpeg when the shared asset scripts need them.
- [ ] Keep the project in an ordinary local development folder, for example `C:\Dev\SlashySlash-Godot`, rather than a folder being simultaneously rewritten by a cloud-sync application.
- [ ] Record versions and executable paths in a toolchain document; restart GUI assistants after changing PATH/environment variables.

Run both assistants, Godot and the asset editors **natively on Windows initially**. WSL is an alternative when a particular Linux workflow warrants it, but has different paths, homes and runtime behavior. Do not mix Windows executables and Linux MCP configurations casually. Current official setup guidance supports native Windows: [Codex Windows](https://developers.openai.com/codex/windows/), [Claude Code setup](https://code.claude.com/docs/en/setup).

This cloud chat has a separate filesystem and localhost. Its GitHub/image tools do not automatically become connections in either Windows client. Local Godot automation should run with the Windows project. Cloud work can use a separate checkout for code/tests with explicit synchronization through Git.

## 3. MCP connection requirements

| Connection | Status | Transport and prerequisites | What to verify |
|---|---|---|---|
| Godot: [Coding-Solo/godot-mcp](https://github.com/Coding-Solo/godot-mcp) | Community candidate; optional | Local stdio; reviewed/pinned server build, Node/npm, Godot path | Version/project info, basic scene operations, run/stop and logs |
| [GitHub MCP](https://github.com/github/github-mcp-server) | Official; recommended convenience | Hosted Streamable HTTP; repository-scoped authentication | Intended repository, issues/PRs and required permissions |
| [ElevenLabs MCP](https://elevenlabs.io/docs/eleven-api/resources/mcp-server) | Official; optional paid generation | Hosted HTTP + OAuth/workspace; credits | Creative tools, SFX/music sample, usable downloaded output |
| Pixelorama/Aseprite | No MCP required | CLI exports + files | Repeatable atlas/metadata output |
| Audacity/REAPER | No MCP required | Files/macros; supported scripting when useful | Repeatable audio edit/render |
| Git, filesystem, terminal, tests | No additional MCP required | Existing assistant file/shell access | Same commands, same working directory and same results |
| Game LAN networking | No MCP involved | Godot ENet and a chosen UDP game port | Real host/client play on separate PCs |

### A. Godot connection

- [ ] Review and pin one release/commit of the community server. Record the version after testing; do not silently track `main` or an unpinned `latest`.
- [ ] Build/install its prerequisites according to that pinned release's instructions.
- [ ] Set `GODOT_PATH` to the actual Windows executable.
- [ ] Register the server separately in Codex and Claude Code.
- [ ] Give every operation the intended project/worktree path. Confirm the returned project identity before edits.
- [ ] Run a scratch scene, retrieve a deliberate script error, stop it, and make/revert a small scene change.

The selected server documents CLI-backed project, scene and debug operations. It does **not** establish runtime screenshot, input-playback or profiler automation. Those capabilities need separate capture/testing mechanisms. Godot's native CLI remains the fallback: [command-line documentation](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html).

Two clients can launch two independent stdio server processes. That does not coordinate their writes. Assign one editor/scene writer at a time; do not let both bridges mutate the same project simultaneously.

### B. GitHub connection

- [ ] Use the official hosted endpoint `https://api.githubcopilot.com/mcp/` if choosing MCP.
- [ ] Configure access separately in both clients. The documented hosted setup uses a personal access token; scope it to the intended repository and needed operations.
- [ ] Keep token values outside tracked files and shell-history commands. A local `.env` file is not automatically loaded by either assistant.
- [ ] Verify a read of the existing project and a PR/issue listing. Enable additional write capabilities only as the workflow requires them.
- [ ] Keep native Git for commits, branches and worktrees. GitHub MCP addresses remote repository services.

Provider guides: [Codex configuration](https://github.com/github/github-mcp-server/blob/main/docs/installation-guides/install-codex.md), [Claude configuration](https://github.com/github/github-mcp-server/blob/main/docs/installation-guides/install-claude.md). GitHub CLI is a sufficient alternative if minimizing MCP connections.

### C. Optional ElevenLabs connection

- [ ] Select a workspace and a small generation budget; verify the account's commercial-use/export rights for the game.
- [ ] Add the official full endpoint `https://api.elevenlabs.io/v1/mcp` to both clients and complete OAuth independently.
- [ ] Discover the creative tools and verify SFX/music generation through Flow nodes.
- [ ] Save selected output into local asset staging; store provider/job/reference information with it.
- [ ] Check quality in the editor and in-game before expanding usage.

The hosted route needs no local server/API key and consumes workspace credits. The restricted Claude directory connector lacks music generation; use the full endpoint for this workflow. See [official MCP documentation](https://elevenlabs.io/docs/eleven-api/resources/mcp-server). Generated audio still needs editing and listening review.

### D. Images and creative applications

- [ ] Check whether the Windows Codex environment exposes image generation. This chat does, but availability is environment-specific.
- [ ] If available, use it and export candidates for both assistants to inspect and integrate.
- [ ] If Claude also needs to request generations directly, give it a separately configured provider connection; its subscription does not supply unrelated provider credits.
- [ ] Prefer shared files and export recipes over installing another connector solely to duplicate an already working generation path.

Audacity can optionally use its documented [local scripting pipe](https://manual.audacityteam.org/man/scripting.html); REAPER supports [ReaScript](https://www.reaper.fm/sdk/reascript/reascript.php). Start with ordinary editing and exports. Add those automation paths for specific repetitive jobs, not as prerequisites for using AI assistants.

## 4. Client configuration examples

These are **templates**, not installed configuration. Replace executable paths with actual paths, merge entries into existing files, and never overwrite an entire existing configuration blindly.

| Client | Configuration location | Inspection |
|---|---|---|
| Codex | Normally `%USERPROFILE%\.codex\config.toml`; trusted project configuration can use `.codex/config.toml` | `codex mcp list`, then `/mcp` in the client |
| Claude Code | Project-shared `.mcp.json`; project-private/user definitions in `%USERPROFILE%\.claude.json` | `claude mcp list`, `claude mcp get godot`, then `/mcp` |

User-home overrides can change these paths. Local machine paths usually belong in personal configuration; keep checked-in examples free of credentials. Official references: [Codex MCP](https://developers.openai.com/codex/mcp/), [Claude Code MCP](https://code.claude.com/docs/en/mcp).

Godot example for Codex:

```toml
[mcp_servers.godot]
command = "C:/Program Files/nodejs/node.exe"
args = ["C:/Dev/Tools/godot-mcp/build/index.js"]

[mcp_servers.godot.env]
GODOT_PATH = "C:/Dev/Tools/Godot/Godot_console.exe"
```

Equivalent Claude Code project `.mcp.json` structure:

```json
{
  "mcpServers": {
    "godot": {
      "type": "stdio",
      "command": "C:/Program Files/nodejs/node.exe",
      "args": ["C:/Dev/Tools/godot-mcp/build/index.js"],
      "env": {
        "GODOT_PATH": "C:/Dev/Tools/Godot/Godot_console.exe"
      }
    }
  }
}
```

The abbreviated Godot filename above is a placeholder. The selected server's documented source-build entry point is `build/index.js`; confirm it exists in the pinned installation. These snippets supply an executable, not a project allowlist. Project targeting and write ownership still need verification.

For GitHub, Codex can reference an environment variable without storing the token in its config:

```toml
[mcp_servers.github]
url = "https://api.githubcopilot.com/mcp/"
bearer_token_env_var = "GITHUB_PAT_TOKEN"
```

Claude's corresponding server object can use environment expansion:

```json
{
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp/",
  "headers": { "Authorization": "Bearer ${GITHUB_PAT_TOKEN}" }
}
```

Place that object under `mcpServers.github` when using `.mcp.json`. Provision the variable outside source control and ensure the launched client inherits it. Merely writing its name does not authenticate anything.

Optional hosted ElevenLabs registration, after deciding to use the service:

```powershell
codex mcp add elevenlabs --url https://api.elevenlabs.io/v1/mcp
codex mcp login elevenlabs

claude mcp add --transport http --scope user elevenlabs https://api.elevenlabs.io/v1/mcp
```

Complete Claude authentication through `/mcp`. Verify OAuth and tool discovery with current client versions; a documented endpoint is not an end-to-end compatibility test on your machine. No paid generation is required just to write these configurations.

## 5. Shared repository and asset requirements

- [ ] Create the new Godot project separately from the preserved browser reference.
- [ ] Keep canonical rules in `AGENTS.md`: engine version, language, architecture boundaries, validation commands, asset contracts and editor ownership.
- [ ] Use a small `CLAUDE.md` that imports `@AGENTS.md`, with only Claude-specific additions. Verify both clients actually load the rules.
- [ ] Keep tasks, decisions, acceptance criteria and handoffs in the repository or issues. Do not rely on either assistant's conversation memory as the only record.
- [ ] Use separate Git worktrees/branches for concurrent implementation. Review may be read-only against the writer's branch.
- [ ] Ignore `.godot/` caches, local credentials, temporary outputs and test saves. Track source `.gd`, `.tscn`, `.tres`, needed `.uid` and import-settings sidecars.
- [ ] Set text line endings through `.gitattributes`; use LFS selectively for large binary source art/audio. Tiny sprites do not automatically need LFS.
- [ ] Establish a backup/remote policy for source masters and local saves. Git LFS storage/bandwidth quotas are a separate budget consideration.
- [ ] Give each test/worktree a separate save location and running instance/port allocation. Implement this in the test harness; ordinary worktrees alone do not isolate Godot's user-data saves.

Sources for instruction/configuration behavior: [Codex AGENTS.md](https://developers.openai.com/codex/guides/agents-md/), [Claude memory/imports](https://code.claude.com/docs/en/memory). Godot's [version-control guidance](https://docs.godotengine.org/en/stable/tutorials/best_practices/version_control_systems.html) explains generated caches, Windows line endings and LFS.

Suggested layout to create in the new project:

```text
project.godot
AGENTS.md
CLAUDE.md
docs/                 design, decisions, tasks, handoffs, tool versions
scenes/               reusable actors, hub, district rooms, UI
scripts/              gameplay, persistence, networking
data/                 moves, items, recipes, encounters
art_source/           editable pixel-art masters
audio_source/         lossless masters and arrangement projects
asset_staging/        candidates; approved status recorded explicitly
assets/               approved runtime exports and metadata
tests/                meaningful combat/save/network tests
tools/                shared import, export, validation and launch scripts
```

Store bulky staging candidates outside Git or selectively ignore them; promote approved masters/exports deliberately. Keep raw source/staging directories out of Godot resource scanning when appropriate through `.gdignore`.

Asset contracts to define before mass generation:

- [ ] Sprites: dimensions, palette, frame timing, animation tags, pivots, facing, attachment points and import filtering.
- [ ] Effects: texture/flipbook layout, duration, layer, brightness and reduced-effects behavior.
- [ ] Audio: master/playback formats, sample rate, intended loudness, start/tail handling, loop points and event ID.
- [ ] Music: tempo/key, bar boundaries, stem length and transition points.
- [ ] Every asset: ID, source/master, generator or creator, usage-rights record, export recipe and approval status.

## 6. Hybrid Codex + Claude Code workflow

Assign **roles per task**, rather than permanently assuming one model owns architecture and the other owns implementation.

1. **Specify:** you and one assistant define the behavior, affected files and acceptance criteria from the audit.
2. **Implement:** one assistant owns a branch/worktree and the relevant editor/scene changes. It writes code and repeatable import/test commands.
3. **Produce assets:** use the available generator, clean in the pixel/audio editor, export through the agreed recipe, then import into Godot. Both assistants use the same files and metadata.
4. **Review independently:** the other assistant examines the diff, requirements and test evidence; it looks for alternative explanations and missing cases. Rotate roles on later tasks.
5. **Verify:** execute the shared checks, inspect the game in Godot, record difficult combat cases and listen to the full mix. You decide whether feel, readability and sound meet the intended standard.
6. **Integrate and hand off:** merge a coherent tested change; record the commit, remaining concerns, asset IDs and next task. Only the integrated branch becomes the next task's baseline.

Parallelize independent scripts, research or review. Serialize changes to the same scene, binary asset and active editor. A second assistant should not unknowingly undo unsaved Godot editor changes.

No Codex-to-Claude MCP bridge is required. Git, shared task files and explicit handoffs are sufficient. If automated agent-to-agent orchestration is later useful, give it bounded tasks and a clear stop condition instead of letting the assistants recursively assign work to each other.

## 7. Build, test and LAN checklist

Create a small set of version-controlled commands that **both assistants** can run, regardless of MCP availability:

- [ ] Import/validate assets and open the project headlessly.
- [ ] Run combat/resource rules and save-transaction tests using a Godot-compatible GUT release or a small native harness.
- [ ] Validate asset IDs, dimensions, animation metadata, missing dependencies and audio formats.
- [ ] Export and launch a Windows debug build using the matching templates.
- [ ] Launch local host/client instances with separate save profiles.
- [ ] Exercise actual host/client play on two PCs, including extraction, reconnect and host restart.
- [ ] Collect frame-time/network logs and a visual recording for the busiest intended encounter.

Godot supports headless import/testing/export, but headless execution cannot validate visual polish or audible sound. Do not count a successful import as proof of satisfying combat.

For LAN, select a game UDP port, connect using the host's private address, and allow the game on the relevant Windows private-network firewall profile. Same-LAN testing does not require a public matchmaking service or router port forwarding. ENet is part of Godot: [networking documentation](https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html). Keep editor/MCP access separate from that game port.

## 8. Setup order and readiness gate

1. [ ] Godot, Git, both assistants and a shared repository work without MCP.
2. [ ] Both assistants use the same project instructions and run one verification command successfully.
3. [ ] Evaluate/connect the Godot MCP in each client against a scratch project; keep it only if it improves the workflow.
4. [ ] Connect GitHub MCP or authenticate GitHub CLI for issues/PRs.
5. [ ] Prove one cleaned sprite animation and one authored SFX through export/import.
6. [ ] Add REAPER and/or ElevenLabs only when the soundtrack/SFX sample requires them.
7. [ ] Implement the movement/combat sample and prove two-player LAN before city-scale production.

**Ready to begin the migration:** both assistants can target the correct checkout, run/import/export the sample, exchange approved assets, retrieve errors, review each other's changes and preserve independent saves. MCP tools should have been exercised, not merely listed in configuration.

Tools intentionally outside the starting requirements: Unity/Unreal, Blender, a separate level editor, paid online multiplayer services, Docker, an extra filesystem/terminal MCP and multiple overlapping AI-generation subscriptions. Add a tool when a demonstrated production requirement warrants it.

Detailed verification sources: [Windows/client research](tooling-mcp-research-notes.md), [Godot/asset research](tooling-assets-research-notes.md). These sources establish documented capabilities; the Windows connection acceptance checks remain to be performed.
