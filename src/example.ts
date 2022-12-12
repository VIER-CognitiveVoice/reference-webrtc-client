import {
  CallApi,
  fetchWebRtcAuthDetails,
  setupSipClient,
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
    Tone.ONE,   Tone.TWO,   Tone.THREE, Tone.A,
    Tone.FOUR,  Tone.FIVE,  Tone.SIX,   Tone.B,
    Tone.SEVEN, Tone.EIGHT, Tone.NINE,  Tone.C,
    Tone.STAR,  Tone.ZERO,  Tone.POUND, Tone.D,
  ]
  for (let value of tones) {
    const button = createButton()
    button.innerText = value
    button.dataset.dtmf = value
    button.addEventListener('click', () => {
      onDtmf(value)
    });
    container.appendChild(button)
  }

  return container
}

function generateCallControls(callApi: CallApi): HTMLDivElement {
  const container = document.createElement('div')
  container.classList.add('call-controls')

  const dtmfContainer = generateDtmfControls(tone => {
    callApi.sendTone(tone)
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

  return container;
}

window.addEventListener('DOMContentLoaded', () => {
  const audio = document.querySelector('audio')
  const form = document.querySelector<HTMLFormElement>('form')
  if (!audio || !form) {
    return
  }
  const submitButton = form.querySelector<HTMLButtonElement>('button[type=submit]')
  if (!submitButton) {
    return
  }
  const submitButtonText = submitButton.innerText

  form.querySelectorAll<HTMLInputElement>('input[name]').forEach(element => {
    const key = `form.${element.name}`
    const existingValue = localStorage.getItem(key)
    if (existingValue) {
      element.value = existingValue
    }
    element.addEventListener('change', () => {
      localStorage.setItem(key, element.value)
    })
  })
  form.addEventListener('submit', (e) => {
    e.preventDefault()

    const environment = localStorage.getItem('form.environment')
    const resellerToken = localStorage.getItem('form.reseller-token')
    const destination = localStorage.getItem('form.destination')

    if (!environment || !resellerToken || !destination) {
      return
    }

    submitButton.innerText = 'Connecting...'
    submitButton.disabled = true
    let currentCall: CallApi | null = null
    fetchWebRtcAuthDetails(environment, resellerToken)
      .then(details => setupSipClient(details, 10000))
      .then(async (sipApi) => {
        sipApi.call(destination, 45000).then(
          async (callApi) => {
            currentCall = callApi
            console.log("Call was accepted!", callApi)
            audio.srcObject = callApi.media
            await audio.play()
            submitButton.innerHTML = 'Connected'
            const controls = generateCallControls(callApi)
            document.body.appendChild(controls)
            callApi.callCompletion.then(() => {
              document.body.removeChild(controls)
              currentCall = null
              submitButton.innerText = submitButtonText
              submitButton.disabled = false
            })
          }, (reason) => {
            submitButton.innerText = submitButtonText
            submitButton.disabled = false
            audio.srcObject = null
            console.log("Call failed", reason)
            sipApi.disconnect()
          })
      })
    window.addEventListener('beforeunload', () => {
      if (currentCall) {
        currentCall.drop()
      }
    })
  })
})