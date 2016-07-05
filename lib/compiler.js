'use strict';

var tsc = require('./tsc');
var fs = require('fs');
var path = require('path');
var util = require('util');
var _ = require('lodash');
var async = require('async');
var byline = require('byline');
var temp = require('temp');
var rimraf = require('rimraf');
var through = require('through2');
var fsSrc = require('vinyl-fs').src;
var EventEmitter = require('events').EventEmitter;
var versionCompare = require('node-version-compare');

function Compiler(sourceFiles, options) {
    EventEmitter.call(this);
    
    this.sourceFiles = sourceFiles || [];
    
    var defaultModule = options && (options.target === 'ES6' || options.target === 'ES2015') ? null : 'commonjs';
    
    this.options = _.extend({
        tscPath:           null,
        tscSearch:         null,
        module:            defaultModule,
        target:            'ES3',
        out:               null,
        outDir:            null,
        mapRoot:           null,
        sourceRoot:        null,
        allowbool:         false,
        allowimportmodule: false,
        declaration:       false,
        noImplicitAny:     false,
        noResolve:         false,
        removeComments:    false,
        sourceMap:         false,
        suppressImplicitAnyIndexErrors: false,
        tmpDir:            '',
        noLib:             false,
        keepTree:          true,
        noEmitOnError:     false,
        pathFilter:        null,
        safe:              false,
        emitDecoratorMetadata: false,
        experimentalDecorators: false,
        forceConsistentCasingInFileNames: false,
        allowSyntheticDefaultImports: false,
        noImplicitUseStrict: false,
        stripInternal: false,
        inlineSourceMap: false,
        inlineSources: false,
        isolatedModules: false,
        listFiles: false,
        additionalTscParameters: []
    }, options);
    this.options.sourceMap = this.options.sourceMap || this.options.sourcemap;
    delete this.options.sourcemap;
    
    this.tscOptions = {
        path:   this.options.tscPath,
        search: this.options.tscSearch
    };

    this.tempDestination = null;
    this.tscArgumentsFile = null;
    this.treeKeeperFile  = null;
}
util.inherits(Compiler, EventEmitter);

Compiler.prototype.buildTscArguments = function (version) {
  var args = [];
  if (version === undefined) {
      version = "1.5";
  }

  version = version.substring(0, 3);

  if (this.options.module)            args.push('--module',     this.options.module.toLowerCase());
  if (this.options.target)            args.push('--target',     this.options.target.toUpperCase());
  if (this.options.mapRoot)           args.push('--mapRoot',    this.options.mapRoot);
  if (this.options.sourceRoot)        args.push('--sourceRoot', this.options.sourceRoot);
  if (this.options.allowbool)         args.push('--allowbool');
  if (this.options.allowimportmodule) args.push('--allowimportmodule');
  if (this.options.suppressImplicitAnyIndexErrors 
    && (version.indexOf("1.5") === 0 
        || version.indexOf("1.6") === 0 
        || version.indexOf("1.7") === 0 
        || version.indexOf("1.8") === 0)) args.push('--suppressImplicitAnyIndexErrors');
  if (this.options.declaration)       args.push('--declaration');
  if (this.options.noImplicitAny)     args.push('--noImplicitAny');
  if (this.options.noResolve)         args.push('--noResolve');
  if (this.options.removeComments)    args.push('--removeComments');
  if (this.options.sourceMap)         args.push('--sourcemap');
  if (this.options.noLib)             args.push('--noLib');
  if (this.options.jsx 
    && (version.indexOf("1.6") === 0 
        || version.indexOf("1.7") === 0 
        || version.indexOf("1.8") === 0)) args.push('--jsx');
  if (this.options.emitDecoratorMetadata)    args.push('--emitDecoratorMetadata');
  if (this.options.experimentalDecorators)    args.push('--experimentalDecorators');
  if (this.options.allowJs
    && (version.indexOf("1.8") === 0))    args.push('--allowJs');
  if (this.options.reactNamespace
    && (version.indexOf("1.8") === 0))    args.push('--reactNamespace');
  if (this.options.allowUnusedLabels
    && (version.indexOf("1.8") === 0))    args.push('--allowUnusedLabels');
  if (this.options.allowUnreachableCode
    && (version.indexOf("1.8") === 0))    args.push('--allowUnreachableCode');
  if (this.options.noImplicitReturns
    && (version.indexOf("1.8") === 0))    args.push('--noImplicitReturns');
  if (this.options.noFallthroughCasesInSwitch
    && (version.indexOf("1.8") === 0))    args.push('--noFallthroughCasesInSwitch');
  if (this.options.forceConsistentCasingInFileNames
    && (version.indexOf("1.8") === 0))    args.push('--forceConsistentCasingInFileNames');
  if (this.options.allowSyntheticDefaultImports
    && (version.indexOf("1.8") === 0))    args.push('--allowSyntheticDefaultImports');
    if (this.options.noImplicitUseStrict && (version.indexOf("1.8") === 0)) {
        args.push('--noImplicitUseStrict');
    }
    
    if (this.options.stripInternal && (version.indexOf("1.8") === 0)) {
        args.push('--stripInternal');
    }
    
    if (this.options.inlineSourceMap && (version.indexOf("1.8") === 0)) {
        args.push('--inlineSourceMap');
    }
    
    if (this.options.inlineSources && (version.indexOf("1.8") === 0)) {
        args.push('--inlineSources');
    }
    
    if (this.options.isolatedModules && (version.indexOf("1.8") === 0)) {
        args.push('--isolatedModules');
    }
    
    if (this.options.listFiles && (version.indexOf("1.8") === 0)) {
        args.push('--listFiles');
    }

    if (this.options.noEmitOnError && versionCompare(version, "1.4") >= 0) {
        args.push('--noEmitOnError');
    }
  if (this.options.additionalTscParameters)   this.options.additionalTscParameters.forEach(function (param) { args.push(param); });

  if (this.tempDestination) {
    args.push('--outDir', this.tempDestination);
    if (this.options.out) {
      args.push('--out', path.resolve(this.tempDestination, this.options.out));
    }
  } else if (this.options.out) {
    args.push('--out', this.options.out);
  }

  this.sourceFiles.forEach(function (f) { args.push(f.path); });
  if (this.treeKeeperFile) {
    args.push(this.treeKeeperFile);
  }

  return args;
};

