import {
  DEFAULT_ICE_GATHERING_TIMEOUT,
  fetchWebRtcAuthDetails,
  HeaderList,
  setupSipClient,
} from './client'
import {
  DEFAULT_TIMEOUT,
  enableMediaStreamAudioInChrome,
} from './controls'

function preventDefault(e: Event): void {
  e.preventDefault()
}

class DroppedAudioFile {
  readonly name: string
  readonly type: string
  readonly hash: string
  readonly content: ArrayBuffer


  constructor(name: string, type: string, hash: string, content: ArrayBuffer) {
    this.name = name
    this.type = type
    this.hash = hash
    this.content = content
  }

  decode(audioContext: AudioContext): Promise<DecodedAudioFile> {
    return audioContext.decodeAudioData(this.content).then(buf => {
      return new DecodedAudioFile(this.name, this.type, this.hash, buf)
    })
  }
}

class DecodedAudioFile {
  readonly name: string
  readonly type: string
  readonly hash: string
  readonly audio: AudioBuffer


  constructor(name: string, type: string, hash: string, audio: AudioBuffer) {
    this.name = name
    this.type = type
    this.hash = hash
    this.audio = audio
  }
}


function startCall(environment: string, resellerToken: string, destination: string, audioContext: AudioContext, file: DecodedAudioFile) {
  const audioGap = 2000
  fetchWebRtcAuthDetails(environment, resellerToken)
    .then(details => setupSipClient(details, DEFAULT_TIMEOUT))
    .then(telephony => {
      const headers: HeaderList = [["x-filename", file.name]]
      const localAudio = audioContext.createBufferSource()
      localAudio.buffer = file.audio
      const virtualMic = audioContext.createMediaStreamDestination()
      localAudio.connect(virtualMic)
      return telephony.call(destination, DEFAULT_TIMEOUT, DEFAULT_ICE_GATHERING_TIMEOUT, headers, virtualMic.stream)
        .then(callApi => {
          enableMediaStreamAudioInChrome(callApi.media)
          const remoteAudio = audioContext.createMediaStreamSource(callApi.media)
          remoteAudio.connect(audioContext.destination)

          setTimeout(() => {
            localAudio.addEventListener('ended', () => {
              setTimeout(() => {
                callApi.drop()
              }, audioGap)
            })
            localAudio.start()
          }, audioGap)

          callApi.media
        })
        .catch(e => {
          console.error('call failed', e)
          telephony.disconnect()
        })
    })
    .catch(e => {
      console.error('SIP setup failed', e)
    })
}

function filesDropped(files: FileList): Promise<Array<DroppedAudioFile>> {
  console.log('files', files)
  const gatheringFiles: Array<Promise<Array<DroppedAudioFile>>> = []
  for (let i = 0; i < files.length; ++i) {
    const file = files.item(i)
    if (file) {
      const name = file.name
      const type = file.type
      if (type.startsWith('audio/')) {
        const promise = file.arrayBuffer()
          .then(buf => {
            return crypto.subtle.digest('SHA-1', buf).then(hashBuf => {
              const hash = Array.from(new Uint8Array(hashBuf))
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('')
              return [new DroppedAudioFile(name, type, hash, buf)]
            })
          })
          .catch(e => {
            console.warn(`Failed to load and decode file ${name} (${type})!`, e)
            return []
          })

        gatheringFiles.push(promise)
      } else {
        console.warn(`Ignoring file ${name}, because type ${type} is not supported!`)
      }
    }
  }

  return Promise.all(gatheringFiles).then(arrays => arrays.reduce((a, b) => a.concat(b)))
}

function renderFile(container: HTMLDivElement, file: DroppedAudioFile) {
  const div = document.createElement('div')
  div.classList.add('file')
  div.title = `sha1: ${file.hash}`

  const name = document.createElement('div')
  name.innerText = file.name
  div.appendChild(name)

  const type = document.createElement('div')
  type.innerText = file.type
  div.appendChild(type)

  const size = document.createElement('div')
  size.innerText = `${file.content.byteLength} bytes`
  div.appendChild(size)

  container.appendChild(div)
}

window.addEventListener('dragleave', preventDefault, false)
window.addEventListener('dragover', preventDefault, false)
window.addEventListener('drop', preventDefault, false)

window.addEventListener('DOMContentLoaded', () => {

  const query = new URLSearchParams(location.search)
  document.querySelectorAll<HTMLInputElement>('input[name]').forEach(element => {
    const key = `form.${element.name}`
    const queryValue = query.get(element.name)
    const existingValue = localStorage.getItem(key)
    element.addEventListener('change', () => {
      localStorage.setItem(key, element.value)
    })
    if (existingValue) {
      element.value = existingValue
    } else if (queryValue) {
      element.value = queryValue
      localStorage.setItem(key, queryValue)
    }
  })

  const dropZone = document.getElementById('audio-drop-zone')!
  const filesContainer = document.getElementById('files')! as HTMLDivElement
  const startCallsButton = document.getElementById('start-calls')! as HTMLButtonElement

  const droppingClass = 'dropping'
  const audioFiles: Map<string, DroppedAudioFile> = new Map<string, DroppedAudioFile>()

  dropZone.addEventListener('dragover', () => {
    dropZone.classList.add(droppingClass)
  }, false)

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove(droppingClass)
  }, false)

  dropZone.addEventListener('drop', e => {
    dropZone.classList.remove(droppingClass)
    console.log('dropped!', e)
    const transfer = e.dataTransfer
    if (transfer != null) {
      filesDropped(transfer.files).then(files => {
        console.log("gathered files", files)
        for (let file of files) {
          if (audioFiles.has(file.hash)) {
            console.warn(`Ignoring duplicated file ${file.name} (sha1: ${file.hash})`)
            continue
          }
          audioFiles.set(file.hash, file)
          renderFile(filesContainer, file)
        }
      })
    }
  }, false)

  startCallsButton.addEventListener('click', e => {
    e.preventDefault()
    if (audioFiles.size === 0) {
      alert('Drag in some files first!')
      return
    }

    const audioContext = new AudioContext()

    const decodedAudioPromises: Array<Promise<DecodedAudioFile>> = []
    for (let value of audioFiles.values()) {
      decodedAudioPromises.push(value.decode(audioContext))
    }

    audioFiles.clear()
    filesContainer.innerHTML = ''

    const environment = localStorage.getItem("form.environment")!!
    const resellerToken = localStorage.getItem("form.reseller-token")!!
    const destination = localStorage.getItem("form.destination")!!

    Promise.all(decodedAudioPromises).then(audioFiles => {
      for (let audioFile of audioFiles) {
        startCall(environment, resellerToken, destination, audioContext, audioFile)
      }
    })
  })

})