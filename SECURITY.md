# Security policy

## Supported version

Security fixes are considered for the latest code on `main` and the latest published prerelease. Public alpha versions do not receive a guaranteed support window.

## Reporting a vulnerability

Please do not open a public issue for an unreleased vulnerability.

Use GitHub's private vulnerability reporting feature for this repository. If it is unavailable, contact the repository owner through their GitHub profile and ask for a private reporting channel without including exploit details in the first message.

Include:

- the affected commit or release;
- impact and prerequisites;
- minimal reproduction steps;
- whether secrets or private repository content are involved;
- any suggested mitigation.

We will acknowledge a complete report when the project is actively maintained. This experimental project does not promise a response SLA.

## Security boundaries

RepoCity analyzes local paths or public Git URLs. It does not intentionally execute code from the analyzed repository. Generated city bundles can contain paths, commit metadata, dependency facts, and knowledge text; inspect them before sharing.
