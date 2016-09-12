
# This script launches the less CSS pre-processor in order to generate the CSS files.

# Pre-requisites:
# - node.js
# - less (nodejs package)
# - Grunt + other Bootstrap dependencies
#
# Linux install (example):
# - Install packages
#   sudo apt-get update
#   sudo apt-get install nodejs npm
#   sudo ln -s /usr/bin/nodejs /usr/bin/node
# - Upgrade nodejs
#   sudo npm cache clean -f
#   sudo npm install -g n
#   sudo n stable
# - Install nodejs packages
#   sudo npm install -g less
#   sudo npm install -g grunt-cli
# - Install Bootstrap dependencies
#   cd templates/dwr_default/data/bootstrap
#   npm install


MAKEFILE_PATH := $(abspath $(lastword $(MAKEFILE_LIST))/..)
TEMPLATES_PATH := $(MAKEFILE_PATH)/templates


default_target:
	@echo ''
	@echo 'Use the following targets:'
	@echo '    make css: build the DynamicWeb report CSS files'
	@echo '    make bootstrap: install less, grunt, bootstrap dependencies, and build Bootstrap'
	@echo '    make all: build everything'
	@echo '    make build: build Bootstrap and the DynamicWeb report CSS files (do not install anything)'
	@echo '    make clean_dist: Remove useles files (generated during the build process)'
	@echo ''

.PHONY: all clean_dist css bootstrap bootstrap_install bootstrap_build css_clean bootstrap_clean force

all: bootstrap css

clean_dist: css_clean bootstrap_clean

bootstrap: bootstrap_install bootstrap_build

build: bootstrap_build css

bootstrap_install: $(patsubst %,%_install,$(wildcard $(TEMPLATES_PATH)/*/data/bootstrap))

bootstrap_build: $(patsubst %,%_build,$(wildcard $(TEMPLATES_PATH)/*/data/bootstrap))

%/bootstrap_install: force
	@echo "############################################################################"
	@echo "## Installing    $(@:%_install=%)"
	@echo "############################################################################"
	cd $(@:%_install=%); npm install -g less
	cd $(@:%_install=%); npm install -g grunt-cli
	cd $(@:%_install=%); npm install

%/bootstrap_build: force
	@echo '============================================================================'
	@echo '== Building    $(@:%_build=%)'
	@echo '============================================================================'
	rm -rf $(@:%_build=%)/dist
	cd $(@:%_build=%); grunt dist

bootstrap_clean:
	@for template in $(wildcard $(TEMPLATES_PATH)/*); do \
		rm -rf \
		$$template/data/bootstrap/dist/css/*.map \
		$$template/data/bootstrap/dist/css/bootstrap.css \
		$$template/data/bootstrap/dist/css/bootstrap-theme.css \
		$$template/data/bootstrap/dist/js/bootstrap.js \
		$$template/data/bootstrap/dist/js/npm.js \
		$$template/data/bootstrap/node_modules \
	; done

css: $(patsubst %.less,%.css,$(wildcard $(TEMPLATES_PATH)/*/data/*.less))

css_clean:
	@#Nothing to do
	@#rm -f $(patsubst %.less,%.css,$(wildcard $(TEMPLATES_PATH)/*/data/*.less))

%.css: %.less force
	@echo '============================================================================'
	@echo '== Building    $@'
	@echo '============================================================================'
	templates/dwr_default/data/bootstrap/node_modules/grunt-contrib-less/node_modules/.bin/lessc $< $@

force:
