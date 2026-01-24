import React, { useCallback, useMemo, forwardRef } from 'react';
import CodeMirror, { ReactCodeMirrorProps, EditorView, Extension, ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorState, Transaction } from '@codemirror/state';
import { keymap, KeyBinding } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting, indentUnit } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import {
    copyLineUp, copyLineDown, moveLineUp, moveLineDown,
    deleteLine, standardKeymap, toggleComment
} from '@codemirror/commands';

interface CodeMirrorEditorProps {
    value: string;
    onChange: (value: string) => void;
    onImageUpload?: (file: File) => Promise<void>;
    startLine?: number;
    className?: string;
    style?: React.CSSProperties;
}

// Custom Green Theme Highlighting
const greenHighlightStyle = HighlightStyle.define([
    { tag: tags.heading1, color: "#42b883", fontWeight: "800" },
    { tag: tags.heading2, color: "#42b883", fontWeight: "700" },
    { tag: tags.heading3, color: "#42b883", fontWeight: "600" },
    { tag: tags.heading4, color: "#42b883", fontWeight: "600" },
    { tag: tags.heading5, color: "#42b883", fontWeight: "600" },
    { tag: tags.heading6, color: "#42b883", fontWeight: "600" },
    { tag: tags.strong, fontWeight: "bold", color: "#000" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    { tag: tags.link, color: "#42b883", textDecoration: "underline" },
    { tag: tags.url, color: "#42b883", textDecoration: "underline" },
    { tag: tags.list, color: "#42b883", fontWeight: "bold" },
    { tag: tags.quote, color: "#6a737d", fontStyle: "italic" },
    // Code Blocks: Text Color Only (Emerald Green Variations), Background only for inline monospace
    { tag: tags.monospace, color: "#42b883", backgroundColor: "rgba(66, 184, 131, 0.1)", borderRadius: "3px" }, // Inline
    { tag: [tags.string, tags.attributeName, tags.name, tags.propertyName, tags.atom], color: "#42b883" }, // Code Text
    { tag: [tags.keyword, tags.typeName, tags.bool, tags.literal, tags.macroName], color: "#2E8B57" }, // Keywords
    { tag: [tags.number, tags.className, tags.variableName, tags.function(tags.variableName), tags.labelName, tags.definition(tags.name)], color: "#3CB371" }, // Vars
    { tag: [tags.operator, tags.comment], color: "#888" },
    { tag: tags.meta, color: "#888" },
    { tag: tags.punctuation, color: "#aaa" }
]);

// Helper for toggling wrapper (Exported to be used by Toolbar if needed, or keeping local logic)
export const toggleWrapper = (view: EditorView, wrapper: string) => {
    const { state, dispatch } = view;
    const { from, to } = state.selection.main;
    const text = state.doc.toString();
    const selectedText = text.slice(from, to);
    const before = text.slice(0, from);
    const after = text.slice(to);

    // 1. Internal Check
    if (selectedText.startsWith(wrapper) && selectedText.endsWith(wrapper) && selectedText.length >= 2 * wrapper.length) {
        dispatch({
            changes: { from, to, insert: selectedText.slice(wrapper.length, -wrapper.length) },
            selection: { anchor: from, head: to - 2 * wrapper.length }
        });
        return true;
    }

    // 2. External Check
    if (before.endsWith(wrapper) && after.startsWith(wrapper)) {
        dispatch({
            changes: [
                { from: from - wrapper.length, to: from, insert: "" },
                { from: to, to: to + wrapper.length, insert: "" }
            ],
            selection: { anchor: from - wrapper.length, head: to - wrapper.length }
        });
        return true;
    }

    // 3. Apply Wrapper
    dispatch({
        changes: { from, to, insert: `${wrapper}${selectedText}${wrapper}` },
        selection: { anchor: from + wrapper.length, head: to + wrapper.length }
    });
    return true;
};

// Insert Text Helper
export const insertTextAtCursor = (view: EditorView, textToInsert: string) => {
    const { state, dispatch } = view;
    const { from, to } = state.selection.main;
    dispatch({
        changes: { from, to, insert: textToInsert },
        selection: { anchor: from + textToInsert.length }
    });
}

const CodeMirrorEditor = forwardRef<ReactCodeMirrorRef, CodeMirrorEditorProps>(({ value, onChange, onImageUpload, className, style }, ref) => {

    // Handlers for Paste/Drop
    const eventHandlers = useMemo(() => EditorView.domEventHandlers({
        drop(event, view) {
            if (!onImageUpload) return;
            const file = event.dataTransfer?.files[0];
            if (file && file.type.startsWith('image/')) {
                event.preventDefault();
                onImageUpload(file);
            }
        },
        paste(event, view) {
            if (!onImageUpload) return;
            const items = event.clipboardData?.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith('image/')) {
                        const file = items[i].getAsFile();
                        if (file) {
                            event.preventDefault();
                            onImageUpload(file);
                            return;
                        }
                    }
                }
            }
        }
    }), [onImageUpload]);

    // Keybindings
    const keyMaps = useMemo<Extension>(() => keymap.of([
        { key: "Mod-b", run: (view) => toggleWrapper(view, "**"), preventDefault: true },
        { key: "Mod-i", run: (view) => toggleWrapper(view, "*"), preventDefault: true },
        { key: "Mod-k", run: (view) => toggleWrapper(view, "~~"), preventDefault: true },
        // Comment
        { key: "Mod-/", run: toggleComment },
        // Line Operations
        { key: "Alt-ArrowUp", run: moveLineUp },
        { key: "Alt-ArrowDown", run: moveLineDown },
        { key: "Shift-Alt-ArrowUp", run: copyLineUp },
        { key: "Shift-Alt-ArrowDown", run: copyLineDown },
    ]), []);

    const extensions = useMemo(() => [
        indentUnit.of("    "),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        syntaxHighlighting(greenHighlightStyle),
        eventHandlers,
        keyMaps,
        EditorView.lineWrapping,
        EditorView.theme({
            "&": { height: "100%", fontSize: "16px", fontFamily: '"Fira Code", "Fira Mono", monospace' },
            ".cm-content": { caretColor: "#42b883", lineHeight: "1.6" },
            ".cm-scroller": { fontFamily: '"Fira Code", "Fira Mono", monospace', lineHeight: "1.6" },
            "&.cm-focused": { outline: "none" }
        })
    ], [eventHandlers, keyMaps]);

    return (
        <CodeMirror
            ref={ref}
            value={value}
            height="100%"
            extensions={extensions}
            onChange={onChange}
            className={className}
            style={style}
            basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                // history: true, // enabled by default in basicSetup
            }}
        />
    );
});

export default CodeMirrorEditor;
