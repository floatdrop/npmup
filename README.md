# update-my-deps [![NPM version][npm-image]][npm-url]
> Cli tool to update dependencies in json files

To keep things simple - this will update only **strict fixed** versions.

<p align="center">
    <img src="https://f.cloud.github.com/assets/365089/2074077/9432f5e2-8d70-11e3-8ad8-f55c5edebaf7.png" />
</p>

## Example

```js
var umd = require('update-my-deps');

umd('package.json', 'https://raw.github.com/floatdrop/update-my-deps/master/package.json', function () { console.log('done'); });
```

[npm-url]: https://npmjs.org/package/update-my-deps
[npm-image]: https://badge.fury.io/js/update-my-deps.png
