# Security Policy

## Supported Versions

This project currently supports the latest code on the `main` branch.

## Reporting a Vulnerability

Please do not open public GitHub issues for security vulnerabilities.

Report vulnerabilities privately by using GitHub Security Advisories:

1. Open the repository Security tab.
2. Select **Report a vulnerability**.
3. Include reproduction details, impact, and suggested mitigation if available.

You can also contact the maintainer through GitHub profile contact options if needed.

## Current Mitigations

- CI runs lint and production build checks on every pull request and push to `main`.
- CodeQL SAST runs on pull requests, pushes to `main`, and on a weekly schedule.
- GitHub Actions are pinned to immutable commit SHAs where configured.
