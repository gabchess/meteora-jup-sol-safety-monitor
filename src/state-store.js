import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function loadMonitorState(path, { required = false } = {}) {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("Monitor state must be a JSON object");
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") {
      if (required) {
        throw new Error(
          "Monitor state is missing. Run the explicit initialize mode after reconciling a dry run"
        );
      }
      return null;
    }
    throw new Error(
      `Unable to load monitor state: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function saveMonitorState(path, state) {
  const directory = dirname(path);
  const temporaryPath = `${path}.tmp-${process.pid}`;

  try {
    await mkdir(directory, { recursive: true });
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600
    });
    await rename(temporaryPath, path);
  } catch (error) {
    throw new Error(
      `Unable to save monitor state: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
