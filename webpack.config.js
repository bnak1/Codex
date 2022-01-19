module.exports = {
	entry: "./src/renderer.ts",
	output: {
		filename: "renderer.js",
		libraryTarget: "var",
		library: "renderer",
        path: process.cwd() + "/out/"
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: {
                    loader: "ts-loader",
                    options: {
                        configFile: "tsconfig.renderer.json"
                    }
                },
				exclude: /node_modules/,
			},
		],
	},
	resolve: {
		extensions: [".tsx", ".ts", ".js"],
	},
	mode: "none",
	devtool: "source-map",
	performance: {
		maxEntrypointSize: 4250000, // 4 MB
		maxAssetSize: 4250000
	},
    optimization: {
        usedExports: true
    },
    watchOptions: {
        aggregateTimeout: 100,
        poll: 200,
    }
};