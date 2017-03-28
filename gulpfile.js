// BUG Symlink not working

var gulp = require('gulp');
var debug = require('gulp-debug');
var plugins = require('gulp-load-plugins')();
var del = require('del');
var es = require('event-stream');
var bowerFiles = require('main-bower-files');
var print = require('gulp-print');
var Q = require('q');
var imagemin = require('gulp-imagemin'), pngquant = require('imagemin-pngquant');
var taskListing = require('gulp-task-listing');
var symlink = require('gulp-sym');
var rename = require("gulp-rename");
var exec = require('child_process').exec
var argv = require('yargs').argv;

// == PATH STRINGS ========
var appdir  = "./app/";   // Warning to not forget trailling '/'
config=require (appdir + "etc/_Config"); // upload user local preferences if any

var frontend= appdir + config.FRONTEND;

var paths = {
    application : frontend,
    scripts     : frontend+'/**/*.js',
    appStyles   : [frontend+'/**/*.scss', '!'+frontend+'/styles/*.scss'],
    globalStyles: [frontend+'/styles/*.scss'],
    images      : [
		frontend+'/**/*.png',
		frontend+'/**/*.jpg',
		frontend+'/**/*.jpeg',
		frontend+'/**/*.svg',
		frontend+'/**/*.ttf',
		'bower_components/leaflet/dist/images/*.png'
	],
    index       : frontend+'/index.html',
    partials    : [frontend + '/**/*.html', '!' + frontend +'/index.html'],
    distDev     : './dist.dev',
    distProd    : './dist.prod',
    sass:  [
		frontend+'/styles',
		'bower_components/bootstrap-sass/assets/stylesheets'
	],
    fonts: ['bower_components/**/*.woff'],
    favicon: frontend+'/images/favicon.ico',
	wgtconfig: 'config.xml'
};

// add bower files to global styles
bowerFiles('**/*.css').forEach(function(p) {
	paths.globalStyles.unshift(p);
});

paths['distAppDev']  = paths.distDev + config.URLBASE;
paths['distAppProd'] = paths.distProd + config.URLBASE;

// Run node in debug mode in developpement mode ?
var nodeopts = config.DEBUG !== undefined ? '--debug='+config.DEBUG : ''; 

// == PIPE SEGMENTS ========
var pipes = {};

pipes.orderedVendorScripts = function() {
    return plugins.order(['jquery.js', 'bootstrap.js','leaflet-src.js','tween.js','steelseries.js']);
};

pipes.minifiedFileName = function() {
    return plugins.rename(function (path) {
        path.extname = '.min' + path.extname;
    });
};

pipes.validatedAppScripts = function() {
    return gulp.src(paths.scripts)
        .pipe(plugins.replace('@@APPNAME@@', config.APPNAME))
        .pipe(plugins.replace('@@APPVER@@', config.APPVER))
        .pipe(plugins.jshint())
        .pipe(plugins.jshint.reporter('jshint-stylish'));
};

pipes.builtAppScriptsDev = function() {
    return pipes.validatedAppScripts()
        .pipe(gulp.dest(paths.distAppDev));
};

pipes.builtAppScriptsProd = function() {
    var scriptedPartials = pipes.scriptedPartials();
    var validatedAppScripts = pipes.validatedAppScripts();
    return es.merge(scriptedPartials, validatedAppScripts)
        .pipe(plugins.sourcemaps.init())
        .pipe(plugins.concat(config.APPNAME+'.min.js'))
        .pipe(plugins.uglify({compress: {drop_console: true}}))
        .pipe(plugins.sourcemaps.write())
        .pipe(gulp.dest(paths.distAppProd+'/js'));
};

pipes.builtVendorScriptsDev = function() {
    return gulp.src(bowerFiles('**/*.js'))
        .pipe(gulp.dest( paths.distDev +'/bower_components'));
};

pipes.builtVendorScriptsProd = function() {
    return gulp.src(bowerFiles('**/*.js'))
        .pipe(pipes.orderedVendorScripts())
        .pipe(plugins.concat('vendor.min.js'))
        .pipe(plugins.uglify())
        .pipe(gulp.dest(paths.distProd+ '/bower_components'));
};


pipes.validatedPartials = function() {
    return gulp.src(paths.partials)
        .pipe(plugins.htmlhint({'doctype-first': false}))
        .pipe(plugins.htmlhint.reporter());
};

pipes.builtPartialsDev = function() {
    return pipes.validatedPartials()
        .pipe(gulp.dest(paths.distAppDev));
};

