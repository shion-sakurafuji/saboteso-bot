import ogiri = require("./ogiri");

async function main(): Promise<void> {
	const generatedText = await ogiri.generateOgiri();
	const postText = ogiri.formatPostText(generatedText);

	console.log("投稿用テキスト:");
	console.log(postText);
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`大喜利の生成に失敗しました: ${message}`);
	process.exitCode = 1;
});
