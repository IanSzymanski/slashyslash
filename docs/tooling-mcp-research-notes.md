# Windows MCP and shared-agent workflow: verified setup notes

Research date: November 14, 2026. This is a connection checklist, not an installation record. The inspected cloud has Codex CLI `0.167.0-alpha.4`; Claude Code was not found on its PATH. That says nothing about the creator's Windows installation.

## Recommended topology

Run the Godot editor, asset editors, Codex local client and Claude Code on the same Windows workstation initially. Each assistant has its own MCP configuration and authentication. A plugin connected in this cloud chat does not establish either Windows connection. A cloud container's localhost does not refer to the Windows machine. Treat remote execution as a separate environment with separately verified tools, paths and credentials.

Use stdio for a locally launched bridge when the selected server supports it. Use Streamable HTTP for services that expose an MCP endpoint. HTTP is not a reason to expose a local Godot editing bridge on the LAN: bind local editor automation to loopback unless remote access is explicitly needed. A Godot game LAN socket and an editor MCP endpoint serve different purposes.

## Client configuration

Codex accepts stdio and Streamable HTTP. User configuration is `~/.codex/config.toml`; trusted projects can use `.codex/config.toml`. On a native Windows installation with default home settings, the former is `%USERPROFILE%\.codex\config.toml`. Stdio entries use `command`, `args`, optional `cwd`, and `env_vars`; HTTP can use `bearer_token_env_var`. Inspect with `codex mcp list` and `/mcp`. [Official Codex MCP documentation](https://developers.openai.com/codex/mcp/).

Claude Code's project file is `.mcp.json`. Its local/project-private and user-wide MCP definitions are in `~/.claude.json`, normally `%USERPROFILE%\.claude.json` on Windows. Default local scope is tied to the project path. Project scope is appropriate for secret-free shared definitions; user scope is useful for machine-wide services. Claude expands `${VAR}` in configuration. Inspect with `claude mcp list`, `claude mcp get NAME` and `/mcp`; a written configuration is not proof of a working connection. [Official Claude MCP documentation](https://code.claude.com/docs/en/mcp).

Illustrative CLI syntax, with placeholders to replace after selecting a server:

```powershell
codex mcp add local_tool -- node "C:\Dev\Tools\SELECTED_SERVER\VERIFIED_ENTRY.js"
claude mcp add --transport stdio --scope local local_tool -- node "C:\Dev\Tools\SELECTED_SERVER\VERIFIED_ENTRY.js"

codex mcp add remote_tool --url "https://PROVIDER/MCP_ENDPOINT"
claude mcp add --transport http --scope user remote_tool "https://PROVIDER/MCP_ENDPOINT"
```

The local Codex CLI help verified its command syntax. Claude syntax is documented. These are not commands to run unchanged and do not assert that any particular Godot bridge uses a JavaScript entry point.

## Windows requirements and pitfalls

- Native Windows is a supported and recommended default for Codex; use WSL when Linux-specific tooling justifies it. [Official Windows guidance](https://developers.openai.com/codex/windows/).
- Claude Code supports native Windows and WSL. Its current native setup can use PowerShell without Git for Windows; Git for Windows adds Bash and is still useful for this project's Git workflow. Older instructions describing Bash as mandatory are outdated. Current documentation says Claude's command sandbox is available in WSL2, not native Windows; do not assume permission/sandbox behavior is identical between the two assistants. [Official Claude setup](https://code.claude.com/docs/en/setup).
- Recommendation: avoid mixing native Windows and WSL versions of the same project's tools at first. They have distinct home directories, PATHs, executable formats and path conventions. A `C:\...` executable path does not become a Linux command by copying its config.
- Prefer a directly executable server binary or `node.exe` plus a pinned local script when suitable. Do not prescribe `cmd /c npx` universally: current Claude docs support direct `npx` configurations, and launcher behavior varies by client/version. Test the chosen command in each client.
- Install Node only for a bridge that requires Node; Python/uv only for a bridge that requires those; Docker only if the selected deployment requires it. They are not inherent Godot or MCP requirements.
- Restart GUI clients after changing PATH or user environment variables so the launched server sees the new values. Use absolute paths or verified project-root resolution. Keep credentials outside checked-in definitions and avoid putting literal tokens into shell command history. Use provider-specific credentials, not either assistant's own model API credential.

## Shared instructions and concurrent work

Keep canonical project rules in `AGENTS.md`: engine version, script language, test commands, asset layout, scene ownership and relevant design decisions. Codex reads this file through its normal instruction discovery. [Official AGENTS.md guidance](https://developers.openai.com/codex/guides/agents-md/).

For predictable Claude compatibility, a root `CLAUDE.md` can contain `@AGENTS.md`, with only genuinely Claude-specific additions afterward. Current Claude versions can read AGENTS.md directly, but a CLAUDE.md or CLAUDE.local.md in the directory ancestry changes that default. The import remains supported and avoids Windows symlink complications. Verify loaded instructions with `/memory` or `/context all`. [Official Claude memory documentation](https://code.claude.com/docs/en/memory).

Use separate Git worktrees/branches for simultaneous implementation and review. Claude supports `claude --worktree NAME`; ordinary Git worktrees also work independently of either assistant. [Official parallel-session guidance](https://code.claude.com/docs/en/common-workflows#run-parallel-sessions-with-worktrees).

Recommended project-specific rules:

- One writer owns a scene, asset source file and the active Godot editor at a time.
- Each worktree has its own import cache. If running more than one editor bridge, explicitly configure separate project paths and ports; never assume a tool attaches to the intended editor.
- A stdio connection from each assistant may start two independent bridge processes. Validate server behavior before allowing both to target one editor.
- Keep integration, acceptance and save compatibility decisions in version-controlled files. Neither assistant's conversation memory is the authoritative handoff.
- Prefer sequential editor mutations even while code review and read-only inspection run in parallel. Have one assistant implement and the other inspect the resulting diff and test evidence, then rotate roles.

## Connection acceptance checklist

- [ ] Both clients report the expected server and expose the required tools.
- [ ] Each can read the exact project path, engine version and a known scene; wrong-project attachment fails this test.
- [ ] Each can start or inspect the sample scene and retrieve useful errors/logs through the selected mechanism.
- [ ] A controlled scratch-scene change appears in Godot and Git; undo/revert behaves correctly.
- [ ] A server restart and editor restart recover predictably.
- [ ] Worktree paths and ports remain isolated; simultaneous read access does not create competing writers.
- [ ] Remote-service credentials are authenticated separately in each client and have the required repository/service scope.
- [ ] The same build, lint, import and test commands work through both assistants' shells without MCP where appropriate.

The connection checklist should not require a filesystem MCP, Git MCP or terminal MCP when the assistants already have direct repository and shell access. MCP is most valuable where a tool exposes state or actions that files and deterministic CLI commands do not provide.
