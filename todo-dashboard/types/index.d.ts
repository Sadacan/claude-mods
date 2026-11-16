export type Todo = { id: number; text: string; isDone: boolean }

declare module 'claude-code' {
  interface PluginState {
    'todo-dashboard': { todos: Shaped<Todo[]> }
  }
}
