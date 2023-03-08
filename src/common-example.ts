import { HeaderList } from './client'

export function getAndDisplayEnvironmentFromQuery(): string {
  const query = new URLSearchParams(location.search)
  const environment = query.get('environment') ?? 'https://cognitivevoice.io'
  const environmentField = document.querySelector<HTMLInputElement>('input#environment')
  if (environmentField) {
    environmentField.value = environment
  }
  return environment
}

export function updateQueryParameter(name: string, value: string): void {
  const url = new URL(document.location.href)
  url.searchParams.set(name, value)
  history.pushState(undefined, "", url)
}

export function getCustomSipHeadersFromQuery(): HeaderList {
  const query = new URLSearchParams(location.search)
  const headerList: HeaderList = []
  for (let [name, value] of query) {
    if (name.toLowerCase().startsWith("x-")) {
      headerList.push([name, value])
    }
  }
  return headerList;
}