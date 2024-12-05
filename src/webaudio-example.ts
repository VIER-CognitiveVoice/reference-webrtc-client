import {
  CreateCallOptions,
  DEFAULT_ICE_GATHERING_TIMEOUT,
  fetchWebRtcAuthDetails,
  HeaderList,
  setupSipClient,
} from './client'
import {
  DEFAULT_TIMEOUT,
  enableMediaStreamAudioInChrome,
} from './controls'
import {
  concurrencyLimitedWorkQueue,
  getAndDisplayEnvironmentFromQuery,
  getCustomSipHeadersFromQuery,
  updateQueryParameter,
} from './common-example'

function preventDefault(e: Event): void {
  e.preventDefault()
}

class DroppedAudioFile {
  readonly name: string
  readonly type: string
  readonly hash: string
  channel: number
  readonly content: ArrayBuffer


  constructor(name: string, type: string, hash: string, content: ArrayBuffer) {
    this.name = name
    this.type = type
    this.hash = hash
    this.channel = 0
    this.content = content
  }

  decode(audioContext: AudioContext): Promise<DecodedAudioFile> {
    return audioContext.decodeAudioData(this.content).then(buf => {
      if (this.channel < 0) {
        throw Error("Invalid channel selection! (negative)")
      }
      if (this.channel >= buf.numberOfChannels) {
        alert(`File ${this.name} had channel ${this.channel} selected, but there are only ${buf.numberOfChannels} channels available!`)
        throw Error("Invalid channel selection! (channel unavailable)")
      }
      return new DecodedAudioFile(this.name, this.type, this.hash, Math.floor(this.channel), buf)
    })
  }
}

class DecodedAudioFile {
  readonly name: string
  readonly type: string
  readonly hash: string
  readonly channel: number
  readonly audio: AudioBuffer

  constructor(name: string, type: string, hash: string, channel: number, audio: AudioBuffer) {
    this.name = name
    this.type = type
    this.hash = hash
    this.channel = channel
    this.audio = audio
  }

  toString() {
    return `DecodedAudioFile(name=${this.name}, type=${this.type}, hash=${this.hash}, channel=${this.channel}, audio=${this.audio.duration})`
  }
}


function performCall(
  environment: string,
  resellerToken: string,
  destination: string,
  extraCustomSipHeaders: HeaderList,
  audioContext: AudioContext,
  file: DecodedAudioFile,
): Promise<DecodedAudioFile> {
  const audioGap = 2000
  return new Promise((resolve, reject) => {
    fetchWebRtcAuthDetails(environment, resellerToken)
      .then(details => setupSipClient(details))
      .then(telephony => {
        const headers: HeaderList = [
          ...extraCustomSipHeaders,
          ["x-filename", file.name],
          ["x-channel", `${file.channel}`],
        ]
        const localAudio = audioContext.createBufferSource()
        localAudio.buffer = file.audio
        const channelSplitter = audioContext.createChannelSplitter(localAudio.channelCount)
        localAudio.connect(channelSplitter)
        const virtualMic = audioContext.createMediaStreamDestination()
        channelSplitter.connect(virtualMic, file.channel);
        const options: CreateCallOptions = {
          timeout: DEFAULT_TIMEOUT,
          iceGatheringTimeout: DEFAULT_ICE_GATHERING_TIMEOUT,
          extraHeaders: headers,
          mediaStream: virtualMic.stream,
        }
        return telephony.createCall(destination, options)
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

            callApi.callCompletion.then(() => resolve(file), reject)
          })
          .catch(e => {
            console.error('call failed', e)
            telephony.disconnect()
            reject(e)
          })
      })
      .catch(e => {
        console.error('SIP setup failed', e)
        reject(e)
      })
  })
}

