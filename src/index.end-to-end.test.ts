import { describe, it, expect } from "vitest";
import { exec, type ExecException } from "child_process";

const APP_ENTRY = "node dist/index.js";

interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const execWithExitCode = (command: string): Promise<ExecResult> => {
  command = `${APP_ENTRY} ${command}`;
  return new Promise((resolve) => {
    exec(command, (error: ExecException | null, stdout: string, stderr: string) => {
      const result = {
        stdout,
        stderr,
        exitCode: error?.code ?? 0,
      };
      resolve(result);
    });
  });
};

describe(`${APP_ENTRY} base infos`, () => {
  it("should show help message", async () => {
    const { stdout, stderr, exitCode } = await execWithExitCode(`--help`);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain(APP_DESCRIPTION);
    expect(stderr).toBe("");
  });

  it("should run a command and return the correct version", async () => {
    const { stdout, stderr, exitCode } = await execWithExitCode(`--version`);
    expect(exitCode).toBe(0);
    expect(stdout).toContain(`${APP_NAME} ${APP_VERSION}`);
    expect(stderr).toBe("");
  });

  it("should fail with invalid command", async () => {
    const { exitCode } = await execWithExitCode(`unknown_command`);
    expect(exitCode).toBe(1);
  });
});

describe(`${APP_NAME} commands help`, () => {
  it(`"should show help message for diff"`, async () => {
    const { stdout, stderr, exitCode } = await execWithExitCode(`diff --help`);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
    expect(stderr).toBe("");
  });

  it("should run a command and return the correct version", async () => {
    const { stdout, stderr } = await execWithExitCode(`--version`);

    expect(stdout).toContain(`${APP_NAME} ${APP_VERSION}`);
    expect(stderr).toBe("");
  });
});