pipes.scriptedPartials = function() {
    return pipes.validatedPartials()
        .pipe(plugins.htmlhint.failReporter())
        .pipe(plugins.htmlmin({collapseWhitespace: true, removeComments: true}));
};

pipes.builtAppStylesDev = function() {
    return gulp.src(paths.appStyles)
        .pipe(plugins.sass({includePaths: paths.sass}))
        .pipe(gulp.dest(paths.distAppDev + '/styles'));
};

pipes.builtglobalStylesDev = function() {
    return gulp.src(paths.globalStyles)
        .pipe(plugins.sass({includePaths: paths.sass}))
        .pipe(gulp.dest(paths.distDev  + '/global_styles'));
};

pipes.builtAppStylesProd = function() {
    return gulp.src(paths.appStyles)
        .pipe(plugins.sourcemaps.init())
        .pipe(plugins.sass({includePaths: paths.sass}))
        // .pipe(debug({title: '***** appStyle:'}))
        .pipe(plugins.cleanCss())
        .pipe(plugins.concat(config.APPNAME+'.css'))
        .pipe(plugins.sourcemaps.write())
        .pipe(pipes.minifiedFileName())
        .pipe(gulp.dest(paths.distAppProd));
};

pipes.builtglobalStylesProd = function() {
    return gulp.src(paths.globalStyles)
        .pipe(plugins.sourcemaps.init())
        .pipe(plugins.sass({includePaths: paths.sass}))
        .pipe(plugins.cleanCss())
        .pipe(plugins.sourcemaps.write())
        .pipe(pipes.minifiedFileName())
        .pipe(rename(function (path) {path.dirname="";return path;}))
        .pipe(plugins.concat('output.min.css'))
        .pipe(gulp.dest(paths.distProd + '/global_styles'));
};

pipes.processedFontsDev = function() {
    return gulp.src(paths.fonts)
        .pipe(rename(function (path) {path.dirname="";return path;}))
        .pipe(gulp.dest(paths.distDev+'/bower_components'));
};

pipes.processedFontsProd = function() {
    return gulp.src(paths.fonts)
        .pipe(rename(function (path) {path.dirname="";return path;}))
        .pipe(gulp.dest(paths.distProd+'/bower_components'));
};


pipes.processedImagesDev = function() {
    return gulp.src(paths.images)
		.pipe(rename(function(path) { path.dirname=""; return path; }))
        .pipe(gulp.dest(paths.distAppDev+"/images/"));
};

pipes.processedFaviconDev = function() {
    return gulp.src(paths.favicon)
        .pipe(gulp.dest(paths.distDev));
};

pipes.processedImagesProd = function() {
    return gulp.src(paths.images)
		.pipe(rename(function(path) { path.dirname=""; return path; }))
       .pipe(imagemin({
            progressive: true,
            svgoPlugins: [{removeViewBox: false}],
            use: [pngquant()]
        }))
        .pipe(gulp.dest(paths.distAppProd+"/images/"));
};

pipes.processedFaviconProd = function() {
    return gulp.src(paths.favicon)
        .pipe(gulp.dest(paths.distProd));
};

// Create an Symlink when config.URLBASE exist
pipes.createDevSymLink = function() {
    return gulp.src(paths.distDev).pipe(symlink(paths.distDev+config.URLBASE, {force: true}));
};

pipes.createProdSymLink = function() {
    return gulp.src(paths.distProd).pipe(symlink(paths.distDev+config.URLBASE,{force: true}));
};

pipes.validatedIndex = function() {
    return gulp.src(paths.index)       
        .pipe(plugins.replace('@@APPNAME@@', config.APPNAME))
        .pipe(plugins.replace('@@APPVER@@', config.APPVER))
        .pipe(plugins.replace('@@URLBASE@@', config.URLBASE))
        .pipe(plugins.htmlhint())
        .pipe(plugins.htmlhint.reporter());
};

pipes.builtIndexDev = function() {

    var orderedVendorScripts = pipes.builtVendorScriptsDev()
        .pipe(pipes.orderedVendorScripts());

    var orderedAppScripts = pipes.builtAppScriptsDev();

    var appStyles    = pipes.builtAppStylesDev();
    var globalStyles = pipes.builtglobalStylesDev();

    return pipes.validatedIndex()
         // Vendor and Global should have absolute path to rootdir application one are relative to BaseURL
        .pipe(plugins.inject(orderedVendorScripts, {relative: false, ignorePath: "/dist.dev", name: 'bower'}))
        .pipe(plugins.inject(globalStyles, {relative: false, ignorePath: "/dist.dev", name:'vendor'}))
        .pipe(gulp.dest(paths.distAppDev)) // write first to get relative path for inject
        .pipe(plugins.inject(orderedAppScripts, {relative: true}))
        .pipe(plugins.inject(appStyles, {relative: true, name: 'appli'}))
        .pipe(gulp.dest(paths.distAppDev));
};

