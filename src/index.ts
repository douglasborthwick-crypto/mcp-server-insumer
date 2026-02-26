#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://us-central1-insumer-merchant.cloudfunctions.net/insumerApi/v1";

const apiKey = process.env.INSUMER_API_KEY;
if (!apiKey) {
  console.error("INSUMER_API_KEY environment variable is required");
  process.exit(1);
}

// --- Shared API helper ---

async function apiCall(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; data?: unknown; error?: unknown; meta?: unknown }> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey!,
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
  ])
  .describe("Chain identifier: EVM chain ID (integer) or 'solana'");

const OnboardingChainId = z
  .union([
    z.enum(["1", "56", "8453", "43114", "137", "42161", "10", "88888", "1868", "98866"]).transform(Number),
    z.number().int().refine(
      (n) => [1, 56, 8453, 43114, 137, 42161, 10, 88888, 1868, 98866].includes(n),
      "Must be a supported onboarding chain"
    ),
    z.literal("solana"),
  ])
  .describe("Onboarding chain: 1, 56, 8453, 43114, 137, 42161, 10, 88888, 1868, 98866, or 'solana'");

const UsdcChainId = z
  .union([
    z.enum(["1", "8453", "137", "42161", "10", "56", "43114"]).transform(Number),
    z.number().int().refine(
      (n) => [1, 8453, 137, 42161, 10, 56, 43114].includes(n),
      "Must be a supported USDC chain"
    ),
    z.literal("solana"),
  ])
  .describe("USDC chain: 1, 8453, 137, 42161, 10, 56, 43114, or 'solana'");

const TierSchema = z.object({
  name: z.string().max(30).describe("Tier name, e.g. 'Gold', 'Silver'"),
  threshold: z.number().positive().describe("Minimum token balance for this tier"),
  discount: z.number().int().min(1).max(50).describe("Discount percentage (1-50)"),
});

const TokenConfigSchema = z.object({
  symbol: z.string().max(10).describe("Token symbol, e.g. 'UNI'"),
  chainId: OnboardingChainId,
  contractAddress: z.string().describe("Token contract address"),
  decimals: z.number().int().min(0).max(18).optional().describe("Token decimals (0-18, default 18)"),
  tiers: z.array(TierSchema).min(1).max(4).describe("1-4 discount tiers"),
});

const NftCollectionSchema = z.object({
  name: z.string().max(50).describe("NFT collection name"),
  contractAddress: z.string().describe("NFT contract address"),
  chainId: OnboardingChainId,
  discount: z.number().int().min(1).max(50).describe("Discount percentage (1-50)"),
});

// --- Server setup ---

const server = new McpServer({
  name: "insumer",
  version: "1.0.8",
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
  "Create on-chain verification (attestation). Verify 1-10 conditions (token balances, NFT ownership) across 31 chains. Returns ECDSA-signed boolean results with a kid field identifying the signing key (fetch public key via insumer_jwks). Never exposes actual balances. Each result includes evaluatedCondition (exact logic checked), conditionHash (SHA-256 for tamper-evidence), and blockNumber/blockTimestamp for RPC chains (freshness). Standard mode costs 1 credit. Pass proof: 'merkle' for EIP-1186 Merkle storage proofs (2 credits).",
  {
    wallet: z.string().optional().describe("EVM wallet address (0x...)"),
    solanaWallet: z.string().optional().describe("Solana wallet address (base58)"),
    proof: z.enum(["merkle"]).optional().describe("Set to 'merkle' for EIP-1186 Merkle storage proofs (2 credits). Proofs available for token_balance on RPC chains only."),
    conditions: z
      .array(
        z.object({
          type: z.enum(["token_balance", "nft_ownership"]).describe("Condition type"),
          contractAddress: z.string().describe("Token or NFT contract address"),
          chainId: ChainId,
          threshold: z.number().optional().describe("Minimum balance required (for token_balance)"),
          decimals: z.number().int().min(0).max(18).optional().describe("Token decimals (default 18)"),
          label: z.string().max(100).optional().describe("Human-readable label"),
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
  "insumer_wallet_trust",
  "Generate a structured, ECDSA-signed wallet trust fact profile. Send a wallet address, get 14 curated checks across stablecoins (USDC on 7 chains), governance tokens (UNI, AAVE, ARB, OP), and NFTs (BAYC, Pudgy Penguins, Wrapped CryptoPunks). Returns per-dimension pass/fail counts and overall summary. No score, no opinion — just cryptographically verifiable evidence organized by dimension. Designed for AI agent-to-agent trust decisions. Costs 3 credits (standard) or 6 credits (proof: 'merkle').",
  {
    wallet: z.string().describe("EVM wallet address (0x...) to profile"),
    solanaWallet: z.string().optional().describe("Solana wallet address (base58). If provided, adds USDC on Solana check (15th condition)."),
    proof: z.enum(["merkle"]).optional().describe("Set to 'merkle' for EIP-1186 Merkle storage proofs on stablecoin/governance checks (6 credits)."),
  },
  async (args) => {
    const result = await apiCall("POST", "/trust", args);
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
    chain: z.union([z.number().int(), z.literal("solana")]).optional().describe("Filter by chain ID"),
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
  },
  async (args) => {
    const params = new URLSearchParams();
    params.set("merchant", args.merchant);
    if (args.wallet) params.set("wallet", args.wallet);
    if (args.solanaWallet) params.set("solanaWallet", args.solanaWallet);
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

// --- Start server ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
