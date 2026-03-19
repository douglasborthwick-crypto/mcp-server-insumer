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

Privacy-preserving on-chain token and NFT verification across 32 blockchains (30 EVM + Solana + XRPL). Returns ECDSA-signed boolean results — no raw balances exposed.

**Version**: 1.8.5

## Overview

InsumerAPI enables agents to verify on-chain credentials without handling private keys or raw balance data. Every response is ECDSA P-256 signed and independently verifiable.

Agents can:
- Verify token balances, NFT ownership, EAS attestations, and Farcaster identity
- Check multiple conditions in a single call (1-10)
- Get optional Merkle storage proofs for trustless verification
- Generate wallet trust fact profiles (single or batch)
- Discover merchants and generate signed discount codes
- Onboard and configure merchants end-to-end
- Buy API keys and credits with USDC (no auth required)
- Integrate with ACP (OpenAI/Stripe) and UCP (Google) commerce protocols

## Setup

### 1. Get an API Key
Use the `insumer_setup` tool with your email — or sign up at [insumermodel.com/developers](https://insumermodel.com/developers/#pricing). Free tier available (instant, no credit card).

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

## Tools (26)

### Setup (free, no auth)

#### `insumer_setup(email, appName?)`
Generate a free InsumerAPI key instantly. Returns an `insr_live_...` key with 10 credits and 100 calls/day. No credit card required. One free key per email, 3 per IP per day.

### Key Discovery (free)

#### `insumer_jwks()`
Get the JWKS containing InsumerAPI's ECDSA P-256 public signing key (RFC 7517). Use the `kid` from attestation responses to match the correct key. No authentication required.

### On-Chain Verification

#### `insumer_attest(wallet?, solanaWallet?, xrplWallet?, conditions, proof?, format?)`
Verify 1-10 on-chain conditions (token balances, NFT ownership, EAS attestations, Farcaster identity) across 32 chains. Returns ECDSA-signed boolean results with `evaluatedCondition`, `conditionHash` (SHA-256), and `blockNumber`/`blockTimestamp`. 1 credit (2 with `proof: "merkle"` for EIP-1186 Merkle storage proofs). Optional `format: "jwt"` for ES256-signed JWT output.

#### `insumer_compliance_templates()`
List available EAS compliance templates (Coinbase Verifications on Base, Gitcoin Passport on Optimism). Pre-configured schema IDs, attester addresses, and decoder contracts. Free, no auth.

#### `insumer_wallet_trust(wallet, solanaWallet?, xrplWallet?, proof?)`
Generate an ECDSA-signed wallet trust fact profile. 17 base checks (up to 20 with Solana + XRPL) across stablecoins, governance tokens, NFTs, and staking. 3 credits (6 with merkle).

#### `insumer_batch_wallet_trust(wallets, proof?)`
Batch trust profiles for up to 10 wallets. Shared block fetches, 5-8x faster than sequential calls. Partial success supported. 3 credits/wallet (6 with merkle).

#### `insumer_verify(merchantId, wallet?, solanaWallet?, xrplWallet?)`
Create a signed discount code (INSR-XXXXX, 30-min expiry) for a wallet at a merchant. Returns tier and discount percentage. 1 merchant credit.

### Discovery (free)

#### `insumer_list_merchants(token?, verified?, limit?, offset?)`
Browse the merchant directory. Filter by accepted token symbol, verification status. Returns company name, website, tokens accepted, and discount info.

#### `insumer_get_merchant(id)`
Get full public merchant profile including token tiers, NFT collections, discount mode, and verification status.

#### `insumer_list_tokens(chain?, symbol?, type?)`
List all registered tokens and NFT collections in the registry. Filter by chain ID, symbol, or asset type (token/nft).

#### `insumer_check_discount(merchant, wallet?, solanaWallet?, xrplWallet?)`
Calculate discount for a wallet at a merchant. Returns tier and discount percentage per token. Free, no credits consumed.

### Credits & Keys

#### `insumer_credits()`
Check verification credit balance, tier (free/pro/enterprise), and daily rate limit for the current API key.

#### `insumer_buy_key(txHash, chainId, amount, appName)`
Buy a new API key with USDC (no auth required). Send USDC, then call with the transaction hash. Sender wallet becomes the key's identity. One key per wallet. Supported chains: Ethereum, Base, Polygon, Arbitrum, Optimism, BNB Chain, Avalanche, Solana. Minimum $5. Non-refundable.

#### `insumer_buy_credits(txHash, chainId, amount, updateWallet?)`
Buy verification credits with USDC. Volume discounts: $5-$99 = $0.04/call, $100-$499 = $0.03, $500+ = $0.02. Minimum $5. Supported chains: Ethereum, Base, Polygon, Arbitrum, Optimism, BNB Chain, Avalanche, Solana. Non-refundable.

#### `insumer_confirm_payment(code, txHash, chainId, amount)`
Confirm USDC payment for a discount code. After calling `insumer_verify`, confirm the on-chain USDC payment. The server verifies the transaction receipt.

### Merchant Onboarding (owner-only)

#### `insumer_create_merchant(companyName, companyId, location?)`
Create a new merchant. Receives 100 free verification credits. Max 10 merchants per API key.

#### `insumer_merchant_status(id)`
Get full private merchant details: credits, token configs, NFT collections, directory status, verification status, USDC settings.

#### `insumer_configure_tokens(id, ownToken?, partnerTokens?)`
Configure merchant token discount tiers. Set own token and/or partner tokens. Max 8 tokens total.

#### `insumer_configure_nfts(id, nftCollections)`
Configure NFT collections that grant discounts. Max 4 collections.

#### `insumer_configure_settings(id, discountMode?, discountCap?, usdcPayment?)`
Update merchant settings: discount stacking mode (highest/stack), cap, and USDC payment configuration.

#### `insumer_publish_directory(id)`
Publish (or refresh) the merchant's listing in the public directory.

#### `insumer_buy_merchant_credits(id, txHash, chainId, amount, updateWallet?)`
Buy merchant verification credits with USDC. Same volume discounts as `insumer_buy_credits`.

### Domain Verification (owner-only)

#### `insumer_request_domain_verification(id, domain)`
Request a verification token for a merchant's domain. Returns the token and three methods: DNS TXT record, HTML meta tag, or file upload.

#### `insumer_verify_domain(id)`
Complete domain verification after placing the token. Verified merchants get a trust badge in the public directory. Rate limited to 5 attempts per hour.

### Commerce Protocol Integration

#### `insumer_acp_discount(merchantId, wallet?, solanaWallet?, xrplWallet?, items?)`
Check discount eligibility in OpenAI/Stripe Agentic Commerce Protocol (ACP) format. Returns coupon objects, applied/rejected arrays, and per-item allocations. 1 merchant credit.

#### `insumer_ucp_discount(merchantId, wallet?, solanaWallet?, xrplWallet?, items?)`
Check discount eligibility in Google Universal Commerce Protocol (UCP) format. Returns title, extension field, and applied array. 1 merchant credit.

#### `insumer_validate_code(code)`
Validate an INSR-XXXXX discount code. Returns validity, discount percent, and expiry. Free, no auth required.

## Supported Chains (32)

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
