import { JsonProperty, Serializable, } from "typescript-json-serializer";
import { NotebookItem } from "./NotebookItem";

@Serializable()
export class Save {
    @JsonProperty({ type: NotebookItem })
    notebooks: NotebookItem[] = [];

    @JsonProperty()
    version = "2.0.0";
}
