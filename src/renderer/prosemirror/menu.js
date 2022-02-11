import {
	wrapItem, blockTypeItem, Dropdown, DropdownSubmenu, joinUpItem, liftItem,
	selectParentNodeItem, undoItem, redoItem, icons, MenuItem
} from "prosemirror-menu";
import { NodeSelection, Transaction } from "prosemirror-state";
import {setBlockType, toggleMark} from "prosemirror-commands";
import { wrapInList } from "prosemirror-schema-list";
import { TextField, openPrompt } from "./prompt";
import { schema } from "./schema";
import { LANGUAGES } from "./languages";
import { insertMathCmd } from "@benrbray/prosemirror-math";
import { isInTable } from "prosemirror-tables";
import { isCursorInCodeBlock } from "./index";
import { Fragment } from "prosemirror-model";
import {  addColumnAfter, addColumnBefore, deleteColumn, addRowAfter, addRowBefore, deleteRow,
    mergeCells, splitCell, setCellAttr, toggleHeaderRow, toggleHeaderColumn, toggleHeaderCell,
    deleteTable } from "prosemirror-tables";

var myIcons = {
    underline: {
        width: 875, height: 875,
        path: "M 166.25,746.00 C 161.50,750.75 160.00,757.00 160.00,771.62 160.00,785.62 161.88,791.50 167.38,794.38 169.88,795.62 181.12,796.12 215.62,796.62 240.38,797.00 274.12,797.88 290.62,798.62 308.38,799.38 398.12,799.88 511.25,799.88 724.00,799.88 705.25,800.62 711.75,790.75 715.00,785.88 715.12,785.00 714.75,771.75 714.38,758.88 714.13,757.50 710.88,752.88 708.88,750.00 705.75,747.12 704.00,746.38 701.63,745.50 635.50,745.00 483.75,745.12 340.25,745.12 263.75,744.75 257.50,743.88 252.38,743.12 230.50,742.50 209.00,742.50 209.00,742.50 169.75,742.50 169.75,742.50 169.75,742.50 166.25,746.00 166.25,746.00 Z M 133.38,64.75 C 128.12,65.37 125.00,71.37 125.00,80.62 125.13,92.37 126.88,93.62 147.88,96.75 155.38,97.87 162.50,99.75 166.00,101.62 169.25,103.25 176.00,106.12 181.00,108.00 186.00,110.00 190.62,112.50 191.25,113.75 192.00,115.13 194.75,118.62 197.50,121.88 200.13,125.00 203.12,129.62 203.88,132.25 205.13,135.75 205.50,180.13 205.88,325.62 206.12,451.12 206.62,518.62 207.63,526.88 208.50,535.38 210.00,542.00 212.50,547.50 214.38,552.00 216.88,560.00 218.12,565.38 219.63,572.50 221.25,576.38 224.38,580.38 226.75,583.25 230.13,588.38 232.00,591.88 236.62,600.62 242.25,607.25 258.25,623.12 267.38,632.25 274.62,638.25 279.75,641.00 283.88,643.25 289.62,647.00 292.38,649.38 295.25,651.62 300.75,654.75 304.75,656.12 308.62,657.50 314.12,659.88 316.88,661.38 329.00,668.00 331.38,668.88 342.00,670.75 348.12,671.75 358.25,674.25 364.38,676.25 381.13,681.75 392.00,682.88 430.62,683.00 468.63,683.12 480.12,681.88 493.25,676.75 497.38,675.00 507.38,672.00 515.50,670.00 523.62,668.00 532.62,665.12 535.50,663.62 538.25,662.12 544.62,658.88 549.38,656.50 554.25,654.12 560.62,650.38 563.75,648.12 566.88,645.88 571.62,642.88 574.38,641.50 580.38,638.38 609.25,610.38 614.75,602.38 616.88,599.12 621.12,593.62 624.12,590.12 627.12,586.62 630.38,581.38 631.12,578.50 632.00,575.62 634.38,570.50 636.25,567.00 639.88,560.50 643.50,547.25 646.25,530.00 647.12,524.88 648.88,515.88 650.25,510.00 652.75,499.88 652.88,494.50 653.25,394.38 653.88,246.50 654.75,178.88 656.12,164.00 657.75,146.25 660.62,138.12 671.63,120.87 675.75,114.25 680.12,111.50 691.88,108.12 696.00,107.00 702.00,104.50 705.12,102.50 712.88,97.75 718.75,96.25 729.38,96.25 740.25,96.12 747.62,94.50 749.62,91.75 750.62,90.50 751.25,85.87 751.25,81.00 751.25,71.00 749.25,67.00 743.38,65.12 740.88,64.38 697.12,64.00 626.00,64.25 626.00,64.25 512.62,64.50 512.62,64.50 512.62,64.50 509.38,67.50 509.38,67.50 504.38,72.25 502.25,82.87 505.12,89.12 507.13,93.50 511.13,94.87 526.00,96.37 535.25,97.25 541.50,98.62 546.75,100.87 551.00,102.62 559.38,105.75 565.62,107.87 575.12,111.00 577.75,112.63 583.12,118.00 596.62,131.50 599.50,137.87 603.12,162.75 604.25,170.13 606.25,181.12 607.75,187.12 610.38,198.00 610.38,200.25 610.88,339.50 610.88,339.50 611.38,480.88 611.38,480.88 611.38,480.88 608.25,496.37 608.25,496.37 606.50,504.88 604.12,518.00 603.12,525.62 600.62,542.88 599.38,546.75 594.25,553.75 592.00,557.00 589.12,562.12 587.88,565.38 585.00,572.75 578.38,581.38 566.75,593.00 556.25,603.38 547.62,609.88 537.12,615.12 533.00,617.25 527.50,620.38 525.12,621.88 519.00,625.88 509.88,628.00 476.62,633.25 476.62,633.25 448.12,637.75 448.12,637.75 448.12,637.75 428.75,635.00 428.75,635.00 402.00,631.25 380.50,626.38 375.38,622.88 373.00,621.25 367.00,618.00 362.12,615.62 355.25,612.50 350.25,608.62 341.13,599.75 327.75,586.75 319.00,574.38 314.25,561.75 312.50,557.12 309.50,549.88 307.50,545.62 299.38,528.88 298.75,511.50 298.75,314.38 298.75,139.12 299.00,131.62 304.12,121.75 307.62,115.00 315.38,109.00 327.00,103.87 340.25,98.00 346.25,96.50 362.75,95.50 377.00,94.62 380.62,92.75 381.88,85.25 382.88,79.00 380.88,70.25 377.50,67.00 377.50,67.00 374.88,64.38 374.88,64.38 374.88,64.38 255.88,64.38 255.88,64.38 190.38,64.38 135.25,64.50 133.38,64.75 Z"
    },
    leftAlign: {
        width: 24, height: 24,
        path: "M 17.00,18.00 C 17.00,18.00 3.00,18.00 3.00,18.00M 21.00,14.00 C 21.00,14.00 3.00,14.00 3.00,14.00M 21.00,6.00 C 21.00,6.00 3.00,6.00 3.00,6.00M 17.00,10.00 C 17.00,10.00 3.00,10.00 3.00,10.00",
        stroke: "currentColor",
        scale: 1.5,
        strokeWidth: 1.5
    },
    centerAlign: {
        width: 24, height: 24,
        path: "M 18.00,18.00 C 18.00,18.00 6.00,18.00 6.00,18.00M 21.00,14.00 C 21.00,14.00 3.00,14.00 3.00,14.00M 21.00,6.00 C 21.00,6.00 3.00,6.00 3.00,6.00M 18.00,10.00 C 18.00,10.00 6.00,10.00 6.00,10.00",
        stroke: "currentColor",
        scale: 1.5,
        strokeWidth: 1.5
    },
    rightAlign: {
        width: 24, height: 24,
        path: "M 21.00,18.00 C 21.00,18.00 7.00,18.00 7.00,18.00M 21.00,14.00 C 21.00,14.00 3.00,14.00 3.00,14.00M 21.00,6.00 C 21.00,6.00 3.00,6.00 3.00,6.00M 21.00,10.00 C 21.00,10.00 7.00,10.00 7.00,10.00",
        stroke: "currentColor",
        scale: 1.5,
        strokeWidth: 1.5
    }
};

