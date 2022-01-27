import {
	wrapIn, setBlockType, chainCommands, toggleMark, exitCode,
	joinUp, joinDown, lift, selectParentNode
} from "prosemirror-commands";
import { wrapInList, splitListItem, liftListItem, sinkListItem } from "prosemirror-schema-list";
import { undo, redo } from "prosemirror-history";
import { undoInputRule } from "prosemirror-inputrules";

import { isInTable, goToNextCell, addColumnAfter, addColumnBefore, addRowAfter, addRowBefore } from "prosemirror-tables";
import { schema } from "./schema";

const mac = typeof navigator != "undefined" ? /Mac/.test(navigator.platform) : false;


function codeBlockEnter(state, dispatch) {

    let nodesInSelection = 0;
    let theNode = null;

    state.doc.nodesBetween(state.selection.from, state.selection.to, (node, startPos) => {
        if (node.type == state.schema.nodes.code_block || node.type != state.schema.nodes.text) {
            nodesInSelection++;
            theNode = node;
        }
    });

    if (nodesInSelection == 1) {

        if (theNode.type == state.schema.nodes.code_block) {

            const raw = theNode.textBetween(0, state.selection.$head.parentOffset);
            const text = raw.substring(raw.lastIndexOf("\n"), raw.length);

            let tabs = 0;
            let spaces = 0;
            let tabChars = 0;
            for (let i = 0; i < text.length; i++) {
                if (text.charAt(i) == " ") {
                    spaces++;
                }
                else if (text.charAt(i) == "\t") {
                    tabChars++;
                }
                else if (text.charAt(i) != "\n")
                    break;
            }
            tabs = Math.floor(spaces / 2);

            const tr = state.tr;
            tr.insertText("\n");
            for (let i = 0; i < tabs; i++) {
                tr.insertText("  ");
            }
            for (let i = 0; i < tabChars; i++) {
                tr.insertText("\t");
            }

            dispatch(tr);

            return true;
        }
    }

    return false;
}


