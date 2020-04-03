import { MINUTE } from '@beenotung/tslib/time';

export type CallType = 'query' | 'subscribe' | 'submit';

export type BaseRPCResponse<
  T extends object = object,
  E extends string = string
> =
  | {
      Success: true;
      Data: T;
    }
  | {
      Success: false;
      Reason: E;
    };

export function Fail<R extends string>(Reason: R): BaseRPCResponse<any, R> {
  return {
    Success: false,
    Reason,
  };
}

export function Success<T extends object>(Data: T): BaseRPCResponse<T, any> {
  return {
    Success: true,
    Data,
  };
}

export interface Call<
  Action extends string = string,
  Params extends any[] = any[],
  Response extends BaseRPCResponse<any, any> = any
> {
  Type: CallType;
  Action: Action;
  Params: Params;
  Response: Response;
}

export type CallInput<C extends Call = Call> = {
  Type: C['Type'];
  Action: C['Action'];
  Params: C['Params'];
};

export type CallSessionIn<C extends Call = Call> = {
  Seq: number;
  Call: CallInput<C>;
};
export type CallSessionOut<C extends Call = Call> = {
  Seq: number;
  Response: C['Response'];
};

// TODO add error handling
export type Callback<C extends Call> = (res: C['Response']) => void;

export type CallHandler<C extends Call> = (
  call: CallInput<C>,
  ack?: Callback<C>,
) => void;

export type StopCallback = (err?: any) => void;

export const DefaultClose = (cb: StopCallback) => cb();

export abstract class RPCServer<C extends Call = Call> {
  abstract type: string;
  abstract port: number;

  action_handlers = new Map<string, Array<CallHandler<C>>>();

  abstract listen(cb?: () => void): void;

  abstract close(cb?: (err?: any) => void): void;

  /**
   * for supplier (e.g. consensus and storage)
   * */
  registerHandler(action: C['Action'], handler: CallHandler<C>) {
    let handlers = this.action_handlers.get(action);
    if (!handlers) {
      handlers = [];
      this.action_handlers.set(action, handlers);
    }
    handlers.push(handler);
  }

  /**
   * for producer (e.g. from socket via internal networking)
   * */
  emit(call: CallInput<C>, cb?: Callback<C>) {
    const handlers = this.action_handlers.get(call.Action);
    if (!handlers || handlers.length === 0) {
      console.warn('emitted', call.Action, 'but not handler is registered');
      return;
    }
    handlers.forEach((handler) => handler(call, cb));
  }
}

export abstract class RPCClient {
  abstract type: string;

  abstract _init(server: string, cb?: () => void): void;

  init(server: string): Promise<void>;
  init(server: string, cb: () => void): void;
  init(server: string, cb?: () => void): void | Promise<void> {
    if (cb) {
      this._init(server, cb);
    } else {
      return new Promise((resolve, reject) => {
        try {
          this._init(server, resolve);
        } catch (e) {
          reject(e);
        }
      });
    }
  }

  abstract close(cb?: (err?: any) => void): void;

  abstract emit<C extends Call>(call: CallInput<C>, cb?: Callback<C>): void;

  /** for internal use */
  callAndWait<R extends BaseRPCResponse<any, any>>(
    call: CallInput<Call>,
  ): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      this.emit(call, (cb) => {
        resolve(cb);
      });
      // TODO timeout
      setTimeout(() => reject('TIMEOUT'), 1 * MINUTE);
    });
  }
}
