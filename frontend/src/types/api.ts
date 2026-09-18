export type ApiResult<TSuccess = object, TFailure = object> =
  | ({ ok: true; message: string } & TSuccess)
  | ({ ok: false; message: string } & TFailure);
