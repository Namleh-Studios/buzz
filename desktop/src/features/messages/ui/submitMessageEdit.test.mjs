import assert from "node:assert/strict";
import test from "node:test";

import { submitMessageEdit } from "./submitMessageEdit.ts";

function baseOptions(save, { content = "hello @Missing User" } = {}) {
  return {
    clearComposer: () => {},
    content,
    customEmoji: [],
    editTargetId: "event-id",
    extractMentionPubkeys: () => [],
    getMentionRefs: () => [],
    originalContent: content,
    ownerPubkey: "a".repeat(64),
    pendingImeta: [],
    queuedAttachments: [],
    restoreComposer: () => {},
    restoreMentionRefs: () => {},
    revalidateMentionPubkeys: async (pubkeys) => [...pubkeys],
    setDeferredUploadPending: () => {},
    setUploadError: () => {},
    shouldRestoreComposer: () => true,
    spoileredAttachmentUrls: new Set(),
    save,
  };
}

test("edit save revalidates added mentions immediately before save", async () => {
  const agent = "c".repeat(64);
  const calls = [];
  await submitMessageEdit({
    ...baseOptions(async (_content, _tags, mentionPubkeys) => {
      calls.push(["save", mentionPubkeys]);
    }),
    content: "hello @Agent",
    originalContent: "hello",
    extractMentionPubkeys: (content) =>
      content.includes("@Agent") ? [agent] : [],
    revalidateMentionPubkeys: async (pubkeys) => {
      calls.push(["revalidate", pubkeys]);
      return [];
    },
  });

  assert.deepEqual(calls, [
    ["revalidate", [agent]],
    ["save", []],
  ]);
});

test("edit upload pause revalidates revoked mentions only after upload completes", async () => {
  const agent = "d".repeat(64);
  const calls = [];
  let completeUpload;
  await submitMessageEdit({
    ...baseOptions(async (_content, _tags, mentionPubkeys) => {
      calls.push(["save", mentionPubkeys]);
    }),
    content: "hello @Agent",
    originalContent: "hello",
    extractMentionPubkeys: (content) =>
      content.includes("@Agent") ? [agent] : [],
    queuedAttachments: [
      {
        file: new File(["image"], "image.png", { type: "image/png" }),
        id: 1,
        spoilered: false,
      },
    ],
    enqueueUpload: ({ onComplete }) => {
      completeUpload = () => onComplete([], new AbortController().signal);
      return {};
    },
    revalidateMentionPubkeys: async (pubkeys) => {
      calls.push(["revalidate", pubkeys]);
      return [];
    },
  });

  assert.deepEqual(calls, []);
  await completeUpload();
  assert.deepEqual(calls, [
    ["revalidate", [agent]],
    ["save", []],
  ]);
});
