import { afterEach, describe, expect, it } from "vitest";

import { PACKAGE_VERSION } from "../src/constants.js";
import { acquireSharedRuntime, releaseSharedRuntime, type SharedRuntime } from "../src/shared-runtime.js";

const KEY = Symbol.for("pi-antigravity-acp:runtime");
const slots = globalThis as unknown as Record<symbol, SharedRuntime | undefined>;

describe("shared runtime identity", () => {
	afterEach(async () => {
		const shared = slots[KEY];
		if (shared) {
			shared.refs = 1;
			await releaseSharedRuntime(shared, "quit");
		}
	});

	it("does not reuse a same-version runtime left by a different install", async () => {
		let closed = false;
		const foreign = {
			runtime: { close: async () => { closed = true; } },
			provider: {},
			refs: 0,
			version: PACKAGE_VERSION, // same version, different (deleted) install
		} as unknown as SharedRuntime;
		slots[KEY] = foreign;

		const shared = acquireSharedRuntime();
		expect(shared).not.toBe(foreign);
		expect(shared.version.startsWith(`${PACKAGE_VERSION}@`)).toBe(true);
		expect(closed).toBe(true);
	});

	it("reuses the runtime from the same install across reloads", async () => {
		const first = acquireSharedRuntime();
		await releaseSharedRuntime(first, "reload");
		const second = acquireSharedRuntime();
		expect(second).toBe(first);
	});
});
