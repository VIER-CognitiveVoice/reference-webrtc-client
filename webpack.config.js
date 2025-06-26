const path = require('path');

module.exports = {
    mode: "development",
    devtool: "inline-source-map",
    entry: {
        "web-call-example": "./src/web-call-example.ts",
        "webaudio-example": "./src/webaudio-example.ts",
        "loadtest-example": "./src/loadtest-example.ts",
        "webcomponent": "./src/webcomponent.ts",
    },
    output: {
        path: path.resolve(__dirname, './dist'),
        filename: "[name]-bundle.js"
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js", '.css'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader'
            },
            {
                test: /\.css$/,
                loader: 'raw-loader'
            },
        ]
    }
};
