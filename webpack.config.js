const path = require('path');

module.exports = {
    mode: "development",
    devtool: "inline-source-map",
    entry: {
        example: "./src/example.ts",
        webcomponent: "./src/webcomponent.ts",
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
