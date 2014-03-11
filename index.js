'use strict';

var fs = Promise.promisifyAll(require('fs')),
    needle = Promise.promisifyAll(require('needle')),
    Promise = require('bluebird'),
    chalk = require('chalk'),
    path = require('path'),
    url = require('url');

var registry = url.parse(process.env.NPM_REGISTRY || 'https://registry.npmjs.org');

function parseJson(response) {
    return new Promise(function (resolve, reject) {
        try {
            resolve(JSON.parse(response.body));
        } catch (e) {
            reject(e);
        }
    });
}

function getDependencies(json) {
    return new Promise(function (resolve, reject) {
        if (!json.dependencies) { return reject(new Error('Dependencies not found')); }
        resolve(json.dependencies);
    });
}

function getSourceDependencies(source) {
    return fs.readFileAsync(source)
        .then(getDependencies);
}

function getFreshJsons(dependencies) {
    return Promise.all(Object.keys(dependencies).map(function (index) {
        registry.pathname = index;
        return needle.getAsync(url.format(registry))
            .then(parseJson)
            .then(function (json) {
                dependencies[index] = json;
            });
    })).then(function () {
        return dependencies;
    });
}

function filterFresh(results) {
    var fresh = {};
    Object.keys(results.local).map(function (index) {
        if (!(index in results.fresh)) { fresh[index] = results.local[index]; }
        var versions = Object.keys[results.fresh[index]];
        fresh[index] = versions.pop(); // Get last version for now
    });
}

function showDiff(results) {
    console.log(chalk.gray(path.relative(process.cwd(), results.source)));
    Object.keys(results.local).forEach(function (index) {
        console.log(index + ': ' + results.local[index] + ' -> ' + results.fresh[index]);
    });
}

function promptUser(results) {
    return new Promise(function (resolve, reject) {
        require('inquirer').prompt([{
            type: 'confirm',
            name: 'merge',
            default: results.safe,
            message: 'Are you sure to merge this changes?'
        }], function (answer) {
            if (answer.merge) {
                return resolve(results);
            }
            reject(new Error('Cancelled'));
        });
    });
}

function merge() {

}

module.exports = function (source, url) {
    var remoteDeps = needle.getAsync(url)
        .then(parseJson)
        .then(getDependencies);

    return Promise.all({
        remote: remoteDeps,
        fresh: getSourceDependencies(source).then(getFreshJsons),
        local: getSourceDependencies(source),
        source: source
    })
    .then(filterFresh)
    .then(showDiff)
    /*.then(promptUser)
    .then(merge)
    .then(function (results) {
        return fs.readFileAsync(source)
            .then(parseJson)
            .then(function (json) {
                json.dependencies = results.merged;
                return fs.writeFileAsync(source, JSON.stringify(json, undefined, 2));
            });
    })*/;
};
