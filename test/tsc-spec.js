var helper = require('./helper');
var tsc = require('../lib/tsc');
var sinon = require('sinon');
var child_process = require('child_process');
var shellescape = require('../lib/shellescape');

describe('tsc', function () {
  var execStub;

  beforeEach(function () {
    execStub = sinon.stub(child_process, 'exec');
  });

  afterEach(function () {
    execStub.restore();
  });

  it('executes tsc command', function (done) {
    execStub.callsArgWith(2, null);
    execStub.returns('return value');

    var ret = tsc.exec('foo bar', function (err) {
      if (err) return done(err);

      execStub.calledOnce.should.be.true;

      var command = execStub.args[0][0];
      command.should.match(/^.+?tsc(\.cmd|\.exe)?"? foo bar$/i);

      done();
    });
    ret.should.equal('return value');
  });

  it('returns the version of tsc command', function (done) {
    var parser = tsc.versionParser(function (err, version) {
      if (err) return done(err);
      version.should.equal('1.6.2');

      done();
    });
    parser("message TS6029: Version 1.6.2", "");
  });
  
  it('returns the version of tsc 1.6 command', function (done) {
    execStub.callsArgWith(2, null, 'Version 12.34.56.78\n', '');
    execStub.returns('return value');

    var ret = tsc.version(function (err, version) {
      if (err) return done(err);
      version.should.equal('12.34.56.78');

      execStub.calledOnce.should.be.true;

      var command = execStub.args[0][0];
      command.should.match(/^.+?tsc(\.cmd|\.exe)?"? -v$/i);

      done();
    });
    ret.should.equal('return value');
  });

  it('returns the version of tsc command 3 parts', function (done) {
    execStub.callsArgWith(2, null, 'Version 12.34.56\n', '');
    execStub.returns('return value');

    var ret = tsc.version(function (err, version) {
      if (err) return done(err);
      version.should.equal('12.34.56');

      execStub.calledOnce.should.be.true;

      var command = execStub.args[0][0];
      command.should.match(/^.+?tsc(\.cmd|\.exe)?"? -v$/i);

      done();
    });
    ret.should.equal('return value');
  });

  it('returns the version of tsc command 1.5.0 alpha', function (done) {
    execStub.callsArgWith(2, null, 'message TS6029: Version 1.5.0-alpha\n', '');
    execStub.returns('return value');

    var ret = tsc.version(function (err, version) {
      if (err) return done(err);
      version.should.equal('1.5.0-alpha');

      execStub.calledOnce.should.be.true;

      var command = execStub.args[0][0];
      command.should.match(/^.+?tsc(\.cmd|\.exe)?"? -v$/i);

      done();
    });
    ret.should.equal('return value');
  });

  it('finds the tsc command location', function () {
    tsc.find().should.match(/tsc(\.cmd|\.exe)?$/i);
  });

});
