import {
  CallApi,
  CodecFilter,
  CreateCallOptions,
  DEFAULT_ICE_GATHERING_TIMEOUT,
  DtmfTone,
  fetchWebRtcAuthDetails,
  HeaderList,
  setupSipClient,
  Tone,
  ToneMap,
  UriArgumentList,
} from './client'
import { CallOptions } from 'jssip/lib/UA'

const images = {
  // https://fontawesome.com/icons/phone-slash?s=solid&f=classic
  drop: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M228.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C76.1 30.2 64 46 64 64c0 107.4 37.8 206 100.8 283.1L9.2 469.1c-10.4 8.2-12.3 23.3-4.1 33.7s23.3 12.3 33.7 4.1l592-464c10.4-8.2 12.3-23.3 4.1-33.7s-23.3-12.3-33.7-4.1L253 278c-17.8-21.5-32.9-45.2-45-70.7L257.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96zm96.8 319l-91.3 72C310.7 476 407.1 512 512 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L368.7 368c-15-7.1-29.3-15.2-43-24.3z"/></svg>',
  // https://fontawesome.com/icons/microphone-slash?s=solid&f=classic
  muted: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L472.1 344.7c15.2-26 23.9-56.3 23.9-88.7V216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 21.2-5.1 41.1-14.2 58.7L416 300.8V96c0-53-43-96-96-96s-96 43-96 96v54.3L38.8 5.1zM344 430.4c20.4-2.8 39.7-9.1 57.3-18.2l-43.1-33.9C346.1 382 333.3 384 320 384c-70.7 0-128-57.3-128-128v-8.7L144.7 210c-.5 1.9-.7 3.9-.7 6v40c0 89.1 66.2 162.7 152 174.4V464H248c-13.3 0-24 10.7-24 24s10.7 24 24 24h72 72c13.3 0 24-10.7 24-24s-10.7-24-24-24H344V430.4z"/></svg>',
  // https://fontawesome.com/icons/microphone?s=solid&f=classic
  unmuted: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M192 0C139 0 96 43 96 96V256c0 53 43 96 96 96s96-43 96-96V96c0-53-43-96-96-96zM64 216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 89.1 66.2 162.7 152 174.4V464H120c-13.3 0-24 10.7-24 24s10.7 24 24 24h72 72c13.3 0 24-10.7 24-24s-10.7-24-24-24H216V430.4c85.8-11.7 152-85.3 152-174.4V216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 70.7-57.3 128-128 128s-128-57.3-128-128V216z"/></svg>',

  dtmf: {
    // https://fontawesome.com/icons/1?s=solid&f=classic
    '1': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M160 64c0-11.8-6.5-22.6-16.9-28.2s-23-5-32.9 1.6l-96 64C-.5 111.2-4.4 131 5.4 145.8s29.7 18.7 44.4 8.9L96 123.8V416H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96 96c17.7 0 32-14.3 32-32s-14.3-32-32-32H160V64z"/></svg>',
    // https://fontawesome.com/icons/2?s=solid&f=classic
    '2': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M142.9 96c-21.5 0-42.2 8.5-57.4 23.8L54.6 150.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L40.2 74.5C67.5 47.3 104.4 32 142.9 32C223 32 288 97 288 177.1c0 38.5-15.3 75.4-42.5 102.6L109.3 416H288c17.7 0 32 14.3 32 32s-14.3 32-32 32H32c-12.9 0-24.6-7.8-29.6-19.8s-2.2-25.7 6.9-34.9L200.2 234.5c15.2-15.2 23.8-35.9 23.8-57.4c0-44.8-36.3-81.1-81.1-81.1z"/></svg>',
    // https://fontawesome.com/icons/3?s=solid&f=classic
    '3': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M64 64c0-17.7 14.3-32 32-32H336c13.2 0 25 8.1 29.8 20.4s1.5 26.3-8.2 35.2L226.3 208H248c75.1 0 136 60.9 136 136s-60.9 136-136 136H169.4c-42.4 0-81.2-24-100.2-61.9l-1.9-3.8c-7.9-15.8-1.5-35 14.3-42.9s35-1.5 42.9 14.3l1.9 3.8c8.1 16.3 24.8 26.5 42.9 26.5H248c39.8 0 72-32.2 72-72s-32.2-72-72-72H144c-13.2 0-25-8.1-29.8-20.4s-1.5-26.3 8.2-35.2L253.7 96H96C78.3 96 64 81.7 64 64z"/></svg>',
    // https://fontawesome.com/icons/4?s=solid&f=classic
    '4': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M189 77.6c7.5-16 .7-35.1-15.3-42.6s-35.1-.7-42.6 15.3L3 322.4c-4.7 9.9-3.9 21.5 1.9 30.8S21 368 32 368H256v80c0 17.7 14.3 32 32 32s32-14.3 32-32V368h32c17.7 0 32-14.3 32-32s-14.3-32-32-32H320V160c0-17.7-14.3-32-32-32s-32 14.3-32 32V304H82.4L189 77.6z"/></svg>',
    // https://fontawesome.com/icons/5?s=solid&f=classic
    '5': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M32.5 58.3C35.3 43.1 48.5 32 64 32H256c17.7 0 32 14.3 32 32s-14.3 32-32 32H90.7L70.3 208H184c75.1 0 136 60.9 136 136s-60.9 136-136 136H100.5c-39.4 0-75.4-22.3-93-57.5l-4.1-8.2c-7.9-15.8-1.5-35 14.3-42.9s35-1.5 42.9 14.3l4.1 8.2c6.8 13.6 20.6 22.1 35.8 22.1H184c39.8 0 72-32.2 72-72s-32.2-72-72-72H32c-9.5 0-18.5-4.2-24.6-11.5s-8.6-16.9-6.9-26.2l32-176z"/></svg>',
    // https://fontawesome.com/icons/6?s=solid&f=classic
    '6': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M232.4 84.7c11.4-13.5 9.7-33.7-3.8-45.1s-33.7-9.7-45.1 3.8L38.6 214.7C14.7 242.9 1.1 278.4 .1 315.2c0 1.4-.1 2.9-.1 4.3c0 .2 0 .3 0 .5c0 88.4 71.6 160 160 160s160-71.6 160-160c0-85.5-67.1-155.4-151.5-159.8l63.9-75.6zM64 320c0-53 43-96 96-96s96 43 96 96s-43 96-96 96s-96-43-96-96z"/></svg>',
    // https://fontawesome.com/icons/7?s=solid&f=classic
    '7': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M0 64C0 46.3 14.3 32 32 32H288c11.5 0 22 6.1 27.7 16.1s5.7 22.2-.1 32.1l-224 384c-8.9 15.3-28.5 20.4-43.8 11.5s-20.4-28.5-11.5-43.8L232.3 96H32C14.3 96 0 81.7 0 64z"/></svg>',
    // https://fontawesome.com/icons/8?s=solid&f=classic
    '8': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M304 160c0-70.7-57.3-128-128-128H144C73.3 32 16 89.3 16 160c0 34.6 13.7 66 36 89C20.5 272.3 0 309.8 0 352c0 70.7 57.3 128 128 128h64c70.7 0 128-57.3 128-128c0-42.2-20.5-79.7-52-103c22.3-23 36-54.4 36-89zM176.1 288H192c35.3 0 64 28.7 64 64s-28.7 64-64 64H128c-35.3 0-64-28.7-64-64s28.7-64 64-64h15.9c0 0 .1 0 .1 0h32c0 0 .1 0 .1 0zm0-64c0 0 0 0 0 0H144c0 0 0 0 0 0c-35.3 0-64-28.7-64-64c0-35.3 28.7-64 64-64h32c35.3 0 64 28.7 64 64c0 35.3-28.6 64-64 64z"/></svg>',
    // https://fontawesome.com/icons/9?s=solid&f=classic
    '9': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M64 192c0 53 43 96 96 96s96-43 96-96s-43-96-96-96s-96 43-96 96zm87.5 159.8C67.1 347.4 0 277.5 0 192C0 103.6 71.6 32 160 32s160 71.6 160 160c0 2.6-.1 5.3-.2 7.9c-1.7 35.7-15.2 70-38.4 97.4l-145 171.4c-11.4 13.5-31.6 15.2-45.1 3.8s-15.2-31.6-3.8-45.1l63.9-75.6z"/></svg>',
    // https://fontawesome.com/icons/0?s=solid&f=classic
    '0': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M0 192C0 103.6 71.6 32 160 32s160 71.6 160 160V320c0 88.4-71.6 160-160 160S0 408.4 0 320V192zM160 96c-53 0-96 43-96 96V320c0 53 43 96 96 96s96-43 96-96V192c0-53-43-96-96-96z"/></svg>',
    // https://fontawesome.com/icons/asterisk?s=solid&f=classic
    '*': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M192 32c17.7 0 32 14.3 32 32V199.5l111.5-66.9c15.2-9.1 34.8-4.2 43.9 11s4.2 34.8-11 43.9L254.2 256l114.3 68.6c15.2 9.1 20.1 28.7 11 43.9s-28.7 20.1-43.9 11L224 312.5V448c0 17.7-14.3 32-32 32s-32-14.3-32-32V312.5L48.5 379.4c-15.2 9.1-34.8 4.2-43.9-11s-4.2-34.8 11-43.9L129.8 256 15.5 187.4c-15.2-9.1-20.1-28.7-11-43.9s28.7-20.1 43.9-11L160 199.5V64c0-17.7 14.3-32 32-32z"/></svg>',
    // https://fontawesome.com/icons/hashtag?s=solid&f=classic
    '#': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M181.3 32.4c17.4 2.9 29.2 19.4 26.3 36.8L197.8 128h95.1l11.5-69.3c2.9-17.4 19.4-29.2 36.8-26.3s29.2 19.4 26.3 36.8L357.8 128H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H347.1L325.8 320H384c17.7 0 32 14.3 32 32s-14.3 32-32 32H315.1l-11.5 69.3c-2.9 17.4-19.4 29.2-36.8 26.3s-29.2-19.4-26.3-36.8l9.8-58.7H155.1l-11.5 69.3c-2.9 17.4-19.4 29.2-36.8 26.3s-29.2-19.4-26.3-36.8L90.2 384H32c-17.7 0-32-14.3-32-32s14.3-32 32-32h68.9l21.3-128H64c-17.7 0-32-14.3-32-32s14.3-32 32-32h68.9l11.5-69.3c2.9-17.4 19.4-29.2 36.8-26.3zM187.1 192L165.8 320h95.1l21.3-128H187.1z"/></svg>',
    // https://fontawesome.com/icons/a?s=solid&f=classic
    'A': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M253.5 51.7C248.6 39.8 236.9 32 224 32s-24.6 7.8-29.5 19.7l-120 288-40 96c-6.8 16.3 .9 35 17.2 41.8s35-.9 41.8-17.2L125.3 384H322.7l31.8 76.3c6.8 16.3 25.5 24 41.8 17.2s24-25.5 17.2-41.8l-40-96-120-288zM296 320H152l72-172.8L296 320z"/></svg>',
    // https://fontawesome.com/icons/b?s=solid&f=classic
    'B': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M32 32C14.3 32 0 46.3 0 64V256 448c0 17.7 14.3 32 32 32H192c70.7 0 128-57.3 128-128c0-46.5-24.8-87.3-62-109.7c18.7-22.3 30-51 30-82.3c0-70.7-57.3-128-128-128H32zM160 224H64V96h96c35.3 0 64 28.7 64 64s-28.7 64-64 64zM64 288h96 32c35.3 0 64 28.7 64 64s-28.7 64-64 64H64V288z"/></svg>',
    // https://fontawesome.com/icons/c?s=solid&f=classic
    'C': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M329.1 142.9c-62.5-62.5-155.8-62.5-218.3 0s-62.5 163.8 0 226.3s155.8 62.5 218.3 0c12.5-12.5 32.8-12.5 45.3 0s12.5 32.8 0 45.3c-87.5 87.5-221.3 87.5-308.8 0s-87.5-229.3 0-316.8s221.3-87.5 308.8 0c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0z"/></svg>',
    // https://fontawesome.com/icons/d?s=solid&f=classic
    'D': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M0 64C0 46.3 14.3 32 32 32H160c123.7 0 224 100.3 224 224s-100.3 224-224 224H32c-17.7 0-32-14.3-32-32V64zM64 96V416h96c88.4 0 160-71.6 160-160s-71.6-160-160-160H64z"/></svg>',
  } as { [key in Tone]: string }
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
  iceGatheringTimeout?: number
}

