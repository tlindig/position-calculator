/*global module:false*/
module.exports = function(grunt) {
    "use strict"; //enable ECMAScript 5 Strict Mode

    // overwrite platform specific setting get always unix like line feed char
    grunt.util.linefeed = '\n';

    // Project configuration.
    grunt.initConfig({
        // global properties
        pkg: (function() {
            var prop = grunt.file.readJSON('position-calculator.jquery.json');
            prop.build = {
                year: grunt.template.today('yyyy'),
                date: grunt.template.today('yyyy-mm-dd'),
                time: grunt.template.today('HH:mm')
            };
            return prop;
        })(),
        banner: [
            '/*!',
            ' * <%= pkg.title || pkg.name %>',
            ' * <%= pkg.homepage %>',
            ' *',
            ' * v<%= pkg.version %> - <%= grunt.template.today("yyyy-mm-dd") %>',
            ' *',
            ' * Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>',
            ' * <%= pkg.author.url %>',
            ' *',
            ' * License: <%= _.pluck(pkg.licenses, "type").join(", ") %>',
            ' *',
            ' * Author: <%= (typeof pkg.author === "string") ? pkg.author : (pkg.author.name + " <" + pkg.author.email + ">") %>',
            ' */\n'
        ].join('\n'),
        // Task configuration.
        clean: {
            files: ['dist']
        },
        concat: {
            options: {
                banner: '<%= banner %>',
                stripBanners: true
            },
            dist: {
                src: ['src/<%= pkg.name %>.js'],
                dest: 'dist/<%= pkg.name %>.js'
            }
        },
        uglify: {
            options: {
                banner: '<%= banner %>',
                sourceMap: true
            },
            dist: {
                src: '<%= concat.dist.dest %>',
                dest: 'dist/<%= pkg.name %>.min.js'
            }
        },
        qunit: {
            files: ['test/**/*.html', '!test/**/manually*.html']
        },
        jshint: {
            gruntfile: {
                options: {
                    jshintrc: '.jshintrc'
                },
                src: 'Gruntfile.js'
            },
            src: {
                options: {
                    jshintrc: 'src/.jshintrc'
                },
                src: ['src/**/*.js']
            },
            test: {
                options: {
                    jshintrc: 'test/.jshintrc'
                },
                src: ['test/**/*.js']
            }
        },
        watch: {
            gruntfile: {
                files: '<%= jshint.gruntfile.src %>',
                tasks: ['jshint:gruntfile']
            },
            src: {
                files: '<%= jshint.src.src %>',
                tasks: ['jshint:src', 'qunit']
            },
            test: {
                files: '<%= jshint.test.src %>',
                tasks: ['jshint:test', 'qunit']
            }
        }
    });

    // Load plugins provide necessary task.
    require('load-grunt-tasks')(grunt, {scope: 'devDependencies'});

    // Default task.
    grunt.registerTask('default', ['jshint', 'qunit', 'clean', 'concat', 'uglify']);

};
