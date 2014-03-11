var umd = require('..'),
    path = require('path');

umd(path.join(__dirname, 'package.json'),
    'https://raw.github.com/floatdrop/update-my-deps/refactoring/example/remote-package.json');
