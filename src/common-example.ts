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
    if (availableSlots === 0) {
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
      runTasksDeferred()
    })
  }

  function runTasksDeferred() {
    setTimeout(() => runTasks(), 0)
  }

  function submitTask(task: Task<T>) {
    taskQueue.push(task)
    runTasksDeferred()
  }

  return {
    submit(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        submitTask({
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
      if (activeTasks.size > 0) {
        for (let task of activeTasks) {
          remaining = remaining.then(() => task).catch(() => task)
        }
        activeTasks.clear()
      }
      return remaining
    },
    awaitEmpty(): Promise<void> {
      if (taskQueue.length === 0 && activeTasks.size === 0) {
        return Promise.resolve()
      }
      return new Promise(resolve => emptyPromises.push(resolve))
    }
  }
}

export function getDialogId(headers: HeaderList): string | undefined {
  const dialogIds = headers
    .filter(([name,]) => name.toLowerCase() == "x-vier-dialogid")
    .map(([, value]) => value)
  if (dialogIds.length > 0) {
    return dialogIds[0]
  }
  return undefined
}

export interface BaseDialogDataEntry {
  type: string,
  timestamp: number
}

export interface StartDialogDataEntry extends BaseDialogDataEntry {
  type: "Start"
  customSipHeaders: {[name: string]: Array<string>}
}

export interface SynthesisDialogDataEntry extends BaseDialogDataEntry {
  type: "Synthesis"
  text: string
  plainText: string
  vendor: string
  language: string
}

export interface ToneDialogDataEntry extends BaseDialogDataEntry {
  type: "Tone"
  tone: string
  triggeredBargeIn: boolean
}

export interface TranscriptionDialogDataEntry extends BaseDialogDataEntry {
  type: "Transcription"
  text: string
  confidence: number
  vendor: string
  language: string
  triggeredBargeIn: boolean
}

export interface EndDialogDataEntry extends BaseDialogDataEntry {
  type: "End"
  reason: string
}

export type DialogDataEntry = StartDialogDataEntry | SynthesisDialogDataEntry | ToneDialogDataEntry | TranscriptionDialogDataEntry | EndDialogDataEntry | BaseDialogDataEntry

export interface DialogDataResponse {
  dialogId: string
  callId?: string
  data: Array<DialogDataEntry>
}

export function getDialogDataUrl(environment: string, resellerToken: string, dialogId: string): string {
  return `${environment}/v1/dialog/${resellerToken}/${dialogId}`
}

export async function fetchDialogData(environment: string, resellerToken: string, dialogId: string) {
  const response = await fetch(getDialogDataUrl(environment, resellerToken, dialogId))
  return await response.json() as DialogDataResponse
}

export function delay(millis: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, millis)
  })
}