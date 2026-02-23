# mcp-server-insumer

MCP server for [InsumerAPI](https://insumermodel.com/developers/) — privacy-preserving on-chain verification and attestation across 31 blockchains.

Enables AI agents (Claude Desktop, Cursor, Windsurf, and any MCP-compatible client) to autonomously verify on-chain conditions, discover merchants, generate signed discount codes, and onboard new merchants — with no balances or private data revealed.

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

## Tools (16)

### On-Chain Verification (cost credits)

| Tool | Description |
|------|-------------|
| `insumer_attest` | Verify arbitrary on-chain conditions (token balances, NFT ownership, multi-chain logic). Returns ECDSA-signed boolean — no balances revealed. 1 credit. |
| `insumer_verify` | Create signed discount code (INSR-XXXXX, 30-min expiry) for a wallet at a merchant. 1 credit. |

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
