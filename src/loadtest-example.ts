import {
  CreateCallOptions,
  DEFAULT_ICE_GATHERING_TIMEOUT,
  fetchWebRtcAuthDetails,
  setupSipClient,
} from './client'
import {
  DEFAULT_TIMEOUT,
  enableMediaStreamAudioInChrome,
} from './controls'
import {
  concurrencyLimitedWorkQueue,
  delay,
  DialogDataResponse,
  fetchDialogData,
  getAndDisplayEnvironmentFromQuery,
  getDialogDataUrl,
  getDialogId,
  updateQueryParameter,
} from './common-example'

async function performCall(
  environment: string,
  resellerToken: string,
  destination: string,
  audioContext: AudioContext,
  waitTimeBeforeDrop: number,
  waitTimeAfterDrop: number,
): Promise<[number, DialogDataResponse]> {
  const details = await fetchWebRtcAuthDetails(environment, resellerToken)
  const telephony = await setupSipClient(details)
  const virtualMic = audioContext.createMediaStreamDestination()
  const options: CreateCallOptions = {
    timeout: DEFAULT_TIMEOUT,
    iceGatheringTimeout: DEFAULT_ICE_GATHERING_TIMEOUT,
    mediaStream: virtualMic.stream,
  }
  const callApi = await telephony.createCall(destination, options)
  enableMediaStreamAudioInChrome(callApi.media)
  const remoteAudio = audioContext.createMediaStreamSource(callApi.media)
  const virtualSpeaker = audioContext.createMediaStreamDestination()
  remoteAudio.connect(virtualSpeaker)
  const dialogId = getDialogId(callApi.acceptHeaders)!

  await delay(waitTimeBeforeDrop)
  callApi.drop()

  await callApi.callCompletion

  await delay(waitTimeAfterDrop)
  const dialog = await fetchDialogData(environment, resellerToken, dialogId)
  let synthesisCount = 0
  for (let datum of dialog.data) {
    if (datum.type === "Synthesis") {
      synthesisCount++
    }
  }
  return [synthesisCount, dialog]
}

async function performAllCalls(
  environment: string,
  resellerToken: string,
  destination: string,
  audioContext: AudioContext,
  numberOfCalls: number,
  maxParallelism: number,
  waitTimeBeforeDrop: number,
  waitTimeAfterDrop: number,
  updateProgress: (noGreeting: number, singleGreeting: number, multipleGreetings: number, failed: number, completed: number, remaining: number, inProgress: number) => void): Promise<[number, number, number, number]> {
  let noGreeting: number = 0
  let singleGreeting: number = 0
  let multiGreeting: number = 0
  let failedCalls: number = 0
  let inProgress: number = 0
  let completed: number = 0

  function applyUpdate() {
    updateProgress(noGreeting, singleGreeting, multiGreeting, failedCalls, completed, numberOfCalls - completed - inProgress, inProgress)
  }

  const workQueue = concurrencyLimitedWorkQueue<void>(maxParallelism)

  for (let i = 0; i < numberOfCalls; i++) {
    workQueue.submit(async () => {
      inProgress++
      applyUpdate()
      try {
        const [greetingCount, dialogData] = await performCall(environment, resellerToken, destination, audioContext, waitTimeBeforeDrop, waitTimeAfterDrop)
        if (greetingCount === 0) {
          console.error(`No greeting received: ${getDialogDataUrl(environment, resellerToken, dialogData.dialogId)}`, dialogData)
          noGreeting++
        } else if (greetingCount === 1) {
          singleGreeting++
        } else {
          console.error(`Multiple greetings received: ${getDialogDataUrl(environment, resellerToken, dialogData.dialogId)}`, dialogData)
          multiGreeting++
        }
      } catch (e) {
        failedCalls++
        console.error("Call failed!", e)
      }
      inProgress--
      completed++
      applyUpdate()
    })
  }

  await workQueue.awaitEmpty()
  return [noGreeting, singleGreeting, multiGreeting, failedCalls]
}

window.addEventListener('DOMContentLoaded', () => {
  const environment = getAndDisplayEnvironmentFromQuery()

  const query = new URLSearchParams(location.search)
  document.querySelectorAll<HTMLInputElement>('input[name]').forEach(element => {
    const key = `form.${element.name}`
    const queryValue = query.get(element.name)
    const existingValue = localStorage.getItem(key)
    element.addEventListener('change', () => {
      localStorage.setItem(key, element.value)
      updateQueryParameter(element.name, element.value)
    })
    if (queryValue) {
      element.value = queryValue
    } else if (existingValue) {
      element.value = existingValue
      updateQueryParameter(element.name, existingValue)
    }
  })

  const startCallsButton = document.getElementById('start-calls')! as HTMLButtonElement

  const progressDiv = document.getElementById('progress')!
  const callsNoGreetingSpan = document.getElementById('calls-no-greeting')!
  const callsSingleGreetingSpan = document.getElementById('calls-single-greetings')!
  const callsMultipleGreetingsSpan = document.getElementById('calls-multiple-greetings')!
  const callsFailedSpan = document.getElementById('calls-failed')!
  const callsCompletedSpan = document.getElementById('calls-completed')!
  const callsRemainingSpan = document.getElementById('calls-remaining')!
  const callsInProgressSpan = document.getElementById('calls-in-progress')!
  startCallsButton.addEventListener('click', e => {
    e.preventDefault()

    progressDiv.style.display = 'block'
    function updateProgress(noGreeting: number, singleGreeting: number, multipleGreetings: number, failed: number, completed: number, remaining: number, inProgress: number) {
      callsNoGreetingSpan.innerText = noGreeting.toString()
      callsSingleGreetingSpan.innerText = singleGreeting.toString()
      callsMultipleGreetingsSpan.innerText = multipleGreetings.toString()
      callsFailedSpan.innerText = failed.toString()
      callsCompletedSpan.innerText = completed.toString()
      callsRemainingSpan.innerText = remaining.toString()
      callsInProgressSpan.innerText = inProgress.toString()
    }


    const audioContext = new AudioContext()

    const resellerToken = document.querySelector<HTMLInputElement>("input#reseller-token")!.value
    const destination = document.querySelector<HTMLInputElement>("input#destination")!.value
    const numberOfCalls = document.querySelector<HTMLInputElement>('#number-of-calls')!.valueAsNumber
    const concurrency = document.querySelector<HTMLInputElement>('#concurrency')!.valueAsNumber
    const delayBeforeDrop = document.querySelector<HTMLInputElement>('#delay-before-drop')!.valueAsNumber
    const delayAfterDrop = document.querySelector<HTMLInputElement>('#delay-after-drop')!.valueAsNumber

    performAllCalls(environment, resellerToken, destination, audioContext, numberOfCalls, concurrency, delayBeforeDrop, delayAfterDrop, updateProgress)
  })
})