// Helpers to create specific types of items

function canInsert(state, nodeType) {
	const $from = state.selection.$from;
	for (let d = $from.depth; d >= 0; d--) {
		const index = $from.index(d);
		if ($from.node(d).canReplaceWith(index, index, nodeType)) return true;
	}
	return false;
}

function insertImageItem(nodeType) {
	return new MenuItem({
		title: "Insert image",
		label: "Image",
		enable(state) { return canInsert(state, nodeType); },
		run(state, _, view) {
			const { from, to } = state.selection;
			let attrs = null;
			if (state.selection instanceof NodeSelection && state.selection.node.type == nodeType)
				attrs = state.selection.node.attrs;
			openPrompt({
				title: "Insert image",
				fields: {
					src: new TextField({ label: "Location", required: true, value: attrs && attrs.src }),
					title: new TextField({ label: "Title", value: attrs && attrs.title }),
					alt: new TextField({
						label: "Description",
						value: attrs ? attrs.alt : state.doc.textBetween(from, to, " ")
					})
				},
				callback(attrs) {
					view.dispatch(view.state.tr.replaceSelectionWith(nodeType.createAndFill(attrs)));
					view.focus();
				}
			});
		}
	});
}

function cmdItem(cmd, options) {
	const passedOptions = {
		label: options.title,
		run: cmd
	};
	for (const prop in options) passedOptions[prop] = options[prop];
	if ((!options.enable || options.enable === true) && !options.select)
		passedOptions[options.enable ? "enable" : "select"] = state => cmd(state);

	return new MenuItem(passedOptions);
}

