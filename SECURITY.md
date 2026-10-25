# Security

## Reporting a vulnerability

Do not open a public issue for a security problem. Use GitHub's private
vulnerability reporting:

<https://github.com/M4Marvin/charon/security/advisories/new>

Include:

- the affected version or commit;
- steps to reproduce;
- what an attacker can do;
- any suggested fix.

You will get an acknowledgement within 7 days. Please give me a reasonable
window to fix the issue before publishing details.

## Scope

In scope:

- the app server, authentication, session handling, and setup flow;
- file uploads and image serving;
- provider-key storage and encryption;
- the Docker image and install scripts;
- anything that lets one user read or change another user's data.

Out of scope:

- vulnerabilities in AI providers, local model servers, or the models
  themselves;
- malicious character cards or world-info files that only affect the person
  who imported them;
- denial of service caused by exposing the app to the public internet without
  a reverse proxy, TLS, or rate limiting.

## Supported versions

The latest GitHub release and the current `main` branch.

## Deployment note

Charon is single-user and binds to loopback by default. It is not designed to
be exposed directly to the public internet. If you publish it, put it behind
TLS and authentication you control, and do not share the owner account.
