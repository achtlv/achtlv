// errors.js
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const fail = (status, message, code) => {
  throw new HttpError(status, message, code);
};

export const err = (code, message) => fail(400, message, code);