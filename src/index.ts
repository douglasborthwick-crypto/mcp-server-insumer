#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://api.insumermodel.com/v1";

const apiKey = process.env.INSUMER_API_KEY ?? "";
if (!apiKey) {
  console.error("Warning: INSUMER_API_KEY not set. Tools requiring authentication will return errors.");
}

// --- Shared API helper ---

async function apiCall(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; data?: unknown; error?: unknown; meta?: unknown }> {
  if (!apiKey) {
    return { ok: false, error: "INSUMER_API_KEY environment variable is not set. Get a free key at https://insumermodel.com/developers/" };
  }
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<{
    ok: boolean;
    data?: unknown;
    error?: unknown;
    meta?: unknown;
  }>;
}

function formatResult(result: {
  ok: boolean;
  data?: unknown;
  error?: unknown;
  meta?: unknown;
}) {
  if (result.ok) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    isError: true,
  };
}

// --- Reusable Zod schemas ---

const ChainId = z
  .union([
    z.number().int().describe("EVM chain ID"),
    z.literal("solana"),
    z.literal("xrpl"),
  ])
  .describe("Chain identifier: EVM chain ID (integer), 'solana', or 'xrpl'");

const OnboardingChainId = z
  .union([
    z.enum(["1", "56", "8453", "43114", "137", "42161", "10", "88888", "1868", "98866", "480"]).transform(Number),
    z.number().int().refine(
      (n) => [1, 56, 8453, 43114, 137, 42161, 10, 88888, 1868, 98866, 480].includes(n),
      "Must be a supported onboarding chain"
    ),
    z.literal("solana"),
    z.literal("xrpl"),
  ])
  .describe("Onboarding chain: 1, 56, 8453, 43114, 137, 42161, 10, 88888, 1868, 98866, 480, 'solana', or 'xrpl'");

const UsdcChainId = z
  .union([
    z.enum(["1", "8453", "137", "42161", "10", "56", "43114"]).transform(Number),
    z.number().int().refine(
      (n) => [1, 8453, 137, 42161, 10, 56, 43114].includes(n),
      "Must be a supported USDC chain"
    ),
    z.literal("solana"),
    z.literal("xrpl"),
  ])
  .describe("USDC chain: 1, 8453, 137, 42161, 10, 56, 43114, 'solana', or 'xrpl'");

const TierSchema = z.object({
  name: z.string().max(30).describe("Tier name, e.g. 'Gold', 'Silver'"),
  threshold: z.number().positive().describe("Minimum token balance for this tier"),
  discount: z.number().int().min(1).max(50).describe("Discount percentage (1-50)"),
});

const TokenConfigSchema = z.object({
  symbol: z.string().max(10).describe("Token symbol, e.g. 'UNI'"),
  chainId: OnboardingChainId,
  contractAddress: z.string().describe("Token contract address. For XRPL: use r-address issuer for trust line tokens, or 'native' for XRP."),
  decimals: z.number().int().min(0).max(18).optional().describe("Token decimals (0-18, default 18)"),
  currency: z.string().max(3).optional().describe("XRPL trust line currency code (e.g. 'USD' for RLUSD). Required for XRPL trust line tokens."),
  tiers: z.array(TierSchema).min(1).max(4).describe("1-4 discount tiers"),
});

const NftCollectionSchema = z.object({
  name: z.string().max(50).describe("NFT collection name"),
  contractAddress: z.string().describe("NFT contract address. For XRPL: use r-address of the NFT issuer."),
  taxon: z.number().int().optional().describe("XRPL NFT taxon for filtering by collection. Optional, XRPL only."),
  chainId: OnboardingChainId,
  discount: z.number().int().min(1).max(50).describe("Discount percentage (1-50)"),
});

// --- Server setup ---

const server = new McpServer({
  name: "insumer",
  version: "1.6.0",
});

// ============================================================
// KEY DISCOVERY
// ============================================================

