import {
  CallApi,
  DtmfTone,
  fetchWebRtcAuthDetails,
  setupSipClient,
  Tone,
  ToneMap,
} from './client'

const images = {
  // https://fontawesome.com/icons/phone-slash?s=solid&f=classic
  drop: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M228.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C76.1 30.2 64 46 64 64c0 107.4 37.8 206 100.8 283.1L9.2 469.1c-10.4 8.2-12.3 23.3-4.1 33.7s23.3 12.3 33.7 4.1l592-464c10.4-8.2 12.3-23.3 4.1-33.7s-23.3-12.3-33.7-4.1L253 278c-17.8-21.5-32.9-45.2-45-70.7L257.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96zm96.8 319l-91.3 72C310.7 476 407.1 512 512 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L368.7 368c-15-7.1-29.3-15.2-43-24.3z"/></svg>',
  // https://fontawesome.com/icons/microphone-slash?s=solid&f=classic
  muted: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L472.1 344.7c15.2-26 23.9-56.3 23.9-88.7V216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 21.2-5.1 41.1-14.2 58.7L416 300.8V96c0-53-43-96-96-96s-96 43-96 96v54.3L38.8 5.1zM344 430.4c20.4-2.8 39.7-9.1 57.3-18.2l-43.1-33.9C346.1 382 333.3 384 320 384c-70.7 0-128-57.3-128-128v-8.7L144.7 210c-.5 1.9-.7 3.9-.7 6v40c0 89.1 66.2 162.7 152 174.4V464H248c-13.3 0-24 10.7-24 24s10.7 24 24 24h72 72c13.3 0 24-10.7 24-24s-10.7-24-24-24H344V430.4z"/></svg>',
  // https://fontawesome.com/icons/microphone?s=solid&f=classic
  unmuted: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M192 0C139 0 96 43 96 96V256c0 53 43 96 96 96s96-43 96-96V96c0-53-43-96-96-96zM64 216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 89.1 66.2 162.7 152 174.4V464H120c-13.3 0-24 10.7-24 24s10.7 24 24 24h72 72c13.3 0 24-10.7 24-24s-10.7-24-24-24H216V430.4c85.8-11.7 152-85.3 152-174.4V216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 70.7-57.3 128-128 128s-128-57.3-128-128V216z"/></svg>',
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
export type UiPositionSide = 'top' | 'left' | 'bottom' | 'right'

export interface UiPosition {
  side: UiPositionSide
  distance?: [number, number]
}

export const DEFAULT_KEYPAD: KeypadMode = 'full'
export const DEFAULT_DARK_MODE: DarkMode = 'auto'

export interface UiOptions {
  keypad?: KeypadMode
  dark?: DarkMode
  anchor?: Element
  position?: UiPosition
}

export interface CallControlOptions {
  audio?: AudioOptions
  volume?: VolumeOptions
  timeout?: TimeoutOptions
  ui?: UiOptions
}

export type CleanupFunction = () => void

type DtmfEvent = 'start' | 'complete' | 'cancel'

function createButton(): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  return button
}

function generateDtmfControls(options: CallControlOptions | undefined, onDtmf: (tone: DtmfTone, event: DtmfEvent) => void): HTMLDivElement {
  const keypad = options?.ui?.keypad ?? DEFAULT_KEYPAD
  const container = document.createElement('div')
  container.classList.add('dtmf-controls', keypad)
  container.part.add('dtmf-button-container', `dtmf-button-container-${keypad}`)


  let tones: Array<DtmfTone>
  if (keypad === 'full') {
    tones = [
      ToneMap.ONE,   ToneMap.TWO,   ToneMap.THREE, ToneMap.A,
      ToneMap.FOUR,  ToneMap.FIVE,  ToneMap.SIX,   ToneMap.B,
      ToneMap.SEVEN, ToneMap.EIGHT, ToneMap.NINE,  ToneMap.C,
      ToneMap.STAR,  ToneMap.ZERO,  ToneMap.POUND, ToneMap.D,
    ]
  } else {
    tones = [
      ToneMap.ONE, ToneMap.TWO, ToneMap.THREE,
      ToneMap.FOUR, ToneMap.FIVE, ToneMap.SIX,
      ToneMap.SEVEN, ToneMap.EIGHT, ToneMap.NINE,
      ToneMap.STAR, ToneMap.ZERO, ToneMap.POUND,
    ]
  }
  for (const tone of tones) {
    const button = createButton()
    button.innerText = tone.value
    button.dataset.dtmf = tone.name
    button.classList.add(tone.kind)
    button.part.add('dtmf-button', `dtmf-button-${tone.kind}`, `dtmf-button-${tone.name}`)
    let hovering: boolean = false
    button.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault()
      hovering = true
      onDtmf(tone, 'start')
      const upHandler = (_: MouseEvent) => {
        window.removeEventListener('blur', blurHandler)
        onDtmf(tone, hovering ? 'complete' : 'cancel')
      }
      const blurHandler = (_: FocusEvent) => {
        window.removeEventListener('mouseup', upHandler)
        onDtmf(tone, 'cancel')
      }
      window.addEventListener('mouseup', upHandler, { once: true })
      window.addEventListener('blur', blurHandler, { once: true })
    })
    button.addEventListener('mouseover', () => {
      hovering = true
    })
    button.addEventListener('mouseleave', () => {
      hovering = false
    })
    container.appendChild(button)
  }

  return container
}

