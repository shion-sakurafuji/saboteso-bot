import assert = require("node:assert/strict");
import test = require("node:test");
import xPost = require("./x-post");

const credentialNames = ["X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_TOKEN_SECRET"] as const;

function withTestCredentials(run: () => Promise<void>): Promise<void> {
	const originalValues = credentialNames.map((name) => process.env[name]);
	credentialNames.forEach((name, index) => {
		process.env[name] = `test-credential-${index}`;
	});

	return run().finally(() => {
		credentialNames.forEach((name, index) => {
			const originalValue = originalValues[index];
			if (originalValue === undefined) {
				delete process.env[name];
			} else {
				process.env[name] = originalValue;
			}
		});
	});
}

test("OAuth認証でPOST /2/tweetsを呼び出し、投稿結果を返す", async () => {
	await withTestCredentials(async () => {
		let requestedUrl = "";
		let requestOptions: RequestInit | undefined;
		const fetchMock: typeof fetch = async (input, init) => {
			requestedUrl = String(input);
			requestOptions = init;
			return new Response(JSON.stringify({ data: { id: "123", text: "投稿文" } }), {
				status: 201,
				headers: { "Content-Type": "application/json" },
			});
		};

		const result = await xPost.postTweet("投稿文", fetchMock);

		assert.equal(requestedUrl, "https://api.x.com/2/tweets");
		assert.equal(requestOptions?.method, "POST");
		assert.equal(requestOptions?.body, JSON.stringify({ text: "投稿文" }));
		assert.match(new Headers(requestOptions?.headers).get("Authorization") ?? "", /^OAuth /);
		assert.deepEqual(result, { id: "123", text: "投稿文" });
	});
});

test("空の投稿文は通信前にエラーにする", async () => {
	await withTestCredentials(async () => {
		let wasCalled = false;
		const fetchMock: typeof fetch = async () => {
			wasCalled = true;
			return new Response();
		};

		await assert.rejects(xPost.postTweet(" \n ", fetchMock), /投稿文が空です/);
		assert.equal(wasCalled, false);
	});
});

test("API認証情報が不足している場合は通信せずエラーにする", async () => {
	const originalValues = credentialNames.map((name) => process.env[name]);
	credentialNames.forEach((name) => delete process.env[name]);
	let wasCalled = false;
	const fetchMock: typeof fetch = async () => {
		wasCalled = true;
		return new Response();
	};

	try {
		await assert.rejects(xPost.postTweet("投稿文", fetchMock), /X_API_KEY/);
		assert.equal(wasCalled, false);
	} finally {
		credentialNames.forEach((name, index) => {
			const originalValue = originalValues[index];
			if (originalValue !== undefined) {
				process.env[name] = originalValue;
			}
		});
	}
});