server.tool(
  "insumer_jwks",
  "Get the JWKS (JSON Web Key Set) containing InsumerAPI's ECDSA P-256 public signing key. Use this to verify attestation signatures without hardcoding the key. The kid field in attestation responses identifies which key signed the response. No authentication required.",
  {},
  async () => {
    const res = await fetch(`${API_BASE}/jwks`);
    const data = await res.json();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  }
);

// ============================================================
// ON-CHAIN VERIFICATION
// ============================================================

server.tool(
  "insumer_attest",
  "Create on-chain verification (attestation). Verify 1-10 conditions (token balances, NFT ownership, EAS attestations, Farcaster identity) across 32 chains. Returns ECDSA-signed boolean results with a kid field identifying the signing key (fetch public key via insumer_jwks). Never exposes actual balances. Each result includes evaluatedCondition (exact logic checked), conditionHash (SHA-256 for tamper-evidence), and blockNumber/blockTimestamp for RPC chains (freshness). Standard mode costs 1 credit. Pass proof: 'merkle' for EIP-1186 Merkle storage proofs (2 credits). For EAS attestations, use a compliance template (Coinbase Verifications, Gitcoin Passport) or raw schemaId. For Farcaster, use type 'farcaster_id' (checks IdRegistry on Optimism). Use insumer_compliance_templates to list available templates.",
  {
    wallet: z.string().optional().describe("EVM wallet address (0x...)"),
    solanaWallet: z.string().optional().describe("Solana wallet address (base58)"),
    xrplWallet: z.string().optional().describe("XRPL wallet address (r-address). For verifying XRP, trust line tokens (RLUSD, USDC), or NFTs on XRP Ledger."),
    proof: z.enum(["merkle"]).optional().describe("Set to 'merkle' for EIP-1186 Merkle storage proofs (2 credits). Proofs available for token_balance on RPC chains only."),
    conditions: z
      .array(
        z.object({
          type: z.enum(["token_balance", "nft_ownership", "eas_attestation", "farcaster_id"]).describe("Condition type: token_balance, nft_ownership, eas_attestation, or farcaster_id (Farcaster IdRegistry on Optimism)"),
          contractAddress: z.string().optional().describe("Token or NFT contract address (required for token_balance and nft_ownership)"),
          chainId: ChainId.optional(),
          threshold: z.number().optional().describe("Minimum balance required (for token_balance)"),
          decimals: z.number().int().min(0).max(18).optional().describe("Token decimals (default 18)"),
          label: z.string().max(100).optional().describe("Human-readable label"),
          schemaId: z.string().optional().describe("EAS schema ID (bytes32 hex). Required for eas_attestation unless template is provided."),
          attester: z.string().optional().describe("Expected attester address (optional, for eas_attestation)"),
          indexer: z.string().optional().describe("EAS indexer contract address (optional, for eas_attestation)"),
          template: z.enum(["coinbase_verified_account", "coinbase_verified_country", "coinbase_one", "gitcoin_passport_score", "gitcoin_passport_active"]).optional().describe("Compliance template name. Use instead of raw schemaId/attester/indexer for eas_attestation. Gitcoin Passport templates check Sybil resistance on Optimism."),
        })
      )
      .min(1)
      .max(10)
      .describe("1-10 on-chain conditions to verify"),
  },
  async (args) => {
    const result = await apiCall("POST", "/attest", args);
    return formatResult(result);
  }
);

server.tool(
  "insumer_compliance_templates",
  "List available compliance templates for EAS attestation verification. Templates provide pre-configured schema IDs, attester addresses, and decoder contracts for KYC/identity providers (Coinbase Verifications on Base, Gitcoin Passport on Optimism). Use a template name in insumer_attest conditions instead of specifying raw EAS parameters. No authentication or credits required.",
  {},
  async () => {
    const url = `${API_BASE}/compliance/templates`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });
    const result = await res.json() as { ok: boolean; data?: unknown; error?: unknown; meta?: unknown };
    return formatResult(result);
  }
);

