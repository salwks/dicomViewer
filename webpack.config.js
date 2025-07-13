const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
  },
  devtool: 'inline-source-map',
  devServer: {
    static: './dist',
    hot: true,
    port: 3001,
    open: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: {
      "path": false,
      "fs": false,
      "os": false,
      "crypto": false,
      "stream": false,
      "buffer": false,
      "util": false,
      "assert": false,
      "url": false,
      "https": false,
      "http": false,
      "zlib": false,
      "vm": false,
      "tty": false,
      "events": false,
      "net": false,
      "child_process": false,
      "cluster": false,
      "dns": false,
      "dgram": false,
      "readline": false,
      "repl": false,
      "tls": false,
      "constants": false,
      "module": false,
      "punycode": false,
      "querystring": false,
      "string_decoder": false,
      "sys": false,
      "timers": false,
      "console": false,
      "domain": false,
      "process": false,
      "v8": false,
      "worker_threads": false,
      "inspector": false,
      "async_hooks": false,
      "perf_hooks": false,
      "trace_events": false,
      "wasi": false
    }
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      title: 'Cornerstone3D Viewer',
    }),
  ],
};