import { fileURLToPath } from "node:url";

import type { Provider } from "@earendil-works/pi-ai";

import { loadConfig } from "./config.js";
import { PACKAGE_VERSION } from "./constants.js";
import { createAntigravityProvider } from "./provider.js";
import { AntigravityRuntime, type AntigravityConnectionFactory } from "./runtime.js";

export interface SharedRuntime {
	runtime: AntigravityRuntime;
	provider: Provider<"antigravity-acp">;
	refs: number;
	version: string;
}

// Pi loads every extension instance without a module cache, so the record lives on globalThis.
const KEY = Symbol.for("pi-antigravity-acp:runtime");
const slots = globalThis as unknown as Record<symbol, SharedRuntime | undefined>;
// Identity includes the install location: two installs of the same version (e.g. npm and a
// local checkout swapped by /reload) must never share, or the survivor may run code whose
// files were deleted with the old install.
const RUNTIME_IDENTITY = `${PACKAGE_VERSION}@${fileURLToPath(new URL(".", import.meta.url))}`;

export function acquireSharedRuntime(connectionFactory?: AntigravityConnectionFactory): SharedRuntime {
	let shared = slots[KEY];
	if (shared?.version !== RUNTIME_IDENTITY) {
		// A different package version or install never shares; an unreferenced old stack would otherwise leak.
		if (shared && shared.refs === 0) void shared.runtime.close();
		const config = loadConfig();
		const runtime = new AntigravityRuntime(connectionFactory, config.permissions, undefined, {
			toolActivityMode: config.toolActivity,
		});
		shared = { runtime, provider: createAntigravityProvider(runtime).provider, refs: 0, version: RUNTIME_IDENTITY };
		slots[KEY] = shared;
	}
	shared.refs += 1;
	return shared;
}

// Children loaded without extensions stream through the runtime without a ref, so only quit closes it.
export async function releaseSharedRuntime(shared: SharedRuntime, reason: string): Promise<void> {
	shared.refs = Math.max(0, shared.refs - 1);
	if (shared.refs > 0 || reason !== "quit") return;
	if (slots[KEY] === shared) delete slots[KEY];
	await shared.runtime.close();
}
