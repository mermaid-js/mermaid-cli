.DEFAULT_GOAL := test

IMAGENAME := mermaid-cli
BUILD_VERSION := latest-build
RELEASE_VERSION := latest-release

ci.build.image:
	docker build -t ${IMAGENAME}:${BUILD_VERSION} . -f DockerfileBuild
.PHONY: ci.build.image

ci.release.image:
	docker build -t ${IMAGENAME}:${RELEASE_VERSION} . -f Dockerfile
.PHONY: ci.release.image

build: ci.build.image ci.release.image
.PHONY: build

test: build
	./run-tests.sh test-positive ${IMAGENAME}:${BUILD_VERSION}
	./run-tests.sh test-positive ${IMAGENAME}:${RELEASE_VERSION}
.PHONY: test
