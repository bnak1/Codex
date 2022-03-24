export class UserPrefs {
    theme = 0;
    codeStyle = "atom-one-dark";
    accentColor = "#FF7A27";
    defaultZoom = 1.0;
    defaultMaximized = false;
    pdfBreakOnH1 = false;
    openPDFonExport = true;
    tabSize = 4;
    sidebarWidth = 275;
    showCodeOverlay = true;
    codeWordWrap = false;
    lastUseVersion = "0.0.0";
    showMenuBar = true;

    static fromObject(obj: object): UserPrefs {
        const inst = new UserPrefs();
        Object.assign(inst, obj);
        return inst;
    }
}