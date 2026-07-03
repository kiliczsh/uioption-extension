import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const SOURCE = "assets/icon.svg";
const TARGETS = [
	{ size: 128, out: "src/icons/icon@0.5x.png" },
	{ size: 256, out: "assets/icon@1x.png" },
];

const svg = readFileSync(SOURCE, "utf8");

for (const { size, out } of TARGETS) {
	const resvg = new Resvg(svg, {
		fitTo: { mode: "width", value: size },
		background: "rgba(0,0,0,0)",
	});
	writeFileSync(out, resvg.render().asPng());
	console.log(`${out} (${size}x${size})`);
}
