/**
 * Cross-platform dev launcher.
 * Detects OS and runs the appropriate script (bash on Unix, PowerShell on Windows).
 */
import { platform } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const isWindows = platform() === "win32";

const cmd = isWindows ? "powershell" : "bash";
const args = isWindows
  ? ["-ExecutionPolicy", "Bypass", "-File", join(__dirname, "dev.ps1")]
  : [join(__dirname, "dev.sh")];

const child = spawn(cmd, args, { stdio: "inherit", shell: isWindows });

child.on("close", (code) => process.exit(code ?? 1));
