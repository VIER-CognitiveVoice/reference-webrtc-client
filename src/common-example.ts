
export function getAndDisplayEnvironment(): string {
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