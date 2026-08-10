# Security Policy

## Supported versions

Security fixes are applied to the latest released version. Upgrade to the newest package version before you report a problem that is already fixed.

## Report a vulnerability

Do not open a public issue for an undisclosed vulnerability. Use the repository's [private vulnerability report](https://github.com/ne-ooo/neo.string-width/security/advisories/new).

Include the affected version, a minimal reproduction, the expected impact, and any suggested mitigation. Do not include real credentials or private user data.

## Supply-chain controls

- LPM installs use a committed lockfile with package integrity and registry signatures.
- Dependency lifecycle scripts are denied by default.
- New dependency releases must pass a three-day cooling-off period.
- Normal builds use committed Unicode 16 data and do not access the network.
- Unicode data maintenance downloads version-pinned files and verifies their SHA-256 checksums.
- Release candidates must pass `lpm run publish:check`.
- Package metadata requires LPM provenance for releases.
