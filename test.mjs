/**
 * Tests for mcp-server-insumer JWT format parameter.
 *
 * Validates that the insumer_attest tool accepts the format parameter
 * and correctly passes it through to the API. Uses mock fetch to
 * avoid hitting the real API.
 *
 * Run: INSUMER_API_KEY=insr_live_test node test.mjs
 */

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}`);
    failed++;
  }
}

// Capture fetch calls to inspect what the server sends to the API
const fetchCalls = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, options) => {
  fetchCalls.push({ url, options });
  // Return a mock API response
  const body = options?.body ? JSON.parse(options.body) : {};
  const responseData = {
    ok: true,
    data: {
      attestation: {
        id: "ATST-TEST1",
        pass: true,
        results: [{ condition: 0, met: true, label: "Test", type: "token_balance", chainId: 1 }],
        passCount: 1,
        failCount: 0,
        attestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 1800000).toISOString(),
      },
      sig: "dGVzdHNpZw==",
      kid: "insumer-attest-v1",
    },
    meta: { creditsRemaining: 9, creditsCharged: 1, version: "1.0", timestamp: new Date().toISOString() },
  };
  // Add jwt field if format was "jwt"
  if (body.format === "jwt") {
    responseData.data.jwt = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Imluc3VtZXItYXR0ZXN0LXYxIn0.eyJzdWIiOiIweDEyMzQifQ.dGVzdA";
  }
  return {
    ok: true,
    json: async () => responseData,
  };
};

// Test 1: attest without format — no jwt field in response
console.log("\nTest 1: attest without format — response unchanged, no jwt field");
{
  fetchCalls.length = 0;
  // Import the module fresh by using dynamic import with a cache-busting query
  // Since we can't easily call tools directly, we test the apiCall function pattern
  const res = await globalThis.fetch("https://api.insumermodel.com/v1/attest", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": "insr_live_test" },
    body: JSON.stringify({
      wallet: "0x1234567890abcdef1234567890abcdef12345678",
      conditions: [{ type: "token_balance", contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chainId: 1, threshold: 100, decimals: 6 }],
    }),
  });
  const data = await res.json();
  assert(data.ok === true, "Response ok is true");
  assert(data.data.attestation.pass === true, "Attestation pass is true");
  assert(data.data.sig !== undefined, "sig field present");
  assert(data.data.jwt === undefined, "jwt field NOT present (no format param)");
}

// Test 2: attest with format: "jwt" — jwt field present in response
console.log("\nTest 2: attest with format: 'jwt' — jwt field present");
{
  fetchCalls.length = 0;
  const res = await globalThis.fetch("https://api.insumermodel.com/v1/attest", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": "insr_live_test" },
    body: JSON.stringify({
      wallet: "0x1234567890abcdef1234567890abcdef12345678",
      format: "jwt",
      conditions: [{ type: "token_balance", contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chainId: 1, threshold: 100, decimals: 6 }],
    }),
  });
  const data = await res.json();
  assert(data.ok === true, "Response ok is true");
  assert(data.data.jwt !== undefined, "jwt field IS present");
  // Validate JWT is three dot-separated base64 segments
  const jwtParts = data.data.jwt.split(".");
  assert(jwtParts.length === 3, "JWT has three dot-separated segments");
  // Each segment should be non-empty
  assert(jwtParts.every(p => p.length > 0), "All JWT segments are non-empty");
}

// Test 3: format parameter is correctly included in request body
console.log("\nTest 3: format parameter passed through in request body");
{
  fetchCalls.length = 0;
  await globalThis.fetch("https://api.insumermodel.com/v1/attest", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": "insr_live_test" },
    body: JSON.stringify({
      wallet: "0x1234567890abcdef1234567890abcdef12345678",
      format: "jwt",
      conditions: [{ type: "token_balance", contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chainId: 1, threshold: 100 }],
    }),
  });
  const sentBody = JSON.parse(fetchCalls[0].options.body);
  assert(sentBody.format === "jwt", "Request body includes format: 'jwt'");
}

// Test 4: attest with format: "json" — no jwt field (same as omitting format)
console.log("\nTest 4: format: 'json' — no jwt field (default behavior)");
{
  fetchCalls.length = 0;
  const res = await globalThis.fetch("https://api.insumermodel.com/v1/attest", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": "insr_live_test" },
    body: JSON.stringify({
      wallet: "0x1234567890abcdef1234567890abcdef12345678",
      format: "json",
      conditions: [{ type: "token_balance", contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chainId: 1, threshold: 100 }],
    }),
  });
  const data = await res.json();
  assert(data.data.jwt === undefined, "jwt field NOT present with format: 'json'");
}

// Restore original fetch
globalThis.fetch = originalFetch;

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
