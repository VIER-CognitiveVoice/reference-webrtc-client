import {
  CallApi,
  fetchWebRtcAuthDetails,
  setupSipClient,
  Tone,
} from './client'

function createButton(): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  return button
}

type DtmfEvent = 'start' | 'complete' | 'cancel'

function generateDtmfControls(options: CallControlOptions | undefined, onDtmf: (tone: Tone, event: DtmfEvent) => void): [HTMLDivElement, CleanupFunction] {
  const cleanupActions: Array<CleanupFunction> = []
  const keypad = options?.ui?.keypad ?? DEFAULT_KEYPAD
  const container = document.createElement('div')
  container.classList.add('dtmf-controls')
  container.classList.add(keypad)

  type ToneKind = 'digit' | 'control' | 'letter'

  let tones: Array<[Tone, ToneKind]>
  if (keypad === 'full') {
    tones = [
      [Tone.ONE, 'digit'], [Tone.TWO, 'digit'], [Tone.THREE, 'digit'], [Tone.A, 'letter'],
      [Tone.FOUR, 'digit'], [Tone.FIVE, 'digit'], [Tone.SIX, 'digit'], [Tone.B, 'letter'],
      [Tone.SEVEN, 'digit'], [Tone.EIGHT, 'digit'], [Tone.NINE, 'digit'], [Tone.C, 'letter'],
      [Tone.STAR, 'control'], [Tone.ZERO, 'digit'], [Tone.POUND, 'control'], [Tone.D, 'letter'],
    ]
  } else {
    tones = [
      [Tone.ONE, 'digit'], [Tone.TWO, 'digit'], [Tone.THREE, 'digit'],
      [Tone.FOUR, 'digit'], [Tone.FIVE, 'digit'], [Tone.SIX, 'digit'],
      [Tone.SEVEN, 'digit'], [Tone.EIGHT, 'digit'], [Tone.NINE, 'digit'],
      [Tone.STAR, 'control'], [Tone.ZERO, 'digit'], [Tone.POUND, 'control'],
    ]
  }
  for (const [tone, kind] of tones) {
    const button = createButton()
    button.innerText = tone
    button.dataset.dtmf = tone
    button.classList.add(kind)
    let hovering: boolean = false
    button.addEventListener('mousedown', () => {
      hovering = true
      onDtmf(tone, 'start')
      const upHandler = () => {
        onDtmf(tone, hovering ? 'complete' : 'cancel')
        window.removeEventListener('blur', blurHandler)
      }
      const blurHandler = () => {
        onDtmf(tone, 'cancel')
        window.removeEventListener('blur', upHandler)
      }
      window.addEventListener('mouseup', upHandler, { once: true })
      window.addEventListener('blur', blurHandler, { once: true })
      cleanupActions.push(() => {
        window.removeEventListener('mouseup', upHandler)
        window.removeEventListener('blur', blurHandler)
      })
    })
    button.addEventListener('mouseover', () => {
      hovering = true
    })
    button.addEventListener('mouseleave', () => {
      hovering = false
    })
    container.appendChild(button)
  }

  return [container, () => cleanupActions.forEach(action => action())]
}

