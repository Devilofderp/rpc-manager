// Publishes what `npm run dist` built as a GitHub release, which installed copies update from.
// electron-builder's own publishing sends its uploads at once and they race to create the release.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const { version } = JSON.parse(fs.readFileSync("package.json", "utf8"));
const installer = `dist/RPC-Manager-Setup-${version}.exe`;

execFileSync("gh", ["release", "create", `v${version}`, installer, `${installer}.blockmap`, "dist/latest.yml",
    "--title", version, "--notes", ""], { stdio: "inherit" });