Compiler.prototype.getVersion = function (callback) {
  return tsc.version(this.tscOptions, callback);
};

Compiler.prototype.compile = function (callback) {
  var _this = this;
  var checkAborted = this.checkAborted.bind(this);

  this.emit('start');
  Compiler._start(this);

  async.waterfall([
    checkAborted,
    this.makeTempDestinationDir.bind(this),
    checkAborted,
    this.makeTreeKeeperFile.bind(this),
    checkAborted,
    this.prepareTscArgumentsFile.bind(this),
    checkAborted,
    this.runTsc.bind(this),
    checkAborted
  ], function (err) {
    if (err && _this.options.safe) {
      finish(err);
    } else {
      _this.processOutputFiles(function (err2) {
        finish(err || err2);
      });
    }
  });

  function finish(err) {
    _this.cleanup();
    _this.emit('end');
    callback(err);
  }
};

Compiler.prototype.checkAborted = function (callback) {
  if (Compiler.isAborted()) {
    callback(new Error('aborted'));
  } else {
    callback(null);
  }
};

Compiler.prototype.makeTempDestinationDir = function (callback) {
  var _this = this;
  temp.track();
  temp.mkdir({ dir: path.resolve(process.cwd(), this.options.tmpDir), prefix: 'gulp-tsc-tmp-' }, function (err, dirPath) {
    if (err) return callback(err);
    _this.tempDestination = dirPath;

    callback(null);
  });
};

Compiler.prototype.makeTreeKeeperFile = function (callback) {
  if (!this.options.keepTree || this.options.out || this.sourceFiles.length === 0) {
    return callback(null);
  }

  var _this = this;
  temp.open({ dir: this.sourceFiles[0].base, prefix: '.gulp-tsc-tmp-', suffix: '.ts' }, function (err, file) {
    if (err) {
      return callback(new Error(
        'Failed to create a temporary file on source directory: ' + (err.message || err) + ', ' +
        'To skip creating it specify { keepTree: false } to your gulp-tsc.'
      ));
    }

    _this.treeKeeperFile = file.path;
    try {
      fs.writeSync(file.fd, '// This is a temporary file by gulp-tsc for keeping directory tree.\n');
      fs.closeSync(file.fd);
    } catch (e) {
      return callback(e);
    }
    callback(null);
  });
};

Compiler.prototype.prepareTscArgumentsFile = function(callback) {
    this.getVersion(function (error, version) {
        var tscArguments = this.buildTscArguments(version);
        var content = '"' + tscArguments.join('"\n"') + '"';
        this.tscArgumentsFile = path.join(this.tempDestination, 'tscArguments');
        fs.writeFile(this.tscArgumentsFile, content, callback);
    }.bind(this));
};

Compiler.prototype.runTsc = function (callback) {
  var _this = this;
  var proc = tsc.exec(['@' + this.tscArgumentsFile], this.tscOptions);
  var stdout = byline(proc.stdout);
  var stderr = byline(proc.stderr);

  proc.on('exit', function (code) {
    if (code !== 0) {
      callback(new Error('tsc command has exited with code:' + code));
    } else {
      callback(null);
    }
  })
  proc.on('error', function (err) {
    _this.emit('error', err);
  });
  stdout.on('data', function (chunk) {
    _this.emit('stdout', chunk.toString('utf8'));
  });
  stderr.on('data', function (chunk) {
    _this.emit('stderr', chunk.toString('utf8'));
  });

  return proc;
};