function dtmfPlayer(outputNode: AudioNode, inputIndex: number, volume: number): (tone: DtmfTone | undefined) => void {
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
    '1': [verticalFrequencies[0], horizontalFrequencies[0]],
    '2': [verticalFrequencies[0], horizontalFrequencies[1]],
    '3': [verticalFrequencies[0], horizontalFrequencies[2]],
    'A': [verticalFrequencies[0], horizontalFrequencies[3]],
    '4': [verticalFrequencies[1], horizontalFrequencies[0]],
    '5': [verticalFrequencies[1], horizontalFrequencies[1]],
    '6': [verticalFrequencies[1], horizontalFrequencies[2]],
    'B': [verticalFrequencies[1], horizontalFrequencies[3]],
    '7': [verticalFrequencies[2], horizontalFrequencies[0]],
    '8': [verticalFrequencies[2], horizontalFrequencies[1]],
    '9': [verticalFrequencies[2], horizontalFrequencies[2]],
    'C': [verticalFrequencies[2], horizontalFrequencies[3]],
    '*': [verticalFrequencies[3], horizontalFrequencies[0]],
    '0': [verticalFrequencies[3], horizontalFrequencies[1]],
    '#': [verticalFrequencies[3], horizontalFrequencies[2]],
    'D': [verticalFrequencies[3], horizontalFrequencies[3]],
  }

  window.addEventListener('blur', () => {
    gain.gain.value = 0
  })

  return function playTone(tone: DtmfTone | undefined) {
    if (tone === undefined) {
      gain.gain.value = 0
      return
    }

    const [vertical, horizontal] = toneToFrequency[tone.value]
    oscillatorVertical.frequency.value = vertical
    oscillatorHorizontal.frequency.value = horizontal

    gain.gain.value = volume
  }
}

function enableMediaStreamAudioInChrome(stream: MediaStream) {
  // yes, this object is indeed created, modified and discarded.
  // see: https://stackoverflow.com/questions/41784137/webrtc-doesnt-work-with-audiocontext
  // and: https://stackoverflow.com/questions/53325793/no-audio-from-webrct-stream-on-chrome-without-audio-tag
  const audio = new Audio()
  audio.volume = 0
  audio.srcObject = stream
}

function replaceOrAdd(list: DOMTokenList, oldValue: string, newValue: string) {
  if (!list.replace(oldValue, newValue)) {
    list.add(newValue)
  }
}

function muteButtonSetState(button: HTMLButtonElement, part: string, muted: boolean) {
  const MUTED = 'muted'
  const UNMUTED = 'unmuted'
  const MUTED_PART = `${part}-${MUTED}`
  const UNMUTED_PART = `${part}-${UNMUTED}`
  if (muted) {
    replaceOrAdd(button.classList, UNMUTED, MUTED)
    replaceOrAdd(button.part, UNMUTED_PART, MUTED_PART)
    button.innerHTML = images.muted
  } else {
    replaceOrAdd(button.classList, MUTED, UNMUTED)
    replaceOrAdd(button.part, MUTED_PART, UNMUTED_PART)
    button.innerHTML = images.unmuted
  }
}

