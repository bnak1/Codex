import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import * as fs from "fs";
import * as remote from "@electron/remote";
import {Titlebar, Color} from "@treverix/custom-electron-titlebar";
import * as hljs from "highlight.js";

export type MainAPI = {
	ipcHandle(channel: string, listener: (event: any, ...args: any[]) => void): void,
    ipcSend(channel: string, ...args: any[]): void,
    ipcSendSync(channel: string, ...args: any[]): any,
    fsExistsSync(path: string): boolean,
    fsReadFileSync(path: string): string,
    fsWriteFileSync(path: string, data: string): void,
    fsMkDirSync(path: string): void,
}

const api: MainAPI = {
	ipcHandle: (channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void) => {
        ipcRenderer.on(channel, listener);
    },

    ipcSend: (channel: string, ...args: any[]): void => {
        ipcRenderer.send(channel, args);
    },

    ipcSendSync: (channel: string, ...args: any[]): any => {
        return ipcRenderer.sendSync(channel, args);
    },

    fsExistsSync: (path: string): boolean => {
        return fs.existsSync(path);
    },

    fsReadFileSync: (path: string): string => {
        return fs.readFileSync(path, "utf-8");
    },

    fsWriteFileSync: (path: string, data: string): void => {
        fs.writeFileSync(path, data, "utf-8");
    },

    fsMkDirSync: (path: string): void => {
        fs.mkdirSync(path);
    },
};

contextBridge.exposeInMainWorld("mainAPI", {
	api: api
});

// Initialize custom titlebar and highlight example code
window.addEventListener("DOMContentLoaded", () => {

	// Set up example code block in Settings page and highlight it
    document.getElementById("exampleCode").innerHTML = "//EXAMPLE CODE BLOCK\n#include &lt;iostream&gt;\n\nint main(int argc, char *argv[]) {\n\tfor (auto i = 0; i &lt; 0xFFFF; i++)\n\t\tcout &lt;&lt; \"Hello, World!\" &lt;&lt; endl;\n\treturn -2e3 + 12l;\n}";
    document.getElementById("exampleCode").innerHTML = hljs.highlight(document.getElementById("exampleCode").innerText, {language: "cpp", ignoreIllegals: false}).value;

    if (process.platform === "win32") {
        const titlebar = new Titlebar({
            backgroundColor: Color.fromHex("#343A40"),
                unfocusEffect: true,
                icon: "../assets/icons/icon.ico"
        });

		ipcRenderer.on("updateMenubar", (event) => {
			titlebar.updateMenu(remote.Menu.getApplicationMenu());
		});

        document.getElementById("editorRibbon").style.marginTop = "40px";

        if (process.platform !== "win32") {
            document.documentElement.style.setProperty("--titlebar-height", "0px");
        }
    }
});