function dtmfPlayer(outputNode: AudioNode, inputIndex: number, volume: number): (tone: Tone | undefined) => void {
  const gain = outputNode.context.createGain()
  gain.gain.value = 0
  gain.connect(outputNode, 0, inputIndex)
  const oscillatorVertical = outputNode.context.createOscillator()
  oscillatorVertical.connect(gain)
  oscillatorVertical.start()
  const oscillatorHorizontal = outputNode.context.createOscillator()
  oscillatorHorizontal.connect(gain)
  oscillatorHorizontal.start()

  // see: https://en.wikipedia.org/wiki/Dual-tone_multi-frequency_signaling#Keypad
  const verticalFrequencies = [697, 770, 852, 941]
  const horizontalFrequencies = [1209, 1336, 1477, 1633]

  const toneToFrequency: { [t in Tone]: [number, number] } = {
    [Tone.ONE]: [verticalFrequencies[0], horizontalFrequencies[0]],
    [Tone.TWO]: [verticalFrequencies[0], horizontalFrequencies[1]],
    [Tone.THREE]: [verticalFrequencies[0], horizontalFrequencies[2]],
    [Tone.A]: [verticalFrequencies[0], horizontalFrequencies[3]],
    [Tone.FOUR]: [verticalFrequencies[1], horizontalFrequencies[0]],
    [Tone.FIVE]: [verticalFrequencies[1], horizontalFrequencies[1]],
    [Tone.SIX]: [verticalFrequencies[1], horizontalFrequencies[2]],
    [Tone.B]: [verticalFrequencies[1], horizontalFrequencies[3]],
    [Tone.SEVEN]: [verticalFrequencies[2], horizontalFrequencies[0]],
    [Tone.EIGHT]: [verticalFrequencies[2], horizontalFrequencies[1]],
    [Tone.NINE]: [verticalFrequencies[2], horizontalFrequencies[2]],
    [Tone.C]: [verticalFrequencies[2], horizontalFrequencies[3]],
    [Tone.STAR]: [verticalFrequencies[3], horizontalFrequencies[0]],
    [Tone.ZERO]: [verticalFrequencies[3], horizontalFrequencies[1]],
    [Tone.POUND]: [verticalFrequencies[3], horizontalFrequencies[2]],
    [Tone.D]: [verticalFrequencies[3], horizontalFrequencies[3]],
  }

  window.addEventListener('blur', () => {
    gain.gain.value = 0
  })

  return function playTone(tone: Tone | undefined) {
    if (tone === undefined) {
      gain.gain.value = 0
      return
    }

    const [vertical, horizontal] = toneToFrequency[tone]
    oscillatorVertical.frequency.value = vertical
    oscillatorHorizontal.frequency.value = horizontal

    gain.gain.value = volume
  }
}

export interface VolumeOptions {
  masterVolume?: number
  callVolume?: number
  dtmfVolume?: number
}

export const DEFAULT_TIMEOUT = 10000

export interface TimeoutOptions {
  register?: number
  invite?: number
}

export interface AudioOptions {
  context?: AudioContext
  outputNode?: AudioNode
}

export type KeypadMode = 'none' | 'standard' | 'full'
export type DarkMode = 'yes' | 'no' | 'auto'

export const DEFAULT_KEYPAD: KeypadMode = 'full'
export const DEFAULT_DARK_MODE: DarkMode = 'auto'

export interface UiOptions {
  keypad?: KeypadMode
  dark?: DarkMode
}

export interface CallControlOptions {
  audio?: AudioOptions
  volume?: VolumeOptions
  timeout?: TimeoutOptions
  ui?: UiOptions
}

function enableMediaStreamAudioInChrome(stream: MediaStream) {
  // yes, this object is indeed created, modified and discarded.
  // see: https://stackoverflow.com/questions/41784137/webrtc-doesnt-work-with-audiocontext
  // and: https://stackoverflow.com/questions/53325793/no-audio-from-webrct-stream-on-chrome-without-audio-tag
  const audio = new Audio()
  audio.volume = 0
  audio.srcObject = stream
}

function muteButtonSetState(button: HTMLButtonElement, muted: boolean) {
  const MUTED = 'muted'
  const UNMUTED = 'unmuted'
  if (muted) {
    if (!button.classList.replace(UNMUTED, MUTED)) {
      button.classList.add(MUTED)
    }
    button.innerText = 'Unmute'
  } else {
    if (!button.classList.replace(MUTED, UNMUTED)) {
      button.classList.add(UNMUTED)
    }
    button.innerText = 'Mute'
  }
}

export type CleanupFunction = () => void