pipes.builtIndexProd = function() {

    var vendorScripts= pipes.builtVendorScriptsProd();
    var appScripts   = pipes.builtAppScriptsProd();
    var appStyles    = pipes.builtAppStylesProd();
    var globalStyles = pipes.builtglobalStylesProd();

    return pipes.validatedIndex()
         // Vendor and Global should have absolute path to rootdir application one are relative to BaseURL
        .pipe(plugins.inject(vendorScripts, {relative: false, ignorePath: "/dist.prod", name: 'bower'}))
        .pipe(plugins.inject(globalStyles, {relative: false, ignorePath: "/dist.prod", name:'vendor'}))
        .pipe(gulp.dest(paths.distAppProd)) // write first to get relative path for inject
        .pipe(plugins.inject(appScripts, {relative: true}))
        .pipe(plugins.inject(appStyles, {relative: true, name:'appli'}))
        .pipe(plugins.htmlmin({collapseWhitespace: true, removeComments: true}))
        .pipe(gulp.dest(paths.distAppProd));
};

pipes.builtAppDev = function() {
    return es.merge(pipes.builtIndexDev(), pipes.builtPartialsDev(), pipes.processedFaviconDev(), pipes.processedImagesDev(), pipes.processedFontsDev() )
		.pipe(pipes.doRsync("Dev"));
};

pipes.builtAppProd = function() {
    return es.merge(pipes.builtIndexProd(), pipes.processedFaviconProd(), pipes.processedImagesProd(), pipes.processedFontsProd())
		.pipe(pipes.doRsync("Prod"));
};

pipes.widgetConfig = function(type) {
	var dst=paths["dist"+type];
	var content="."+config.URLBASE+"/index.html";
	content=content.replace(/\/+/g,"/"); 
	return gulp.src(paths.wgtconfig+".in")
        .pipe(plugins.replace('@@APPNAME@@', config.APPNAME))
        .pipe(plugins.replace('@@APPVER@@', config.APPVER))
        .pipe(plugins.replace('@@CONTENT@@', content))
        .pipe(plugins.rename("config.xml"))
		.pipe(gulp.dest(dst))
};

pipes.widgetPack = function(type,cb) {
	var dst=paths["dist"+type];
	var wgtfile=config.APPNAME+"_"+type+".wgt"

	exec(
		"wgtpkg-pack -f -o "+wgtfile+" "+dst,
		function(err,stdout,stderr) {
			console.log(stdout);
			console.log(stderr);
			cb(err);
	});
};

pipes.doRsync=function(type) {
	var dst=paths["dist"+type];
	if (!argv.host) return plugins.empty();

	return plugins.rsync({
		root: dst+"/",
		hostname: argv.host,
		username: "root",
		destination: "/usr/share/afm/applications/"+config.APPNAME+"/"+config.APPVER+"/htdocs/",
		archive: true,
		compress: true,
		recursive: true
	});
}

// == TASKS ========

// Add a task to render the output 
gulp.task('help', taskListing.withFilters(/-/));
   
// clean, build of production environement
gulp.task('build', ['clean-build-app-prod']);

// removes all compiled dev files
gulp.task('clean-dev', function() {
    var deferred = Q.defer();
    del(paths.distDev, function() {
        deferred.resolve();
    });
    return deferred.promise;
});

// removes all compiled production files
gulp.task('clean-prod', function() {
    var deferred = Q.defer();
    del(paths.distProd, function() {
        deferred.resolve();
    });
    return deferred.promise;
});

// checks html source files for syntax errors
gulp.task('validate-partials', pipes.validatedPartials);

// checks index.html for syntax errors
gulp.task('validate-index', pipes.validatedIndex);

// moves html source files into the dev environment
gulp.task('build-partials-dev', pipes.builtPartialsDev);

// converts partials to javascript using html2js
gulp.task('convert-partials-to-js', pipes.scriptedPartials);

// runs jshint on the app scripts
gulp.task('validate-app-scripts', pipes.validatedAppScripts);

// moves app scripts into the dev environment
gulp.task('build-app-scripts-dev', pipes.builtAppScriptsDev);

// concatenates, uglifies, and moves app scripts and partials into the prod environment
gulp.task('build-app-scripts-prod', pipes.builtAppScriptsProd);