server.tool(
  "insumer_wallet_trust",
  "Generate a structured, ECDSA-signed wallet trust fact profile. Send a wallet address, get 17 base checks across stablecoins (USDC on 7 chains), governance tokens (UNI, AAVE, ARB, OP), NFTs (BAYC, Pudgy Penguins, Wrapped CryptoPunks), and staking positions (stETH, rETH, cbETH). Up to 20 checks with optional Solana and XRPL wallets. Returns per-dimension pass/fail counts and overall summary. No score, no opinion — just cryptographically verifiable evidence organized by dimension. Designed for AI agent-to-agent trust decisions. Costs 3 credits (standard) or 6 credits (proof: 'merkle').",
  {
    wallet: z.string().describe("EVM wallet address (0x...) to profile"),
    solanaWallet: z.string().optional().describe("Solana wallet address (base58). If provided, adds USDC on Solana check."),
    xrplWallet: z.string().optional().describe("XRPL wallet address (r-address). If provided, adds RLUSD and USDC on XRPL checks."),
    proof: z.enum(["merkle"]).optional().describe("Set to 'merkle' for EIP-1186 Merkle storage proofs on stablecoin/governance checks (6 credits)."),
  },
  async (args) => {
    const result = await apiCall("POST", "/trust", args);
    return formatResult(result);
  }
);

server.tool(
  "insumer_batch_wallet_trust",
  "Generate wallet trust fact profiles for up to 10 wallets in a single request. Shared block fetches make this 5-8x faster than sequential calls. Each wallet gets an independently ECDSA-signed profile with its own TRST-XXXXX ID. Supports partial success — failed wallets get error entries while successful ones return full profiles. Costs 3 credits per successful wallet (standard) or 6 credits per wallet (proof: 'merkle'). Credits only charged for successful profiles.",
  {
    wallets: z
      .array(
        z.object({
          wallet: z.string().describe("EVM wallet address (0x...)"),
          solanaWallet: z
            .string()
            .optional()
            .describe("Solana wallet address (base58). Adds USDC on Solana check."),
          xrplWallet: z
            .string()
            .optional()
            .describe("XRPL wallet address (r-address). Adds RLUSD and USDC on XRPL checks."),
        })
      )
      .min(1)
      .max(10)
      .describe("1-10 wallet entries to profile"),
    proof: z
      .enum(["merkle"])
      .optional()
      .describe(
        "Set to 'merkle' for EIP-1186 Merkle storage proofs on all wallets (6 credits/wallet)."
      ),
  },
  async (args) => {
    const result = await apiCall("POST", "/trust/batch", args);
    return formatResult(result);
  }
);

server.tool(
  "insumer_verify",
  "Create signed discount code (INSR-XXXXX, 30-min expiry) for a wallet at a merchant. Returns tier and discount percentage — never raw balance amounts. Consumes 1 merchant credit. If merchant has Stripe Connect, a coupon is auto-created.",
  {
    merchantId: z.string().describe("Merchant ID"),
    wallet: z.string().optional().describe("EVM wallet address (0x...)"),
    solanaWallet: z.string().optional().describe("Solana wallet address (base58)"),
    xrplWallet: z.string().optional().describe("XRPL wallet address (r-address)"),
  },
  async (args) => {
    const result = await apiCall("POST", "/verify", args);
    return formatResult(result);
  }
);

// ============================================================
// DISCOVERY
// ============================================================

server.tool(
  "insumer_list_merchants",
  "Browse merchants in the public directory. Filter by accepted token, verification status. Returns company name, website, tokens accepted, and discount info.",
  {
    token: z.string().optional().describe("Filter by accepted token symbol, e.g. 'UNI'"),
    verified: z.enum(["true", "false"]).optional().describe("Filter by domain verification status"),
    limit: z.number().int().min(1).max(200).optional().describe("Results per page (default 50, max 200)"),
    offset: z.number().int().min(0).optional().describe("Pagination offset (default 0)"),
  },
  async (args) => {
    const params = new URLSearchParams();
    if (args.token) params.set("token", args.token);
    if (args.verified) params.set("verified", args.verified);
    if (args.limit !== undefined) params.set("limit", String(args.limit));
    if (args.offset !== undefined) params.set("offset", String(args.offset));
    const qs = params.toString();
    const result = await apiCall("GET", `/merchants${qs ? `?${qs}` : ""}`);
    return formatResult(result);
  }
);

