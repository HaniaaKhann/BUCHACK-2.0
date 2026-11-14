export function outletSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function outletPhotoPath(name: string): string {
  return `/outlets/${outletSlug(name)}.jpg`;
}
