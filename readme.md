# ai-engineer-workshop scripts

This repo is where the workshop scripts live.

The package named `ai-engineer-workshop` comes from the Iterate monorepo and provides:

- the `workshop` CLI
- `createEventsClient`
- `defineProcessor`
- `PullSubscriptionProcessorRuntime`
- a few workshop-specific helpers like `runWorkshopMain`

## Local development against a linked package

`pnpm-workspace.yaml` can override `ai-engineer-workshop` to a local checkout of the Iterate monorepo package.

Current local override:

```yaml
overrides:
  ai-engineer-workshop: link:../../../../.superset/worktrees/iterate/excited-cemetery/ai-engineer-workshop
```

After changing the override, run:

```bash
pnpm install
```

You can confirm the package resolves locally with:

```bash
pnpm exec node -e "import('ai-engineer-workshop').then((m)=>console.log(Object.keys(m)))"
```

## Running scripts

Show usage:

```bash
pnpm w --help
```

Run a specific script:

```bash
pnpm w run --script jonas/01-hello-world/append-hello-world.ts
```

Run with an explicit path prefix:

```bash
pnpm w run --script jonas/01-hello-world/append-hello-world.ts --path-prefix /jonas
```

If a script imports `ai-engineer-workshop`, it should be run from this repo so normal package resolution works.