export function generateCallControls(callApi: CallApi, options?: CallControlOptions): [HTMLDivElement, CleanupFunction] {

  const cleanupActions: Array<CleanupFunction> = [];

  const container = document.createElement('div')
  const CONTAINER_PART = 'call-controls'
  container.classList.add(CONTAINER_PART)
  container.part.add(CONTAINER_PART)

  const DARK_MODE = 'dark-mode'
  const LIGHT_MODE = 'light-mode'
  const DARK_MODE_PART = `call-controls-${DARK_MODE}`
  const LIGHT_MODE_PART = `call-controls-${LIGHT_MODE}`

  switch (options?.ui?.dark ?? DEFAULT_DARK_MODE) {
    case 'yes':
      container.classList.add(DARK_MODE)
      container.part.add(DARK_MODE_PART)
      break;
    case 'no':
      container.classList.add(LIGHT_MODE)
      container.part.add(LIGHT_MODE_PART)
      break;
    case 'auto':
      const darkMedia = window.matchMedia('(prefers-color-scheme: dark)')
      container.classList.add(darkMedia.matches ? DARK_MODE : LIGHT_MODE)
      container.part.add(darkMedia.matches ? DARK_MODE_PART : LIGHT_MODE_PART)
      const mediaChangeListener = (e: MediaQueryListEvent) => {
        if (e.matches) {
          replaceOrAdd(container.classList, LIGHT_MODE, DARK_MODE)
          replaceOrAdd(container.part, LIGHT_MODE_PART, DARK_MODE_PART)
        } else {
          replaceOrAdd(container.classList, DARK_MODE, LIGHT_MODE)
          replaceOrAdd(container.part, DARK_MODE_PART, LIGHT_MODE_PART)
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
    const dtmfContainer = generateDtmfControls(options, (tone, event) => {
      if (event === 'complete') {
        callApi.sendTone(tone.value)
      }
      playTone(event === 'start' ? tone : undefined)
    })
    container.appendChild(dtmfContainer)
  }

  const callActionsContainer = document.createElement('div')
  callActionsContainer.classList.add('call-actions')
  callActionsContainer.part.add('call-actions')

  const dropButton = createButton()
  dropButton.classList.add('drop')
  dropButton.part.add('call-action-drop')
  dropButton.innerHTML = images.drop
  dropButton.addEventListener('click', (e) => {
    e.preventDefault()
    callApi.drop()
  })
  callActionsContainer.appendChild(dropButton)

  const MUTE_BUTTON_PART = 'call-action-mute-toggle'
  const muteButton = createButton()
  muteButton.classList.add('mute-toggle')
  muteButton.part.add(MUTE_BUTTON_PART)
  muteButtonSetState(muteButton, MUTE_BUTTON_PART, false)
  muteButton.addEventListener('click', (e) => {
    e.preventDefault()
    const isCurrentlyMuted = !!muteButton.dataset.muted
    if (isCurrentlyMuted) {
      delete muteButton.dataset.muted
    } else {
      muteButton.dataset.muted = 'yes'
    }
    muteButtonSetState(muteButton, MUTE_BUTTON_PART, !isCurrentlyMuted)
    callApi.setMicrophoneMuted(!isCurrentlyMuted)
  })
  callActionsContainer.appendChild(muteButton)

  container.appendChild(callActionsContainer)


  const anchor: Element = options?.ui?.anchor ?? document.body
  const uiPosition = options?.ui?.position
  if (uiPosition) {
    container.classList.add('positioned', uiPosition.side)
    container.part.add(`${CONTAINER_PART}-positioned`, `${CONTAINER_PART}-positioned-${uiPosition.side}`)
    const [distanceX, distanceY] = uiPosition.distance ?? [0, 0]

    const position = () => {
      const anchorBoundingRect = anchor.getBoundingClientRect()
      let anchorTopOffset: number
      if (anchor.clientHeight !== 0) {
        anchorTopOffset = (anchorBoundingRect.height - anchor.clientHeight) / 2.0
      } else {
        anchorTopOffset = 0
      }
      let anchorLeftOffset: number
      if (anchor.clientWidth !== 0) {
        anchorLeftOffset = (anchorBoundingRect.width - anchor.clientWidth) / 2.0
      } else {
        anchorLeftOffset = 0
      }

      switch (uiPosition.side) {
        case 'top':
          container.style.top = `${-container.getBoundingClientRect().height - (anchorTopOffset + distanceY)}px`
          container.style.left = `${-anchorLeftOffset + distanceX}px`
          break
        case 'left':
          container.style.top = `${-anchorTopOffset + distanceY}px`
          container.style.left = `${-container.getBoundingClientRect().width - (anchorLeftOffset + distanceX)}px`
          break
        case 'bottom':
          container.style.top = `${anchorBoundingRect.height - anchorTopOffset + distanceY}px`
          container.style.left = `${-anchorLeftOffset + distanceX}px`
          break
        case 'right':
          container.style.top = `${-anchorTopOffset + distanceY}px`
          container.style.left = `${anchorBoundingRect.width - anchorLeftOffset + distanceX}px`
          break
      }
    }

    position()
    const resizeObserver = new ResizeObserver(position)
    resizeObserver.observe(container)
    resizeObserver.observe(anchor)
    cleanupActions.push(() => resizeObserver.disconnect())

  }
  anchor.appendChild(container)
  cleanupActions.push(() => anchor.removeChild(container))

  return [container, () => cleanupActions.forEach(action => action())]
}

export function triggerControls(environment: string, resellerToken: string, destination: string, options?: CallControlOptions): Promise<CallApi> {
  return new Promise((resolve, reject) => {
    fetchWebRtcAuthDetails(environment, resellerToken)
      .then(details => setupSipClient(details, options?.timeout?.register ?? DEFAULT_TIMEOUT))
      .then(telephony => {
        return telephony.call(destination, options?.timeout?.invite ?? DEFAULT_TIMEOUT)
          .then(call => {
            const [, controlsCleanup] = generateCallControls(call, options)
            call.callCompletion.then(() => {
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
      const customizedOptions: CallControlOptions = {
        ...options,
        ui: {
          ...options?.ui,
            anchor: element,
        },
      }
      return triggerControls(environment, resellerToken, destination, customizedOptions)
    }, { once: true })
  })
}
