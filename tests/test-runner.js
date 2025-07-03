#!/usr/bin/env node

/**
 * Test runner utility for Digital PR Extension
 * Provides helpful commands for running and debugging tests
 */

const { spawn } = require('child_process');
const path = require('path');

const command = process.argv[2];
const args = process.argv.slice(3);

const commands = {
  'all': {
    description: 'Run all tests',
    cmd: 'jest',
    args: []
  },
  'unit': {
    description: 'Run unit tests only',
    cmd: 'jest',
    args: ['tests/unit']
  },
  'watch': {
    description: 'Run tests in watch mode',
    cmd: 'jest',
    args: ['--watch']
  },
  'coverage': {
    description: 'Run tests with coverage',
    cmd: 'jest',
    args: ['--coverage']
  },
  'base': {
    description: 'Run BaseModule tests',
    cmd: 'jest',
    args: ['tests/unit/base-module.test.js']
  },
  'cache': {
    description: 'Run UnifiedCache tests',
    cmd: 'jest',
    args: ['tests/unit/unified-cache.test.js']
  },
  'storage': {
    description: 'Run StorageManager tests',
    cmd: 'jest',
    args: ['tests/unit/storage-manager.test.js']
  },
  'debug': {
    description: 'Run tests with debugging enabled',
    cmd: 'node',
    args: ['--inspect-brk', 'node_modules/.bin/jest', '--runInBand']
  }
};

function showHelp() {
  console.log('Digital PR Extension Test Runner\n');
  console.log('Usage: node test-runner.js <command> [options]\n');
  console.log('Commands:');
  Object.entries(commands).forEach(([name, config]) => {
    console.log(`  ${name.padEnd(10)} - ${config.description}`);
  });
  console.log('\nExamples:');
  console.log('  node test-runner.js all');
  console.log('  node test-runner.js unit --verbose');
  console.log('  node test-runner.js coverage');
}

if (!command || command === 'help' || !commands[command]) {
  showHelp();
  process.exit(0);
}

const config = commands[command];
const finalArgs = [...config.args, ...args];

console.log(`Running: ${config.cmd} ${finalArgs.join(' ')}\n`);

const child = spawn(config.cmd, finalArgs, {
  stdio: 'inherit',
  shell: true
});

child.on('error', (error) => {
  console.error('Failed to run tests:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code);
});