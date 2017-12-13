import { checkStringForRegexp } from 'util'
/** @type {String} regexp to check filenames to apply to */
export const filenamePattern = '.*\\.js';

/**
 * Checks the input file to comply to the rule
 * pushes errors to `errors` array
 * @param  {Object} file file in question
 * @param  {string} file.name name of the file
 * @param  {string} file.content content of the file
 * @param  {Array} options  main options array
 * @param  {Array} errors   errors array to push to
 */
export function check(file, options, errors) {
    checkStringForRegexp(file.content, 'console\\.', function (index) {
        errors.push({
            problem: 'no console calls',
            solution: 'use logging library',
            file: file,
            index: index,
        });
    });
}