// :: (Schema, ?Object) → Object
// Inspect the given schema looking for marks and nodes from the
// basic schema, and if found, add key bindings related to them.
// This will add:
//
// * **Mod-b** for toggling [strong](#schema-basic.StrongMark)
// * **Mod-i** for toggling [emphasis](#schema-basic.EmMark)
// * **Mod-`** for toggling [code font](#schema-basic.CodeMark)
// * **Ctrl-Shift-0** for making the current textblock a paragraph
// * **Ctrl-Shift-1** to **Ctrl-Shift-Digit6** for making the current
//   textblock a heading of the corresponding level
// * **Ctrl-Shift-Backslash** to make the current textblock a code block
// * **Ctrl-Shift-8** to wrap the selection in an ordered list
// * **Ctrl-Shift-9** to wrap the selection in a bullet list
// * **Ctrl->** to wrap the selection in a block quote
// * **Enter** to split a non-empty textblock in a list item while at
//   the same time splitting the list item
// * **Mod-Enter** to insert a hard break
// * **Mod-_** to insert a horizontal rule
// * **Backspace** to undo an input rule
// * **Alt-ArrowUp** to `joinUp`
// * **Alt-ArrowDown** to `joinDown`
// * **Mod-BracketLeft** to `lift`
// * **Escape** to `selectParentNode`
//
// You can suppress or map these bindings by passing a `mapKeys`
// argument, which maps key names (say `"Mod-B"` to either `false`, to
// remove the binding, or a new key name string.
export function buildKeymap(tabSize) {
	const keys = {};
	let type;
	function bind(key, cmd) {
		keys[key] = cmd;
	}


	bind("Mod-z", undo);
	bind("Shift-Mod-z", redo);
	bind("Backspace", undoInputRule);
	if (!mac) bind("Mod-y", redo);

	if (type = schema.marks.strong) {
		bind("Mod-b", toggleMark(type));
		bind("Mod-B", toggleMark(type));
	}
	if (type = schema.marks.em) {
		bind("Mod-i", toggleMark(type));
		bind("Mod-I", toggleMark(type));
	}
	if (type = schema.marks.underline) {
		bind("Mod-u", toggleMark(type));
		bind("Mod-U", toggleMark(type));
	}
	if (type = schema.marks.code)
		bind("Mod-`", toggleMark(type));

	if (type = schema.nodes.bullet_list)
		bind("Shift-Ctrl-8", wrapInList(type));
	if (type = schema.nodes.ordered_list)
		bind("Shift-Ctrl-9", wrapInList(type));
	if (type = schema.nodes.blockquote)
		bind("Ctrl->", wrapIn(type));
	if (type = schema.nodes.hard_break) {
		const br = type, cmd = chainCommands(exitCode, (state, dispatch) => {
			dispatch(state.tr.replaceSelectionWith(br.create()).scrollIntoView());
			return true;
		});
		bind("Mod-Enter", cmd);
		bind("Shift-Enter", cmd);
		if (mac) bind("Ctrl-Enter", cmd);
	}
	if (type = schema.nodes.heading)
		for (let i = 1; i <= 6; i++) bind("Ctrl-" + i, setBlockType(type, { level: i }));
	if (type = schema.nodes.horizontal_rule) {
		const hr = type;
		bind("Mod-_", (state, dispatch) => {
			dispatch(state.tr.replaceSelectionWith(hr.create()).scrollIntoView());
			return true;
		});
	}

	bind("Enter", chainCommands(splitListItem(schema.nodes.list_item), codeBlockEnter));

	bind("Tab", (state, dispatch) => {

		if (sinkListItem(schema.nodes.list_item)(state, dispatch)) {
			return true;
		}
		else if (isInTable(state)) {
			goToNextCell(1)(state, dispatch);
			return true;
		}
		else {
			if (dispatch) {
				const tr = state.tr;
				for (let i = 0; i < tabSize; i++) {
					tr.insertText(" ").scrollIntoView();
				}
				dispatch(tr);
				return true;
			}
		}
	});

	bind("Shift-Tab", (state, dispatch) => {
		if (liftListItem(schema.nodes.list_item)(state, dispatch)) {
			return true;
		}
		else if (isInTable(state)) {
			goToNextCell(-1)(state, dispatch);
			return true;
		}
		else {
			if (dispatch) {
				const tr = state.tr;

				if (state.selection.to - state.selection.from === 0) {

					let nodesInSelection = 0;
					let node = null;
					state.doc.nodesBetween(state.selection.from, state.selection.to, (_node, startPos) => {

						if (_node.type == state.schema.nodes.code_block) {
							nodesInSelection++;
							node = _node;
						}
					});

					if (nodesInSelection == 1 && node.type == state.schema.nodes.code_block) {

						let text = node.textBetween(0, state.selection.$head.parentOffset);

						const firstIndexOfLine = text.lastIndexOf("\n") || 0;

						text = node.textBetween(0, state.selection.$head.parentOffset + 1);

						const distToStart = text.length - firstIndexOfLine - 1;

						for (let i = 1; i <= tabSize; i++) {
							if (text.charAt(firstIndexOfLine + 1) == " ") {
								tr.delete(state.selection.from - distToStart + 1, state.selection.from - distToStart + 2).scrollIntoView();
							}
						}
					}
				}

				dispatch(tr);
				return true;
			}
		}
		return false;
	});

    bind("Mod-ArrowRight", (state, dispatch) => {
        if (isInTable(state)) {
            addColumnAfter(state, dispatch);
            return true;
        }
    });

    bind("Mod-ArrowLeft", (state, dispatch) => {
        if (isInTable(state)) {
            addColumnBefore(state, dispatch);
            return true;
        }
    });

    bind("Mod-ArrowUp", (state, dispatch) => {
        if (isInTable(state)) {
            addRowBefore(state, dispatch);
            return true;
        }
    });

    bind("Mod-ArrowDown", (state, dispatch) => {
        if (isInTable(state)) {
            addRowAfter(state, dispatch);
            return true;
        }
    });

	return keys;
}