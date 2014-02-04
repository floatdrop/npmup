'use strict';

var fs = require('fs'),
    request = require('request'),
    dd = require('dependencies-diff'),
    chalk = require('chalk'),
    inquirer = require('inquirer'),
    _ = require('lodash'),
    path = require('path');

module.exports = function (source, url) {
    var sourceJson = JSON.parse(fs.readFileSync(source));

    request(url, function (error, response, body) {
        if (error) {
            console.error(error);
            return;
        }

        var destJson = JSON.parse(body);

        var diff = dd(sourceJson.dependencies, destJson.dependencies);

        console.log(chalk.gray(path.relative(__dirname, source)));

        Object.keys(diff).forEach(function (key) {
            var d = diff[key];
            var color = chalk.gray;

            if (d.patch) { color = chalk.green; }
            if (d.minor) { color = chalk.yellow; }
            if (d.major) { color = chalk.red; }

            console.log('\t' + color(key) + ': ' + d.version + ' -> ' + d.newVersion);
        });

        inquirer.prompt([{
            type: 'confirm',
            name: 'merge',
            message: 'Are you sure to merge this changes?'
        }], function (answer) {
            if (answer.merge) {
                _.assign(sourceJson, destJson.dependencies);
                fs.writeFileSync(source, sourceJson);
            }
        });
    });
};
