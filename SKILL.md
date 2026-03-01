---
name: insumer-verify
description: Privacy-preserving on-chain token verification across 32 blockchains. Verify wallet holdings with ECDSA-signed proofs — no balances exposed.
homepage: https://insumermodel.com/developers/
metadata:
  clawdbot:
    requires:
      env: ["INSUMER_API_KEY"]
      bins: ["npx"]
    install: ["npx -y mcp-server-insumer"]
---

# InsumerAPI Verification Skill

Privacy-preserving on-chain token and NFT verification across 30 EVM chains + Solana + XRPL. Returns ECDSA-signed boolean results — no raw balances exposed.

**Version**: 1.0.0

## Overview

InsumerAPI enables agents to verify on-chain credentials without handling private keys or raw balance data. Every response is ECDSA P-256 signed and independently verifiable.

Agents can:
- Verify token balances meet thresholds (ERC-20, SPL)
- Verify NFT ownership (ERC-721, ERC-1155)
- Check multiple conditions in a single call
- Get optional Merkle storage proofs for trustless verification
- Discover merchants accepting token-based discounts
- Generate signed discount codes for verified wallets

## Setup

### 1. Get an API Key
Sign up at [insumermodel.com/developers](https://insumermodel.com/developers/#pricing) — free tier available (instant, no credit card).

### 2. Environment Variables
```bash
export INSUMER_API_KEY="insr_live_..."
```

### 3. MCP Configuration
```json
{
  "mcpServers": {
    "insumer": {
      "command": "npx",
      "args": ["-y", "mcp-server-insumer"],
      "env": {
        "INSUMER_API_KEY": "insr_live_..."
      }
    }
  }
}
```

## Functions

### Verification

#### `insumer_attest(wallet, conditions)`
Verify on-chain token holdings. Returns boolean results with ECDSA signature. No balances exposed.
```
insumer_attest("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", [
  { "type": "token_balance", "contractAddress": "0xA0b8...", "chainId": 1, "threshold": 100 }
])
// → { pass: true, sig: "base64...", kid: "insumer-attest-v1" }
```

#### `insumer_attest_merkle(wallet, conditions)`
Same as attest but includes EIP-1186 Merkle storage proofs verifiable against public block headers. No trust in any third party required.

#### `insumer_verify_attestation(attestation)`
Independently verify an attestation response: ECDSA signature, condition hash, block freshness, expiry.

### NFT Verification

#### `insumer_check_nft(wallet, contractAddress, chainId)`
Check if a wallet owns any NFT from a specific collection.

#### `insumer_check_nft_specific(wallet, contractAddress, tokenId, chainId)`
Check ownership of a specific NFT token ID.

### Key Discovery

#### `insumer_jwks()`
Get the JWKS containing InsumerAPI's ECDSA P-256 public signing key (RFC 7517). For independent signature verification.

### Merchant Operations

#### `insumer_list_merchants()`
List all merchants accepting token-based discounts.

#### `insumer_get_merchant(merchantId)`
Get merchant details including accepted tokens and discount tiers.

#### `insumer_check_discount(wallet, merchantId)`
Check what discount a wallet qualifies for at a specific merchant.

#### `insumer_generate_code(wallet, merchantId)`
Generate a signed, time-limited discount code for a verified wallet.

### Chain Information

#### `insumer_supported_chains()`
List all 32 supported chains with chain IDs and RPC status.

#### `insumer_chain_details(chainId)`
Get details for a specific chain including supported token standards.

## Supported Chains (30 EVM + Solana + XRPL)

Ethereum, Base, Polygon, Arbitrum, Optimism, BNB Chain, Avalanche, Sonic, Gnosis, Mantle, Scroll, Linea, zkSync Era, Blast, Taiko, Ronin, Celo, Moonbeam, Moonriver, Viction, opBNB, World Chain, Unichain, Ink, Sei, Berachain, ApeChain, Chiliz, Soneium, Plume, Solana, XRPL.

## Security Model

- **No private keys required** — read-only verification, never handles signing keys
- **No balances exposed** — boolean results only (pass/fail), raw amounts never returned
- **ECDSA P-256 signatures** — every response cryptographically signed
- **JWKS key discovery** — public key at [/.well-known/jwks.json](https://insumermodel.com/.well-known/jwks.json) (RFC 7517)
- **Optional Merkle proofs** — EIP-1186 storage proofs for trustless verification against block headers
- **Independent verification** — [`insumer-verify`](https://www.npmjs.com/package/insumer-verify) (npm, zero deps) checks signature, condition hash, block freshness, expiry

## Links

- Homepage: https://insumermodel.com/developers/
- MCP Server: https://www.npmjs.com/package/mcp-server-insumer
- OpenAPI Spec: https://insumermodel.com/openapi.yaml
- GitHub: https://github.com/douglasborthwick-crypto/mcp-server-insumer
- Verifier: https://www.npmjs.com/package/insumer-verify
