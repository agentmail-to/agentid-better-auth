# AgentID for Better Auth

`@agentmail/agentid-better-auth` is an AgentID provider helper for Better
Auth's Generic OAuth plugin. It lets AI agents sign in with their AgentMail
identity while Better Auth handles the OAuth callback and session.

## Requirements

- Better Auth 1.7.2 or later
- An AgentID client from the [AgentID console](https://console.agentid.com)

## Install

```sh
pnpm add @agentmail/agentid-better-auth
```

## Configure

Register this callback URL in the AgentID console:

```text
https://yourapp.com/api/auth/callback/agentid
```

Then add the helper to Better Auth:

```ts
import { agentid } from "@agentmail/agentid-better-auth";
import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";

export const auth = betterAuth({
	plugins: [
		genericOAuth({
			config: [
				agentid({
					clientId: process.env.AGENTID_CLIENT_ID!,
					clientSecret: process.env.AGENTID_CLIENT_SECRET!,
				}),
			],
		}),
	],
});
```

Use your existing Better Auth client, or create one. No client plugin is
required:

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
```

Start sign-in with the standard social-provider API:

```ts
await authClient.signIn.social({
	provider: "agentid",
	callbackURL: "/",
});
```

See the [AgentID Better Auth guide](https://www.agentid.com/docs/better-auth)
for the complete setup.

## Scopes and owner claims

The default scopes are `openid`, `email`, and `profile`. These identify the
agent and expose its AgentMail address. To also request information about the
human who owns the agent, add `owner_profile` and `owner_email`:

```ts
agentid({
	clientId: process.env.AGENTID_CLIENT_ID!,
	clientSecret: process.env.AGENTID_CLIENT_SECRET!,
	scopes: ["openid", "email", "profile", "owner_profile", "owner_email"],
});
```

Owner claims are returned by AgentID's UserInfo endpoint and are available to
Better Auth callbacks in the raw OAuth profile. See the AgentID guide for an
example of reading them later with the stored access token.

## Protocol details

- Discovery: `https://auth.agentid.com/.well-known/openid-configuration`
- Token endpoint authentication: `client_secret_basic`
- PKCE: required (`S256`)
- Callback path: `/api/auth/callback/agentid`
- ID tokens: verified through AgentID's discovery metadata and JWKS

AgentID does not echo an OIDC nonce in authorization-code ID tokens. The helper
therefore disables Better Auth's nonce binding for this provider and requires
PKCE instead. Signature, issuer, audience, algorithm, and expiry validation
remain enabled.

## Development

```sh
pnpm install
pnpm check
```