server.tool(
  "insumer_get_merchant",
  "Get full public merchant profile including token tiers, NFT collections, discount mode, and verification status.",
  {
    id: z.string().describe("Merchant ID"),
  },
  async (args) => {
    const result = await apiCall("GET", `/merchants/${encodeURIComponent(args.id)}`);
    return formatResult(result);
  }
);

server.tool(
  "insumer_list_tokens",
  "List all registered tokens and NFT collections in the Insumer registry. Filter by chain, symbol, or asset type.",
  {
    chain: z.union([z.number().int(), z.literal("solana"), z.literal("xrpl")]).optional().describe("Filter by chain ID"),
    symbol: z.string().optional().describe("Filter by token symbol"),
    type: z.enum(["token", "nft"]).optional().describe("Filter by asset type"),
  },
  async (args) => {
    const params = new URLSearchParams();
    if (args.chain !== undefined) params.set("chain", String(args.chain));
    if (args.symbol) params.set("symbol", args.symbol);
    if (args.type) params.set("type", args.type);
    const qs = params.toString();
    const result = await apiCall("GET", `/tokens${qs ? `?${qs}` : ""}`);
    return formatResult(result);
  }
);

server.tool(
  "insumer_check_discount",
  "Calculate discount for a wallet at a merchant. Checks on-chain balances and returns tier and discount percentage per token — never raw balance amounts. Free — does not consume credits.",
  {
    merchant: z.string().describe("Merchant ID"),
    wallet: z.string().optional().describe("EVM wallet address (0x...)"),
    solanaWallet: z.string().optional().describe("Solana wallet address (base58)"),
    xrplWallet: z.string().optional().describe("XRPL wallet address (r-address)"),
  },
  async (args) => {
    const params = new URLSearchParams();
    params.set("merchant", args.merchant);
    if (args.wallet) params.set("wallet", args.wallet);
    if (args.solanaWallet) params.set("solanaWallet", args.solanaWallet);
    if (args.xrplWallet) params.set("xrplWallet", args.xrplWallet);
    const result = await apiCall("GET", `/discount/check?${params.toString()}`);
    return formatResult(result);
  }
);

// ============================================================
// CREDITS
// ============================================================

server.tool(
  "insumer_credits",
  "Check verification credit balance, tier (free/pro/enterprise), and daily rate limit for the current API key.",
  {},
  async () => {
    const result = await apiCall("GET", "/credits");
    return formatResult(result);
  }
);

server.tool(
  "insumer_buy_credits",
  "Buy verification credits with USDC. Rate: 25 credits per 1 USDC. Minimum: 5 USDC. Send USDC first, then provide the transaction hash.",
  {
    txHash: z.string().describe("USDC transaction hash"),
    chainId: UsdcChainId,
    amount: z.number().min(5).describe("USDC amount sent (minimum 5)"),
  },
  async (args) => {
    const result = await apiCall("POST", "/credits/buy", args);
    return formatResult(result);
  }
);

server.tool(
  "insumer_confirm_payment",
  "Confirm USDC payment for a discount code. After calling insumer_verify, confirm that the USDC payment was made on-chain. The server verifies the transaction receipt.",
  {
    code: z.string().describe("Verification code from insumer_verify (e.g. INSR-A7K3M)"),
    txHash: z.string().describe("On-chain transaction hash or Solana signature"),
    chainId: UsdcChainId,
    amount: z.union([z.string(), z.number()]).describe("USDC amount sent"),
  },
  async (args) => {
    const result = await apiCall("POST", "/payment/confirm", args);
    return formatResult(result);
  }
);

// ============================================================
// MERCHANT ONBOARDING
// ============================================================

server.tool(
  "insumer_create_merchant",
  "Create a new merchant. Receives 100 free verification credits. The API key that creates the merchant owns it. Max 10 merchants per API key.",
  {
    companyName: z.string().max(100).describe("Company display name"),
    companyId: z
      .string()
      .min(2)
      .max(50)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .describe("Unique merchant ID (alphanumeric, dashes, underscores)"),
    location: z.string().max(200).optional().describe("City or region"),
  },
  async (args) => {
    const result = await apiCall("POST", "/merchants", args);
    return formatResult(result);
  }
);