function performAllCalls(
  environment: string,
  resellerToken: string,
  destination: string,
  extraCustomSipHeaders: HeaderList,
  audioContext: AudioContext,
  files: Array<DecodedAudioFile>,
  maxParallelism: number,
): Promise<[Array<DecodedAudioFile>, Array<[DecodedAudioFile, any]>]> {
  const completed: Array<DecodedAudioFile> = []
  const failed: Array<[DecodedAudioFile, any]> = []
  const workQueue = concurrencyLimitedWorkQueue<void>(maxParallelism)
  for (let file of files) {
    workQueue.submit(() => {
      return performCall(environment, resellerToken, destination, extraCustomSipHeaders, audioContext, file)
        .then(() => {
          console.info(`Call completed for: ${file.toString()}`)
          completed.push(file)
        })
        .catch(e => {
          console.info(`Call failed for: ${file.toString()}`, e)
          failed.push([file, e])
        })
    })
  }

  return workQueue.awaitEmpty().then(() => {
    return [completed, failed]
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

function renderFile(container: HTMLDivElement, seq: number, file: DroppedAudioFile) {
  const div = document.createElement('div')
  div.classList.add('file')

  const name = document.createElement('div')
  name.innerText = file.name
  name.title = `sha1: ${file.hash}`
  div.appendChild(name)

  const channelSelector = document.createElement('div')
  channelSelector.classList.add('channel-selector')
  const channelSelectorLabel = document.createElement('span')
  channelSelectorLabel.innerText = 'CH'
  channelSelectorLabel.title = 'Channel Selection'
  channelSelector.appendChild(channelSelectorLabel)
  const channelSelectorInput = document.createElement('input')
  channelSelectorInput.type = 'number'
  channelSelectorInput.min = '0'
  channelSelectorInput.max = '100'
  channelSelectorInput.step = '1'
  channelSelectorInput.value = '0'
  channelSelectorInput.addEventListener('change', () => {
    const value = Number(channelSelectorInput.value)
    if (!Number.isNaN(value)) {
      file.channel = value
    }
  })
  channelSelector.appendChild(channelSelectorInput)
  div.appendChild(channelSelector)

  container.appendChild(div)
}

window.addEventListener('dragleave', preventDefault, false)
window.addEventListener('dragover', preventDefault, false)
window.addEventListener('drop', preventDefault, false)

window.addEventListener('DOMContentLoaded', () => {
  const environment = getAndDisplayEnvironmentFromQuery()
  const customSipHeaders = getCustomSipHeadersFromQuery()

  const query = new URLSearchParams(location.search)
  document.querySelectorAll<HTMLInputElement>('input[name]').forEach(element => {
    const key = `form.${element.name}`
    const queryValue = query.get(element.name)
    const existingValue = localStorage.getItem(key)
    element.addEventListener('change', () => {
      localStorage.setItem(key, element.value)
      updateQueryParameter(element.name, element.value)
    })
    if (queryValue) {
      element.value = queryValue
    } else if (existingValue) {
      element.value = existingValue
      updateQueryParameter(element.name, existingValue)
    }
  })

  const dropZone = document.getElementById('audio-drop-zone')!
  const filesContainer = document.getElementById('files')! as HTMLDivElement
  const startCallsButton = document.getElementById('start-calls')! as HTMLButtonElement

  const droppingClass = 'dropping'
  let fileSequenceNumber = 0
  const audioFiles = new Map<number, DroppedAudioFile>()

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
          const seq = fileSequenceNumber++
          audioFiles.set(seq, file)
          renderFile(filesContainer, seq, file)
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

    const resellerToken = document.querySelector<HTMLInputElement>("input#reseller-token")!!.value
    const destination = document.querySelector<HTMLInputElement>("input#destination")!!.value

    Promise.all(decodedAudioPromises)
      .then(audioFiles => {
        return performAllCalls(
          environment,
          resellerToken,
          destination,
          customSipHeaders,
          audioContext,
          audioFiles,
          5,
        )
      })
      .then(([completed, failed]) => {
        if (failed.length === 0) {
          window.alert(`All ${completed.length} calls have been performed successfully!`)
        } else if (completed.length === 0) {
          window.alert(`All ${failed.length} calls failed!`)
        } else {
          window.alert(`All ${completed.length + failed.length} calls have been performed, but ${failed.length} failed!`)
        }
      })
  })

})