// compiles app sass and moves to the dev environment
gulp.task('build-app-styles-dev', pipes.builtAppStylesDev);

// compiles and minifies app sass to css and moves to the prod environment
gulp.task('build-app-styles-prod', pipes.builtAppStylesProd);

// moves vendor scripts into the dev environment
gulp.task('build-vendor-scripts-dev', pipes.builtVendorScriptsDev);

// concatenates, uglifies, and moves vendor scripts into the prod environment
gulp.task('build-vendor-scripts-prod', pipes.builtVendorScriptsProd);

// validates and injects sources into index.html and moves it to the dev environment
gulp.task('build-index-dev', pipes.builtIndexDev);

// validates and injects sources into index.html, minifies and moves it to the dev environment
gulp.task('build-index-prod', pipes.builtIndexProd);

// builds a complete dev environment
gulp.task('build-app-dev', pipes.builtAppDev);

// builds a complete prod environment
gulp.task('build-app-prod', pipes.builtAppProd);

// cleans and builds a complete dev environment
gulp.task('clean-build-app-dev', ['clean-dev'], pipes.builtAppDev);

// cleans and builds a complete prod environment
gulp.task('clean-build-app-prod', ['clean-prod'], pipes.builtAppProd);

// clean, build, and watch live changes to the dev environment
gulp.task('watch-dev', ['clean-build-app-dev'], function() {

    // watch index
    gulp.watch(paths.index, function() {
        return pipes.builtIndexDev()
			.pipe(pipes.doRsync("Dev"))
            .pipe(plugins.livereload());
    });

    // watch app scripts
    gulp.watch(paths.scripts, function() {
        return pipes.builtAppScriptsDev()
			.pipe(pipes.doRsync("Dev"))
            .pipe(plugins.livereload());
    });

    // watch html partials
    gulp.watch(paths.partials, function() {
        return pipes.builtPartialsDev()
			.pipe(pipes.doRsync("Dev"))
            .pipe(plugins.livereload());
    });
    
    // watch Images
    gulp.watch(paths.images, function() {
        return pipes.processedImagesDev()
			.pipe(pipes.doRsync("Dev"))
            .pipe(plugins.livereload());
    });

    // watch styles
    gulp.watch(paths.appStyles, function() {
        return pipes.builtAppStylesDev()
			.pipe(pipes.doRsync("Dev"))
            .pipe(plugins.livereload());
    });
    gulp.watch(paths.globalStyles, function() {
        return pipes.builtglobalStylesDev()
			.pipe(pipes.doRsync("Dev"))
            .pipe(plugins.livereload());
    });

});

// clean, build, and watch live changes to the prod environment
gulp.task('watch-prod', ['clean-build-app-prod'], function() {

    // watch index
    gulp.watch(paths.index, function() {
        return pipes.builtIndexProd()
			.pipe(pipes.doRsync("Prod"))
            .pipe(plugins.livereload());
    });

    // watch app scripts
    gulp.watch(paths.scripts, function() {
        return pipes.builtAppScriptsProd()
			.pipe(pipes.doRsync("Prod"))
            .pipe(plugins.livereload());
    });

    // watch hhtml partials
    gulp.watch(paths.partials, function() {
        return pipes.builtAppScriptsProd()
			.pipe(pipes.doRsync("Prod"))
            .pipe(plugins.livereload());
    });
    
    // watch Images
    gulp.watch(paths.images, function() {
        return pipes.processedImagesProd()
			.pipe(pipes.doRsync("Prod"))
            .pipe(plugins.livereload());
    });

    // watch styles
    gulp.watch(paths.appStyles, function() {
        return pipes.builtAppStylesProd()
			.pipe(pipes.doRsync("Prod"))
            .pipe(plugins.livereload());
    });
    gulp.watch(paths.globalStyles, function() {
        return pipes.builtglobalStylesProd()
			.pipe(pipes.doRsync("Prod"))
            .pipe(plugins.livereload());
    });
    
});

gulp.task('widget-config-dev',  ['build-app-dev'],  function() { return pipes.widgetConfig("Dev"); });
gulp.task('widget-config-prod', ['build-app-prod'], function() { return pipes.widgetConfig("Prod"); });
gulp.task('widget-dev',  ['widget-config-dev'],  function(cb) { return pipes.widgetPack("Dev",cb); });
gulp.task('widget-prod', ['widget-config-prod'], function(cb) { return pipes.widgetPack("Prod",cb); });

// default task builds for prod
gulp.task('default', ['widget-prod']);
