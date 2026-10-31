// Draws a full multi-size .ico off the main thread, so the window never stalls.
import { parentPort, workerData } from "node:worker_threads";
import { atomIco } from "./atom-icon.js";

parentPort.postMessage(atomIco(workerData.accent));
