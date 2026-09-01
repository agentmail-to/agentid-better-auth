import { afterEach, describe, expect, it, vi } from "vitest";
import { agentid } from "../src/index.js";

function encodeJwtPart(value: object): string {
	return btoa(JSON.stringify(value))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
}

function idToken(subject = "agent_123"): string {
	return `${encodeJwtPart({ alg: "ES256" })}.${encodeJwtPart({ sub: subject })}.signature`;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("agentid", () => {
	it("returns a secure AgentID Generic OAuth configuration", () => {
		const config = agentid({
			clientId: "client-id",
			clientSecret: "client-secret",
		});

		expect(config).toMatchObject({
			providerId: "agentid",
			name: "AgentID",
			discoveryUrl:
				"https://auth.agentid.com/.well-known/openid-configuration",
			requireIdTokenVerification: true,
			disableIdTokenNonceBinding: true,
			clientId: "client-id",
			clientSecret: "client-secret",
			tokenEndpointAuth: { method: "client_secret_basic" },
			scopes: ["openid", "email", "profile"],
			pkce: true,
		});
	});

	it("passes supported Better Auth options through", () => {
		const config = agentid({
			clientId: "client-id",
			clientSecret: "client-secret",
			scopes: ["openid", "email", "owner_email"],
			redirectURI: "https://example.com/custom-callback",
			disableImplicitSignUp: true,
			disableSignUp: true,
			overrideUserInfo: true,
		});

		expect(config).toMatchObject({
			scopes: ["openid", "email", "owner_email"],
			redirectURI: "https://example.com/custom-callback",
			disableImplicitSignUp: true,
			disableSignUp: true,
			overrideUserInfo: true,
		});
	});

	it("fetches AgentID UserInfo and preserves owner claims", async () => {
		const fetchMock = vi.fn(async () =>
			new Response(
				JSON.stringify({
					sub: "agent_123",
					email: "assistant@agentmail.to",
					email_verified: true,
					name: "Research Assistant",
					owner_name: "Ada Lovelace",
					owner_email: "ada@example.com",
				}),
				{ status: 200 },
			),
		);
		vi.stubGlobal("fetch", fetchMock);

		const config = agentid({
			clientId: "client-id",
			clientSecret: "client-secret",
		});
		const profile = await config.getUserInfo?.({
			accessToken: "access-token",
			idToken: idToken(),
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://auth.agentid.com/v0/userinfo",
			{ headers: { Authorization: "Bearer access-token" } },
		);
		expect(profile).toMatchObject({
			sub: "agent_123",
			email: "assistant@agentmail.to",
			emailVerified: true,
			name: "Research Assistant",
			owner_name: "Ada Lovelace",
			owner_email: "ada@example.com",
		});
	});

	it("derives a name from the AgentMail address when one is omitted", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				new Response(
					JSON.stringify({
						sub: "agent_123",
						email: "research-assistant@agentmail.to",
						email_verified: true,
					}),
					{ status: 200 },
				),
			),
		);

		const config = agentid({
			clientId: "client-id",
			clientSecret: "client-secret",
		});
		const profile = await config.getUserInfo?.({
			accessToken: "access-token",
			idToken: idToken(),
		});

		expect(profile?.name).toBe("research-assistant");
	});

	it.each([
		["missing access token", {}, undefined],
		["missing ID token", { accessToken: "access-token" }, undefined],
		[
			"failed UserInfo response",
			{ accessToken: "access-token", idToken: idToken() },
			401,
		],
	])("returns null for %s", async (_name, tokens, responseStatus) => {
		const fetchMock = vi.fn(async () => new Response(null, { status: 401 }));
		vi.stubGlobal("fetch", fetchMock);

		const config = agentid({
			clientId: "client-id",
			clientSecret: "client-secret",
		});
		const profile = await config.getUserInfo?.(tokens);

		expect(profile).toBeNull();
		expect(fetchMock).toHaveBeenCalledTimes(responseStatus ? 1 : 0);
	});

	it("returns null when UserInfo omits the stable subject", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				new Response(
					JSON.stringify({
						email: "assistant@agentmail.to",
						email_verified: true,
					}),
					{ status: 200 },
				),
			),
		);

		const config = agentid({
			clientId: "client-id",
			clientSecret: "client-secret",
		});

		await expect(
			config.getUserInfo?.({
				accessToken: "access-token",
				idToken: idToken(),
			}),
		).resolves.toBeNull();
	});

	it("rejects UserInfo for a different ID-token subject", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				new Response(
					JSON.stringify({
						sub: "different_agent",
						email: "assistant@agentmail.to",
						email_verified: true,
					}),
					{ status: 200 },
				),
			),
		);

		const config = agentid({
			clientId: "client-id",
			clientSecret: "client-secret",
		});

		await expect(
			config.getUserInfo?.({
				accessToken: "access-token",
				idToken: idToken(),
			}),
		).resolves.toBeNull();
	});
});
