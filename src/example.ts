import { CallApi, fetchWebRtcAuthDetails, setupSipClient } from "./client";


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
    const key = `form.${element.name}`;
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
            callApi.callCompletion.then(() => {
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