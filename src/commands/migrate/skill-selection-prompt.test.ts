import { PassThrough, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import {
  MIGRATION_SKILL_SELECTION_SKIP,
  MIGRATION_SKILL_SELECTION_TOGGLE_ALL_OFF,
  MIGRATION_SKILL_SELECTION_TOGGLE_ALL_ON,
} from "./selection.js";
import { promptMigrationSkillSelectionValues } from "./skill-selection-prompt.js";

function createPromptOutput(): NodeJS.WriteStream {
  const output = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  Object.defineProperty(output, "columns", {
    configurable: true,
    value: 100,
  });
  return output as NodeJS.WriteStream;
}

async function runPromptWithKeys(params: {
  cursorAt: string;
  initialValues?: string[];
  keys: string[];
}): Promise<string[] | symbol | undefined> {
  const input = new PassThrough() as unknown as NodeJS.ReadStream;
  const result = promptMigrationSkillSelectionValues({
    message: "Select Codex skills",
    options: [
      { value: MIGRATION_SKILL_SELECTION_SKIP, label: "Skip for now" },
      { value: MIGRATION_SKILL_SELECTION_TOGGLE_ALL_ON, label: "Toggle all on" },
      { value: MIGRATION_SKILL_SELECTION_TOGGLE_ALL_OFF, label: "Toggle all off" },
      { value: "skill:alpha", label: "alpha" },
      { value: "skill:beta", label: "beta" },
    ],
    initialValues: params.initialValues,
    required: false,
    cursorAt: params.cursorAt,
    selectableValues: ["skill:alpha", "skill:beta"],
    input,
    output: createPromptOutput(),
    withGuide: false,
  });
  params.keys.forEach((key, index) => {
    setTimeout(
      () => {
        if (key === " ") {
          input.emit("keypress", " ", { name: "space" });
          return;
        }
        if (key === "\r") {
          input.emit("keypress", "\r", { name: "return" });
          return;
        }
        input.write(key);
      },
      20 + index * 20,
    );
  });
  return await result;
}

async function runPromptWithReturn(params: {
  cursorAt: string;
  initialValues?: string[];
}): Promise<string[] | symbol | undefined> {
  return await runPromptWithKeys({ ...params, keys: ["\r"] });
}

describe("promptMigrationSkillSelectionValues", () => {
  it("submits the pre-selected visual state when Enter is pressed at Skip for now", async () => {
    // Enter never triggers a sentinel action by cursor position; it submits
    // whatever the user can see is selected. The user must space-toggle the
    // sentinel row first to activate it.
    await expect(
      runPromptWithReturn({
        cursorAt: MIGRATION_SKILL_SELECTION_SKIP,
        initialValues: ["skill:alpha", "skill:beta"],
      }),
    ).resolves.toEqual(["skill:alpha", "skill:beta"]);
  });

  it("keeps the cursor item selected when submitting with return", async () => {
    await expect(
      runPromptWithReturn({
        cursorAt: "skill:alpha",
        initialValues: ["skill:alpha"],
      }),
    ).resolves.toEqual(["skill:alpha"]);
  });

  it("preserves a cursor item deselected with space before return", async () => {
    await expect(
      runPromptWithKeys({
        cursorAt: "skill:alpha",
        initialValues: ["skill:alpha", "skill:beta"],
        keys: [" ", "\r"],
      }),
    ).resolves.toEqual(["skill:beta"]);
  });

  it("activates Skip for now when space-toggled before Enter", async () => {
    await expect(
      runPromptWithKeys({
        cursorAt: MIGRATION_SKILL_SELECTION_SKIP,
        initialValues: ["skill:alpha", "skill:beta"],
        keys: [" ", "\r"],
      }),
    ).resolves.toEqual([MIGRATION_SKILL_SELECTION_SKIP]);
  });

  it("activates Toggle all off when space-toggled before Enter", async () => {
    await expect(
      runPromptWithKeys({
        cursorAt: MIGRATION_SKILL_SELECTION_TOGGLE_ALL_OFF,
        initialValues: ["skill:alpha", "skill:beta"],
        keys: [" ", "\r"],
      }),
    ).resolves.toEqual([MIGRATION_SKILL_SELECTION_TOGGLE_ALL_OFF]);
  });

  it("activates Toggle all on when space-toggled before Enter", async () => {
    await expect(
      runPromptWithKeys({
        cursorAt: MIGRATION_SKILL_SELECTION_TOGGLE_ALL_ON,
        initialValues: [],
        keys: [" ", "\r"],
      }),
    ).resolves.toEqual([MIGRATION_SKILL_SELECTION_TOGGLE_ALL_ON, "skill:alpha", "skill:beta"]);
  });
});
