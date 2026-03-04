#!/usr/bin/env sh

set -eu

npm install
rm -Rv dist || echo "Dist already gone"
npx tsc
npx webpack bundle --env mode=production
cp -v package.json dist
cd dist
rm -v ./*example* webcomponent.*

npm publish --access=public "$@"
