/**
 * @fileoverview Tests for configInitializer.
 * @author Ilya Volodin
 */

"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

var assert = require("chai").assert,
    fs = require("fs"),
    path = require("path"),
    os = require("os"),
    sinon = require("sinon"),
    sh = require("shelljs"),
    proxyquire = require("proxyquire");

var originalDir = process.cwd();
proxyquire = proxyquire.noCallThru().noPreserveCache();

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

var answers = {};

describe("configInitializer", function() {

    var fixtureDir,
        init;
    var fakeNpm = {
        checkInstalled: function(packages) {
            return packages.reduce(function(status, pkg) {
                status[pkg] = true;
                return status;
            }, {});
        },
        installSyncSaveDev: function() {}
    };
    var log = {
        info: sinon.spy(),
        error: sinon.spy()
    };
    var requireStubs = {
        "../util/npm-util": fakeNpm,
        "../logging": log
    };

    /**
     * Returns the path inside of the fixture directory.
     * @returns {string} The path inside the fixture directory.
     * @private
     */
    function getFixturePath() {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(fixtureDir);
        var filepath = path.join.apply(path, args);
        try {
            filepath = fs.realpathSync(filepath);
            return filepath;
        } catch (e) {
            return filepath;
        }
    }

    // copy into clean area so as not to get "infected" by this project's .eslintrc files
    before(function() {
        fixtureDir = os.tmpdir() + "/eslint/fixtures/config-initializer";
        sh.mkdir("-p", fixtureDir);
        sh.cp("-r", "./tests/fixtures/config-initializer/.", fixtureDir);
        fixtureDir = fs.realpathSync(fixtureDir);
    });

    beforeEach(function() {
        process.chdir(fixtureDir);
        init = proxyquire("../../../lib/config/config-initializer", requireStubs);
    });

    afterEach(function() {
        process.chdir(originalDir);
    });

    after(function() {
        sh.rm("-r", fixtureDir);
    });

    describe("processAnswers()", function() {

        describe("prompt", function() {

            beforeEach(function() {
                answers = {
                    source: "prompt",
                    extendDefault: true,
                    indent: 2,
                    quotes: "single",
                    linebreak: "unix",
                    semi: true,
                    es6: true,
                    env: ["browser"],
                    jsx: false,
                    react: false,
                    format: "JSON",
                    commonjs: false
                };
            });

            it("should create default config", function() {
                var config = init.processAnswers(answers);
                assert.deepEqual(config.rules.indent, [2, 2]);
                assert.deepEqual(config.rules.quotes, [2, "single"]);
                assert.deepEqual(config.rules["linebreak-style"], [2, "unix"]);
                assert.deepEqual(config.rules.semi, [2, "always"]);
                assert.equal(config.env.es6, true);
                assert.equal(config.env.browser, true);
                assert.equal(config.extends, "eslint:recommended");
            });

            it("should disable semi", function() {
                answers.semi = false;
                var config = init.processAnswers(answers);
                assert.deepEqual(config.rules.semi, [2, "never"]);
            });

            it("should enable jsx flag", function() {
                answers.jsx = true;
                var config = init.processAnswers(answers);
                assert.equal(config.parserOptions.ecmaFeatures.jsx, true);
            });

            it("should enable react plugin", function() {
                answers.jsx = true;
                answers.react = true;
                var config = init.processAnswers(answers);
                assert.equal(config.parserOptions.ecmaFeatures.jsx, true);
                assert.equal(config.parserOptions.ecmaFeatures.experimentalObjectRestSpread, true);
                assert.deepEqual(config.plugins, ["react"]);
            });

            it("should not enable es6", function() {
                answers.es6 = false;
                var config = init.processAnswers(answers);
                assert.isUndefined(config.env.es6);
            });

            it("should extend eslint:recommended", function() {
                var config = init.processAnswers(answers);
                assert.equal(config.extends, "eslint:recommended");
            });

            it("should support the google style guide", function() {
                var config = init.getConfigForStyleGuide("google");
                assert.deepEqual(config, {extends: "google"});
            });

            it("should support the airbnb style guide", function() {
                var config = init.getConfigForStyleGuide("airbnb");
                assert.deepEqual(config, {extends: "airbnb", plugins: ["react"]});
            });

            it("should support the standard style guide", function() {
                var config = init.getConfigForStyleGuide("standard");
                assert.deepEqual(config, {extends: "standard", plugins: ["standard"]});
            });

            it("should throw when encountering an unsupported style guide", function() {
                assert.throws(function() {
                    init.getConfigForStyleGuide("non-standard");
                }, "You referenced an unsupported guide.");
            });

            it("should not use commonjs by default", function() {
                var config = init.processAnswers(answers);
                assert.isUndefined(config.env.commonjs);
            });

            it("should use commonjs when set", function() {
                answers.commonjs = true;
                var config = init.processAnswers(answers);
                assert.isTrue(config.env.commonjs);
            });
        });

        describe("auto", function() {
            var config,
                origLog,
                completeSpy = sinon.spy();

            before(function() {
                var patterns = [
                    getFixturePath("lib"),
                    getFixturePath("tests")
                ].join(" ");
                answers = {
                    source: "auto",
                    patterns: patterns,
                    es6: false,
                    env: ["browser"],
                    jsx: false,
                    react: false,
                    format: "JSON",
                    commonjs: false
                };
                origLog = console.log;
                console.log = function() {}; // necessary to replace, because of progress bar
                var uiMock = {complete: completeSpy};
                process.chdir(fixtureDir);
                config = init.processAnswers(answers, uiMock);
            });

            beforeEach(function() {
                console.log = origLog;
            });

            it("should create a config", function() {
                assert.isTrue(completeSpy.notCalled);
                assert.ok(config);
            });

            it("should create the config based on examined files", function() {
                assert.deepEqual(config.rules.quotes, [2, "double"]);
                assert.equal(config.rules.semi, 0);
            });

            it("should extend and not disable recommended rules", function() {
                assert.equal(config.extends, "eslint:recommended");
                assert.notProperty(config.rules, "no-console");
            });
        });
    });
});
