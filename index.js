'use strict';

var Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    needle = Promise.promisifyAll(require('needle')),
    path = require('path'),
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

function getFreshJsons(dependencies) {
    var fresh = {};
    return Promise.all(Object.keys(dependencies).map(function (index) {
        registry.pathname = index;
        return needle.getAsync(url.format(registry))
            .then(parseJson)
            .then(function (json) {
                fresh[index] = json;
            });
    })).then(function () {
        return fresh;
    });
}

function filterFresh(results) {
    var fresh = {};
    Object.keys(results.local).map(function (index) {
        if (!(index in results.fresh)) { fresh[index] = results.local[index]; }
        var versions = Object.keys(results.fresh[index].versions);
        fresh[index] = versions.pop(); // Get last version for now
    });
    results.fresh = fresh;
    return results;
}

function showDiff(results) {
    console.log(path.relative(process.cwd(), results.source).grey);
    Object.keys(results.local).forEach(function (index) {
        console.log(index + ': ' + results.local[index] + ' -> ' + results.fresh[index]);
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
    var remoteDeps = needle.getAsync(url)
        .then(parseJson)
        .then(getDependencies);

    return Promise.props({
        remote: remoteDeps,
        fresh: getSourceDependencies(source).then(getFreshJsons),
        local: getSourceDependencies(source),
        source: source,
        safe: false
    })
    .then(filterFresh)
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
