var path         = require('path');
var through      = require('through2');
var throughPipes = require('through-pipes');
var minimatch    = require('minimatch');
var sass         = require('node-sass');
var gulp         = require('gulp');
var gutil        = require('gulp-util');
var inject       = require('gulp-inject');
var slash        = require('gulp-slash');
var semiflat     = require('gulp-semiflat');

/**
 * Create an instance.
 * @returns {{libraries: function, transpile: function, sassReporter: function, injectAppCSS: function}}
 */
module.exports = function() {
  'use strict';
  var libList  = [ ];

  /**
   * Add string values to the <code>libList</code> uniquely.
   * @param {string|Array} value An explicit library path string or array thereof
   */
  function addUnique(value) {
    if ((typeof value === 'object') && (value instanceof Array)) {
      value.forEach(addUnique);
    } else if ((typeof value === 'string') && (libList.indexOf(value) < 0)) {
      libList.push(value);
    }
  }

  // create a return value
  var instance = {

    /**
     * Infer library paths from the <code>base</code> paths in the input stream in preparation for
     * <code>transpile</code>.
     * Any arguments given are treated as explicit paths and are added as-is to the library list.
     * Outputs a stream of the same files.
     * @param {...string|Array} Any number of explicit library path strings or arrays thereof
     * @returns {stream.Through} A through stream that performs the operation of a gulp stream
     */
    libraries: function() {
      addUnique(Array.prototype.slice.call(arguments));
      return through.obj(function(file, encoding, done) {
        addUnique(file.base);
        this.push(file);
        done();
      });
    },

    /**
     * Use <code>node-sass</code> to compile the files of the input stream.
     * Uses any library paths defined in <code>libraries</code>. Does not utilise the file content in the input stream.
     * Outputs a stream of compiled files and their source-maps, alternately.
     * @see https://github.com/sass/node-sass#outputstyle
     * @param {string?} outputStyle One of the <code>libsass</code> supported output styles
     * @returns {stream.Through} A through stream that performs the operation of a gulp stream
     */
    transpile: function(outputStyle) {
      return through.obj(function(file, encoding, done) {
        var stream = this;

        // setup parameters
        var sourcePath = file.path.replace(path.basename(file.path), '');
        var sourceName = path.basename(file.path, path.extname(file.path));
        var mapName    = sourceName + '.css.map';
        var stats      = { };

        /**
         * Push file contents to the output stream.
         * @param {string} ext The extention for the file, including dot
         * @param {string|object?} contents The contents for the file or fields to assign to it
         * @return {vinyl.File} The file that has been pushed to the stream
         */
        function pushResult(ext, contents) {
          var pending = new gutil.File({
            cwd:      file.cwd,
            base:     file.base,
            path:     sourcePath + sourceName + ext,
            contents: (typeof contents === 'string') ? new Buffer(contents) : null
          });
          if (typeof contents === 'object') {
            for (var key in contents) {
              pending[key] = contents[key];
            }
          }
          stream.push(pending);
          return pending;
        }

        /**
         * Handler for successful transpilation using node-sass.
         * @param {string} css Compiled css
         * @param {string} map The source-map for the compiled css
         */
        function successHandler(css, map) {
          var source = minimatch.makeRe(file.cwd).source
            .replace(/^\^|\$$/g, '')          // match text anywhere on the line by removing line start/end
            .replace(/\\\//g, '[\\\\\\/]') +  // detect any platform path format
            '|\\.\\.\\/';  			              // relative paths are an artefact and must be removed
          var parsable  = slash(map.replace(new RegExp(source, 'g'), ''));
          var sourceMap = JSON.parse(parsable);
          delete sourceMap.file;
          delete sourceMap.sourcesContent;
          pushResult('.css', css);
          pushResult('.css.map', JSON.stringify(sourceMap, null, '  '));
          done();
        }

        /**
         * Handler for error in node-sass.
         * @param {string} error The error text from node-sass
         */
        function errorHandler(error) {
          pushResult('.css', {
            sassSource: file,
            sassError:  error.toString()
          });
          done();
        }

        /**
         * Perform the sass render with the given <code>sourceMap</code> and <code>success</code> parameters.
         * @param {string|boolean} map The source map filename or <code>false</code> for none
         * @param {function({string})} error Handler for error
         * @param {function({string}, {string})} success Handler for success
         */
        function render(map, error, success) {
          sass.render({
            file:         file.path,
            success:      success,
            error:        error,
            includePaths: libList,
            outputStyle:  outputStyle || 'compressed',
            stats:        stats,
            sourceMap:    map
          });
        }

        // run first without sourcemap as this can cause process exit where errors exist
        render(false, errorHandler, function() {
          render(mapName, errorHandler, successHandler);
        });
      });
    },

    /**
     * A reporter for the <code>transpile</code> step.
     * Strips from the stream files that failed compilation and displays their error message.
     * @param {number?} bannerWidth The width of banner comment, zero or omitted for none
     * @returns {stream.Through} A through stream that performs the operation of a gulp stream
     */
    sassReporter: function(bannerWidth) {
      var output = [ ];

      // push each item to an output buffer
      return through.obj(function (file, encoding, done) {

        // unsuccessful element have a the correct properties
        var isError = (file.isNull()) && (file.sassError) && (file.sassSource);
        if (isError) {

          // extract features from the error
          var analysis = (/(.*)\:(\d+)\:\s*error:\s*(.*)/).exec(file.sassError);
          var message;
          if (analysis) {
            var source   = file.sassSource;
            var isSource = (analysis[1] === 'source string');
            var absolute = (isSource) ? source.path : path.resolve(analysis[1] + '.scss');
            message = absolute + ':' + analysis[2] + ':0: ' + analysis[3] + '\n';
          } else {
console.log('\n!!! TODO include this error: ' + error + '\n');
          }

          // report unique errors in original sources
          if ((message) && (output.indexOf(message) < 0)) {
            output.push(message);
          }

        // only successful elements to the output
        } else {
          this.push(file);
        }
        done();

      // display the output buffer with padding before and after and between each item
      }, function (done) {
        if (output.length) {
          var width = Number(bannerWidth) || 0;
          var hr    = new Array(width + 1);   // this is a good trick to repeat a character N times
          var start = (width > 0) ? (hr.join('\u25BC') + '\n') : '';
          var stop  = (width > 0) ? (hr.join('\u25B2') + '\n') : '';
          process.stdout.write(start + '\n' + output.join('\n') + '\n' + stop);
        }
        done();
      });
    },

    /**
     * Inject all CSS files found in the same relative directory as the HTML file in the stream.
     * Where a <code>cssBasePath</code> is not given CSS is presumed to be adjacent to HTML.
     * Outputs a stream of HTML files with amended content.
     * @param {string} cssBasePath An absolute or root relative base path for css files
     * @returns {stream.Through} A through stream that performs the operation of a gulp stream
     */
    injectAppCSS: function(cssBasePath) {
      return through.obj(function(file, encoding, done) {
        var stream = this;

        // infer the html base path from the file.base and use this as a base to locate
        //  the corresponding css files
        var htmlName  = path.basename(file.path);
        var htmlPath  = path.resolve(file.path.replace(htmlName, ''));
        var htmlBase  = path.resolve(file.base);
        var cssBase   = (cssBasePath) ? path.resolve(cssBasePath) : htmlBase;
        var glob      = htmlPath.replace(htmlBase, cssBase) + '/*.css'
        var sources   = gulp.src(glob, { read: false })
          .pipe(semiflat(cssBase))
          .pipe(slash());

        // pass the html file into a stream that injects the given sources
        //  then add the resulting file to the output stream
        throughPipes(function(readable) {
          return readable
            .pipe(inject(sources));
        })
          .output(function(file) {
            stream.push(file);
            done();
          })
          .input(file)
          .end();
      });
    }
  };
  return instance;
};
