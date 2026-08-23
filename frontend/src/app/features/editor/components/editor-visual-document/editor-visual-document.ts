import { Component, computed, input } from '@angular/core';

type VisualSegment = { text: string; bold?: boolean; italic?: boolean };
type VisualBlock =
  | { kind: 'title' | 'author' | 'section' | 'paragraph'; segments: VisualSegment[] }
  | { kind: 'list'; ordered: boolean; items: VisualSegment[][] };

@Component({
  selector: 'app-editor-visual-document',
  standalone: true,
  templateUrl: './editor-visual-document.html',
  styleUrl: './editor-visual-document.css',
})
export class EditorVisualDocumentComponent {
  readonly content = input('');
  readonly blocks = computed(() => this.parseContent(this.content()));

  private parseContent(content: string): VisualBlock[] {
    const blocks: VisualBlock[] = [];
    let paragraphLines: string[] = [];
    let listOrdered: boolean | null = null;
    let listItems: string[] = [];

    const flushParagraph = () => {
      const text = paragraphLines.join(' ').trim();
      if (text) blocks.push({ kind: 'paragraph', segments: this.toSegments(text) });
      paragraphLines = [];
    };
    const flushList = () => {
      if (listOrdered !== null && listItems.length) {
        blocks.push({
          kind: 'list',
          ordered: listOrdered,
          items: listItems.map((item) => this.toSegments(item)),
        });
      }
      listOrdered = null;
      listItems = [];
    };

    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        continue;
      }

      const listStart = line.match(/^\\begin\{(itemize|enumerate)\}$/);
      if (listStart) {
        flushParagraph();
        flushList();
        listOrdered = listStart[1] === 'enumerate';
        continue;
      }
      if (/^\\end\{(itemize|enumerate)\}$/.test(line)) {
        flushList();
        continue;
      }
      if (listOrdered !== null) {
        const item = line.match(/^\\item\s*(.*)$/);
        if (item) {
          listItems.push(item[1]);
        } else if (listItems.length) {
          listItems[listItems.length - 1] += ` ${line}`;
        }
        continue;
      }

      const title = this.readCommand(line, 'title');
      const author = this.readCommand(line, 'author');
      const section = this.readCommand(line, 'section') ?? this.readCommand(line, 'subsection');
      if (title !== null || author !== null || section !== null) {
        flushParagraph();
        const kind = title !== null ? 'title' : author !== null ? 'author' : 'section';
        blocks.push({ kind, segments: this.toSegments(title ?? author ?? section ?? '') });
        continue;
      }

      if (this.isStructuralCommand(line)) continue;
      paragraphLines.push(line);
    }

    flushParagraph();
    flushList();
    return blocks;
  }

  private readCommand(line: string, command: string): string | null {
    const match = line.match(new RegExp(`^\\\\${command}\\{(.*)\\}$`));
    return match ? match[1] : null;
  }

  private isStructuralCommand(line: string): boolean {
    return (
      line.startsWith('%') ||
      /^\\(?:documentclass|usepackage|date|begin\{document\}|end\{document\}|maketitle)$/.test(line)
    );
  }

  private toSegments(value: string): VisualSegment[] {
    const segments: VisualSegment[] = [];
    const commandPattern = /\\(textbf|textit)\{([^{}]*)\}/g;
    let position = 0;
    let match: RegExpExecArray | null;

    const addText = (text: string, bold = false, italic = false) => {
      const safeText = this.toSafeText(text);
      if (safeText.trim()) segments.push({ text: safeText, bold, italic });
    };

    while ((match = commandPattern.exec(value))) {
      addText(value.slice(position, match.index));
      addText(match[2], match[1] === 'textbf', match[1] === 'textit');
      position = commandPattern.lastIndex;
    }
    addText(value.slice(position));
    return segments;
  }

  private toSafeText(value: string): string {
    return value
      .replace(/\\[a-zA-Z]+\{([^{}]*)\}/g, '$1')
      .replace(/[{}]/g, '')
      .replace(/~+/g, ' ');
  }
}
