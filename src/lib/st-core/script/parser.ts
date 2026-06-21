import type {
  SlashCommandDef,
  SlashCommandExecutor,
  NamedArgAssignment,
  UnnamedArgAssignment,
  ParseOptions,
  ISlashCommandClosure,
} from './types.js';
import { createScope } from './scope.js';

/**
 * Minimal STscript parser.
 * Parses text into a chain of SlashCommandExecutors wrapped in a SlashCommandClosure.
 *
 * Supports:
 *   /command arg1 arg2 key=val
 *   /command | /next-command          (pipe)
 *   /command || /no-pipe-inject       (suppress pipe injection)
 *   {:/command :}                     (explicit closure)
 *   /command {:/sub-command :}        (closure as argument)
 *   // comment text
 *
 * Does NOT (yet) support:
 *   Run shorthands (/:varname)
 *   Named args at closure level
 *   Breakpoints/break
 *   Parser flags
 */
export function parse(
  text: string,
  commands: Record<string, SlashCommandDef>,
  options: ParseOptions = {},
): ISlashCommandClosure {
  const verifyNames = options.verifyCommandNames ?? true;
  const index = new ParserCursor(text);
  const scope = createScope(null);

  const closure: ISlashCommandClosure = {
    scope,
    executorList: [],
    executeNow: false,
    argumentList: [],
    ...(options.abortController ? { abortController: options.abortController } : {}),
    async execute() {
      let pipe = '';
      for (const executor of closure.executorList) {
        const namedArgs: Record<string, unknown> = {
          _scope: closure.scope,
          _abortController: closure.abortController ?? new AbortController(),
          _hasUnnamedArgument: executor.unnamedArgumentList.length > 0,
        };
        Object.assign(
          namedArgs,
          Object.fromEntries(executor.namedArgumentList.map((a) => [a.name, a.value])),
        );
        for (const arg of executor.namedArgumentList) {
          namedArgs[arg.name] = arg.value;
        }

        let value = '';
        if (executor.unnamedArgumentList.length > 0) {
          value = executor.unnamedArgumentList.map((a) => a.value).join(' ');
        } else if (executor.injectPipe && pipe) {
          value = pipe;
          namedArgs._hasUnnamedArgument = true;
        }

        try {
          const result = await executor.command.callback(
            namedArgs as import('./types.js').CommandArgs,
            value,
          );
          if (typeof result === 'string') {
            pipe = result;
          } else if (result && typeof result === 'object' && 'execute' in result) {
            closure.scope.pipe = pipe;
            const subResult = await result.execute();
            pipe = subResult.pipe ?? '';
          }
        } catch (e) {
          throw new Error(`Error executing "/${executor.name}": ${(e as Error).message}`, { cause: e });
        }
      }
      return { pipe, isAborted: false, isError: false };
    },
  };

  index.discardWhitespace();

  while (!index.isEnd()) {
    if (index.peek() === '/' && index.peek(1) === '/') {
      // Line comment
      index.discardUntil('\n');
      index.discardWhitespace();
    } else if (index.peek() === '/') {
      index.advance(); // consume /

      const start = index.pos;
      let name = '';
      while (!index.isEnd() && !/\s/.test(index.peek())) {
        name += index.advance();
      }

      if (verifyNames && !commands[name]) {
        throw new Error(`Unknown command at position ${start}: "/${name}"`);
      }

      const commandDef = commands[name];
      if (!commandDef) {
        // Skip unknown commands when not verifying names
        index.discardWhitespace();
        continue;
      }

      index.discardWhitespace();

      const executor: SlashCommandExecutor = {
        name,
        command: commandDef,
        namedArgumentList: [],
        unnamedArgumentList: [],
        injectPipe: true,
        start,
        end: index.pos,
        commandCount: 1,
      };

      // Parse named arguments (key=value)
      while (testNamedArg(index)) {
        const arg = parseNamedArg(index);
        executor.namedArgumentList.push(arg);
        index.discardWhitespace();
      }

      // Parse unnamed arguments (remaining text until pipe or end)
      index.discardWhitespace();
      if (!testPipe(index) && !index.isEnd()) {
        executor.unnamedArgumentList = parseUnnamedArgs(index);
      }

      executor.end = index.pos;
      closure.executorList.push(executor);
    } else if (index.peek() === '{' && index.peek(1) === ':') {
      // Nested closure {: ... :}
      index.advance(2);
      index.discardWhitespace();
      index.discardUntil(':}');
      if (index.peek() === ':' && index.peek(1) === '}') {
        index.advance(2);
      }
      index.discardWhitespace();
    } else if (testPipe(index)) {
      index.advance();
      if (index.peek() === '|') {
        index.advance();
        // || suppresses pipe injection for next command
        const lastExecutor = closure.executorList[closure.executorList.length - 1];
        if (lastExecutor) {
          lastExecutor.injectPipe = false;
        }
      }
      index.discardWhitespace();
    } else {
      // Skip any other characters
      index.advance();
    }
  }

  return closure;
}

