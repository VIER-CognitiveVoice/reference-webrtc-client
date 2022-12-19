import {
  CvgWebRtcButton,
  ELEMENT_NAME,
} from './custom-element'

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

  form.querySelectorAll<HTMLInputElement>('input[name]').forEach(element => {
    const key = `form.${element.name}`
    const queryValue = query.get(element.name)
    const existingValue = localStorage.getItem(key)
    element.addEventListener('change', () => {
      localStorage.setItem(key, element.value)
      connectButton.setAttribute(element.name, element.value)
    })
    if (existingValue) {
      element.value = existingValue
    } else if (queryValue) {
      element.value = queryValue
      localStorage.setItem(key, queryValue)
    }
    connectButton.setAttribute(element.name, element.value)
  })
  form.addEventListener('submit', (e) => {
    e.preventDefault()
  })
})