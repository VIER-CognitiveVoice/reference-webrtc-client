
export function getEnvironment() {
  const query = new URLSearchParams(location.search)
  const environment = query.get('environment') ?? 'https://cognitivevoice.io'
  const environmentField = document.querySelector<HTMLInputElement>('input#environment')
  if (environmentField) {
    environmentField.value = environment
  }
  return environment
}