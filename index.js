'use strict';

var fs = require('fs'),
    request = require('request'),
    dd = require('dependencies-diff'),
    chalk = require('chalk'),
    inquirer = require('inquirer'),
    _ = require('lodash'),
    path = require('path');

module.exports = function (source, url, cb) {
    var sourceJson = JSON.parse(fs.readFileSync(source));

    request(url, function (error, response, body) {
        if (error) {
            console.error(error);
            return;
        }

        var destJson = JSON.parse(body);

        var diff = dd(sourceJson.dependencies, destJson.dependencies);

        console.log(chalk.gray(path.relative(process.cwd(), source)));

        var keys = Object.keys(diff);

        if (!keys.length) { console.log('\t No changes'); return; }

        var safe = true;

        keys.forEach(function (key) {
            var d = diff[key];
            var color = chalk.gray;

            if (d.patch) { color = chalk.green; }
            if (d.minor) { color = chalk.yellow; safe = false; }
            if (d.major) { color = chalk.red; safe = false; }

            console.log('\t' + color(key) + ': ' + d.version + ' -> ' + d.newVersion);
        });

        inquirer.prompt([{
            type: 'confirm',
            name: 'merge',
            default: safe,
            message: 'Are you sure to merge this changes?'
        }], function (answer) {
            if (answer.merge) {
                _.assign(sourceJson.dependencies, destJson.dependencies);
                fs.writeFileSync(source, JSON.stringify(sourceJson, undefined, 2));
            }
            if (cb) { cb(); }
        });
    });
};
