#!/usr/bin/env bun
import { runCli } from "./cli";

process.exitCode = runCli(Bun.argv.slice(2));
