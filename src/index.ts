#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { buildServer } from './server.ts';
import { Store } from './store.ts';

// stdout carries the protocol: anything this process says goes to stderr.
const store = new Store();
serveStdio(() => buildServer({ store }));
