import defaultOptions from 'default-options'
import { multiGlobSync, checkStringForRegexp } from 'util'
import spawnPromise from 'spawn-promise'
import path from 'path'
import fs from 'fs'
import { CLIEngine } from 'eslint'
import basename from 'basename'
import jsonlint from 'jsonlint'

/**
 * Main operating class, used for CLI and API operations
 */
export default class Enforcer {
    /**
     * Creates instance of Enforcer
     * @param  {Object} options read from .code-enforcer.json
     */
    constructor(options) {
        /** @type {Object} options dictionary */
        this.options = options;

        for(const key in defaultOptions) {
            if (this.options[key] === undefined) {
                this.options[key] = defaultOptions[key];
            }
        }

        /** @type {Array} errors accumulated this far */

        this.errors = [];

        /** @type {Array} rules with their handlers */
        this.rules = [];
    }

    /**
     * Iterates list of filenames and reads their content from disk
     * @param  {Array<string>} list of filenames
     * @return {Array} each record has `name` and `content`
     */

    readFiles(list) {
        return list.map(function (file) {
            return {
                name: file,
                content: fs.readFileSync(file, 'utf8'),
            };
        });
    }

    /**
     * Reads JS and JSON file list from config and loads files
     */
    buildFileList() {
        /** @type {Array} array of memory cached JS files */
        this.jsFiles = multiGlobSync(this.options.jsFiles.include, { ignore: this.options.jsFiles.ignore });

        /** @type {Array} array of memory cached JSON files */
        this.jsonFiles = multiGlobSync(this.options.jsonFiles.include, { ignore: this.options.jsonFiles.ignore });

        this.jsFiles = this.readFiles(this.jsFiles);
        this.jsonFiles = this.readFiles(this.jsonFiles);
    }

    /**
     * Dynamically loads rules from `src/rules/*.js` folder
     */

    loadRules() {
        const files = multiGlobSync([path.join(__dirname, 'rules', '*.js')]);

        for(const file of files) {
            this.rules[basename(file)] = require(path.resolve(file));
        }
    }

    /**
     * Runs ESDoc and validates linting errors and coverage
     */
    async checkESDoc() {
        await spawnPromise(path.join('node_modules', '.bin', 'esdoc'));

        const esDocConfig = JSON.parse(fs.readFileSync(path.join('.esdoc.json')));
        const rootPath = path.resolve(esDocConfig.destination);
        const coverage = JSON.parse(fs.readFileSync(path.join(rootPath, 'coverage.json'), 'utf-8'));

        for(const file in coverage.files) {
            if (this.options.ESDocIgnore.find(re => file.match(re))) {
                continue
            }

            const data = coverage.files[file];
            const percent = 100 * data.actualCount / data.expectCount;
            if (percent !== 100) {
                for(const lineNumber of data.undocumentLines) {
                    this.errors.push({
                        problem: 'not documented',
                        solution: 'add documentation comments: /** */',
                        file: {
                            name: file,
                            content: fs.readFileSync(file, 'utf-8'),
                        },
                        lineNumber: lineNumber,
                    });
                }
            }
        };

        const linting = JSON.parse(fs.readFileSync(path.join(rootPath, 'lint.json'), 'utf-8'));

        for(const record of linting) {
            this.errors.push({
                problem: `doc linting error for ' + ${[...record.codeParams, ...record.docParams].join(',')}`,
                solution: 'fix the documentation (parameters, return types)',
                file: {
                    name: record.filePath,
                    content: fs.readFileSync(record.filePath, 'utf-8'),
                },
                lineNumber: record.lines[0].lineNumber + 1,
            });
        }
    }

    /**
     * Checks `package.json` file for validity
     */
    checkPackageJSON() {
        const content = fs.readFileSync('package.json', 'utf-8');
        checkStringForRegexp(content, /"\^(\d+)\.(\d+)\.(\d+)"/, index => {
            this.errors.push({
                problem: 'versions in package.json should be fixed',
                solution: 'remove ^',
                file: {
                    name: 'package.json',
                    content,
                },
                index,
            });
        });
    }

    /**
     * Runs `jsonlint` on all `.json` files
     */
    runJSONLint() {
        for(const file of this.jsonFiles) {
            let stringified

            try {
                const parsed = jsonlint.parse(file.content);
                stringified = JSON.stringify(parsed, null, 2);
            } catch (err) {
                this.errors.push({
                    problem: 'json file failed to parse: ' + err.toString(),
                    solution: 'fix formatting errors',
                    file: file,
                });
            }
            if (stringified.trim() !== file.content.trim()) {
                this.errors.push({
                    problem: 'json file needs proper formatting',
                    solution: 'run jsonlint --in-place',
                    file: file,
                });
            }
        }
    }

    /**
     * Runs `eslint` on all `.js` files
     */
    runESLint() {
        const engine = new CLIEngine({
            useEslintrc: true,
        });

        const results = engine.executeOnFiles(this.jsFiles.map(file => file.name)).results;

        for(const result of results) {
            const filePath = result.filePath
            const messages = result.messages;
            for(const message of messages) {
                this.errors.push({
                    file: {
                        name: filePath,
                        content: fs.readFileSync(filePath, 'utf-8'),
                    },
                    problem: message.message.slice(0, -1) + ' - ' + message.ruleId,
                    solution: 'run eslint --fix',
                    lineNumber: message.line,
                    columnNumber: message.column,
                });
            }
        }
    }

    /**
     * Performs all the checks
     */
    async run() {
        this.loadRules();
        this.buildFileList();
        await this.checkESDoc();
        for(const ruleName in this.rules) {
            const rule = this.rules[ruleName]
            for(const file of this.jsFiles) {
                const patterns = this.options.disableRules[ruleName] || []
                if(patterns.find(rule => file.name.match(rule))) {
                    continue
                }
                if(!file.name.match(rule.filenamePattern)) {
                    continue
                }
                rule.check(file, this.options, this.errors)
            }
        }
        this.runESLint();
        this.runJSONLint();
        this.checkPackageJSON();
    }
}
