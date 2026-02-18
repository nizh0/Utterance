"use client";

interface Token {
  text: string;
  className: string;
}

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const keywords = new Set([
    "import",
    "from",
    "const",
    "new",
    "await",
    "export",
    "default",
    "function",
    "return",
    "let",
    "var",
    "if",
    "else",
    "for",
    "while",
    "class",
    "extends",
    "async",
  ]);

  while (i < code.length) {
    // Line comments
    if (code[i] === "/" && code[i + 1] === "/") {
      let end = code.indexOf("\n", i);
      if (end === -1) end = code.length;
      tokens.push({ text: code.slice(i, end), className: "syn-comment" });
      i = end;
      continue;
    }

    // Strings (double quotes)
    if (code[i] === '"') {
      let end = i + 1;
      while (end < code.length && code[end] !== '"') {
        if (code[end] === "\\") end++;
        end++;
      }
      end++;
      tokens.push({ text: code.slice(i, end), className: "syn-string" });
      i = end;
      continue;
    }

    // Strings (single quotes)
    if (code[i] === "'") {
      let end = i + 1;
      while (end < code.length && code[end] !== "'") {
        if (code[end] === "\\") end++;
        end++;
      }
      end++;
      tokens.push({ text: code.slice(i, end), className: "syn-string" });
      i = end;
      continue;
    }

    // Template literals
    if (code[i] === "`") {
      let end = i + 1;
      while (end < code.length && code[end] !== "`") {
        if (code[end] === "\\") end++;
        end++;
      }
      end++;
      tokens.push({ text: code.slice(i, end), className: "syn-string" });
      i = end;
      continue;
    }

    // Numbers
    if (/\d/.test(code[i]) && (i === 0 || /[\s(,=+\-*/<>[\]{};:]/.test(code[i - 1]))) {
      let end = i;
      while (end < code.length && /[\d.]/.test(code[end])) end++;
      tokens.push({ text: code.slice(i, end), className: "syn-number" });
      i = end;
      continue;
    }

    // Words (identifiers / keywords)
    if (/[a-zA-Z_$]/.test(code[i])) {
      let end = i;
      while (end < code.length && /[a-zA-Z0-9_$]/.test(code[end])) end++;
      const word = code.slice(i, end);

      if (keywords.has(word)) {
        tokens.push({ text: word, className: "syn-keyword" });
      } else if (code[end] === "(") {
        tokens.push({ text: word, className: "syn-function" });
      } else if (word === "console") {
        tokens.push({ text: word, className: "syn-builtin" });
      } else if (word === "log") {
        tokens.push({ text: word, className: "syn-function" });
      } else {
        tokens.push({ text: word, className: "syn-ident" });
      }
      i = end;
      continue;
    }

    // Brackets and punctuation
    if (/[(){}[\]]/.test(code[i])) {
      tokens.push({ text: code[i], className: "syn-bracket" });
      i++;
      continue;
    }

    // Operators and punctuation
    if (/[=+\-*/<>!&|?:;.,]/.test(code[i])) {
      // Arrow =>
      if (code[i] === "=" && code[i + 1] === ">") {
        tokens.push({ text: "=>", className: "syn-operator" });
        i += 2;
        continue;
      }
      tokens.push({ text: code[i], className: "syn-punctuation" });
      i++;
      continue;
    }

    // Whitespace and newlines
    if (/\s/.test(code[i])) {
      let end = i;
      while (end < code.length && /\s/.test(code[end])) end++;
      tokens.push({ text: code.slice(i, end), className: "" });
      i = end;
      continue;
    }

    // Fallback
    tokens.push({ text: code[i], className: "" });
    i++;
  }

  return tokens;
}

export function SyntaxHighlight({ code }: { code: string }) {
  const tokens = tokenize(code);

  return (
    <code>
      {tokens.map((token, i) => {
        if (!token.className) {
          return <span key={i}>{token.text}</span>;
        }
        return (
          <span key={i} className={token.className}>
            {token.text}
          </span>
        );
      })}
    </code>
  );
}
