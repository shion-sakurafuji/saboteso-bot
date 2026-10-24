import assert = require("node:assert/strict");
import test = require("node:test");
import ogiri = require("./ogiri");

test("投稿用テキストの前後の空白を除去する", () => {
	assert.equal(ogiri.formatPostText("  お題: テスト\n回答: テスト  \n"), "お題: テスト\n回答: テスト");
});

test("空文字はエラーにする", () => {
	assert.throws(() => ogiri.formatPostText(""), /生成結果が空です/);
});

test("空白だけの出力はエラーにする", () => {
	assert.throws(() => ogiri.formatPostText(" \t\n "), /生成結果が空です/);
});