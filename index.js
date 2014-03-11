'use strict';

var Promise = require('bluebird'),
    needle = Promise.promisifyAll(require('needle')),
    fs = Promise.promisifyAll(require('fs')),
    Table = require('cli-table'),
    semver = require('semver'),
    url = require('url'),
    is = require('is');

require('colors');

var registry = url.parse(process.env.NPM_REGISTRY || 'https://registry.npmjs.org');

function parseJson(response) {
    if (is.array(response)) { response = response[0]; }
    if (response.body) { response = response.body; }
    if (response instanceof Buffer) { response = response.toString(); }
    if (!is.string(response)) {
        return response;
    }
    return new Promise(function (resolve, reject) {
        try {
            resolve(JSON.parse(response));
        } catch (e) {
            reject(e);
        }
    });
}

function getDependencies(json) {
    return new Promise(function (resolve, reject) {
        if (!json.dependencies) {
            return reject(new Error('Dependencies not found'));
        }
        resolve(json.dependencies);
    });
}

function getSourceDependencies(source) {
    return fs.readFileAsync(source)
        .then(parseJson)
        .then(getDependencies);
}

function getJsonsFromRegistry(dependencies) {
    var recent = {};
    return Promise.all(Object.keys(dependencies).map(function (index) {
        registry.pathname = index;
        return needle.getAsync(url.format(registry))
            .then(parseJson)
            .then(function (json) {
                recent[index] = json;
            });
    })).then(function () {
        return recent;
    });
}

function parseVersions(depsConditionsKey, key, results) {
    var obj = {};
    var depsConditions = results[depsConditionsKey] || {};
    Object.keys(results.local).map(function (index) {

        var versions = Object.keys(results.recent[index].versions);
        var version;
        versions.forEach(function (v) {
            if (semver.satisfies(v, depsConditions[index])) {
                version = v;
            }
        });

        obj[index] = version || versions.pop();
    });
    results[key] = obj;
    return results;
}

function getColor(stable, latest) {
    var color;
    stable = semver.parse(stable);
    latest = semver.parse(latest);

    if (stable.patch < latest.patch) { color = 'green'; }
    if (stable.minor < latest.minor) { color = 'yellow'; }
    if (stable.major < latest.major) { color = 'red'; }

    return color;
}

function showDiff(results) {
    var size = 0;
    Object.keys(results.local).forEach(function (key) {
        size = Math.max(size, key.length + 2);
    });

    var table = new Table({
        head: ['', 'Dependency', 'Required', 'Stable', 'Latest'],
        chars: NONE,
        style: {
            head: ['white'],
            'padding-left': 0,
            'padding-right': 0
        }
    });

    Object.keys(results.local).sort().forEach(function (index) {
        var required = results.local[index];
        var stable = results.stable[index];
        var latest = results.latest[index];

        var color = getColor(stable, latest) || 'grey';

        table.push([
            color !== 'grey' ? '!' : '',
            index[color],
            required[color],
            stable[color],
            latest[color]]
        );
    });

    console.log(table.toString());

    return results;
}

module.exports = function (source) {
    return Promise.props({
        recent: getSourceDependencies(source).then(getJsonsFromRegistry),
        local: getSourceDependencies(source),
        source: source,
        safe: false
    })
    .then(parseVersions.bind(null, '', 'latest'))
    .then(parseVersions.bind(null, 'local', 'stable'))
    .then(showDiff);
};

var NONE = { 'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
    'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
    'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
    'right': '', 'right-mid': '', 'middle': ' ' };
