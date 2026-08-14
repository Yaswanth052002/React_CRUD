---
name: changelog-and-release-notes
description: Keep-a-Changelog format, semver guidance, and release-note tone-of-voice for internal vs external audiences.
when_to_use: Cutting a release or updating CHANGELOG.md.
user-invocable: false
allowed-tools: Read Write Edit
---
# Changelog and Release Notes

## CHANGELOG.md format

Follow keepachangelog.com:

```
## [Unreleased]

### Added
- …

### Changed
- …

### Deprecated
- …

### Removed
- …

### Fixed
- …

### Security
- …
```

## Semver

- MAJOR: breaking change to a contract that downstream code observes.
- MINOR: new functionality, backwards compatible.
- PATCH: bug fixes only.
- Pre-release: `1.2.0-rc.1`, `1.2.0-beta.3`.

## Release notes

- **Internal** (engineering / ops): exact behavior change, migration steps, rollback.
- **External** (users): outcome-focused, jargon-free, screenshot or example if visual.
- One section per audience. Don't mix.
