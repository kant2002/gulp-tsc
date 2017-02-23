'use strict';

export function shellescape(arg: string | string[]): string {
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
