'use strict';

function shellescape(arg) {
    if (Array.isArray(arg)) {
        return arg.map(shellescape).join(" ");
    } else {
        if (/["'` \\$]/.test(arg)) {
            return '"' + arg.replace(/(["`\\$])/g, '\\$1') + '"';
        } else {
            return '"' + arg + '"';
        }
    }
}

module.exports = shellescape;