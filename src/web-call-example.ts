import {
  AttributeValidationFailedEvent,
  CallEndedEvent,
  CvgWebRtcButton,
  ELEMENT_NAME,
} from './custom-element'
import {
  getAndDisplayEnvironmentFromQuery,
  getCustomSipHeadersFromQuery,
  updateQueryParameter,
} from './common-example'

const images = {
  // https://fontawesome.com/icons/phone?s=solid&f=classic
  newCall: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M164.9 24.6c-7.7-18.6-28-28.5-47.4-23.2l-88 24C12.1 30.2 0 46 0 64C0 311.4 200.6 512 448 512c18 0 33.8-12.1 38.6-29.5l24-88c5.3-19.4-4.6-39.7-23.2-47.4l-96-40c-16.3-6.8-35.2-2.1-46.3 11.6L304.7 368C234.3 334.7 177.3 277.7 144 207.3L193.3 167c13.7-11.2 18.4-30 11.6-46.3l-40-96z"/></svg>',
  // https://fontawesome.com/icons/phone-volume?s=solid&f=classic
  endCall: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!--! Font Awesome Pro 6.2.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path d="M280 0C408.1 0 512 103.9 512 232c0 13.3-10.7 24-24 24s-24-10.7-24-24c0-101.6-82.4-184-184-184c-13.3 0-24-10.7-24-24s10.7-24 24-24zm8 192a32 32 0 1 1 0 64 32 32 0 1 1 0-64zm-32-72c0-13.3 10.7-24 24-24c75.1 0 136 60.9 136 136c0 13.3-10.7 24-24 24s-24-10.7-24-24c0-48.6-39.4-88-88-88c-13.3 0-24-10.7-24-24zM117.5 1.4c19.4-5.3 39.7 4.6 47.4 23.2l40 96c6.8 16.3 2.1 35.2-11.6 46.3L144 207.3c33.3 70.4 90.3 127.4 160.7 160.7L345 318.7c11.2-13.7 30-18.4 46.3-11.6l96 40c18.6 7.7 28.5 28 23.2 47.4l-24 88C481.8 499.9 466 512 448 512C200.6 512 0 311.4 0 64C0 46 12.1 30.2 29.5 25.4l88-24z"/></svg>'
}

window.addEventListener('DOMContentLoaded', () => {
  const query = new URLSearchParams(location.search)
  const form = document.querySelector<HTMLFormElement>('form')
  if (!form) {
    console.error('Form not found!')
    return
  }
  const connectButton = form.querySelector<CvgWebRtcButton>(ELEMENT_NAME)
  if (!connectButton) {
    console.error('WebRtc button not found in form!')
    return
  }
  connectButton.innerHTML = images.newCall

  connectButton.addEventListener('new_call', () => {
    connectButton.innerHTML = images.endCall
  })

  connectButton.addEventListener('call_ended', (e: CallEndedEvent) => {
    connectButton.innerHTML = images.newCall
    if (e.detail !== null) {
      window.alert('The call failed to establish, check the browser console for details!')
      console.error('call failed', e.detail)
    }
  })

  connectButton.addEventListener('attribute_validation_failed', (e: AttributeValidationFailedEvent) => {
    switch (e.detail.attributeName) {
      case 'reseller-token':
        window.alert('You have to provide a reseller token in the form above!')
        break;
      case 'destination':
        window.alert('You have to provide a call destination token in the form above!')
        break;
    }
  })

  connectButton.setAttribute('environment', getAndDisplayEnvironmentFromQuery())
  const forceCodec = query.get('force-codec')
  if (forceCodec) {
    connectButton.setAttribute('force-codec', forceCodec)
  }
  for (let [name, value] of getCustomSipHeadersFromQuery()) {
    connectButton.setAttribute(name, value)
  }

  form.querySelectorAll<HTMLInputElement>('input[name]').forEach(element => {
    const key = `form.${element.name}`
    const queryValue = query.get(element.name)
    const existingValue = localStorage.getItem(key)
    element.addEventListener('change', () => {
      localStorage.setItem(key, element.value)
      connectButton.setAttribute(element.name, element.value)
      updateQueryParameter(element.name, element.value)
    })
    if (queryValue) {
      element.value = queryValue
    } else if (existingValue) {
      element.value = existingValue
      updateQueryParameter(element.name, existingValue)
    }
    connectButton.setAttribute(element.name, element.value)
  })
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    connectButton.trigger()
  })
})