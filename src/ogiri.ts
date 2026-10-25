type ResponsesApiResponse = {
	output?: Array<{
		type?: string;
		content?: Array<{
			type?: string;
			text?: string;
		}>;
	}>;
	error?: {
		message?: string;
	};
};

async function generateOgiri(): Promise<string> {
	const apiKey = process.env.OPENAI_API_KEY;
	const model = process.env.OPENAI_MODEL;

	if (!apiKey || !model) {
		throw new Error("OPENAI_API_KEY と OPENAI_MODEL を環境変数に設定してください。");
	}

	const response = await fetch("https://api.openai.com/v1/responses", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model,
			input:
				"日本語の大喜利を1件作ってください。出力は「お題: ...」と「回答: ...」の2行だけにしてください。",
		}),
	});

	const result = (await response.json()) as ResponsesApiResponse;
	if (!response.ok) {
		throw new Error(result.error?.message ?? `OpenAI APIエラー (${response.status})`);
	}

	return (
		result.output
			?.filter((item) => item.type === "message")
			.flatMap((item) => item.content ?? [])
			.filter((item) => item.type === "output_text")
			.map((item) => item.text ?? "")
			.join("") ?? ""
	);
}

function formatPostText(generatedText: string): string {
	const postText = generatedText.trim().replace(/\r\n?/g, "\n");
	if (!postText) {
		throw new Error("生成結果が空です。投稿用テキストを作成できません。");
	}

	const match = postText.match(/^[ \t]*お題[ \t]*[:：][ \t]*(.*)\n[ \t]*回答[ \t]*[:：][ \t]*(.*)$/);
	if (!match) {
		throw new Error("生成結果は「お題: ...」と「回答: ...」の2行である必要があります。");
	}

	const question = match[1]?.trim();
	const answer = match[2]?.trim();
	if (!question || !answer) {
		throw new Error("お題と回答を空にすることはできません。");
	}

	return `【お題】\n${question}\n\n【回答】\n${answer}`;
}

function normalizePostText(postText: string): string {
	return postText.trim().replace(/\s+/g, " ");
}

function hasDuplicatePost(previousPosts: string[], newPost: string): boolean {
	const normalizedNewPost = normalizePostText(newPost);
	return previousPosts.some((post) => normalizePostText(post) === normalizedNewPost);
}

export = { formatPostText, generateOgiri, hasDuplicatePost };
