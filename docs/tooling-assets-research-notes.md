# Asset tooling and Godot MCP research

Checked November 14, 2026 for a Windows workstation, solo Godot 2D project, Codex + Claude Code, and LAN play. This is a requirements review, not an installation or compatibility test. No provider account or paid generation was used.

## Recommended connections

| Tool | Requirement | Connection recommendation | Acceptance check |
|---|---|---|---|
| Godot stable editor + matching export templates | Required | Native executable/CLI is the reliable foundation; one community MCP can improve run/log/scene iteration | Both assistants identify the same engine version, run the sample, retrieve a deliberate test error, stop it, and export the intended Windows build |
| Pixelorama **or** Aseprite | One required for authored pixel work | File exchange + versioned export scripts; no MCP needed initially | Source animation exports image + metadata; frame timing/pivots/tags survive import |
| Krita | Optional concept/paintover editor | Files and human review; add automation only for a proven repetitive job | Approved reference and final export use expected dimensions/palette |
| Audacity | Low-cost SFX cleanup option | Files/macros; optional local scripting pipe later | Trim, fades, sample-rate conversion and output naming repeat reliably |
| REAPER | Optional, useful for adaptive music/stem arrangements | Files + ReaScript where automation pays off; do not require a community MCP | Common-length synchronized stems render and loop correctly |
| Existing image generator | Required capability if AI supplies art; no new subscription assumed | Use Codex's built-in generation when exposed; export files for both assistants | A reference-driven animation sample survives cleanup and gameplay-scale inspection |
| ElevenLabs | Optional paid/provider account for generated SFX/music | Official hosted HTTP MCP + OAuth in each assistant | Discover creative tools, make one budgeted sample, download into staging, preserve source/license record |

Choosing one pixel editor and one audio workflow is sufficient. The assistants can write export/validation scripts and inspect asset files without gaining direct GUI control of every creative app. MCP adds a tool protocol; it does not make a poor asset production step repeatable by itself.

## Godot community MCP candidate

