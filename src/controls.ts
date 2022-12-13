import {
  CallApi,
  Tone,
} from "./client"

function createButton(): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  return button
}

function generateDtmfControls(onDtmf: (tone: Tone) => void): HTMLDivElement {
  const container = document.createElement('div')
  container.classList.add('dtmf-controls')

  const tones = [
    Tone.ONE, Tone.TWO, Tone.THREE, Tone.A,
    Tone.FOUR, Tone.FIVE, Tone.SIX, Tone.B,
    Tone.SEVEN, Tone.EIGHT, Tone.NINE, Tone.C,
    Tone.STAR, Tone.ZERO, Tone.POUND, Tone.D,
  ]
  for (let value of tones) {
    const button = createButton()
    button.innerText = value
    button.dataset.dtmf = value
    button.addEventListener('click', () => {
      onDtmf(value)
    })
    container.appendChild(button)
  }

  return container
}

function dtmfPlayer(volume: number): (tone: Tone) => void {

  const audioContext = new AudioContext({
    latencyHint: "interactive",
  })

  const gain = audioContext.createGain()
  gain.gain.value = 0
  gain.connect(audioContext.destination)
  const oscillatorVertical = audioContext.createOscillator()
  oscillatorVertical.connect(gain)
  oscillatorVertical.start()
  const oscillatorHorizontal = audioContext.createOscillator()
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

  let tonePlaybackTimeout: number | null = null

  return function playTone(tone: Tone) {
    if (tonePlaybackTimeout !== null) {
      clearTimeout(tonePlaybackTimeout)
      gain.gain.value = 0;
    }
    const [vertical, horizontal] = toneToFrequency[tone]
    oscillatorVertical.frequency.value = vertical
    oscillatorHorizontal.frequency.value = horizontal

    gain.gain.value = volume
    tonePlaybackTimeout = window.setTimeout(() => {
      gain.gain.value = 0
    }, 200)
  }
}

export function generateCallControls(callApi: CallApi, dtmfVolume: number = 0): HTMLDivElement {
  const container = document.createElement('div')
  container.classList.add('call-controls')

  const playTone = dtmfVolume > 0 ? dtmfPlayer(dtmfVolume) : () => {}

  const dtmfContainer = generateDtmfControls(tone => {
    callApi.sendTone(tone)
    playTone(tone)
  })
  container.appendChild(dtmfContainer)

  const callControlsContainer = document.createElement('div')

  const dropButton = createButton()
  dropButton.innerText = 'Drop'
  dropButton.addEventListener('click', () => {
    callApi.drop()
  })
  callControlsContainer.appendChild(dropButton)

  const muteButton = createButton()
  muteButton.innerText = 'Mute'
  muteButton.addEventListener('click', () => {
    const isMuted = !!muteButton.dataset.muted
    if (isMuted) {
      muteButton.innerText = 'Unmute'
      muteButton.dataset.muted = 'yes'
    } else {
      muteButton.innerText = 'Mute'
      delete muteButton.dataset.muted
    }
  })
  callControlsContainer.appendChild(muteButton)

  container.appendChild(callControlsContainer)

  return container
}