Compiler.prototype.processOutputFiles = function (callback) {
  var _this = this;
  var options = { cwd: this.tempDestination, cwdbase: true };
  var patterns = ['**/*{.js,.js.map,.d.ts}'];
  if (this.treeKeeperFile) {
    patterns.push('!**/' + path.basename(this.treeKeeperFile, '.ts') + '.*');
  }

  var stream = fsSrc(patterns, options);
  stream = stream.pipe(this.fixOutputFilePath());
  if (this.options.sourceMap && !this.options.sourceRoot) {
    stream = stream.pipe(this.fixSourcemapPath());
  }
  if (this.options.declaration && this.options.outDir) {
    stream = stream.pipe(this.fixReferencePath());
  }
  stream.on('data', function (file) {
    _this.emit('data', file);
  });
  stream.on('error', function (err) {
    callback(err);
  });
  stream.on('end', function () {
    callback();
  });
};

Compiler.prototype.fixOutputFilePath = function () {
  var filter = this.options.pathFilter && this.filterOutput.bind(this);
  var outDir;
  if (this.options.outDir) {
    outDir = path.resolve(process.cwd(), this.options.outDir);
  } else {
    outDir = this.tempDestination;
  }

  return through.obj(function (file, encoding, done) {
    file.originalPath = file.path;
    file.path = path.resolve(outDir, file.relative);
    file.cwd = file.base = outDir;
    if (filter) {
      try {
        file = filter(file);
      } catch (e) {
        return done(e);
      }
    }
    if (file) this.push(file);
    done();
  });
};

Compiler.prototype.filterOutput = function (file) {
  if (!this.options.pathFilter) return file;

  var filter = this.options.pathFilter;
  if (_.isFunction(filter)) {
    var ret = filter(file.relative, file);
    if (ret === true || _.isUndefined(ret)) {
      return file;
    } else if (ret === false) {
      return null;
    } else if (_.isString(ret)) {
      file.path = path.resolve(file.base, ret);
      return file;
    } else if (_.isObject(ret) && ret.path) {
      return ret;
    } else {
      throw new Error('Unknown return value from pathFilter function');
    }
  } else if (_.isPlainObject(filter)) {
    _.forOwn(filter, function (val, key) {
      if (_.isString(key) && _.isString(val)) {
        var src = path.normalize(key) + path.sep;
        if (file.relative.substr(0, src.length) === src) {
          file.path = path.resolve(file.base, val, file.relative.substr(src.length) || '.');
          return false;
        }
      }
    });
    return file;
  } else {
    throw new Error('Unknown type for pathFilter');
  }
};

Compiler.prototype.fixSourcemapPath = function () {
  return through.obj(function (file, encoding, done) {
    if (!file.isBuffer() || !/\.js\.map/.test(file.path)) {
      this.push(file);
      return done();
    }

    var map = JSON.parse(file.contents);
    if (map['sources'] && map['sources'].length > 0) {
      map['sources'] = map['sources'].map(function (sourcePath) {
        sourcePath = path.resolve(path.dirname(file.originalPath), sourcePath);
        sourcePath = path.relative(path.dirname(file.path), sourcePath);
        if (path.sep == '\\') sourcePath = sourcePath.replace(/\\/g, '/');
        return sourcePath;
      });
      file.contents = new Buffer(JSON.stringify(map));
    }
    this.push(file);
    done();
  });
};

Compiler.prototype.fixReferencePath = function () {
  return through.obj(function (file, encoding, done) {
    if (!file.isBuffer() || !/\.d\.ts/.test(file.path)) {
      this.push(file);
      return done();
    }

    var newContent = file.contents.toString().replace(
      /(\/\/\/\s*<reference\s*path\s*=\s*)(["'])(.+?)\2/g,
      function (entire, prefix, quote, refPath) {
        refPath = path.resolve(path.dirname(file.originalPath), refPath);
        refPath = path.relative(path.dirname(file.path), refPath);
        if (path.sep == '\\') refPath = refPath.replace(/\\/g, '/');
        return prefix + quote + refPath + quote;
      }
    );
    file.contents = new Buffer(newContent);
    this.push(file);
    done();
  });
};

Compiler.prototype.cleanup = function () {
  try { rimraf.sync(this.tempDestination); } catch(e) {}
  try { fs.unlinkSync(this.treeKeeperFile); } catch(e) {}
};

Compiler.running = 0;
Compiler.aborted = false;
Compiler.abortCallbacks = [];

Compiler.abortAll = function (callback) {
  Compiler.aborted = true;
  callback && Compiler.abortCallbacks.push(callback);
  if (Compiler.running == 0) {
    Compiler._allAborted();
  }
};

Compiler.isAborted = function () {
  return Compiler.aborted;
};

Compiler._start = function (compiler) {
  Compiler.running++;
  compiler.once('end', function () {
    Compiler.running--;
    if (Compiler.running == 0 && Compiler.aborted) {
      Compiler._allAborted();
    }
  });
};

Compiler._allAborted = function () {
  var callbacks = Compiler.abortCallbacks;
  Compiler.aborted = false;
  Compiler.abortCallbacks = [];
  callbacks.forEach(function (fn) {
    fn.call(null);
  });
};

module.exports = Compiler;