[Coding-Solo/godot-mcp](https://github.com/Coding-Solo/godot-mcp) is a **community** server, not an official Godot integration. Its documented tools cover editor/project launch, debug output, stopping execution, version/project information and basic scene/node/sprite operations. UID operations require Godot 4.4+. Requirements are Godot, Node.js >=18 and npm; choose a currently supported Node LTS rather than treating the minimum as a recommendation. `GODOT_PATH` selects the executable. It supports a bundled GDScript/CLI approach; its setup does not require a Godot editor addon. The README offers npm package `@coding-solo/godot-mcp` or a source build with `build/index.js`.

The [repository package metadata](https://github.com/Coding-Solo/godot-mcp/blob/main/package.json) currently declares version `0.1.1` and a Node entry point. This establishes repository metadata, not independent verification of the registry package or a supported engine-version matrix. Pin a reviewed release/commit and record it after testing; do not silently follow `main`/`latest` in a stable toolchain.

For Windows, a locally installed Node executable pointing at a built, pinned `build/index.js` avoids shell-wrapper ambiguity. Use an absolute path to the selected Godot executable and a known project/worktree. Both assistants need their own client registration. Each stdio client starts its own server process; that does not make simultaneous scene writes safe. Assign one writer/editor owner per worktree.

Do not assume this server supplies runtime screenshots, input playback, visual regression or profiler capture merely because it can run the project and read logs. Add a narrow in-project debug/test harness and normal visual capture as required. The Godot CLI remains usable even if MCP integration is unavailable. [Official Godot command-line documentation](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html) documents `--path`, headless execution, log files and exported builds; headless mode uses dummy audio and cannot establish audible sound quality.

## Sprite and animation exports

[Aseprite's official CLI](https://aseprite.org/docs/cli/) supports batch mode, image sheets, JSON metadata, tags/layers and Lua scripts. A useful Windows recipe, after choosing source/output paths, is:

```powershell
& $AsepriteExe --batch "assets_source/player.aseprite" --sheet "assets/player.png" --data "assets/player.json" --format json-array --list-tags
```

`$AsepriteExe` is an example task-specific variable, not a preexisting machine setting. Avoid trimming/pivot-changing export options until the import contract explicitly supports them. Source projects remain editable; runtime exports are reproducible.

[Pixelorama's official CLI](https://pixelorama.org/user_manual/cli/) supports Windows, Linux and macOS; it separates engine options from application arguments with `--`. Documented capabilities include headless operation, sprite-sheet export, JSON metadata, frame selection and layer splitting. This makes it a practical free alternative for scripted exports. Validate the chosen version with `--help` and a real `.pxo` sample. No pixel-editor MCP is needed to invoke either CLI from Codex or Claude Code.

Recommended shared asset contract: source/master, generated candidates, approved exports and metadata have distinct locations. Record dimensions, palette, animation tags, per-frame timing, pivots, hitbox references, source/provider and usage rights. One assistant may generate candidates while the other validates/imports them; only approved exports enter runtime assets. Both must use the same export recipe.

## Audio editing connections

[Audacity's official scripting interface](https://manual.audacityteam.org/man/scripting.html) uses a named pipe; `mod-script-pipe` ships with Windows/macOS and is enabled through Modules preferences followed by restart. Python is the common client, but any language with pipe support can drive it. It supports selections, effects, clip arrangement and export. The manual warns that pipe commands are not sanitized and describes single-project/focus limitations. Prefer ordinary files/macros initially; if enabled later, keep it local and scoped to the audio workstation. Do not expose it as a public remote service.

[REAPER ReaScript](https://www.reaper.fm/sdk/reascript/reascript.php) is the supported automation route. Lua and EEL are embedded; Python needs a separate matching installation/configuration. Agents can author scripts, while REAPER runs them through its Actions workflow. Use Lua for a small portable automation layer before adding another bridge dependency. A community REAPER MCP could be evaluated later, but it is not a requirement for stem preparation, rendering or project organization.

Audio workflow still requires listening: generated effect → selected variation → cleanup/layering → level/tail/loop check → in-game mix check. Adaptive music requires synchronized tempo/key/bar structure, equal-length stems and intentional transition points. A functioning MCP does not verify those qualities.

## Official ElevenLabs hosted MCP

[Official ElevenLabs MCP documentation](https://elevenlabs.io/docs/eleven-api/resources/mcp-server) specifies `https://api.elevenlabs.io/v1/mcp` with OAuth and workspace selection. No local server or API key is needed for this hosted route. It supports SFX and music through Flow nodes, as well as other creative functions. Generations spend workspace credits. Generated file links expire after about two hours, so download approved artifacts into the project rather than using signed URLs as permanent asset references. The documented restricted Claude directory connector lacks music/images/video; use the custom full endpoint for this workflow. Verify each client's tool discovery and OAuth completion independently.

The [old official local server](https://github.com/elevenlabs/elevenlabs-mcp) was archived August 20, 2026, and explicitly deprecated in favor of hosted MCP. Do not base a fresh setup checklist on its old Python/`uvx`/API-key instructions.

Recommendation: optional second-stage purchase/connection, after existing tools establish a sample sound target. A generation is external paid work; establish a small sample/iteration budget and avoid retrying a job that is still running. Verify current commercial-use/export rights for the chosen account and intended game release.

## Image generation across the two assistants

This Codex session exposes a built-in image-generation tool; its availability should be checked on the user's Windows client rather than assumed for every Codex environment. When available, use it directly and put approved outputs in the shared project. No separate image-generation MCP is required for that path.

[Anthropic's help center](https://support.claude.com/en/articles/9002504-can-claude-produce-images) distinguishes Claude's HTML/SVG visuals from photographic/illustration generation and confirms image analysis. Claude Code can still orchestrate an external image-capable MCP/API or consume files generated by Codex. Do not treat Claude subscription access as including unrelated image-service usage or API credit.

The simplest hybrid workflow is provider-independent: one assistant creates a candidate through its available generator; both inspect the same exported files; the pixel editor establishes consistent frames; a deterministic script builds the atlas; Godot imports it; a human evaluates animation and readability in motion. A shared generated-assets directory and explicit approval status are more important than duplicating every provider connection in both clients.
