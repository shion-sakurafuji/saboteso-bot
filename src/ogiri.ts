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

async function requestOpenAi(input: string): Promise<string> {
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
            input,
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
    ).trim();
}

async function generateOgiri(): Promise<string> {
    // 1回目：お題だけを生成
    const questionRaw = await requestOpenAi(
        "日本語の大喜利のお題を1つ作ってください。回答は出力せず、お題の本文だけを1行で出力してください。"
    );

    const question = questionRaw.replace(/^お題\s*[:：]\s*/, "").trim();

    if (!question || question.includes("\n")) {
        throw new Error("お題の生成結果が不正です。");
    }

    // 2回目：確定したお題への回答だけを生成
    const answerRaw = await requestOpenAi(
        `あなたは日本語の大喜利の回答者です。

目的は、お題の質問に正しく答えることではありません。
読んだ人が思わず笑ってしまう「ボケ」を作ることです。

【お題】
${question}

【回答の方針】
	1. 読者が最初に予想する普通の回答を裏切ってください。
	2. ただし、単に意味不明なことを言うのではなく、意外なのに一瞬で意味が理解できる回答にしてください。
	3. 具体的な人物の行動、状況、セリフなどを使い、読者の頭に面白い光景が浮かぶようにしてください。
	4. 人間の心理、習慣、見栄、勘違いなどを利用しても構いません。
	5. オチを説明しないでください。最後の一言がオチになるようにしてください。
	6. ありがちな説教、単なる機能紹介、奇妙な出来事を説明するだけの回答は避けてください。

	【出力】
	最も面白いと考える回答を1つだけ出力してください。
	回答本文のみ、1行で出力してください。`
    );

    const answer = answerRaw.replace(/^回答\s*[:：]\s*/, "").trim();

    if (!answer || answer.includes("\n")) {
        throw new Error("回答の生成結果が不正です。");
    }

    // 既存の投稿処理が要求する形式に結合
    return `お題: ${question}\n回答: ${answer}`;
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
