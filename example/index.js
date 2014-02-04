var umd = require('..'),
    path = require('path');

umd(path.join(__dirname, 'bower.json'),
    'https://raw.github.com/floatdrop/update-my-deps/master/example/updatebower.json');
