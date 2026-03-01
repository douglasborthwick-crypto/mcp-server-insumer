# mcp-server-insumer

MCP server for [InsumerAPI](https://insumermodel.com/developers/) -- on-chain verification across 32 blockchains. Returns ECDSA-signed booleans without exposing wallet balances. Up to 10 conditions per request, each with its own chainId. Optional Merkle storage proofs for trustless verification.

Enables AI agents (Claude Desktop, Cursor, Windsurf, and any MCP-compatible client) to autonomously verify on-chain conditions, discover merchants, generate signed discount codes, and onboard new merchants.

**In production:** [DJD Agent Score](https://github.com/jacobsd32-cpu/djdagentscore) (Coinbase x402 ecosystem) uses InsumerAPI for AI agent wallet trust scoring. [Case study](https://insumermodel.com/blog/djd-agent-score-insumer-api-integration.html).

Also available as: [LangChain](https://pypi.org/project/langchain-insumer/) (25 tools, PyPI) | [OpenAI GPT](https://chatgpt.com/g/g-699c5e43ce2481918b3f1e7f144c8a49-insumerapi-verify) (GPT Store) | [insumer-verify](https://www.npmjs.com/package/insumer-verify) (client-side verification, npm)

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

1. Go to [insumermodel.com/developers](https://insumermodel.com/developers/#pricing)
2. Sign up for a free key (instant, no credit card)
3. Set it as `INSUMER_API_KEY`

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

## Verify the Response

Your agent gets the attestation. Your application should verify it. Install [insumer-verify](https://www.npmjs.com/package/insumer-verify):

```bash
npm install insumer-verify
```

```typescript
import { verifyAttestation } from "insumer-verify";

// attestationResponse = the JSON your agent received from insumer_attest
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

## Tools (25)

### Key Discovery (free)

| Tool | Description |
|------|-------------|
| `insumer_jwks` | Get the JWKS containing InsumerAPI's ECDSA P-256 public signing key. Use the `kid` from attestation responses to match the correct key. |

### On-Chain Verification (cost credits)

| Tool | Description |
|------|-------------|
| `insumer_attest` | Verify on-chain conditions (token balances, NFT ownership, EAS attestations, Farcaster identity). Returns ECDSA-signed boolean with `kid`, `evaluatedCondition`, `conditionHash` (SHA-256), and `blockNumber`/`blockTimestamp`. 1 credit. Optional `proof: "merkle"` for EIP-1186 Merkle storage proofs (2 credits). |
| `insumer_compliance_templates` | List available EAS compliance templates (Coinbase Verifications on Base, Gitcoin Passport on Optimism). Free. |
| `insumer_wallet_trust` | Generate ECDSA-signed wallet trust fact profile. 17 checks across stablecoins, governance, NFTs, and staking. 3 credits (6 with merkle). |
| `insumer_batch_wallet_trust` | Batch trust profiles for up to 10 wallets. Shared block fetches, 5-8x faster. Partial success supported. 3 credits/wallet (6 with merkle). |
| `insumer_verify` | Create signed discount code (INSR-XXXXX, 30-min expiry) for a wallet at a merchant. 1 merchant credit. |

### Discovery (free)

| Tool | Description |
|------|-------------|
| `insumer_list_merchants` | Browse the merchant directory. Filter by token, verification status. |
| `insumer_get_merchant` | Get full public merchant profile. |
| `insumer_list_tokens` | List all registered tokens and NFTs. Filter by chain, symbol, type. |
| `insumer_check_discount` | Calculate discount for a wallet at a merchant. |

### Credits

| Tool | Description |
|------|-------------|
| `insumer_credits` | Check credit balance and tier. |
| `insumer_buy_credits` | Buy verification credits with USDC (25 credits / 1 USDC). |
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
| `insumer_buy_merchant_credits` | Buy merchant verification credits with USDC. |

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

## Supported Chains (32)

**EVM**: Ethereum, BNB Chain, Base, Avalanche, Polygon, Arbitrum, Optimism, Chiliz, Soneium, Plume, Sonic, Gnosis, Mantle, Scroll, Linea, zkSync Era, Blast, Taiko, Ronin, Celo, Moonbeam, Moonriver, Viction, opBNB, World Chain, Unichain, Ink, Sei, Berachain, ApeChain

**Non-EVM**: Solana, XRPL (XRP Ledger — native XRP, trust line tokens, NFTs)

## Development

```bash
npm install
npm run build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node build/index.js
```

## License

MIT