server.tool(
  "insumer_merchant_status",
  "Get full private merchant details: credits, token configs, NFT collections, directory status, verification status, USDC settings. Owner only.",
  {
    id: z.string().describe("Merchant ID"),
  },
  async (args) => {
    const result = await apiCall(
      "GET",
      `/merchants/${encodeURIComponent(args.id)}/status`
    );
    return formatResult(result);
  }
);

server.tool(
  "insumer_configure_tokens",
  "Configure merchant token discount tiers. Set own token and/or partner tokens. Max 8 tokens total. Owner only.",
  {
    id: z.string().describe("Merchant ID"),
    ownToken: TokenConfigSchema.nullable()
      .optional()
      .describe("Merchant's own token configuration, or null to remove"),
    partnerTokens: z
      .array(TokenConfigSchema)
      .optional()
      .describe("Partner token configurations"),
  },
  async (args) => {
    const { id, ...body } = args;
    const result = await apiCall(
      "PUT",
      `/merchants/${encodeURIComponent(id)}/tokens`,
      body
    );
    return formatResult(result);
  }
);

server.tool(
  "insumer_configure_nfts",
  "Configure NFT collections that grant discounts at the merchant. Max 4 collections. Owner only.",
  {
    id: z.string().describe("Merchant ID"),
    nftCollections: z
      .array(NftCollectionSchema)
      .min(0)
      .max(4)
      .describe("NFT collection configurations (0-4)"),
  },
  async (args) => {
    const { id, ...body } = args;
    const result = await apiCall(
      "PUT",
      `/merchants/${encodeURIComponent(id)}/nfts`,
      body
    );
    return formatResult(result);
  }
);

server.tool(
  "insumer_configure_settings",
  "Update merchant settings: discount stacking mode, cap, and USDC payment configuration. All fields optional. Owner only.",
  {
    id: z.string().describe("Merchant ID"),
    discountMode: z
      .enum(["highest", "stack"])
      .optional()
      .describe("'highest' uses best single discount, 'stack' adds them together"),
    discountCap: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum total discount percentage (1-100)"),
    usdcPayment: z
      .object({
        enabled: z.boolean().describe("Enable or disable USDC payments"),
        evmAddress: z.string().optional().describe("EVM wallet for USDC (0x...)"),
        solanaAddress: z.string().optional().describe("Solana wallet for USDC"),
        xrplAddress: z.string().optional().describe("XRPL wallet for USDC (r-address)"),
        preferredChainId: UsdcChainId.optional().describe("Preferred USDC chain"),
      })
      .nullable()
      .optional()
      .describe("USDC payment settings, or null to disable"),
  },
  async (args) => {
    const { id, ...body } = args;
    const result = await apiCall(
      "PUT",
      `/merchants/${encodeURIComponent(id)}/settings`,
      body
    );
    return formatResult(result);
  }
);

server.tool(
  "insumer_publish_directory",
  "Publish (or refresh) the merchant's listing in the public directory. Call again after updating tokens or settings. Owner only.",
  {
    id: z.string().describe("Merchant ID"),
  },
  async (args) => {
    const result = await apiCall(
      "POST",
      `/merchants/${encodeURIComponent(args.id)}/directory`,
      {}
    );
    return formatResult(result);
  }
);

server.tool(
  "insumer_buy_merchant_credits",
  "Buy merchant verification credits with USDC. Rate: 25 credits per 1 USDC ($0.04/credit). Minimum: 5 USDC. Owner only.",
  {
    id: z.string().describe("Merchant ID"),
    txHash: z.string().describe("USDC transaction hash"),
    chainId: UsdcChainId,
    amount: z.number().min(5).describe("USDC amount sent (minimum 5)"),
  },
  async (args) => {
    const { id, ...body } = args;
    const result = await apiCall(
      "POST",
      `/merchants/${encodeURIComponent(id)}/credits`,
      body
    );
    return formatResult(result);
  }
);

