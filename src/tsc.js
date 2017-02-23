/// <reference path="../typings/node/node.d.ts"/>
'use strict';

var path = require('path');
var fs = require('fs');
var child_process = require('child_process');
var resolve = require('resolve');
var which = require('which');
var shellescape = require('./shellescape');

function exec(args, options, callback) {
    if (!callback && typeof options === 'function') {
        callback = options;
        options = {};
    }

    if (!options && typeof args === 'function') {
        callback = args;
        args = null;
    }

    options = options || {};
    var tscPath = options.path;
        if (!tscPath) {
        try {
            tscPath = find(options.search);
        } catch (e) {
            return callback && callback(e);
        }
    }

    var exe = /(\.exe|\.cmd)$/i.test(tscPath);
    var command = shellescape(exe ? [tscPath] : [process.execPath, tscPath]);
    if (args && args.length > 0) {
        command += ' ' + (Array.isArray(args) ? shellescape(args) : args);
    }

    return child_process.exec(command, options, callback);
}

function versionParser(callback) {
    return function (stdout, stderr) {
        if (!stdout) {
            callback(null, null);
            return;
        }
      
        var versionMatch = stdout.match(/Version (\d+\.\d+\.\d+((\.\d+)|(-alpha))?)/);
        if (versionMatch.length > 1) {
            callback(null, versionMatch[1]);
            return;
        }

        // versionMatch = stdout.match(/Version (\d+\.\d+\.\d+((\.\d+)|(-alpha)))/);
        // version = version && version[1];

        callback(null, null);
    };
}

function version(options, callback) {
    if (!callback && typeof options === 'function') {
        callback = options;
        options = {};
    }

    return exec('-v', options, function (err, stdout, stderr) {
        if (err) {
            return callback(err, null);
        }

        var parser = versionParser(callback);
        parser(stdout, stderr);
    });
}

function find(places) {
    places = places || ['cwd', 'bundle', 'shell'];
    for (var i = 0; i < places.length; i++) {
        var fn = searchFunctions[places[i]];
        if (!fn) {
            throw new Error('Unknown search place: ' + places[i]);
        }

        var found = fn();
        if (found) {
            return found;
        }
    }
  
    throw new Error('Can\'t locate `tsc` command');
}

var searchFunctions = {
    cwd: function () {
        try {
            var tpath = resolve.sync('typescript', { basedir: process.cwd() });
            var tscPath = path.resolve(path.dirname(tpath), 'tsc');
            return fs.existsSync(tscPath) ? tscPath : null;
        } catch (e) {
            return null;
        }
    },
    shell: function () {
        try { 
            return which.sync('tsc');
        } catch (e) { 
            return null;
        }
    },
    bundle: function () {
        try { 
            return path.resolve(require.resolve('typescript'), '../tsc');
        } catch (e) { 
            return null 
        }
    }
};

module.exports = {
    exec: exec,
    version: version,
    find: find,
    versionParser: versionParser
}

