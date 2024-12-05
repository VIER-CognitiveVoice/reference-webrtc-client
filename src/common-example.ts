import { HeaderList } from './client'

export function getAndDisplayEnvironmentFromQuery(): string {
  const query = new URLSearchParams(location.search)
  const environment = query.get('environment') ?? 'https://cognitivevoice.io'
  const environmentField = document.querySelector<HTMLInputElement>('input#environment')
  if (environmentField) {
    environmentField.value = environment
  }
  return environment
}

export function updateQueryParameter(name: string, value: string): void {
  const url = new URL(document.location.href)
  url.searchParams.set(name, value)
  history.pushState(undefined, "", url)
}

export function getCustomSipHeadersFromQuery(): HeaderList {
  const query = new URLSearchParams(location.search)
  const headerList: HeaderList = []
  for (let [name, value] of query) {
    if (name.toLowerCase().startsWith("x-")) {
      headerList.push([name, value])
    }
  }
  return headerList;
}

export interface WorkQueue<T> {
  submit(task: () => Promise<T>): Promise<T>
  cancel(): Promise<void>
  awaitEmpty(): Promise<void>
}

interface Task<T> {
  work: () => Promise<T>
  resolve(value: T | PromiseLike<T>): void
  reject(value?: any): void
  abortSignal: AbortSignal
}

export function concurrencyLimitedWorkQueue<T>(maxConcurrency: number): WorkQueue<T> {
  const taskQueue: Array<Task<T>> = []
  const activeTasks: Set<Task<T>> = new Set<Task<T>>()
  const abortController = new AbortController()
  const emptyPromises: Array<() => void> = []

  function resolveEmptyPromises() {
    const copy = [...emptyPromises]
    emptyPromises.length = 0
    for (let emptyPromise of copy) {
      emptyPromise()
    }
  }

  function runTasks() {
    const activeCount = activeTasks.size
    if (taskQueue.length === 0) {
      if (activeCount == 0) {
        // empty queue and no active tasks, no more work
        resolveEmptyPromises()
      }
      return
    }
    const availableSlots = maxConcurrency - activeCount
    if (availableSlots == 0) {
      return
    }

    const spawnLimit = Math.min(taskQueue.length, availableSlots)
    for (let i = 0; i < spawnLimit; i++) {
      runNextTask()
    }
  }

  function runNextTask(): void {
    const task = taskQueue.shift()
    if (task === undefined) {
      return
    }
    if (task.abortSignal.aborted) {
      task.reject(task.abortSignal.reason)
      runNextTask()
      return
    }
    activeTasks.add(task)
    task.work().then(task.resolve, task.reject).finally(() => {
      activeTasks.delete(task)
      runTasks()
    })
  }

  return {
    submit(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        taskQueue.push({
          work: task,
          resolve,
          reject,
          abortSignal: abortController.signal,
        })
      })
    },
    cancel(reason?: any): Promise<void> {
      abortController.abort(reason)
      taskQueue.length = 0
      let remaining: Promise<any> = Promise.resolve()
      for (let task of activeTasks) {
        remaining = remaining.then(() => task).catch(() => task)
      }
      return remaining
    },
    awaitEmpty(): Promise<void> {
      return new Promise(resolve => emptyPromises.push(resolve))
    }
  }
}