// ============================================================
// DOMAIN VERIFICATION
// ============================================================

server.tool(
  "insumer_request_domain_verification",
  "Request a domain verification token for a merchant. Returns the token and three verification methods: DNS TXT record, HTML meta tag, or file upload. After placing the token, call insumer_verify_domain to complete verification. Verified merchants get a trust badge in the public directory. Owner only.",
  {
    id: z.string().describe("Merchant ID"),
    domain: z.string().describe("Domain to verify (e.g. 'example.com')"),
  },
  async (args) => {
    const { id, ...body } = args;
    const result = await apiCall(
      "POST",
      `/merchants/${encodeURIComponent(id)}/domain-verification`,
      body
    );
    return formatResult(result);
  }
);

server.tool(
  "insumer_verify_domain",
  "Verify domain ownership for a merchant. Call this after placing the verification token (from insumer_request_domain_verification) via DNS TXT record, HTML meta tag, or file upload. The server checks all three methods automatically. Rate limited to 5 attempts per hour. Owner only.",
  {
    id: z.string().describe("Merchant ID"),
  },
  async (args) => {
    const result = await apiCall(
      "PUT",
      `/merchants/${encodeURIComponent(args.id)}/domain-verification`
    );
    return formatResult(result);
  }
);

// ============================================================
// COMMERCE PROTOCOL INTEGRATION
// ============================================================

server.tool(
  "insumer_acp_discount",
  "Check token-holder discount eligibility in OpenAI/Stripe Agentic Commerce Protocol (ACP) format. Returns coupon objects, applied/rejected arrays, and per-item allocations compatible with ACP checkout flows. Same on-chain verification as insumer_verify, wrapped in ACP format. Consumes 1 merchant credit.",
  {
    merchantId: z.string().describe("Merchant ID"),
    wallet: z.string().optional().describe("EVM wallet address (0x...)"),
    solanaWallet: z.string().optional().describe("Solana wallet address (base58)"),
    xrplWallet: z.string().optional().describe("XRPL wallet address (r-address)"),
    items: z
      .array(
        z.object({
          path: z.string().describe("JSONPath reference to the line item, e.g. '$.line_items[0]'"),
          amount: z.number().int().describe("Item price in cents"),
        })
      )
      .optional()
      .describe("Optional line items for per-item cent-amount allocations"),
  },
  async (args) => {
    const result = await apiCall("POST", "/acp/discount", args);
    return formatResult(result);
  }
);

server.tool(
  "insumer_ucp_discount",
  "Check token-holder discount eligibility in Google Universal Commerce Protocol (UCP) format. Returns title, extension field, and applied array compatible with UCP checkout flows. Same on-chain verification as insumer_verify, wrapped in UCP format. Consumes 1 merchant credit.",
  {
    merchantId: z.string().describe("Merchant ID"),
    wallet: z.string().optional().describe("EVM wallet address (0x...)"),
    solanaWallet: z.string().optional().describe("Solana wallet address (base58)"),
    xrplWallet: z.string().optional().describe("XRPL wallet address (r-address)"),
    items: z
      .array(
        z.object({
          path: z.string().describe("JSONPath reference to the line item, e.g. '$.line_items[0]'"),
          amount: z.number().int().describe("Item price in cents"),
        })
      )
      .optional()
      .describe("Optional line items for per-item cent-amount allocations"),
  },
  async (args) => {
    const result = await apiCall("POST", "/ucp/discount", args);
    return formatResult(result);
  }
);

server.tool(
  "insumer_validate_code",
  "Validate an INSR-XXXXX discount code. For merchant backends during ACP/UCP checkout to confirm code validity, discount percent, and expiry. Returns valid/invalid status with reason. No authentication required, no credits consumed. Does not expose wallet or token data.",
  {
    code: z.string().regex(/^INSR-[A-Z0-9]{5}$/).describe("Discount code in INSR-XXXXX format"),
  },
  async (args) => {
    const res = await fetch(`${API_BASE}/codes/${encodeURIComponent(args.code)}`);
    const data = await res.json();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  }
);

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