function markActive(state, type) {
	const { from, $from, to, empty } = state.selection;
	if (empty) return type.isInSet(state.storedMarks || $from.marks());
	else return state.doc.rangeHasMark(from, to, type);
}

function markItem(markType, options) {
	const passedOptions = {
		active(state) { return markActive(state, markType); },
		enable: true
	};
	for (const prop in options) passedOptions[prop] = options[prop];
	return cmdItem(toggleMark(markType), passedOptions);
}

function linkItem(markType) {
	return new MenuItem({
		title: "Add or remove link",
		icon: icons.link,
		active(state) { return markActive(state, markType); },
		enable(state) { return !state.selection.empty && !isCursorInCodeBlock(state); },
		run(state, dispatch, view) {
			if (markActive(state, markType)) {
				toggleMark(markType)(state, dispatch);
				return true;
			}
			openPrompt({
				title: "Create a link",
				fields: {
					href: new TextField({
						label: "Link target",
						required: true
					}),
					title: new TextField({ label: "Title" })
				},
				callback(attrs) {
					toggleMark(markType, attrs)(view.state, view.dispatch);
					view.focus();
				}
			});
		}
	});
}

function wrapListItem(nodeType, options) {
	return cmdItem(wrapInList(nodeType, options.attrs), options);
}

/**
 * @param {string} language
 */
function makeCodeBlock(language) {

	return function (state, dispatch) {
		if (state.selection.empty) {
			setBlockType(state.schema.nodes.code_block, { params: language })(state, dispatch);
			return true;
		}
		else {
			const range = state.selection.$from.blockRange(state.selection.$to);
			let content = "";
			state.doc.nodesBetween(state.selection.from, state.selection.to, (node) => {
				if (node.text) {
					content += node.text + "\n";
				}
			});

			if (content !== "") {
				const node = state.schema.node(state.schema.nodes.code_block, { params: language }, [state.schema.text(content)]);

				const tr = state.tr.replaceRangeWith(range.start, range.end, node);

				if (dispatch) {
					dispatch(tr);
					return true;
				}
			}
			return false;
		}
	};
}

/**
 * 
 * @param {EditorState} state 
 * @param {Transaction} dispatch 
 */
