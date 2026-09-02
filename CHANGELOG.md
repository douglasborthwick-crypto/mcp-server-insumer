# Changelog

## 1.13.3 (2026-09-02)

- Adds the post-quantum companion to the README: every attest and trust response since 2026-09-01 carries `pqSig`/`pqKid` beside `sig`/`kid`, and `pqJwt` beside `jwt`. The worked example now shows a P1363 `sig` and the companion fields.
- Enhances the signing note so the preimage matches the `kid` shown: `insumer-attest-v2` signs the domain-tagged canonical preimage; `insumer-attest-v1` signs bare insertion-order JSON.
- Enhances the `insumer_jwks` tool description and README entry: five JWKS entries over two keys (three EC kids, two RFC 9964 `AKP` kids), matched by `kid` or `pqKid`, never by position.
- Strengthens the verification guidance: `insumer-verify` 1.8.1+ reports five verdicts, the post-quantum companion being the fifth.
- Aligns `server.json` with the npm version so the MCP registry entry tracks the published package. SKILL.md lists all 38 chains.
