import glob from 'glob'

/**
 * Globs files for multiple patterns
 * @param  {Array<string>} patterns array of patters
 * @param  {Object} options  to pass to each glob
 * @return {Array<string>} found files
 */
export function multiGlobSync(patterns, options) {
    const result = [];
    for(const pattern of patterns) {
        result.push(...glob.sync(pattern, options));
    }
    return result;
}

/**
 * Runs `pattern` agains `content` and calls `onMatch` with char index on each match
 * @param  {string} content input string
 * @param  {string} pattern regexp
 * @param  {function} onMatch callback to call on each match
 */
export function checkStringForRegexp(content, pattern, onMatch) {
    var re = new RegExp(pattern, 'mg');
    let match
    while (match = re.exec(content)) {
        onMatch(match.index);
    }
}
