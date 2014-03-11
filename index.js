'use strict';

var Promise = require('bluebird'),
    needle = Promise.promisifyAll(require('needle')),
    fs = Promise.promisifyAll(require('fs')),
    semver = require('semver'),
    path = require('path'),
    url = require('url'),
    pad = require('pad'),
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

function showDiff(results) {
    console.log(path.relative(process.cwd(), results.source) + ':');

    var size = 0;
    Object.keys(results.local).forEach(function (key) {
        size = Math.max(size, key.length + 2);
    });

    Object.keys(results.local).sort().forEach(function (index) {
        var color = 'grey';
        var from = results.local[index];
        var latest = results.latest[index];
        var recommended = results.recommended[index];
        var remote = results.remote[index];

        if (!remote) { return; }

        if (recommended !== latest) { color = 'yellow'; }

        var to = remote || ('~' + latest);
        console.log((pad(size, index) + '@' + latest)[color] + ': ' + from + ' -> ' + to);
    });

    return results;
}

function promptUser(results) {
    return new Promise(function (resolve) {
        require('inquirer').prompt([{
            type: 'confirm',
            name: 'merge',
            default: results.safe,
            message: 'Are you sure to merge this changes?'
        }], function (answer) {
            if (answer.merge) {
                return resolve(results);
            }
            console.log('Cancelled'.grey);
        });
    });
}

function merge(results) {
    return results;
}

module.exports = function (source, url) {
    process.stdout.write('[' + 'info'.yellow + '] Fetching ' + url.grey);

    var remoteDeps = needle.getAsync(url)
        .then(function (response) {
            process.stdout.write(' ' + '✓'.green + '\n');
            return response;
        })
        .then(parseJson)
        .then(getDependencies);

    return Promise.props({
        remote: remoteDeps,
        recent: getSourceDependencies(source).then(getJsonsFromRegistry),
        local: getSourceDependencies(source),
        source: source,
        safe: false
    })
    .then(parseVersions.bind(null, 'local', 'latest'))
    .then(parseVersions.bind(null, 'remote', 'recommended'))
    .then(showDiff)
    .then(promptUser)
    .then(merge)
    .then(function (results) {
        return fs.readFileAsync(source)
            .then(parseJson)
            .then(function (json) {
                json.dependencies = results.merged;
                return fs.writeFileAsync(source, JSON.stringify(json, undefined, 2));
            });
    });
};
