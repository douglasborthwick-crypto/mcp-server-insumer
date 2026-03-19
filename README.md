# mcp-server-insumer

[![npm](https://img.shields.io/npm/v/mcp-server-insumer)](https://www.npmjs.com/package/mcp-server-insumer) [![Glama](https://glama.ai/mcp/servers/@douglasborthwick-crypto/mcp-server-insumer/badge)](https://glama.ai/mcp/servers/@douglasborthwick-crypto/mcp-server-insumer) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for [The Insumer Model](https://insumermodel.com/developers/) — read-first blockchain verification infrastructure that returns ECDSA-signed, privacy-preserving booleans across 32 chains without exposing wallet balances or requiring trust in the API provider.

Enables AI agents (Claude Desktop, Cursor, Windsurf, and any MCP-compatible client) to autonomously verify on-chain conditions, discover merchants, generate signed discount codes, and onboard new merchants. Not a loyalty program. Not a reputation network. Not an identity system.

**In production:** [DJD Agent Score](https://github.com/jacobsd32-cpu/djdagentscore) (Coinbase x402 ecosystem) uses InsumerAPI for AI agent wallet trust scoring. [Case study](https://insumermodel.com/blog/djd-agent-score-insumer-api-integration.html).

Also available as: [LangChain](https://pypi.org/project/langchain-insumer/) (26 tools, PyPI) | [langchain-community](https://github.com/langchain-ai/langchain/pull/549) (26 tools, PR #549) | [ElizaOS](https://www.npmjs.com/package/eliza-plugin-insumer) (10 actions, npm) | [OpenAI GPT](https://chatgpt.com/g/g-699c5e43ce2481918b3f1e7f144c8a49-insumerapi-verify) (GPT Store) | [insumer-verify](https://www.npmjs.com/package/insumer-verify) (client-side verification, npm)

**[Full AI Agent Verification API guide](https://insumermodel.com/ai-agent-verification-api/)** — covers all 32 chains, trust profiles, commerce protocols, and signature verification.

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

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

### Cursor / Windsurf

Add to your MCP settings:

```json
{
  "insumer": {
    "command": "npx",
    "args": ["-y", "mcp-server-insumer"],
    "env": {
      "INSUMER_API_KEY": "insr_live_..."
    }
  }
}
```

### Get an API Key

**Option A — Let your agent do it:** Start the server without a key. Your AI agent can call the `insumer_setup` tool with your email to generate a free key instantly. Add it to your config and restart.

**Option B — Terminal (no browser needed):**

```bash
curl -s -X POST https://us-central1-insumer-merchant.cloudfunctions.net/createDeveloperApiKey \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "appName": "MCP Server", "tier": "free"}' | jq .
```

Returns an `insr_live_...` key with 10 credits and 100 calls/day. One free key per email.

**Option C — Browser:** Go to [insumermodel.com/developers](https://insumermodel.com/developers/#pricing) and generate a free key instantly.

Set it as `INSUMER_API_KEY` in your config.

## What You Get Back

When your agent calls `insumer_attest`, you get an ECDSA-signed attestation:

```json
{
  "ok": true,
  "data": {
    "attestation": {
      "id": "ATST-A7C3E",
      "pass": true,
      "results": [
        {
          "condition": 0,
          "met": true,
          "label": "USDC >= 1000 on Ethereum",
          "type": "token_balance",
          "chainId": 1,
          "evaluatedCondition": {
            "chainId": 1,
            "contractAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            "decimals": 6,
            "operator": "gte",
            "threshold": 1000,
            "type": "token_balance"
          },
          "conditionHash": "0x8a3b...",
          "blockNumber": "0x129e3f7",
          "blockTimestamp": "2026-02-28T12:34:56.000Z"
        }
      ],
      "passCount": 1,
      "failCount": 0,
      "attestedAt": "2026-02-28T12:34:57.000Z",
      "expiresAt": "2026-02-28T13:04:57.000Z"
    },
    "sig": "MEUCIQD...(base64 ECDSA signature)...",
    "kid": "insumer-attest-v1"
  },
  "meta": {
    "version": "1.0",
    "timestamp": "2026-02-28T12:34:57.000Z",
    "creditsCharged": 1,
    "creditsRemaining": 99
  }
}
```

The `sig` is an ECDSA P-256 signature over `{id, pass, results, attestedAt}`. The `kid` identifies which key signed it. The `conditionHash` is a SHA-256 of the exact condition logic that was evaluated.

No balances. No amounts. Just a cryptographically signed true/false.

For XRPL conditions, results include `ledgerIndex`, `ledgerHash` (validated ledger hash), and `trustLineState: { frozen: boolean }` instead of `blockNumber`/`blockTimestamp`. Native XRP conditions include `ledgerIndex` and `ledgerHash` but not `trustLineState`. Frozen trust lines cause `met: false`.

### Wallet Auth (JWT)

Add `format: "jwt"` to the `insumer_attest` tool parameters to receive the attestation as a standard JWT bearer token:

```json
{
  "wallet": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "conditions": [ ... ],
  "format": "jwt"
}
```

The response includes an additional `jwt` field containing an ES256-signed JWT. This token is verifiable by any standard JWT library via the JWKS endpoint at `GET /v1/jwks` — making it compatible with Kong, Nginx, Cloudflare Access, AWS API Gateway, and other middleware that accepts JWT bearer tokens.

## Verify the Response

Your agent gets the attestation. Your application should verify it. Install [insumer-verify](https://www.npmjs.com/package/insumer-verify):

```bash
npm install insumer-verify
```

```typescript
import { verifyAttestation } from "insumer-verify";

// attestationResponse = the full API envelope {ok, data: {attestation, sig, kid}, meta}
// Do NOT pass attestationResponse.data — the function expects the outer envelope
const result = await verifyAttestation(attestationResponse, {
  jwksUrl: "https://insumermodel.com/.well-known/jwks.json",
  maxAge: 120, // reject if block data is older than 2 minutes
});

if (result.valid) {
  // Signature verified, condition hashes match, not expired
  const pass = attestationResponse.data.attestation.pass;
  console.log(`Attestation ${pass ? "passed" : "failed"} all conditions`);
} else {
  console.log("Verification failed:", result.checks);
}
```

This runs 4 independent checks: ECDSA signature, condition hash integrity, block freshness, and attestation expiry. Zero runtime dependencies, uses Web Crypto API.

## Tools (26)

### Setup (free, no auth)

| Tool | Description |
|------|-------------|
| `insumer_setup` | Generate a free API key instantly. Takes an email, returns an `insr_live_...` key with 10 credits. No credit card required. |

### Key Discovery (free)

| Tool | Description |
|------|-------------|
| `insumer_jwks` | Get the JWKS containing InsumerAPI's ECDSA P-256 public signing key. Use the `kid` from attestation responses to match the correct key. |

### On-Chain Verification (cost credits)

| Tool | Description |
|------|-------------|
| `insumer_attest` | Verify on-chain conditions (token balances, NFT ownership, EAS attestations, Farcaster identity). Returns ECDSA-signed boolean with `kid`, `evaluatedCondition`, `conditionHash` (SHA-256), and `blockNumber`/`blockTimestamp`. 1 credit. Optional `proof: "merkle"` for EIP-1186 Merkle storage proofs (2 credits). |
| `insumer_compliance_templates` | List available EAS compliance templates (Coinbase Verifications on Base, Gitcoin Passport on Optimism). Free. |
| `insumer_wallet_trust` | Generate ECDSA-signed wallet trust fact profile. 17 base checks (up to 20 with optional Solana + XRPL) across stablecoins, governance, NFTs, staking, and cross-chain positions. 3 credits (6 with merkle). |
| `insumer_batch_wallet_trust` | Batch trust profiles for up to 10 wallets. Each wallet object supports optional `solanaWallet` and `xrplWallet`. Shared block fetches, 5-8x faster. Partial success supported. 3 credits/wallet (6 with merkle). |
| `insumer_verify` | Create signed discount code (INSR-XXXXX, 30-min expiry) for a wallet at a merchant. 1 merchant credit. |

### Discovery (free)

| Tool | Description |
|------|-------------|
| `insumer_list_merchants` | Browse the merchant directory. Filter by token, verification status. |
| `insumer_get_merchant` | Get full public merchant profile. |
| `insumer_list_tokens` | List all registered tokens and NFTs. Filter by chain, symbol, type. |
| `insumer_check_discount` | Calculate discount for a wallet at a merchant. |

### Credits & Keys

| Tool | Description |
|------|-------------|
| `insumer_buy_key` | Buy a new API key with USDC (no auth required). Agent-friendly: no email needed, sender wallet becomes the key's identity. One key per wallet. Volume discounts: $0.04–$0.02/call. Supported chains: Ethereum, Base, Polygon, Arbitrum, Optimism, BNB Chain, Avalanche, Solana. Non-refundable. |
| `insumer_credits` | Check credit balance and tier. |
| `insumer_buy_credits` | Buy verification credits with USDC. Volume discounts: $0.04–$0.02/call. Supported chains: Ethereum, Base, Polygon, Arbitrum, Optimism, BNB Chain, Avalanche, Solana. Non-refundable. First purchase registers sender wallet; subsequent purchases must match or include `updateWallet: true`. |
| `insumer_confirm_payment` | Confirm USDC payment for a discount code. |

### Merchant Onboarding (owner-only)

| Tool | Description |
|------|-------------|
| `insumer_create_merchant` | Create new merchant. Receives 100 free credits. |
| `insumer_merchant_status` | Get full private merchant details. |
| `insumer_configure_tokens` | Set token discount tiers. |
| `insumer_configure_nfts` | Set NFT collection discounts. |
| `insumer_configure_settings` | Set discount mode, cap, USDC payments. |
| `insumer_publish_directory` | Publish merchant to public directory. |
| `insumer_buy_merchant_credits` | Buy merchant verification credits with USDC. Volume discounts: $0.04–$0.02/call. Owner only. Non-refundable. First purchase registers sender wallet; subsequent purchases must match or include `updateWallet: true`. |

### Domain Verification (owner-only)

| Tool | Description |
|------|-------------|
| `insumer_request_domain_verification` | Request a verification token for a merchant's domain. Returns token and 3 methods (DNS TXT, meta tag, file upload). |
| `insumer_verify_domain` | Complete domain verification after placing the token. Verified merchants get a trust badge. |

### Commerce Protocol Integration

| Tool | Description |
|------|-------------|
| `insumer_acp_discount` | Check discount eligibility in OpenAI/Stripe ACP format. Returns coupon objects and per-item allocations. 1 merchant credit. |
| `insumer_ucp_discount` | Check discount eligibility in Google UCP format. Returns title, extension field, and applied array. 1 merchant credit. |
| `insumer_validate_code` | Validate an INSR-XXXXX discount code. Returns validity, discount percent, expiry. Free, no auth. |

## Pricing

**Tiers:** Free (10 credits) | Pro $9/mo (10,000/day) | Enterprise $29/mo (100,000/day)

**USDC volume discounts:** $5–$99 = $0.04/call (25 credits/$1) · $100–$499 = $0.03 (33/$1, 25% off) · $500+ = $0.02 (50/$1, 50% off)

**Platform wallets (USDC only):**
- **EVM:** `0xAd982CB19aCCa2923Df8F687C0614a7700255a23`
- **Solana:** `6a1mLjefhvSJX1sEX8PTnionbE9DqoYjU6F6bNkT4Ydr`

**Supported USDC chains:** Ethereum, Base, Polygon, Arbitrum, Optimism, BNB Chain, Avalanche, Solana. USDC sent on unsupported chains cannot be recovered. All purchases are final and non-refundable. [Full pricing →](https://insumermodel.com/pricing/)

## Handling `rpc_failure` Errors

If the API cannot reach one or more blockchain data sources after retries, endpoints that produce signed attestations (`insumer_attest`, `insumer_trust`, `insumer_trust_batch`) return `ok: false` with error code `rpc_failure`. No signature, no JWT, no credits charged. This is a retryable error — the MCP client should retry after a short delay (2-5 seconds).

**Important:** `rpc_failure` is NOT a verification failure. Do not treat it as `pass: false`. It means the data source was temporarily unavailable and the API refused to sign an unverified result.

## Supported Chains (32)

30 EVM chains + Solana + XRP Ledger. Includes Ethereum, Base, Polygon, Arbitrum, Optimism, BNB Chain, Avalanche, and 23 more. [Full list →](https://insumermodel.com/developers/api-reference/)

## Development

```bash
npm install
npm run build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node build/index.js
```

## License

MIT

---

If you find this useful, please star the repo — it helps others discover it.