export function generateCallControls(callApi: CallApi, options?: CallControlOptions): [HTMLDivElement, CleanupFunction] {

  const cleanupActions: Array<CleanupFunction> = [];

  const container = document.createElement('div')
  container.classList.add('call-controls')

  const DARK_MODE = 'dark-mode'
  const LIGHT_MODE = 'light-mode'

  switch (options?.ui?.dark ?? DEFAULT_DARK_MODE) {
    case 'yes':
      container.classList.add(DARK_MODE)
      break;
    case 'no':
      container.classList.add(LIGHT_MODE)
      break;
    case 'auto':
      const darkMedia = window.matchMedia('(prefers-color-scheme: dark)')
      container.classList.add(darkMedia.matches ? DARK_MODE : LIGHT_MODE)
      const mediaChangeListener = (e: MediaQueryListEvent) => {
        if (e.matches) {
          if (!container.classList.replace(LIGHT_MODE, DARK_MODE)) {
            container.classList.add(DARK_MODE)
          }
        } else {
          if (!container.classList.replace(DARK_MODE, LIGHT_MODE)) {
            container.classList.add(LIGHT_MODE)
          }
        }
      }
      darkMedia.addEventListener('change', mediaChangeListener)
      cleanupActions.push(() => darkMedia.removeEventListener('change', mediaChangeListener))
      break;
  }

  const audioContext = options?.audio?.context ?? new AudioContext({
    latencyHint: 'interactive',
  })
  const outputNode: AudioNode = options?.audio?.outputNode ?? audioContext.destination
  const masterGain = outputNode.context.createGain()
  masterGain.gain.value = options?.volume?.masterVolume ?? 1
  masterGain.connect(outputNode)
  const callGain = outputNode.context.createGain()
  callGain.gain.value = options?.volume?.callVolume ?? 1
  callGain.connect(masterGain)
  enableMediaStreamAudioInChrome(callApi.media)
  const callSource = audioContext.createMediaStreamSource(callApi.media)
  callSource.connect(masterGain)

  const dtmfVolume = options?.volume?.dtmfVolume
  const playTone = dtmfVolume ? dtmfPlayer(masterGain, 0, dtmfVolume) : () => {
  }

  if ((options?.ui?.keypad ?? DEFAULT_KEYPAD) !== 'none') {
    const [dtmfContainer, dtmfCleanup] = generateDtmfControls(options, (tone, event) => {
      if (event === 'complete') {
        callApi.sendTone(tone)
      }
      playTone(event === 'start' ? tone : undefined)
    })
    container.appendChild(dtmfContainer)
    cleanupActions.push(dtmfCleanup)
  }

  const callActionsContainer = document.createElement('div')
  callActionsContainer.classList.add('call-actions')

  const dropButton = createButton()
  dropButton.classList.add('drop')
  dropButton.innerText = 'Drop'
  dropButton.addEventListener('click', () => {
    callApi.drop()
  })
  callActionsContainer.appendChild(dropButton)

  const muteButton = createButton()
  muteButton.classList.add('mute-toggle')
  muteButtonSetState(muteButton, false)
  muteButton.innerText = 'Mute'
  muteButton.addEventListener('click', () => {
    const isCurrentlyMuted = !!muteButton.dataset.muted
    if (isCurrentlyMuted) {
      delete muteButton.dataset.muted
    } else {
      muteButton.dataset.muted = 'yes'
    }
    muteButtonSetState(muteButton, !isCurrentlyMuted)
    callApi.setMicrophoneMuted(!isCurrentlyMuted)
  })
  callActionsContainer.appendChild(muteButton)

  container.appendChild(callActionsContainer)

  return [container, () => cleanupActions.forEach(action => action())]
}

export function triggerControls(alignToElement: Element, environment: string, resellerToken: string, destination: string, options?: CallControlOptions): Promise<CallApi> {
  return new Promise((resolve, reject) => {
    fetchWebRtcAuthDetails(environment, resellerToken)
      .then(details => setupSipClient(details, options?.timeout?.register ?? DEFAULT_TIMEOUT))
      .then(telephony => {
        return telephony.call(destination, options?.timeout?.invite ?? DEFAULT_TIMEOUT)
          .then(call => {
            const [controls, controlsCleanup] = generateCallControls(call, options)
            document.body.appendChild(controls)
            call.callCompletion.then(() => {
              document.body.removeChild(controls)
              controlsCleanup()
              telephony.disconnect()
            })
            resolve(call)
          })
          .catch(e => {
            telephony.disconnect()
            reject(e)
          })
      })
  })
}

export function mountControlsTo(triggerElement: Element | string, options?: CallControlOptions): Promise<CallApi> {
  let element: Element
  if (typeof triggerElement === 'string') {
    const selectorResult = document.querySelector<Element>(triggerElement)
    if (!selectorResult) {
      throw new Error(`Failed to fine element using selector ${triggerElement}`)
    }
    element = selectorResult
  } else {
    element = triggerElement
  }
  return new Promise<CallApi>((resolve, reject) => {
    element.addEventListener('click', (e: Event) => {
      e.preventDefault()
      const environment = element.getAttribute('data-environment') || 'https://cognitivevoice.io'
      const resellerToken = element.getAttribute('data-resellerToken')
      if (!resellerToken) {
        reject(new Error('No reseller token configured!'))
        return
      }
      const destination = element.getAttribute('data-destination')
      if (!destination) {
        reject(new Error('No destination configured!'))
        return
      }
      return triggerControls(element, environment, resellerToken, destination, options)
    }, { once: true })
  })
}
