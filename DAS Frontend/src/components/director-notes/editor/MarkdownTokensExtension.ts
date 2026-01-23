import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const markTokenMap: Record<string, string> = {
  bold: '**',
  italic: '*',
  code: '`',
};

const createTokenElement = (token: string): HTMLElement => {
  const element = document.createElement('span');
  element.className = 'md-token';
  element.textContent = token;
  element.setAttribute('contenteditable', 'false');
  element.setAttribute('data-token', token);
  element.style.pointerEvents = 'none';
  element.style.userSelect = 'none';
  return element;
};

const buildMarkdownDecorations = (state: any): DecorationSet => {
  const decorations: Decoration[] = [];
  const activeMarks = new Set<string>();
  const markTypes = Object.keys(markTokenMap);

  state.doc.descendants((node: any, pos: number) => {
    // Heading tokens
    if (node.type.name === 'heading') {
      const token = `${'#'.repeat(node.attrs.level)} `;
      decorations.push(
        Decoration.widget(pos + 1, () => createTokenElement(token), { side: -1 })
      );
    }

    // Blockquote tokens
    if (node.type.name === 'blockquote') {
      decorations.push(
        Decoration.widget(pos + 1, () => createTokenElement('> '), { side: -1 })
      );
    }

    // List item tokens
    if (node.type.name === 'listItem') {
      const resolved = state.doc.resolve(pos);
      const parent = resolved.node(resolved.depth - 1);
      const index = resolved.index(resolved.depth - 1);
      const token = parent?.type?.name === 'orderedList' ? `${index + 1}. ` : '- ';
      decorations.push(
        Decoration.widget(pos + 1, () => createTokenElement(token), { side: -1 })
      );
    }

    // Code block tokens
    if (node.type.name === 'codeBlock') {
      decorations.push(
        Decoration.widget(pos + 1, () => createTokenElement('```'), { side: -1 })
      );
      decorations.push(
        Decoration.widget(pos + node.nodeSize - 1, () => createTokenElement('```'), { side: 1 })
      );
    }

    // Skip non-text nodes for inline marks
    if (!node.isText) {
      return;
    }

    // Handle inline marks (bold, italic, code)
    const marks = new Set(
      node.marks
        .map((mark: any) => mark.type.name)
        .filter((name: string) => markTokenMap[name])
    );

    markTypes.forEach((markType) => {
      const isActive = marks.has(markType);
      const wasActive = activeMarks.has(markType);

      if (isActive && !wasActive) {
        decorations.push(
          Decoration.widget(pos, () => createTokenElement(markTokenMap[markType]), { side: -1 })
        );
      }

      if (!isActive && wasActive) {
        decorations.push(
          Decoration.widget(pos, () => createTokenElement(markTokenMap[markType]), { side: -1 })
        );
      }
    });

    markTypes.forEach((markType) => {
      if (marks.has(markType)) {
        activeMarks.add(markType);
      } else {
        activeMarks.delete(markType);
      }
    });
  });

  // Close any remaining open marks at the end
  const endPos = state.doc.content.size;
  activeMarks.forEach((markType) => {
    decorations.push(
      Decoration.widget(endPos, () => createTokenElement(markTokenMap[markType]), { side: -1 })
    );
  });

  return DecorationSet.create(state.doc, decorations);
};

interface MarkdownTokensOptions {
  getShowTokens: () => boolean;
}

export const MarkdownTokensExtension = Extension.create<MarkdownTokensOptions>({
  name: 'markdownTokens',

  addOptions() {
    return {
      getShowTokens: () => true,
    };
  },

  addProseMirrorPlugins() {
    const { getShowTokens } = this.options;

    return [
      new Plugin({
        key: new PluginKey('markdownTokens'),
        props: {
          decorations: (state) => {
            if (!getShowTokens()) {
              return null;
            }
            return buildMarkdownDecorations(state);
          },
        },
      }),
    ];
  },
});

export default MarkdownTokensExtension;
