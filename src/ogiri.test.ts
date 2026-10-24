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

test("過去の投稿と同じ文章は重複と判定する", () => {
	assert.equal(ogiri.hasDuplicatePost(["お題: テスト\n回答: テスト"], "お題: テスト\n回答: テスト"), true);
});

test("前後の空白や改行の違いを無視して重複と判定する", () => {
	assert.equal(
		ogiri.hasDuplicatePost(["  お題: テスト\n回答: テスト  "], "お題: テスト   回答: テスト\n"),
		true,
	);
});

test("異なる文章は重複と判定しない", () => {
	assert.equal(ogiri.hasDuplicatePost(["お題: 別のお題\n回答: 別の回答"], "お題: テスト\n回答: テスト"), false);
});