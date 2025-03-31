#!/usr/bin/env sh

set -eu

rm -Rv dist
npx tsc
cp -v package.json dist
cd dist
rm -v ./*-example.* webcomponent.*
npm publish --access=public "$@"
