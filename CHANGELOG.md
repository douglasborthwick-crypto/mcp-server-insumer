# Changelog

## 1.13.4 (2026-09-20)

- Aligns chain counts with the engine: 37 chains, 31 EVM; NFT ownership on 33. SKILL.md lists all 37, including Arc.
- Removes Moonbeam and Moonriver, which the engine retired on 2026-09-20. The merchant onboarding set is now 27 EVM chains.
- Clarifies that `decimals` on `insumer_attest` conditions is an optional cross-check: leave it out and the token's own decimals are read from the chain. A value that differs is rejected with a 400.
- Clarifies `contractAddress`: `native` is for `token_balance` and `ratio_to_amount` only, `nft_ownership` needs the NFT contract address, and native SUI is `0x2::sui::SUI`.
- Updates the Merkle proof wording: available on 27 of the 31 EVM chains (not ZKsync Era, Sei, Viction or XDC Network).
- Updates the SKILL.md `insumer_jwks` entry: five entries over two keys, matched by `kid` or `pqKid`.

## 1.13.3 (2026-09-02)

- Adds the post-quantum companion to the README: every attest and trust response since 2026-09-01 carries `pqSig`/`pqKid` beside `sig`/`kid`, and `pqJwt` beside `jwt`. The worked example now shows a P1363 `sig` and the companion fields.
- Enhances the signing note so the preimage matches the `kid` shown: `insumer-attest-v2` signs the domain-tagged canonical preimage; `insumer-attest-v1` signs bare insertion-order JSON.
- Enhances the `insumer_jwks` tool description and README entry: five JWKS entries over two keys (three EC kids, two RFC 9964 `AKP` kids), matched by `kid` or `pqKid`, never by position.
- Strengthens the verification guidance: `insumer-verify` 1.8.1+ reports five verdicts, the post-quantum companion being the fifth.
- Aligns `server.json` with the npm version so the MCP registry entry tracks the published package. SKILL.md lists all 38 chains.
