import type { VariableScope } from './types.js';

/**
 * Create a new variable scope with optional parent.
 */
export function createScope(parent: VariableScope | null = null): VariableScope {
  return {
    parent,
    variables: {},
    pipe: '',
  };
}

/**
 * Scope copy for snapshot/restore during execution.
 */
export function copyScope(scope: VariableScope): VariableScope {
  return {
    parent: scope.parent,
    variables: { ...scope.variables },
    pipe: scope.pipe,
  };
}

/**
 * Set a variable in the nearest scope where it exists, or the current scope.
 */
export function setVariable(scope: VariableScope, key: string, value: string): void {
  if (Object.prototype.hasOwnProperty.call(scope.variables, key)) {
    scope.variables[key] = value;
    return;
  }
  if (scope.parent) {
    setVariable(scope.parent, key, value);
    return;
  }
  scope.variables[key] = value;
}

/**
 * Get a variable from the current scope chain.
 */
export function getVariable(scope: VariableScope, key: string): string | undefined {
  if (Object.prototype.hasOwnProperty.call(scope.variables, key)) {
    return scope.variables[key];
  }
  if (scope.parent) {
    return getVariable(scope.parent, key);
  }
  return undefined;
}

/**
 * Create a new variable (throws if already exists in scope chain).
 */
export function letVariable(scope: VariableScope, key: string, value: string = ''): void {
  if (existsVariable(scope, key)) {
    throw new Error(`Variable "${key}" already exists.`);
  }
  scope.variables[key] = value;
}

/**
 * Check if a variable exists anywhere in the scope chain.
 */
export function existsVariable(scope: VariableScope, key: string): boolean {
  if (Object.prototype.hasOwnProperty.call(scope.variables, key)) {
    return true;
  }
  if (scope.parent) {
    return existsVariable(scope.parent, key);
  }
  return false;
}

/**
 * Check if a variable exists in the current scope only.
 */
export function existsVariableInScope(scope: VariableScope, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(scope.variables, key);
}
