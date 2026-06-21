export interface Logger {
  warn(message: string): void;
  error(message: string): void;
  info(message: string): void;
}

const defaultLogger: Logger = {
  warn: typeof console !== 'undefined' ? console.warn.bind(console) : () => {},
  error: typeof console !== 'undefined' ? console.error.bind(console) : () => {},
  info: typeof console !== 'undefined' ? console.log.bind(console) : () => {},
};

let active: Logger = defaultLogger;

export function setLogger(logger: Logger): void {
  active = logger;
}

export function warn(message: string): void {
  active.warn(message);
}

export function error(message: string): void {
  active.error(message);
}

export function info(message: string): void {
  active.info(message);
}
