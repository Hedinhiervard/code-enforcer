#!/usr/bin/env node

import yargs from 'yargs'
import path from 'path'
import fs from 'fs'
import chalk from 'chalk'
import defaultOptions from 'default-options'
import Enforcer from 'Enforcer'

/** @type {Array} command options */
const argv = yargs.option('config-file', {
    describe: 'config file name',
    default: '.code-enforcer.json',
}).option('solutions', {
    describe: 'show solutions to problems',
    type: 'boolean',
    default: false,
}).argv;

/** @type {String} path to options file */
const optionsFile = path.resolve(argv['config-file']);

/**
 * Returns line and its number by char index in the string
 * @param  {string} string input string
 * @param  {int} index  position of character
 * @return {int} lineNumber in which the char is located
 * @return {strig} line in which the char is located
 */
function lineByIndex(string, index) {
    let lineNumber = 0;
    let match
    let line
    let markLine
    const re = /(^)(.*)[\S\s]/gm;
    while (match = re.exec(string)) {
        if (match.index > index) {
            break;
        }
        markLine = ' '.repeat(index - match.index + 2) + '^';
        line = match[2];
        lineNumber++;
    }
    return { lineNumber: lineNumber, line: line, markLine: markLine };
}

/**
 * Returns line by its number
 * @param  {string} string input string
 * @param  {number} number line number
 * @return {string} line
 */
function lineByNumber(string, number) {
    let lineNumber = 0;
    let match
    let line
    const re = /(^)(.*)[\S\s]/gm;
    while (match = re.exec(string)) {
        if (lineNumber >= number) {
            break;
        }
        line = match[2];
        lineNumber++;
    }
    const markLine = '^';
    return { line: line, markLine: markLine };
}

/**
 * formats and pretty prints to console the messages from `arr`
 * @param  {Array} arr array of messages
 */
function printMessages(arr) {
    for(const msg of arr) {
        let lineNumber
        let line
        let markLine

        if (msg.index) {
            ({ lineNumber, line, markLine } = lineByIndex(msg.file.content, msg.index));
        } else if (msg.lineNumber) {
            lineNumber = msg.lineNumber;

            ({ line, markLine } = lineByNumber(msg.file.content, msg.lineNumber))
        }

        let solution = '';
        if (argv.solutions && msg.solution) {
            solution = chalk`({white ${solution}}`
        }
        let lineNumberStr = '';
        if (lineNumber) {
            lineNumberStr = chalk`{blue ${lineNumber}}`
        }

        console.log(chalk`${msg.file.name}: ${lineNumberStr}: ${msg.problem} ${solution}`);

        if (line) {
            console.log('  ' + line);
        }
        if (markLine) {
            console.log(chalk`{red ${markLine}}`);
        }
        console.log('');
    }
}

/**
 * Main Function
 */
(async function() {
    let options

    try {
        options = JSON.parse(fs.readFileSync(optionsFile, 'utf-8'));
    } catch (err) {
        console.log(`failed to read ${optionsFile}: ${err.toString()}`)
        options = defaultOptions;
    }
    const enforcer = new Enforcer(options)
    await enforcer.run(options);

    if (enforcer.errors.length === 0) {
        process.exit(0);
    } else {
        console.log('Errors:');
        printMessages(enforcer.errors);
        console.log(chalk`{red Errors: ${enforcer.errors.length}}`)
        process.exit(1);
    }
}());
