// Builds the installer and publishes it as a GitHub release, which installed copies update from.
// electron-builder's own publishing sends its uploads at once and they race to create the release.
import { build } from "electron-builder";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const { version } = JSON.parse(fs.readFileSync("package.json", "utf8"));
// Updates need a full x.y.z version, but people see 0.4.0 as 0.4.
const label = version.replace(/\.0$/, "");
const installer = `dist/RPC-Manager-Setup-${label}.exe`;

await build({ config: { nsis: { artifactName: `RPC-Manager-Setup-${label}.\${ext}` } } });

execFileSync("gh", ["release", "create", `v${label}`, installer, `${installer}.blockmap`, "dist/latest.yml",
    "--title", label, "--notes", ""], { stdio: "inherit" });
