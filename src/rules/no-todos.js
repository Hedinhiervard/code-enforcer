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
    const tags = options.todoTags;
    const commentRegexp = new RegExp(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/, 'gm');

    let commentMatch
    while ((commentMatch = commentRegexp.exec(file.content)) !== null) {
        const comment = commentMatch[0];
        for(const tag of tags) {
            const tagRegexp = new RegExp('@?' + tag + '.*$', 'gim');
            let tagMatch

            while ((tagMatch = tagRegexp.exec(comment)) !== null) {
                errors.push({
                    problem: 'don\'t use ' + tags.join(',') + ' tags',
                    solution: 'create tickets in your tracker',
                    file: file,
                    index: commentMatch.index + tagMatch.index,
                });
            }
        }
    }
}
