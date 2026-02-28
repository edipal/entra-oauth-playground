# Contributing

Thanks for your interest in contributing to this project.

This guide keeps things simple and follows common GitHub open-source best practices.

## Ground rules

- Be respectful and constructive.
- Keep changes small and focused.
- Prefer clear, readable code over clever code.
- Don’t include secrets, keys, or tenant-specific sensitive data.

## Before you start

1. Check open issues and existing pull requests to avoid duplicate work.
2. For larger changes, open an issue first so we can align on approach.
3. Fork the repository and create a feature branch from `main`.

## Development setup

Install dependencies:

```bash
pnpm install
# or npm install
```

Run locally:

```bash
pnpm dev
# or npm run dev
```

## Code quality checks

Before opening a pull request, run:

```bash
pnpm lint
pnpm build
# or npm run lint && npm run build
```

If you changed formatting-sensitive files, run:

```bash
pnpm format
# or npm run format
```

## Pull request checklist

Please make sure your PR:

- Has a clear title and description (what changed and why).
- Links to an issue when relevant (for example: `Closes #123`).
- Includes screenshots for UI changes.
- Keeps unrelated refactors out of scope.
- Passes lint/build checks.

## Commit messages (recommended)

Use short, descriptive commits. Conventional-style commits are welcome, for example:

- `feat: add token validation hint`
- `fix: handle missing tenant id`
- `docs: improve setup instructions`

## Reporting bugs

When opening a bug report, include:

- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser/OS details
- Logs or screenshots (if available)

## Suggesting features

Open an issue describing:

- The problem you want to solve
- Your proposed solution
- Any alternatives you considered

Thanks again for helping improve this project.