// ── Cursor ──

class ParserCursor {
  constructor(
    public text: string,
    public pos: number = 0,
  ) {}

  peek(offset = 0): string {
    return this.text[this.pos + offset] ?? '';
  }

  peekN(n: number): string {
    return this.text.slice(this.pos, this.pos + n);
  }

  advance(n = 1): string {
    const ch = this.text[this.pos];
    this.pos += n;
    return ch;
  }

  isEnd(): boolean {
    return this.pos >= this.text.length;
  }

  discardWhitespace(): void {
    while (this.pos < this.text.length && /\s/.test(this.text[this.pos])) {
      this.pos++;
    }
  }

  discardUntil(char: string): void {
    while (this.pos < this.text.length && this.text[this.pos] !== char) {
      this.pos++;
    }
  }
}

// ── Named argument parsing ──

function testNamedArg(index: ParserCursor): boolean {
  const rest = index.text.slice(index.pos);
  return /^\w+=/.test(rest);
}

function parseNamedArg(index: ParserCursor): NamedArgAssignment {
  let key = '';
  while (/\w/.test(index.peek())) {
    key += index.advance();
  }
  index.advance(); // consume '='

  let value = '';
  // Check for closure value {: ... :}
  if (index.peek() === '{' && index.peek(1) === ':') {
    index.advance(2);
    let depth = 1;
    while (!index.isEnd() && depth > 0) {
      if (index.peek() === ':' && index.peek(1) === '}') {
        depth--;
        index.advance(2);
      } else {
        value += index.advance();
      }
    }
  } else if (index.peek() === '"' || index.peek() === "'") {
    const quote = index.advance();
    while (!index.isEnd() && index.peek() !== quote) {
      if (index.peek() === '\\') {
        index.advance();
        value += index.advance();
      } else {
        value += index.advance();
      }
    }
    index.advance(); // consume closing quote
  } else {
    while (!index.isEnd() && !/\s/.test(index.peek()) && index.peek() !== '|') {
      // Detect closures inline
      if (index.peek() === '{' && index.peek(1) === ':') {
        break;
      }
      value += index.advance();
    }
  }

  return { name: key, value };
}

// ── Unnamed argument parsing ──

function parseUnnamedArgs(index: ParserCursor): UnnamedArgAssignment[] {
  const args: UnnamedArgAssignment[] = [];

  // Read the rest of the line/block until pipe or end
  let value = '';
  while (!index.isEnd() && !testPipe(index)) {
    value += index.advance();
  }

  if (value.trim()) {
    args.push({ value: value.trim() });
  }

  return args;
}

// ── Helpers ──

function testPipe(index: ParserCursor): boolean {
  return index.peek() === '|' && index.peekN(2) !== '|}';
}
