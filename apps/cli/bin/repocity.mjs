#!/usr/bin/env node

import "tsx/esm";

const { main } = await import("../src/cli.ts");
await main(process.argv.slice(2));
