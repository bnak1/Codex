<p align="center">
	<img src="https://www.codexnotes.com/img/logo.png#gh-light-mode-only" width="400" />
    <img src="https://www.codexnotes.com/img/logo-light.png#gh-dark-mode-only" width="400" />
    <br>
	<img alt="GitHub all releases" src="https://img.shields.io/github/downloads/jcv8000/Codex/total?label=Downloads">
	<img alt="GitHub release (latest by date)" src="https://img.shields.io/github/v/release/jcv8000/Codex?label=Release">
	<img alt="GitHub issues" src="https://img.shields.io/github/issues/jcv8000/Codex?label=Issues">
	<a href="https://ko-fi.com/jcv8000"><img src="https://img.shields.io/badge/Ko--Fi-Donate-red"></a><br><br>
	<span>A free note-taking software for programmers and Computer Science students</span><br><br>
	<small>Made by <a href="https://jcv8000.github.io">Josh Vickery</a></small>
</p>

## **DO NOT CLONE THIS BRANCH FOR ACTUAL USE**

⚠️ **This branch is still heavily work-in-progress and has constant breaking changes.** ⚠️

## Development

1. Clone the respoitory
2. Make sure you have [NodeJS](https://nodejs.org/) and npm installed.
3. In the project's root folder, run ``npm install`` to install the required dependencies.

### Scripts

The compilation process is split up into two parts: compiling the main/preload TypeScript files (which have Node integration), and bundling the renderer script with Webpack (which can't have Node integration).

- ``npm start`` will compile everything and then start Electron.
- ``npm run dev`` will compile everything and watch the src folder for changes and recompile when you change something.
- ``npm run serve`` will just start Electron.

I use one terminal to run ``npm run dev`` and leave it going, and another terminal to kill/start the app using ``npm run serve`` after I make a change.

## Building

Run ``npm run dist`` to build.

The "build" section inside the ``package.json`` file is used to configure this.

## Screenshot

![Screenshot](https://codexnotes.com/img/main2.png)

## License

This work is licensed under a [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) license.
