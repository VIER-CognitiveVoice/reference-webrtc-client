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
  fetchDialogData,
  getAndDisplayEnvironmentFromQuery,
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
): Promise<number> {
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
  return synthesisCount
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
): Promise<[number, number, number, number]> {
  let noGreeting: number = 0
  let singleGreeting: number = 0
  let multiGreeting: number = 0
  let failedCalls: number = 0

  const workQueue = concurrencyLimitedWorkQueue<void>(maxParallelism)

  for (let i = 0; i < numberOfCalls; i++) {
    workQueue.submit(async () => {
      try {
        const greetingCount = await performCall(environment, resellerToken, destination, audioContext, waitTimeBeforeDrop, waitTimeAfterDrop)
        if (greetingCount === 0) {
          noGreeting++
        } else if (greetingCount === 1) {
          singleGreeting++
        } else {
          multiGreeting++
        }
      } catch (e) {
        failedCalls++
        console.error("Call failed!", e)
      }
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

  startCallsButton.addEventListener('click', e => {
    e.preventDefault()
    const audioContext = new AudioContext()

    const resellerToken = document.querySelector<HTMLInputElement>("input#reseller-token")!!.value
    const destination = document.querySelector<HTMLInputElement>("input#destination")!!.value

    performAllCalls(environment, resellerToken, destination, audioContext, 6, 2, 5000, 2000)
      .then(([noGreeting, singleGreeting, multiGreeting, failedCalls]) => {
        alert(`Calls without greeting: ${noGreeting}\nCalls with a single greeting: ${singleGreeting}\nCalls with multiple greetings: ${multiGreeting}\nFailed calls: ${failedCalls}`)
      })

  })
})