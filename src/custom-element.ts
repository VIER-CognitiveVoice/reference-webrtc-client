import {
  CallControlOptions,
  DarkMode,
  triggerControls,
} from './controls'
import { CallApi } from './client'
import css from './webcomponent.css'

export const ELEMENT_NAME = 'cvg-webrtc-button'

export class CvgWebRtcButton extends HTMLElement {

  static get observedAttributes() {
    return ['environment', 'reseller-token', 'destination', 'dtmf-volume', 'dark-mode']
  }

  private currentCall: CallApi | undefined = undefined
  private readonly buttonContainer: HTMLDivElement
  private readonly button: HTMLButtonElement
  private connected: boolean = false

  constructor() {
    super()

    const shadow = this.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.innerHTML = css
    shadow.appendChild(style)

    this.buttonContainer = document.createElement('div')
    this.buttonContainer.classList.add('button-container')
    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.innerText = 'Call'
    this.buttonContainer.appendChild(this.button)
    this.button.addEventListener('click', this.onButtonClicked.bind(this))
    shadow.appendChild(this.buttonContainer)
  }

  private onButtonClicked() {
    if (this.currentCall) {
      return
    }

    const environment = this.getAttribute('environment') || 'https://cognitivevoice.io'
    const resellerToken = this.getAttribute('reseller-token')
    if (!resellerToken) {
      console.error('No reseller-token given!')
      return
    }
    const destination = this.getAttribute('destination')
    if (!destination) {
      console.error('No destination given!')
      return
    }

    const dtmfVolume = this.getAttribute('volume-dtmf') || '0'

    let darkMode: DarkMode | undefined = undefined
    switch (this.getAttribute('dark-mode')) {
      case 'yes':
        darkMode = 'yes'
        break;
      case 'no':
        darkMode = 'no'
        break;
      case 'auto':
        darkMode = 'auto'
        break;
    }

    const options: CallControlOptions = {
      ui: {
        anchor: this.buttonContainer,
        position: {
          side: 'right',
          distance: [5, -5],
        },
        dark: darkMode,
      },
      volume: {
        dtmfVolume: Number(dtmfVolume)
      }
    }
    this.button.disabled = true
    triggerControls(environment, resellerToken, destination, options)
      .then(async (callApi) => {
        this.currentCall = callApi
        console.log('Call was accepted!', callApi)
        callApi.callCompletion.then(() => {
          this.currentCall = undefined
          this.button.disabled = false
        })
      }, (reason) => {
        this.button.disabled = false
        console.log('Call failed', reason)
      })
  }

  connectedCallback() {
    this.button.innerHTML = this.innerHTML
    this.connected = true
  }

  disconnectedCallback() {
    this.button.innerHTML = ''
    this.connected = false

    if (this.currentCall) {
      this.currentCall.drop()
    }
  }

  trigger() {
    this.onButtonClicked()
  }
}