import { keymap } from "prosemirror-keymap";
import { history } from "prosemirror-history";
import { baseKeymap } from "prosemirror-commands";
import { buildKeymap } from "./keymap";
import { EditorState, Plugin } from "prosemirror-state";
import { dropCursor } from "prosemirror-dropcursor";
import { gapCursor } from "prosemirror-gapcursor";
import { menuBar } from "./menubar";
import { buildMenuItems } from "./menu";
import { buildInputRules } from "./inputrules";
import { LANGUAGES } from "./languages";
import { schema } from "./schema";
import { highlightPlugin } from "prosemirror-highlightjs";
import { tableEditing } from "prosemirror-tables";
import { mathPlugin } from "@benrbray/prosemirror-math";
import hljs from "highlight.js";

/**
 * @param {EditorState} state
 */
export function isCursorInCodeBlock(state) {
	state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
		if (node.type === schema.nodes["code_block"]) {
			return true;
		}
	});
	return false;
}

const codeCollapsePlugin = new Plugin({
    props: {
        handleClick(view, _, event) {
            
            if (event.target.className == "snippetCollapser") {

                const state = view.state;
                state.doc.nodesBetween(state.selection.from, state.selection.to, (node, pos) => {

                    if (node.type.name == "code_block") {

                        let tr = state.tr;

                        const newAttrs = Object.assign({}, node.attrs);
                        newAttrs.collapsed = !node.attrs.collapsed;
                        tr.setNodeMarkup(pos, node.type, newAttrs);

                        tr = tr.setMeta("addToHistory", false);

                        view.dispatch(tr);
                    }
                });

            }
        }
    }
});

/**
 * @param {number} tabSize
 */
export function prosemirrorSetup(tabSize) {

	const plugins = [

		buildInputRules(schema),

		keymap(buildKeymap(tabSize)),

		keymap(baseKeymap),

		dropCursor(),

		gapCursor(),

		highlightPlugin(hljs),

        codeCollapsePlugin,

		tableEditing(),

		mathPlugin,

		menuBar({
			floating: true,
			content: buildMenuItems().fullMenu
		}),

		history(),

		new Plugin({
			props: {
				attributes: { class: "ProseMirror-example-setup-style" }
			}
		})

	];

	return plugins;
}

export { schema };
