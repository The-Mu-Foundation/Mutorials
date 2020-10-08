// check if two arrays are equal
function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    // If you don't care about the order of the elements inside the array, you should sort both arrays here.
    // Please note that calling sort on an array will modify that array.
    // you might want to clone your array first.

    for (let i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

// delimiter parsing method: input is a string, output is an array of the values
function parseDelimiter(input) {
    return input.split("@");
}

function average(nums) {
    let sum = 0;
    nums.forEach((num) => {
        sum += num;
    })
    return sum/nums.length;
}

module.exports = { arraysEqual , parseDelimiter, average };