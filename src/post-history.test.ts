import assert = require("node:assert/strict");
import fs = require("node:fs");
import os = require("node:os");
import path = require("node:path");
import test = require("node:test");
import history = require("./post-history");

const sample = "お題: 昔の学校\n回答: ロボットが給食を食べる。";

test("日本時間で3つの定期投稿枠を判定する", () => {
    const now = new Date("2026-10-24T22:30:00Z");

    const expected = [
        ["30 7 * * *", "2026-10-25-0730"],
        ["5 12 * * *", "2026-10-25-1205"],
        ["15 18 * * *", "2026-10-25-1815"],
    ];

    for (const [schedule, slot] of expected) {
        assert.equal(
            history.getPostingSlot(
                {
                    GITHUB_EVENT_NAME: "schedule",
                    POST_SCHEDULE: schedule,
                },
                now
            ),
            slot
        );
    }
});

test("手動実行はrun IDを使う", () => {
    assert.equal(
        history.getPostingSlot({
            GITHUB_EVENT_NAME: "workflow_dispatch",
            GITHUB_RUN_ID: "123",
        }),
        "manual-123"
    );

    assert.throws(
        () => history.getPostingSlot({
            GITHUB_EVENT_NAME: "workflow_dispatch",
        }),
        /GITHUB_RUN_ID/
    );
});

test("未知のスケジュール・実行方法では投稿しない", () => {
    assert.throws(
        () => history.getPostingSlot({
            GITHUB_EVENT_NAME: "schedule",
            POST_SCHEDULE: "* * * * *",
        }),
        /想定外/
    );

    assert.throws(
        () => history.getPostingSlot({
            GITHUB_EVENT_NAME: "push",
        }),
        /のみ対応/
    );
});

test("投稿枠を予約し、投稿ID付きで完了にできる", async () => {
    const now = new Date("2026-10-25T00:00:00Z");

    const entry = await history.preparePost(
        [],
        "2026-10-25-0730",
        async () => sample,
        now,
        "100"
    );

    assert.ok(entry);
    assert.equal(entry.status, "reserved");
    assert.equal(entry.runId, "100");

    const posted = history.markPosted(
        [entry],
        entry.slot,
        "123456",
        now
    );

    assert.equal(posted[0]?.status, "posted");
    assert.equal(posted[0]?.xPostId, "123456");
    assert.equal(entry.status, "reserved");
});

test("予約済みの枠では再生成を呼ばない", async () => {
    const previous = await history.preparePost(
        [],
        "2026-10-25-0730",
        async () => sample,
        new Date(),
        "100"
    );

    assert.ok(previous);

    let calls = 0;

    const generate = async () => {
        calls++;
        return sample;
    };

    assert.equal(
        await history.preparePost(
            [previous],
            previous.slot,
            generate
        ),
        null
    );

    assert.equal(
        await history.preparePost(
            [previous],
            "2026-10-26-0730",
            generate,
            new Date(),
            "100"
        ),
        null
    );

    assert.equal(calls, 0);
});

test("重複した場合は再生成する", async () => {
    const previous = await history.preparePost(
        [],
        "2026-10-25-0730",
        async () => sample
    );

    assert.ok(previous);

    let calls = 0;

    const result = await history.preparePost(
        [previous],
        "2026-10-25-1205",
        async () => {
            calls++;

            return calls === 1
                ? sample
                : "お題: 夜の学校\n回答: 校庭が一人で走る。";
        }
    );

    assert.ok(result);
    assert.equal(calls, 2);
    assert.match(result.postText, /夜の学校/);
});

test("形式不正・文字数超過なら再生成する", async () => {
    let calls = 0;

    const valid = await history.preparePost(
        [],
        "slot1",
        async () => {
            calls++;

            if (calls === 1) {
                return "壊れた形式";
            }

            if (calls === 2) {
                return `お題: あ\n回答: ${"い".repeat(300)}`;
            }

            return sample;
        }
    );

    assert.ok(valid);
    assert.equal(calls, 3);

    await assert.rejects(
        history.preparePost(
            [valid],
            "slot2",
            async () => sample
        ),
        /5回生成/
    );
});

test("履歴の保存と読み込み", async () => {
    const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "saboteso-history-")
    );

    const filePath = path.join(
        tempDir,
        "data",
        "history.json"
    );

    try {
        assert.deepEqual(history.loadHistory(filePath), []);

        const entry = await history.preparePost(
            [],
            "slot1",
            async () => sample
        );

        assert.ok(entry);

        history.saveHistory([entry], filePath);

        assert.deepEqual(
            history.loadHistory(filePath),
            [entry]
        );

        fs.writeFileSync(
            filePath,
            '{ "unexpected": true }'
        );

        assert.throws(
            () => history.loadHistory(filePath),
            /形式が不正/
        );
    } finally {
        fs.rmSync(tempDir, {
            recursive: true,
            force: true,
        });
    }
});