export interface AudioOptions {
  context?: AudioContext
  outputNode?: AudioNode
  codecFilter?: CodecFilter
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

export interface TelephonyOptions {
  sipHeaders?: HeaderList
  sipUriArguments?: UriArgumentList
}

export interface CallControlOptions {
  audio?: AudioOptions
  volume?: VolumeOptions
  timeout?: TimeoutOptions
  ui?: UiOptions
  telephony?: TelephonyOptions
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
    button.innerHTML = images.dtmf[tone.value]
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

export function enableMediaStreamAudioInChrome(stream: MediaStream) {
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
      .then(details => {
        const clientOptions = {
          timeout: options?.timeout?.register,
          sipUriArguments: options?.telephony?.sipUriArguments,
        }
        return setupSipClient(details, clientOptions)
      })
      .then(telephony => {
        const callTimeout = options?.timeout?.invite ?? DEFAULT_TIMEOUT
        const iceGatheringTimeout = options?.timeout?.iceGatheringTimeout ?? DEFAULT_ICE_GATHERING_TIMEOUT
        const headers = options?.telephony?.sipHeaders
        const createCallOptions: CreateCallOptions = {
          timeout: callTimeout,
          iceGatheringTimeout,
          extraHeaders: headers,
          codecFilter: options?.audio?.codecFilter,
        }
        return telephony.createCall(destination, createCallOptions)
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
      .catch(e => {
        reject(e)
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
