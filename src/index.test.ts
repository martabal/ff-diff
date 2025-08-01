import { describe, it, expect } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

const APP_ENTRY = "node dist/index.js";

describe("CLI App", () => {
  it("should show help message", async () => {
    const { stdout, stderr } = await execPromise(`${APP_ENTRY} --help`);

    expect(stdout).toContain("Usage:");
    expect(stdout).toContain(APP_DESCRIPTION);
    expect(stderr).toBe("");
  });

  it("should run a command and return the correct version", async () => {
    const { stdout, stderr } = await execPromise(`${APP_ENTRY} --version`);

    expect(stdout).toContain(`${APP_NAME} ${APP_VERSION}`);
    expect(stderr).toBe("");
  });

  it("should fail with invalid command", async () => {
    await expect(
      execPromise(`${APP_ENTRY} unknown_command`),
    ).rejects.toMatchObject({
      code: 1,
    });
  });
});
