# gulp-sass-alt

> An alternate SASS plugin for Gulp that provides library detection and separate source map files.

## Install

Install with [npm](https://npmjs.org/package/gulp-sass-alt).

```
npm install --save-dev gulp-sass-alt
```

## Usage

Please refer to the [proof of concept](https://github.com/bholloway/es6-modular).

## Comparisons

This plugin is an opinionated alternative to the original [gulp-sass](https://www.npmjs.org/package/gulp-sass) plugin.

It presumes that you are using a single top-level SASS file for each HTML file you are publishing. This top level
SASS file imports SASS from library paths that may need to be discovered by globing.

## Reference

### `(outputPath)`

Create an instance.

@returns `{{ libraries: function, transpile: function, sassReporter: function, injectAppCSS:function }}`
 
### `.libraries()`

Infer library paths from the `base` paths in the input stream in preparation for `transpile`.

Any arguments given are treated as explicit paths and are added as-is to the library list.

Outputs a stream of the same files.

@param `{...string|Array}` Any number of explicit library path strings or arrays thereof.

@returns `{stream.Through}` A through stream that performs the operation of a gulp stream.

### `.transpile([outputStyle])`

Use **node-sass** to compile the files of the input stream.

Uses any library paths defined in `libraries`. Does **not** utilise the file content in the input stream.

Outputs a stream of compiled files and their source-maps, alternately.

@param `{string?} outputStyle` One of the libsass supported output styles, see
[outputStyle](https://github.com/sass/node-sass#outputstyle).

@returns `{stream.Through}` A through stream that performs the operation of a gulp stream.

### `.sassReporter([bannerWidth])`

A reporter for the `transpile` step.

Strips from the stream files that failed compilation and displays their error message.

@param `{number?} bannerWidth` The width of banner comment, zero or omitted for none.

@returns `{stream.Through}` A through stream that performs the operation of a gulp stream.

### `.injectAppCSS([cssBasePath])`

Inject all CSS files found in the same relative directory as the HTML file in the stream.

Where a `cssBasePath` is not given CSS is presumed to be adjacent to HTML.

Outputs a stream of HTML files with amended content.

@param `{string?} cssBasePath` An absolute or root relative base path for css files.

@returns `{stream.Through}` A through stream that performs the operation of a gulp stream.
