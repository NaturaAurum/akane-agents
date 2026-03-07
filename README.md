# Akane Agents

Akane is a global OpenCode orchestration plugin draft.

Current direction:

- Keep OpenCode provider and auth infrastructure
- Keep `oh-my-opencode` installed but neutralized
- Drive a deterministic workflow across planning, review, implementation, and synthesis

See [docs/session-context-20260306.md](/Users/taewoo.kim/Desktop/Projects/akane-agents/docs/session-context-20260306.md) for the current working context.

## MVP scaffold

This repository now contains the first MVP skeleton for the plugin:

- `src/plugin.ts`: OpenCode plugin entry
- `src/config.ts`: `~/.config/opencode/akane.json` loader with defaults
- `src/artifacts.ts`: `.opencode/akane/` artifact and `state.json` helpers
- `src/tools/akane-init.ts`: initializes the per-project workspace
- `src/tools/akane-stage-artifact.ts`: writes stage artifacts deterministically
- `examples/akane.example.json`: example global Akane config

## Local development

```bash
bun install
bun run typecheck
bun run build
```

The build emits `dist/index.js` as the package entrypoint and also keeps `dist/akane.js` for local file-based linking.

## Package install

For package-based installation, publish this repository to npm and add it to the OpenCode plugin array in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "oh-my-opencode@latest",
    "opencode-akane@0.1.0"
  ]
}
```

Akane still reads its runtime config from `~/.config/opencode/akane.json`.

## Publish flow

The package is prepared to publish from npm with:

```bash
bun install
bun run typecheck
bun run build
npm publish
```

Useful checks before publishing:

```bash
bun run pack:check
```

Notes:

- The current package name assumption is `opencode-akane`
- The current license is `UNLICENSED`; set an explicit open-source or commercial license before a public release if needed
- If you later switch to a scoped package name, publish with `npm publish --access public`

## Automated publishing

This repository includes GitHub Actions workflows for CI and npm publishing:

- `.github/workflows/ci.yml`: runs install, typecheck, build, and `npm pack --dry-run`
- `.github/workflows/publish.yml`: publishes to npm when a tag like `v0.1.0` is pushed

Recommended setup for public release:

1. Make the GitHub repository public
2. Publish `opencode-akane` once manually from your npm account, or reserve the package name
3. In npm package settings, add a Trusted Publisher for:
   - GitHub owner: `NaturaAurum`
   - Repository: `akane-agents`
   - Workflow filename: `publish.yml`
4. Push a version tag that matches `package.json`, for example:

```bash
git tag v0.1.0
git push origin main --tags
```

The publish workflow intentionally uses npm trusted publishing with GitHub OIDC instead of an `NPM_TOKEN`.
