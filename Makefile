REPORTER = spec
BIN = node_modules/.bin/
SRC_FILES = $(shell find .  -type f \( -name "*.js" ! \
	-path "*node_modules*" ! -path "*lcov-report*" \))

# Use grep to run only tests with keywords:
# make test GREP=events
ifeq ($(GREP), )
	GREP_CMND =
else
 	GREP_CMND = --grep $(GREP)
endif

MOCHA-OPTS = --reporter $(REPORTER) \
		--require chai \
		--ui bdd \
		--recursive \
		--colors

test:
	@NODE_ENV=test $(BIN)/mocha \
		$(MOCHA-OPTS) \
		$(GREP_CMND)
.PHONY: test

#debug by node-inspector + http://127.0.0.1:8080/debug?port=5858
test-d:
	@NODE_ENV=test $(BIN)/mocha \
		$(MOCHA-OPTS) \
		--debug-brk \
		$(GREP_CMND)
.PHONY: test-d

jshint:
	@$(BIN)/jshint $(SRC_FILES)