function insertTable(state, dispatch) {

    if (!isCursorInCodeBlock(state)) {

        const tr = state.tr.replaceSelectionWith(
            state.schema.nodes.table.create(
                undefined,
                Fragment.fromArray([
                    state.schema.nodes.table_row.create(undefined, Fragment.fromArray([
                        //state.schema.nodes.table_cell.createAndFill(),
                        //state.schema.nodes.table_cell.createAndFill()
                        state.schema.nodes.table_cell.create(undefined, Fragment.fromArray([
                            state.schema.nodes.paragraph.createAndFill(null, state.schema.text("New"))
                        ])),
                        state.schema.nodes.table_cell.create(undefined, Fragment.fromArray([
                            state.schema.nodes.paragraph.createAndFill(null, state.schema.text("Table"))
                        ]))
                    ])),
                    state.schema.nodes.table_row.create(undefined, Fragment.fromArray([
                        state.schema.nodes.table_cell.createAndFill(),
                        state.schema.nodes.table_cell.createAndFill()
                    ]))
                ])
            )
        );

        if (dispatch) {
            dispatch(tr);
        }

        return true;

    }
}

function item(label, cmd) { return new MenuItem({ label, select: cmd, run: cmd }); }

export function buildMenuItems() {
	const r = {};
	let type;
	if (type = schema.marks.strong)
		r.toggleStrong = markItem(type, { title: "Toggle strong style", icon: icons.strong });
	if (type = schema.marks.em)
		r.toggleEm = markItem(type, { title: "Toggle emphasis", icon: icons.em });
	if (type = schema.marks.underline) {
		r.toggleUnderline = markItem(type, { title: "Toggle underline", icon: myIcons.underline });
	}
	if (type = schema.marks.code)
		r.toggleCode = markItem(type, { title: "Toggle code font", icon: icons.code });
	if (type = schema.marks.link)
		r.toggleLink = linkItem(type);

	if (type = schema.nodes.image)
		r.insertImage = insertImageItem(type);
	if (type = schema.nodes.bullet_list)
		r.wrapBulletList = wrapListItem(type, {
			title: "Wrap in bullet list",
			icon: icons.bulletList,
            enable: function enable(state) {
                return !isCursorInCodeBlock(state) && !isInTable(state);
            },
            select: function select(state) {
                return true;
            }
		});
	if (type = schema.nodes.ordered_list)
		r.wrapOrderedList = wrapListItem(type, {
			title: "Wrap in ordered list",
			icon: icons.orderedList,
            enable: function enable(state) {
                return !isCursorInCodeBlock(state) && !isInTable(state);
            },
            select: function select(state) {
                return true;
            }
		});
	if (type = schema.nodes.blockquote)
		r.wrapBlockQuote = wrapItem(type, {
			title: "Wrap in block quote",
			icon: icons.blockquote,
            enable: function enable(state) {
                return !isCursorInCodeBlock(state) && !isInTable(state);
            },
            select: function select(state) {
                return true;
            }
		});
	if (type = schema.nodes.paragraph)
		r.makeParagraph = blockTypeItem(type, {
			title: "Change to paragraph",
			label: "Plain"
		});
	if (type = schema.nodes.code_block)
		r.makeCodeBlock = blockTypeItem(type, {
			title: "Change to code block",
			label: "Code"
		});
	if (type = schema.nodes.heading)
		for (let i = 1; i <= 10; i++)
			r["makeHead" + i] = blockTypeItem(type, {
				title: "Change to heading " + i,
				label: "Level " + i,
				attrs: { level: i }
			});
	if (type = schema.nodes.horizontal_rule) {
		const hr = type;
        r.insertHorizontalRule = new MenuItem({
            title: "Insert horizontal rule",
            label: "Horizontal rule",
            enable: function enable(state) { return (canInsert(state, hr) && !isInTable(state) && !isCursorInCodeBlock(state)); },
            run: function run(state, dispatch) {
                if (!isInTable(state) && !isCursorInCodeBlock(state))
                    dispatch(state.tr.replaceSelectionWith(hr.create()));
            }
        });
	}
    if (type = schema.nodes.table) {
        r.insertTable = new MenuItem({
            label: "Table",
            run: insertTable,
            enable: function enable(state) {
                return !isInTable(state) && !isCursorInCodeBlock(state);
            }
        });
    }

	const languageMenu1 = [];
	const languageMenu2 = [];
	const languageMenu3 = [];
	
	for (const lang in LANGUAGES) {
		if (LANGUAGES[lang].charAt(0).toLowerCase() <= "g") {
			languageMenu1.push(blockTypeItem(schema.nodes.code_block, {
				title: `Change to ${LANGUAGES[lang]} code block`,
				label: LANGUAGES[lang],
				attrs: { params: lang },
				run: makeCodeBlock(lang)
			}));
		}
		else if (LANGUAGES[lang].charAt(0).toLowerCase() <= "m") {
			languageMenu2.push(blockTypeItem(schema.nodes.code_block, {
				title: `Change to ${LANGUAGES[lang]} code block`,
				label: LANGUAGES[lang],
				attrs: { params: lang },
				run: makeCodeBlock(lang)
			}));
		}
		else {
			languageMenu3.push(blockTypeItem(schema.nodes.code_block, {
				title: `Change to ${LANGUAGES[lang]} code block`,
				label: LANGUAGES[lang],
				attrs: { params: lang },
				run: makeCodeBlock(lang)
			}));
		}
	}

    languageMenu1.push(blockTypeItem(schema.nodes.code_block, {
        title: "Change to code block (auto-detects language)",
        label: "Other",
        run: makeCodeBlock("")
    }));
    languageMenu2.push(blockTypeItem(schema.nodes.code_block, {
        title: "Change to code block (auto-detects language)",
        label: "Other",
        run: makeCodeBlock("")
    }));
    languageMenu3.push(blockTypeItem(schema.nodes.code_block, {
        title: "Change to code block (auto-detects language)",
        label: "Other",
        run: makeCodeBlock("")
    }));

	const cut = arr => arr.filter(x => x);

	const codeMenu1 = new DropdownSubmenu(languageMenu1, { label: "Code (A-G)" });
	const codeMenu2 = new DropdownSubmenu(languageMenu2, { label: "Code (H-M)" });
	const codeMenu3 = new DropdownSubmenu(languageMenu3, { label: "Code (N-Z)" });


    const tableMenuItems = [
        new MenuItem({ label: "Insert Table", enable: function enable(state) { return !isInTable(state) && !isCursorInCodeBlock(state); }, run: insertTable }),
        item("Insert column before", addColumnBefore),
        item("Insert column after", addColumnAfter),
        item("Delete column", deleteColumn),
        item("Insert row before", addRowBefore),
        item("Insert row after", addRowAfter),
        item("Delete row", deleteRow),
        item("Delete table", deleteTable),
        item("Merge cells", mergeCells),
        item("Split cell", splitCell),
        item("Toggle header column", toggleHeaderColumn),
        item("Toggle header row", toggleHeaderRow),
        item("Toggle header cells", toggleHeaderCell),
        //item("Make cell green", setCellAttr("background", "#dfd")),
        //item("Make cell not-green", setCellAttr("background", null))
    ];

	r.insertMenu = new Dropdown(cut([r.insertImage, r.insertHorizontalRule]), { label: "Insert" });
	r.typeMenu = new Dropdown(cut([r.makeParagraph, codeMenu1, codeMenu2, codeMenu3, r.makeHead1 && new DropdownSubmenu(cut([
		r.makeHead1, r.makeHead2, r.makeHead3, r.makeHead4, r.makeHead5, r.makeHead6
	]), { label: "Heading" })]), { label: "Type..." });

	r.inlineMenu = [cut([undoItem, redoItem]), cut([r.toggleStrong, r.toggleEm, r.toggleUnderline, r.toggleCode, r.toggleLink])];
	r.blockMenu = [cut([r.wrapBulletList, r.wrapOrderedList, r.wrapBlockQuote, /*joinUpItem,
		liftItem,*/ selectParentNodeItem])];
	r.fullMenu = r.inlineMenu.concat([[r.insertMenu, r.typeMenu]], r.blockMenu);

    r.fullMenu.splice(2, 0, [new Dropdown(tableMenuItems, { label: "Table" })]);

	return r;
}
