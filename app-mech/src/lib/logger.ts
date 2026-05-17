import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";

const LOGS_DIR = join(__dirname, "../../logs/migrations");

export function initLogger(label: string): void {
  mkdirSync(LOGS_DIR, { recursive: true });

  const ts = new Date().toISOString().replace(/:/g, "-").slice(0, 19);
  const logPath = join(LOGS_DIR, `${label}-${ts}.log`);
  const stream = createWriteStream(logPath, { flags: "w" });

  const origLog = console.log.bind(console);
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.log = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    origLog(...args);
    stream.write(msg + "\n");
  };

  console.error = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    origError(...args);
    stream.write("[error] " + msg + "\n");
  };

  console.warn = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    origWarn(...args);
    stream.write("[warn]  " + msg + "\n");
  };

  origLog(`log → ${logPath}`);
  stream.write(`${label}  started at ${new Date().toISOString()}\n`);
  stream.write(`log file  ${logPath}\n`);
}
