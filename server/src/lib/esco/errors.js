export class EscoImportError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'EscoImportError';
    this.details = details;
    this.code = details.code ?? 'ESCO_IMPORT';
  }
}
