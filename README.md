# mcp-server-insumer

MCP server for [InsumerAPI](https://insumermodel.com/developers/) -- on-chain verification across 31 blockchains. Returns ECDSA-signed booleans without exposing wallet balances. Up to 10 conditions per request, each with its own chainId. Optional Merkle storage proofs for trustless verification.

Enables AI agents (Claude Desktop, Cursor, Windsurf, and any MCP-compatible client) to autonomously verify on-chain conditions, discover merchants, generate signed discount codes, and onboard new merchants.

**In production:** [DJD Agent Score](https://github.com/jacobsd32-cpu/djdagentscore) (Coinbase x402 ecosystem) uses InsumerAPI for AI agent wallet trust scoring. [Case study](https://insumermodel.com/blog/djd-agent-score-insumer-api-integration.html).

Also available as: [LangChain](https://pypi.org/project/langchain-insumer/) (23 tools, PyPI) | [OpenAI GPT](https://chatgpt.com/g/g-699c5e43ce2481918b3f1e7f144c8a49-insumerapi-verify) (GPT Store) | [insumer-verify](https://www.npmjs.com/package/insumer-verify) (client-side verification, npm)

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

## Get an API Key

1. Go to [insumermodel.com/developers](https://insumermodel.com/developers/#pricing)
2. Sign up for a free key (instant, no credit card)
3. Set it as `INSUMER_API_KEY`

## Tools (23)

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

### Commerce Protocol Integration

| Tool | Description |
|------|-------------|
| `insumer_acp_discount` | Check discount eligibility in OpenAI/Stripe ACP format. Returns coupon objects and per-item allocations. 1 merchant credit. |
| `insumer_ucp_discount` | Check discount eligibility in Google UCP format. Returns title, extension field, and applied array. 1 merchant credit. |
| `insumer_validate_code` | Validate an INSR-XXXXX discount code. Returns validity, discount percent, expiry. Free, no auth. |

## Supported Chains (31)

**EVM**: Ethereum, BNB Chain, Base, Avalanche, Polygon, Arbitrum, Optimism, Chiliz, Soneium, Plume, Sonic, Gnosis, Mantle, Scroll, Linea, zkSync Era, Blast, Taiko, Ronin, Celo, Moonbeam, Moonriver, Viction, opBNB, World Chain, Unichain, Ink, Sei, Berachain, ApeChain

**Non-EVM**: Solana

## Example Agent Workflow

```
1. insumer_list_merchants → find merchants accepting UNI
2. insumer_check_discount → calculate discount for user's wallet
3. insumer_verify → generate discount code
4. insumer_confirm_payment → confirm USDC payment (if applicable)
```

## Development

```bash
npm install
npm run build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node build/index.js
```

## License

MIT
