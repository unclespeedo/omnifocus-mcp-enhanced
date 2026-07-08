#!/usr/bin/env node
// cli.cjs
const path = require('path');
const childProcess = require('child_process');

const serverPath = path.join(__dirname, 'dist', 'server.js');
const child = childProcess.spawn('node', [serverPath], {
    stdio: 'inherit'
});
child.on('exit', (code, signal) => {
    process.exit(signal ? 1 : code ?? 1);
});
