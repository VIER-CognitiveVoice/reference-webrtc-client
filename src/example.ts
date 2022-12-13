import {
  CallApi,
} from "./client"
import {
  CallControlOptions,
  triggerControls,
} from "./controls"

window.addEventListener('DOMContentLoaded', () => {
  const query = new URLSearchParams(location.search)
  const form = document.querySelector<HTMLFormElement>('form')
  if (!form) {
    console.error('Form not found!')
    return
  }
  const submitButton = form.querySelector<HTMLButtonElement>('button[type=submit]')
  if (!submitButton) {
    console.error('Submit button not found in form!')
    return
  }
  const submitButtonText = submitButton.innerText

  let currentCall: CallApi | null = null

  window.addEventListener('beforeunload', () => {
    if (currentCall) {
      currentCall.drop()
    }
  })

  form.querySelectorAll<HTMLInputElement>('input[name]').forEach(element => {
    const key = `form.${element.name}`
    const queryValue = query.get(element.name)
    const existingValue = localStorage.getItem(key)
    if (existingValue) {
      element.value = existingValue
    } else if (queryValue) {
      element.value = queryValue
      localStorage.setItem(key, queryValue)
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

    const options: CallControlOptions = {
      volume: {
        dtmfVolume: 0.4,
      },
    }
    triggerControls(submitButton, environment, resellerToken, destination, options)
      .then(async (callApi) => {
        currentCall = callApi
        console.log("Call was accepted!", callApi)
        submitButton.innerHTML = 'Connected'
        callApi.callCompletion.then(() => {
          currentCall = null
          submitButton.innerText = submitButtonText
          submitButton.disabled = false
        })
      }, (reason) => {
        submitButton.innerText = submitButtonText
        submitButton.disabled = false
        console.log("Call failed", reason)
      })
  })
})