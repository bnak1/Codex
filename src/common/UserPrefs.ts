import { Serializable, JsonProperty } from "typescript-json-serializer";

@Serializable()
export class UserPrefs {
    @JsonProperty()
    theme = 0;

    @JsonProperty()
    codeStyle = "atom-one-dark";

    @JsonProperty()
    accentColor = "#FF7A27";

    @JsonProperty()
    defaultZoom = 1.0;

    @JsonProperty()
    defaultMaximized = false;

    @JsonProperty()
    pdfBreakOnH1 = false;

    @JsonProperty()
    openPDFonExport = true;

    @JsonProperty()
    tabSize = 4;

    @JsonProperty()
    sidebarWidth = 275;

    @JsonProperty()
    showCodeOverlay = true;

    @JsonProperty()
    codeWordWrap = false;

    @JsonProperty()
    lastUseVersion = "0.0.0";

    @JsonProperty()
    showMenuBar = true;
}