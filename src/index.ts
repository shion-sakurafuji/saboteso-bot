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

async function main(): Promise<void> {
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

	const text = result.output
		?.filter((item) => item.type === "message")
		.flatMap((item) => item.content ?? [])
		.filter((item) => item.type === "output_text")
		.map((item) => item.text ?? "")
		.join("")
		.trim();

	if (!text) {
		throw new Error("APIから大喜利のテキストを取得できませんでした。");
	}

	console.log(text);
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`大喜利の生成に失敗しました: ${message}`);
	process.exitCode = 1;
});
