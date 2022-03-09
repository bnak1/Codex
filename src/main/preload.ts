import { contextBridge, ipcRenderer, IpcRendererEvent, shell } from "electron";
import * as remote from "@electron/remote";
import { Titlebar, Color } from "@treverix/custom-electron-titlebar";
import * as hljs from "highlight.js";

export type MainAPI = {
	ipcHandle(channel: string, listener: (event: any, ...args: any[]) => void): void,
    ipcSend(channel: string, ...args: any[]): void,
    ipcSendSync(channel: string, ...args: any[]): any,
    openLink(link: "website" | "download" | "docs" | "changelogs" | "github" | "issues" | "feedback" | "feather"): void,
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

    openLink: (link: "website" | "download" | "docs" | "changelogs" | "github" | "issues" | "feedback" | "feather" | "license"): void => {
        switch (link) {
            case "website":
                shell.openExternal("https://www.codexnotes.com/");
                break;
            case "download":
                shell.openExternal("https://www.codexnotes.com/download/");
                break;
            case "docs":
                shell.openExternal("https://www.codexnotes.com/docs/");
                break;
            case "changelogs":
                shell.openExternal("https://www.codexnotes.com/updates/");
                break;
            case "github":
                shell.openExternal("https://github.com/jcv8000/Codex");
                break;
            case "issues":
                shell.openExternal("https://github.com/jcv8000/Codex/issues");
                break;
            case "feedback":
                shell.openExternal("https://forms.gle/uDLJpqLbNLcEx1F8A");
                break;
            case "feather":
                shell.openExternal("https://www.feathericons.com/");
                break;
            case "license":
                shell.openExternal("https://creativecommons.org/licenses/by-nc/4.0/");
                break;
        }
    }
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

		ipcRenderer.on("updateMenubar", () => {
			titlebar.updateMenu(remote.Menu.getApplicationMenu());
		});

        document.getElementById("editorRibbon").style.marginTop = "40px";

        if (process.platform !== "win32") {
            document.documentElement.style.setProperty("--titlebar-height", "0px");
        }
    }
});